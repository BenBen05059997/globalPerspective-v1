// Build the forecasts inbox (decision 0052) from the PredictionLog `PRED#` rows of the last N days, into LOCAL files, and prove that the forecast_drawn facts
// built from the inbox are byte-identical to the facts built from the log. Nothing is written to AWS: DynamoDB is read (one Scan of the window's PRED# rows, the
// same read the nightly run makes, and GetItem on the archive rows for the day's entries), the inbox is written under --out in the bucket's layout
// (<out>/record/inbox/forecasts/DAY.jsonl), and the proof reads it back through the same code newsStoryRecord uses (FORECASTS_SOURCE=inbox).
//
//   node build-forecasts-inbox.mjs [--days 30] [--to YYYY-MM-DD] [--out DIR]
//   default: the 30 days up to today (UTC), out = ./forecasts-inbox-out. SDK: see sdk.mjs (RECORD_SDK_DIR).
//
// A row the reconcile moved (it has `drawnThreadId`) becomes two lines, as the agent writes them: the drawn line with the thread the forecaster assigned, then a thread
// line with the final one, so the replay (last wins) is exercised. Every other row is one drawn line. The files, uploaded once to s3://<bucket>/record/shadow/inbox/forecasts/,
// then record/inbox/forecasts/, are the 30-day start, so `inbox` mode has a full window before the agent has written 30 days of its own.
//
// The proof compares, for the window: the snapshots (whole JSON, provenance included), the `forecast_drawn` facts forecastFactsFor builds from them for every day of the
// window (that day's archive entries as context, as the nightly run has them), and the facts of the real nightly path for the last day (store.load in both modes).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const world = require('../../shared/src/world');
const forecasts = require('../../shared/src/forecastsInbox.js');
const { forecastFactsFor } = require('../newsStoryRecord/src/facts.js');
const { makeStore } = require('../newsStoryRecord/src/store.js');
const { readForecastDays, snapshotsOfDays, compareSnapshots } = require('../newsStoryRecord/src/inboxForecasts.js');

const PREFIX = 'record/';
const PREDICTIONS = 'GlobalPerspectivePredictionLog';

/** Pure: PRED# rows -> Map(day -> lines), in the order the agent writes them (a day's drawn lines by generatedAt, then its thread lines). */
export function inboxFromRows(rows) {
  const out = new Map();
  const byDay = new Map();
  for (const r of rows) {
    if (!r || typeof r.PK !== 'string' || !r.PK.startsWith('PRED#') || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.SK))) continue;
    (byDay.get(r.SK) || byDay.set(r.SK, []).get(r.SK)).push(r);
  }
  for (const [day, list] of byDay) {
    const sorted = [...list].sort((a, b) => String(a.generatedAt || '').localeCompare(String(b.generatedAt || '')) || (a.PK < b.PK ? -1 : 1));
    const drawn = sorted.map((r) => {
      const { drawnThreadId, ...rest } = r;
      if (drawnThreadId === undefined) return forecasts.drawnLine(r);
      return forecasts.drawnLine(drawnThreadId === 'none' ? (({ threadId, ...x }) => x)(rest) : { ...rest, threadId: drawnThreadId });
    });
    const moved = sorted.filter((r) => r.drawnThreadId !== undefined && r.threadId).map((r) => ({ ...forecasts.threadLine({ PK: r.PK, SK: r.SK, threadId: r.threadId, was: r.drawnThreadId, at: r.generatedAt || `${day}T00:00:00.000Z` }), from: 'backfill' }));
    out.set(day, [...drawn.map((l) => ({ ...l, from: 'backfill' })), ...moved]);
  }
  return out;
}

/** The files of an inbox on disk, as the s3json reader readForecastDays wants it: getLines(key) over <dir>/<key>. */
export function localLines(dir) {
  return {
    async getLines(key) {
      const file = path.join(dir, key);
      if (!existsSync(file)) return { lines: [], etag: null };
      return { lines: readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)), etag: null };
    },
  };
}

