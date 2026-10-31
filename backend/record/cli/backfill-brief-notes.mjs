// Backfill brief notes (decision 0048): every DAILY_BRIEF# / DAILY_BRIEF row becomes a `daily_brief` note and every WEEKLY_BRIEF# /
// WEEKLY_BRIEF row a `weekly_brief` note (draft rows too: the views serve published ones only), through the same builders the
// writers use (shared notes.js). The note's `at` is the row's own generatedAt and its model the row's, so a row the writers
// (newsPostDevTo, newsWeeklyBrief) also wrote makes the same noteId and a re-run appends nothing. A row the builder refuses is
// reported and skipped. Reads DynamoDB only.
//
//   node backfill-brief-notes.mjs [--live] [--dry] [--bucket B]
//   default writes under record/shadow/; --live writes record/. SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');

const NOTE_TABLE = 'SummarizeAndPredict';

/** Pure: daily and weekly rows (as stored) -> {daily, weekly (notes), skipped, counts}. */
export function planBriefNotes({ daily = [], weekly = [], producer }) {
  const skipped = [];
  const plan = (rows, build) => rows.flatMap((row) => {
    try {
      const note = build({ item: row, producer });
      if (!note) { skipped.push({ key: `${row.PK}/${row.SK}`, reason: 'no_content' }); return []; }
      return [note];
    } catch (e) { skipped.push({ key: `${row.PK}/${row.SK}`, reason: e.message }); return []; }
  });
  const dailyNotes = plan(daily, N.dailyBriefNote);
  const weeklyNotes = plan(weekly, N.weeklyBriefNote);
  return { daily: dailyNotes, weekly: weeklyNotes, skipped, counts: { daily: dailyNotes.length, weekly: weeklyNotes.length, weeklyPublished: weeklyNotes.filter((n) => n.payload.status === 'published').length } };
}

async function scan(ddb, ScanCommand, sk) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: NOTE_TABLE, FilterExpression: 'SK = :s', ExpressionAttributeValues: { ':s': sk }, ExclusiveStartKey }));
    out.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, dry: { type: 'boolean' }, bucket: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const prefix = values.live ? 'record/' : 'record/shadow/';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const daily = await scan(ddb, ScanCommand, 'DAILY_BRIEF');
  const weekly = await scan(ddb, ScanCommand, 'WEEKLY_BRIEF');
  const plan = planBriefNotes({ daily, weekly, producer: { lambda: 'record/cli/backfill-brief-notes', runId: `backfill-${new Date().toISOString()}` } });
  const writer = N.makeNoteWriter({ s3json, prefix });
  const dailyResult = values.dry ? { dry: true } : await writer.write('daily_brief', plan.daily);
  const weeklyResult = values.dry ? { dry: true } : await writer.write('weekly_brief', plan.weekly);
  console.log(JSON.stringify({ prefix, dailyRows: daily.length, weeklyRows: weekly.length, notes: plan.counts, skipped: plan.skipped.length,
    dailyWrite: { ...dailyResult, days: undefined }, weeklyWrite: { ...weeklyResult, days: undefined } }));
  for (const s of plan.skipped.slice(0, 20)) console.log('skipped', JSON.stringify(s));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
