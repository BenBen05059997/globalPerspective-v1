// Replay the NewsCache archive days before the record's first day (decision 0047) through newsStoryRecord's own backfill,
// so the facts, the Runs and the views come from the code the nightly run uses. Reads DynamoDB only (archive#DAY rows, one PRED# scan);
// writes nowhere by default.
//
//   node backfill-history.mjs --from 2026-03-07 --to 2026-09-05 [--out DIR] [--seed RECORD_DIR] [--ddb-cache DIR]   dry run: local files
//   node backfill-history.mjs --from ... --to ... --write [--prefix record/shadow-history/]                          S3, under that prefix
//   node backfill-history.mjs --from ... --to ... --write --live                                                      S3, record/ (the real record)
//
// Dry run: the would-be objects go to <out>/record/shadow/...; --seed is a local copy of the live record/ (aws s3 sync), read through
// where <out> has nothing, so the replay sees the facts, inbox, notes and readings the live run would see. --ddb-cache keeps the scanned
// rows as JSON so a re-run does not scan again. --write needs the prefix to hold a copy of the live record (facts/, inbox/, notes/,
// readings/, operator/) for the same reason; --live needs nothing. strict is off: a day with no archive row ends a `missing` Run and no facts.
// --views alone builds the views again from the target's facts and notes (after the notes CLIs ran on it), nothing else.
// SDK: see sdk.mjs (RECORD_SDK_DIR).
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { requireSdk, REGION } from './sdk.mjs';
import { planForecastGaps } from './backfill-forecasts.mjs';

const require = createRequire(import.meta.url);
const { makeHandler } = require('../newsStoryRecord/src/index.js');
const { makeStore } = require('../newsStoryRecord/src/store.js');
const { makeS3Json } = require('../../shared/src/s3json.js');
const { makeManifest } = require('../../shared/src/manifest.js');
const world = require('../../shared/src/world');
const { makePublisher } = require('../newsStoryRecord/src/publish.js');

const BUCKET = 'globalperspective-world-280362093938';
const SHADOW = 'record/shadow/';

/** A world client over rows already in memory: archive#DAY items by id, PRED# rows by SK range. Anything else is refused, never answered empty. */
export function memoryClient({ archive, pred }) {
  const byId = new Map(archive.map((r) => [r.id, r]));
  return {
    async getItem(table, key) {
      if (table !== 'NewsCache') throw new Error(`backfill-history: no reader for ${table}`);
      if (key.id === 'today-archive') return null; // a replayed day is history: nothing was archived "today"
      return byId.get(key.id) || null;
    },
    async query() { throw new Error('backfill-history: query is not used by the facts run'); },
    async batchGet() { throw new Error('backfill-history: batchGet is not used by the facts run'); },
    async scan(table, spec) {
      if (table !== 'GlobalPerspectivePredictionLog') throw new Error(`backfill-history: no scan for ${table}`);
      return pred.filter((r) => String(r.PK).startsWith('PRED#') && r.SK >= spec.values[':f'] && r.SK <= spec.values[':t']);
    },
    async getS3Json() { return null; },
  };
}

/** A fake S3 client over a directory: reads <dir>/<key>, falling back to <seed>/<key minus 'record/shadow/'> for the shadow prefix; writes only <dir>. */
export function localS3({ dir, seed }) {
  class Get { constructor(input) { this.input = input; } }
  class Put { constructor(input) { this.input = input; } }
  const etagOf = (buf) => createHash('sha256').update(buf).digest('hex');
  const target = (key) => { const p = path.resolve(dir, key); if (!p.startsWith(`${path.resolve(dir)}${path.sep}`)) throw new Error('unsafe object key'); return p; };
  const find = (key) => {
    const p = target(key);
    if (fs.existsSync(p)) return p;
    if (seed && key.startsWith(SHADOW)) { const s = path.resolve(seed, key.slice(SHADOW.length)); if (fs.existsSync(s)) return s; }
    return null;
  };
  return {
    GetObjectCommand: Get, PutObjectCommand: Put,
    client: {
      async send(command) {
        const i = command.input;
        const found = find(i.Key);
        if (command instanceof Get) {
          if (!found) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
          const buf = fs.readFileSync(found);
          return { ETag: etagOf(buf), Body: { transformToString: async () => buf.toString('utf8') } };
        }
        if (i.IfMatch && (!found || i.IfMatch !== etagOf(fs.readFileSync(found)))) throw Object.assign(new Error('stale etag'), { name: 'PreconditionFailed' });
        if (i.IfNoneMatch && found) throw Object.assign(new Error('exists'), { name: 'PreconditionFailed' });
        const p = target(i.Key);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, i.Body);
        return {};
      },
    },
  };
}

