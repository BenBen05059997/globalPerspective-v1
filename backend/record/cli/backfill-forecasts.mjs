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

const TITLE_DAYS = 3; // a title match counts only for an entry within this many days of the forecast
const normTitle = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const dayMs = (d) => Date.parse(`${d}T00:00:00Z`);

/**
 * Pure: world snapshots (world.scenarios) + every fact line already stored -> {facts, byDay, counts, unresolved}.
 * `firstDay` = the first day to cover; snapshots dated before it are only counted (the record's first day for the nightly gap,
 * the history's first day for the pre-record range, 0047).
 *
 * threadId of a row, first rule that answers: its own `threadId`; the entry fact of the same topicId nearest in time (the archive
 * thread at ingest); an entry fact whose title equals the forecast's title (case and punctuation folded) within TITLE_DAYS days,
 * nearest first (marked `payload.threadFrom: 'title'`: the forecaster also draws topics under a title-rank id the archive never kept).
 * A row none of these places is `unresolved`: it has no story, so it is no fact (a fact needs a thread).
 */
export function planForecastGaps({ snapshots, facts, firstDay, runId }) {
  const have = new Set(facts.filter((f) => f.kind === 'forecast_drawn').map((f) => f.sourceKey));
  const byTopic = new Map();
  const byTitle = new Map();
  for (const f of facts) {
    if (f.kind !== 'entry' || !f.threadId || !f.payload) continue;
    if (f.payload.topicId) (byTopic.get(f.payload.topicId) || byTopic.set(f.payload.topicId, []).get(f.payload.topicId)).push(f);
    const t = normTitle(f.payload.title);
    if (t) (byTitle.get(t) || byTitle.set(t, []).get(t)).push(f);
  }
  const nearest = (list, date, within = Infinity) => {
    let best = null;
    let gap = Infinity;
    for (const f of list || []) {
      const g = Math.abs(dayMs(f.date || String(f.at).slice(0, 10)) - dayMs(date)) / 86400000;
      if (g <= within && (g < gap || (g === gap && f.at > best.at))) { best = f; gap = g; }
    }
    return best;
  };
  const out = [];
  const unresolved = [];
  const byRule = { thread: 0, topic: 0, title: 0 };
  let beforeRecord = 0;
  for (const snap of snapshots) {
    if (have.has(snap.sourceKey)) continue;
    if (snap.date < firstDay) { beforeRecord += 1; continue; }
    let threadId = snap.threadId;
    let rule = 'thread';
    if (!threadId) {
      const topic = nearest(byTopic.get(snap.topicId), snap.date);
      if (topic) { threadId = topic.threadId; rule = 'topic'; }
    }
    if (!threadId) {
      const title = nearest(byTitle.get(normTitle(snap.title || String(snap.topicId).replace(/-\d+$/, ''))), snap.date, TITLE_DAYS);
      if (title) { threadId = title.threadId; rule = 'title'; }
    }
    if (!threadId) { unresolved.push({ pk: snap.pk, date: snap.date }); continue; }
    byRule[rule] += 1;
    out.push(forecastFact(snap, threadId, [], runId, rule === 'title' ? 'title' : null));
  }
  const byDay = {};
  for (const f of out) (byDay[f.date] ||= []).push(f);
  const branches = out.flatMap((f) => f.payload.branches);
  return {
    facts: out, byDay, unresolved,
    counts: { snapshots: snapshots.length, beforeRecord, unresolved: unresolved.length, facts: out.length, byRule, questionBranches: branches.filter(isQuestion).length, otherBranches: branches.filter((b) => !isQuestion(b)).length },
  };
}

async function main() {
  const { values } = parseArgs({ options: { from: { type: 'string' }, write: { type: 'boolean' }, prefix: { type: 'string' }, bucket: { type: 'string' }, table: { type: 'string' } } });
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
  const firstDay = values.from || days[0]; // --from reaches back before the record's first day (0047: the history's first day)
  const snapshots = await world.scenarios(client, { from: firstDay, to }, { tables: { predictions: table } });
  const plan = planForecastGaps({ snapshots, facts, firstDay, runId: `forecasts-backfill-${to}` });

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