export function writeInbox(dir, days) {
  for (const [date, lines] of days) {
    const file = path.join(dir, PREFIX, 'inbox/forecasts', `${date}.jsonl`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
  }
}

/**
 * Pure proof: the log's snapshots against the inbox's, and the facts built from each for every day of the window. `entriesByDay` = Map(day -> that day's archive
 * entries) and `threadOfTopic` = the window's topic -> thread map (both as store.load builds them). Returns the numbers and every difference.
 */
export function prove({ log, fromInbox, days, entriesByDay, threadOfTopic, runId = 'proof' }) {
  const diff = compareSnapshots(log, fromInbox);
  let facts = 0;
  let bytes = 0;
  const mismatched = [];
  for (const day of days) {
    const entries = entriesByDay.get(day) || [];
    const a = forecastFactsFor({ snapshots: log, entries, threadOfTopic }, runId).map((f) => JSON.stringify(f));
    const b = forecastFactsFor({ snapshots: fromInbox, entries, threadOfTopic }, runId).map((f) => JSON.stringify(f));
    facts += a.length;
    bytes += a.reduce((n, s) => n + Buffer.byteLength(s), 0);
    if (a.length !== b.length || a.some((s, i) => s !== b[i])) mismatched.push({ day, log: a.length, inbox: b.length });
  }
  const questions = log.flatMap((s) => s.scenarios.flatMap((x) => x.triggers.filter((t) => t.question === true && t.qid)));
  return {
    snapshots: log.length, snapshotsDiffering: diff.differing, differences: diff.differences.slice(0, 20), factsCompared: facts, factBytesCompared: bytes, questionBranches: questions.length,
    identical: !diff.differing && !mismatched.length, mismatched,
  };
}

async function main() {
  const { values } = parseArgs({ options: { days: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' } } });
  const to = values.to || new Date().toISOString().slice(0, 10);
  const n = Number(values.days || 30);
  const from = world.addDays(to, 1 - n);
  const out = path.resolve(values.out || 'forecasts-inbox-out');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand, ScanCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const client = world.makeDynamoClient({ client: ddb, GetCommand, ScanCommand });
  const nowMs = Date.parse(`${to}T12:00:00Z`);

  // the log path: exactly what the nightly run reads (the raw rows are scanned once more, to build the inbox from)
  const rawRows = await client.scan(PREDICTIONS, { expression: 'begins_with(PK, :p) AND SK BETWEEN :f AND :t', values: { ':p': 'PRED#', ':f': from, ':t': to } });
  const log = world.snapshotsOfRows(rawRows, { from, to });
  const days = inboxFromRows(rawRows);
  writeInbox(out, days);

  // the inbox path: read the files back through newsStoryRecord's own reader
  const shim = localLines(out);
  const read = snapshotsOfDays(await readForecastDays(shim, PREFIX, from, to), { from, to });

  // the archive entries of each day (the context forecastFact takes) and the window's thread of each topic
  const archive = await world.archiveRange(client, from, to, { env: {}, nowMs });
  const entriesByDay = new Map(archive.days.map((d) => [d.date, d.entries]));
  const threadOfTopic = new Map();
  for (const d of archive.days) for (const e of d.entries) if (e.topicId && e.threadId) threadOfTopic.set(e.topicId, e.threadId);
  const proof = prove({ log, fromInbox: read.snapshots, days: world.eachDay(from, to), entriesByDay, threadOfTopic });

  // the real nightly path for the last day: store.load in both modes (the log mode scans PredictionLog itself)
  const viaLog = await makeStore(client, { env: {} }).load(to, { prefix: PREFIX });
  const viaInbox = await makeStore(client, { env: { FORECASTS_SOURCE: 'inbox' }, s3json: shim }).load(to, { prefix: PREFIX });
  const factsOf = (input) => JSON.stringify(forecastFactsFor(input, 'proof'));
  const nightlySame = factsOf(viaLog) === factsOf(viaInbox);
  const nightlyFacts = forecastFactsFor(viaInbox, 'proof').length;

  const moved = rawRows.filter((r) => r.drawnThreadId !== undefined).length;
  console.log(JSON.stringify({
    window: { from, to }, inboxPath: path.join(out, PREFIX, 'inbox/forecasts'), inboxFiles: days.size, inboxLines: [...days.values()].reduce((s, l) => s + l.length, 0),
    rows: rawRows.length, rowsMovedByReconcile: moved, orphanThreadLines: read.orphans, ...proof, nightly: { day: to, snapshots: viaLog.snapshots.length, forecastFacts: nightlyFacts, factsIdentical: nightlySame },
  }, null, 2));
  return proof.identical && nightlySame && !read.orphans ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