/** Wraps an S3 client so the shadow prefix of newsStoryRecord (record/shadow/) lands under another prefix. */
export function rewritePrefix(client, prefix) {
  if (prefix === SHADOW) return client;
  return { send: (command) => { command.input = { ...command.input, Key: command.input.Key.startsWith(SHADOW) ? prefix + command.input.Key.slice(SHADOW.length) : command.input.Key }; return client.send(command); } };
}

/** The archive#DAY rows and the PRED# rows, from DynamoDB (scans, read only) or from the JSON copies in cacheDir (a first run with a cacheDir also keeps THREAD_ANALYSIS). */
export async function loadRows({ cacheDir, sdk }) {
  const file = (n) => (cacheDir ? path.join(cacheDir, n) : null);
  if (cacheDir && fs.existsSync(file('archive.json')) && fs.existsSync(file('pred.json'))) {
    return { archive: JSON.parse(fs.readFileSync(file('archive.json'), 'utf8')), pred: JSON.parse(fs.readFileSync(file('pred.json'), 'utf8')) };
  }
  const { DynamoDBClient } = sdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand } = sdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const scan = async (TableName, FilterExpression, ExpressionAttributeValues) => {
    const items = [];
    let ExclusiveStartKey;
    do {
      const r = await ddb.send(new ScanCommand({ TableName, FilterExpression, ExpressionAttributeValues, ExclusiveStartKey }));
      items.push(...(r.Items || []));
      ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
  };
  const archive = await scan('NewsCache', 'begins_with(id, :p)', { ':p': 'archive#' });
  const pred = await scan('GlobalPerspectivePredictionLog', 'begins_with(PK, :p)', { ':p': 'PRED#' });
  if (cacheDir) {
    // the story analyses are not read by the replay; they are kept for check-history.mjs (the 202 stories that had none)
    const analysis = await scan('SummarizeAndPredict', 'SK = :s', { ':s': 'THREAD_ANALYSIS' });
    fs.mkdirSync(cacheDir, { recursive: true });
    for (const [name, rows] of [['archive.json', archive], ['pred.json', pred], ['thread_analysis.json', analysis]]) fs.writeFileSync(file(name), JSON.stringify(rows));
  }
  return { archive, pred };
}

const sha1 = (s) => createHash('sha1').update(s).digest('hex');

/**
 * The forecasts the replay's own rule did not place (PRED# rows whose topic is no entry's topic): planForecastGaps over every stored
 * fact, the facts appended to their days, then the rows no rule can place copied whole to <prefix>legacy/predictions/DAY.jsonl (no
 * story, so no fact; 0047), and the views built again. `prefix` is the handler's shadow prefix.
 */
export async function forecastGaps({ from, rows, s3json, today, prefix = SHADOW }) {
  const manifest = makeManifest(s3json);
  const publisher = makePublisher({ s3json });
  const { facts } = await publisher.readFacts(prefix, []);
  const snapshots = await world.scenarios(memoryClient(rows), { from, to: today }, {});
  const plan = planForecastGaps({ snapshots, facts, firstDay: from, runId: `forecasts-backfill-${today}` });
  const days = Object.keys(plan.byDay).sort();
  if (days.length) await manifest.addDays(`${prefix}facts/manifest.json`, days);
  let appended = 0;
  for (const d of days) appended += (await s3json.appendLines(`${prefix}facts/${d}.jsonl`, plan.byDay[d])).appended;

  const unresolved = new Set(plan.unresolved.map((u) => `${u.pk}|${u.date}`));
  const legacy = {};
  for (const r of rows.pred) if (unresolved.has(`${r.PK}|${r.SK}`)) (legacy[r.SK] ||= []).push({ schemaVersion: 1, eventId: sha1(`legacy_prediction${r.PK}|${r.SK}`), reason: 'no_story', pk: r.PK, sk: r.SK, row: r });
  const legacyDays = Object.keys(legacy).sort();
  if (legacyDays.length) await manifest.addDays(`${prefix}legacy/predictions/manifest.json`, legacyDays);
  let legacyAppended = 0;
  for (const d of legacyDays) legacyAppended += (await s3json.appendLines(`${prefix}legacy/predictions/${d}.jsonl`, legacy[d])).appended;

  const views = await publisher.publish({ prefix, today, builtAt: new Date().toISOString(), runId: `forecasts-backfill-${today}`, changedDays: days });
  return { ...plan.counts, byDay: undefined, factDays: days.length, appended, legacyDays: legacyDays.length, legacyAppended, views };
}

