// Backfill the weekly question draws (decision 0043): every PredictionLog SEED#<week>/COMMIT row becomes a `commit` line and every
// SAMPLE#<week>/DRAW row (with the SEED#<week>/REVEAL seed) a `draw` line in the draws inbox, in the shape the resolver writes
// (resolver inbox.js commitLine / drawLine), so newsStoryRecord turns them into question_commit / question_draw facts. PredictionLog is
// read only. A week whose SECRET exists but has no REVEAL yet is a commit only. A re-run appends nothing (same sourceKey).
//
//   node backfill-question-draws.mjs [--dry] [--live] [--table T] [--bucket B]
//   default writes under record/shadow/inbox/draws/; --live writes record/inbox/draws/. SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const { commitLine, drawLine } = require('../../predictions/newsPredictionResolver/src/inbox.js');

const dayOf = (iso) => String(iso).slice(0, 10);

/** Pure: PredictionLog rows ({PK, SK, ...} of SEED#* and SAMPLE#*) -> {lines: [{day, line}], skipped}. */
export function planQuestionDraws(rows) {
  const by = (pk, sk) => new Map(rows.filter((r) => r.SK === sk && String(r.PK).startsWith(pk)).map((r) => [r.PK.slice(pk.length), r]));
  const commits = by('SEED#', 'COMMIT');
  const reveals = by('SEED#', 'REVEAL');
  const draws = by('SAMPLE#', 'DRAW');
  const lines = [];
  const skipped = [];
  for (const [weekId, c] of [...commits].sort(([a], [b]) => a.localeCompare(b))) {
    if (!c.committedAt || !c.commitHash) { skipped.push({ weekId, why: 'commit row incomplete' }); continue; }
    lines.push({ day: dayOf(c.committedAt), line: { schemaVersion: 1, type: 'commit', ...commitLine(c), sourceKey: `backfill:draws/commit|${weekId}` } });
  }
  for (const [weekId, d] of [...draws].sort(([a], [b]) => a.localeCompare(b))) {
    if (!d.drawnAt || !Array.isArray(d.picked)) { skipped.push({ weekId, why: 'draw row incomplete' }); continue; }
    lines.push({ day: dayOf(d.drawnAt), line: { schemaVersion: 1, type: 'draw', ...drawLine(d, reveals.get(weekId)?.seedHex), sourceKey: `backfill:draws/draw|${weekId}` } });
  }
  return { lines, skipped, commits: commits.size, draws: draws.size, reveals: reveals.size };
}

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, dry: { type: 'boolean' }, table: { type: 'string' }, bucket: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const table = values.table || process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
  const prefix = values.live ? 'record/' : 'record/shadow/';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const rows = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({
      TableName: table, ExclusiveStartKey,
      FilterExpression: '(begins_with(PK, :s) AND SK IN (:c, :r)) OR (begins_with(PK, :d) AND SK = :w)',
      ExpressionAttributeValues: { ':s': 'SEED#', ':c': 'COMMIT', ':r': 'REVEAL', ':d': 'SAMPLE#', ':w': 'DRAW' },
    }));
    rows.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const plan = planQuestionDraws(rows);
  let appended = 0;
  const days = [...new Set(plan.lines.map((l) => l.day))].sort();
  if (!values.dry) {
    for (const day of days) {
      const r = await s3json.appendLines(`${prefix}inbox/draws/${day}.jsonl`, plan.lines.filter((l) => l.day === day).map((l) => l.line), { idKey: 'sourceKey' });
      appended += r.appended;
    }
  }
  console.log(JSON.stringify({ prefix, dry: Boolean(values.dry), rows: rows.length, commits: plan.commits, reveals: plan.reveals, draws: plan.draws, lines: plan.lines.length, days: days.length, appended, skipped: plan.skipped.length }));
  for (const s of plan.skipped) console.log('skipped', JSON.stringify(s));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
