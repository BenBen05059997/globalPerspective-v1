// Backfill the forecast_drawn facts the nightly facts run missed: a PredictionLog PRED# row whose topic was not among its day's archive
// entries never became a fact (newsStoryRecord found PRED# rows only through the day's entry topics). Every PRED# row dated inside the
// record (first manifest day .. today) with no forecast_drawn fact becomes one through the same forecastFact, so the eventId is the one the
// facts run would give it and a re-run appends nothing. PredictionLog is read only (a Scan: the Lambda role has no Scan, this runs as the operator).
//
// threadId of a row: its own `threadId`, else the latest `entry` fact of the same topicId (the archive thread at ingest). A row with neither
// is reported as unresolved and not written. Rows dated before the record's first day are out of scope and reported as `beforeRecord`.
//
//   node backfill-forecasts.mjs [--write] [--prefix record/] [--bucket B] [--table T]
//   default is a dry run (reads only); --write appends to <prefix>facts/DAY.jsonl and adds the days to the manifest. SDK: see sdk.mjs (RECORD_SDK_DIR).
//   The views pick the new facts up on the next facts run (or a rebuild).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const { makeManifest } = require('../../shared/src/manifest.js');
const world = require('../../shared/src/world');
const { forecastFact } = require('../newsStoryRecord/src/facts.js');

const isQuestion = (b) => b.question === true && Boolean(b.qid);

/**
 * Pure: world snapshots (world.scenarios) + every fact line already stored -> {facts, byDay, counts, unresolved}.
 * `firstDay` = the record's first day; snapshots dated before it are only counted.
 */
export function planForecastGaps({ snapshots, facts, firstDay, runId }) {
  const have = new Set(facts.filter((f) => f.kind === 'forecast_drawn').map((f) => f.sourceKey));
  const threadOfTopic = new Map();
  for (const f of facts.filter((x) => x.kind === 'entry' && x.threadId && x.payload && x.payload.topicId).sort((a, b) => (a.at < b.at ? -1 : 1))) threadOfTopic.set(f.payload.topicId, f.threadId);
  const out = [];
  const unresolved = [];
  let beforeRecord = 0;
  for (const snap of snapshots) {
    if (have.has(snap.sourceKey)) continue;
    if (snap.date < firstDay) { beforeRecord += 1; continue; }
    const threadId = snap.threadId || threadOfTopic.get(snap.topicId);
    if (!threadId) { unresolved.push({ pk: snap.pk, date: snap.date }); continue; }
    out.push(forecastFact(snap, threadId, [], runId));
  }
  const byDay = {};
  for (const f of out) (byDay[f.date] ||= []).push(f);
  const branches = out.flatMap((f) => f.payload.branches);
  return {
    facts: out, byDay, unresolved,
    counts: { snapshots: snapshots.length, beforeRecord, unresolved: unresolved.length, facts: out.length, questionBranches: branches.filter(isQuestion).length, otherBranches: branches.filter((b) => !isQuestion(b)).length },
  };
}

async function main() {
  const { values } = parseArgs({ options: { write: { type: 'boolean' }, prefix: { type: 'string' }, bucket: { type: 'string' }, table: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const prefix = values.prefix || 'record/';
  const table = values.table || process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });

  const days = ((await s3json.getJson(`${prefix}facts/manifest.json`)) || { days: [] }).days;
  if (!days.length) throw new Error(`no fact days under ${prefix}facts/manifest.json`);
  const facts = [];
  for (const d of days) facts.push(...(await s3json.getLines(`${prefix}facts/${d}.jsonl`)).lines);
  const to = new Date().toISOString().slice(0, 10);
  const client = world.makeDynamoClient({ client: ddb, ScanCommand });
  const snapshots = await world.scenarios(client, { from: days[0], to }, { tables: { predictions: table } });
  const plan = planForecastGaps({ snapshots, facts, firstDay: days[0], runId: `backfill-forecasts-${new Date().toISOString()}` });

  const factDays = Object.keys(plan.byDay).sort();
  let appended = 0;
  if (values.write) {
    await makeManifest(s3json).addDays(`${prefix}facts/manifest.json`, factDays);
    for (const d of factDays) appended += (await s3json.appendLines(`${prefix}facts/${d}.jsonl`, plan.byDay[d])).appended;
  }
  console.log(JSON.stringify({ prefix, write: Boolean(values.write), ...plan.counts, days: factDays.length, appended }));
  console.log('byDay', JSON.stringify(Object.fromEntries(factDays.map((d) => [d, plan.byDay[d].length]))));
  for (const u of plan.unresolved) console.log('unresolved', JSON.stringify(u));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