/** Replays from..to oldest first through newsStoryRecord (strict off) into `s3json`; the shadow prefix is the target. -> the handler's result and the Run totals. */
export async function replay({ from, to, rows, s3json, now }) {
  const manifest = makeManifest(s3json);
  const store = makeStore(memoryClient(rows));
  const handler = makeHandler({ store, s3json, manifest, ...(now ? { now } : {}) });
  let result;
  try { result = await handler({ backfill: { from, to }, strict: false, shadow: true }); } catch (e) { result = { error: e.message, days: e.days }; }
  const gaps = result.error ? null : await forecastGaps({ from, rows, s3json, today: (now ? now() : new Date().toISOString()).slice(0, 10) });
  const days = result.days || [];
  const totals = {};
  for (const d of days) for (const [k, n] of Object.entries(d.counts)) totals[k] = (totals[k] || 0) + n;
  const failures = {};
  for (const d of days) for (const f of d.failures) if (f.stage !== 'inputs') failures[f.stage] = (failures[f.stage] || 0) + 1;
  return {
    from, to, error: result.error || null, days: days.length, ok: days.filter((d) => d.status === 'ok').length,
    missingDays: days.filter((d) => d.inputs.archiveDay === 'missing').map((d) => d.date),
    thinDays: days.filter((d) => d.inputs.archiveDay && d.inputs.archiveDay.thin !== undefined).map((d) => ({ date: d.date, entries: d.inputs.archiveDay.thin })),
    totals, failures, gaps,
  };
}

async function main() {
  const { values } = parseArgs({ options: { from: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' }, seed: { type: 'string' }, 'ddb-cache': { type: 'string' }, write: { type: 'boolean' }, live: { type: 'boolean' }, views: { type: 'boolean' }, prefix: { type: 'string' }, bucket: { type: 'string' } } });
  if (!values.views && (!values.from || !values.to)) throw new Error('usage: backfill-history.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--out DIR --seed DIR | --write [--prefix P] [--live]]');
  const write = Boolean(values.write || values.live);
  const sdk = requireSdk;
  const rows = values.views ? null : await loadRows({ cacheDir: values['ddb-cache'], sdk });
  let io;
  let target;
  if (write) {
    const s3sdk = sdk('@aws-sdk/client-s3');
    const prefix = values.live ? 'record/' : (values.prefix || 'record/shadow-history/');
    if (!prefix.startsWith('record/') || !prefix.endsWith('/') || (!values.live && prefix === 'record/')) throw new Error('--prefix must be record/<name>/ (record/ itself needs --live)');
    // the handler's shadow prefix (record/shadow/) is mapped onto the target, so --live lands on record/ itself
    io = { client: rewritePrefix(new s3sdk.S3Client({ region: REGION }), prefix), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand };
    target = prefix;
  } else {
    const out = path.resolve(values.out || 'history-out');
    const l = localS3({ dir: out, seed: values.seed });
    io = { client: l.client, GetObjectCommand: l.GetObjectCommand, PutObjectCommand: l.PutObjectCommand };
    target = `${out}/record/shadow/`;
  }
  const s3json = makeS3Json({ ...io, bucket: values.bucket || process.env.WORLD_BUCKET || BUCKET });
  if (values.views) {
    const today = new Date().toISOString().slice(0, 10);
    console.log(JSON.stringify({ target, views: await makePublisher({ s3json }).publish({ prefix: SHADOW, today, builtAt: new Date().toISOString(), runId: `history-views-${today}`, changedDays: [] }) }));
    return 0;
  }
  const result = await replay({ from: values.from, to: values.to, rows, s3json });
  console.log(JSON.stringify({ target, write, ...result, missingDays: result.missingDays.length, thinDays: result.thinDays.length }));
  console.log('missing', result.missingDays.join(' '));
  return result.error ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
