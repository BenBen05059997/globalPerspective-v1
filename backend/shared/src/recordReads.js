'use strict';

// recordReads — the Lambdas that read NewsCache `latest` / `today-archive`, SummarizeAndPredict THREAD_ANALYSIS / COUNTRY_INTELLIGENCE and
// WEEKLY_BRIEF# read the record's views instead (decision 0054). One reader, one flag:
//
//   RECORD_READS = ddb (default: nothing changes) | record (the views answer; DynamoDB only when a view cannot) | compare (both are read,
//   the DynamoDB answer is used, and every difference is logged as `[record-reads]`).
//
// Each reader answers in the SHAPE of the DynamoDB row it replaces (latest item, today-archive item, THREAD_ANALYSIS row, COUNTRY_INTELLIGENCE
// row, WEEKLY_BRIEF row), so the Lambda's own code does not change: only the call that fetched the row. Pure mappers first, then
// makeRecordReads({getJson}) over the S3 view files, then readBy() for the flag. Public views only (record/views/*); nothing is written.
//
// "Fresh": newsStoryRecord rebuilds the views after every ingest and brief and nightly, so `manifest.builtAt` is never more than 8 h old
// (decision 0050). A view older than MAX_VIEW_AGE_MS answers nothing and the caller reads DynamoDB (the same rule the pages use).

const { resolveIso3 } = require('./resolveIso3');

const VIEWS = 'record/views';
const MODES = ['ddb', 'record', 'compare'];
const MAX_VIEW_AGE_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86400000;
const TODAY_SOURCES = 3; // the today-archive item keeps the first 3 sources of an entry; the view keeps up to 10
const THREAD_TTL_DAYS = 90; // newsThreadAnalysis stores ttl = generatedAt + 90 days; the note carries no ttl
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LATEST_ONLY = ['urgency', 'urgencyReason', 'significance', 'x_trending', 'primaryCountry', 'mentionedCountries'];
const VIEW_ONLY = ['eventId', 'latest', 'notes'];

/** The flag: 'ddb' | 'record' | 'compare'. Anything else (or unset) is 'ddb', so a typo never changes what a Lambda reads. */
function readMode(env = process.env) {
  const v = String((env && env.RECORD_READS) || 'ddb').trim().toLowerCase();
  return MODES.includes(v) ? v : 'ddb';
}

const without = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const usableToday = (view) => Boolean(view && view.schemaVersion === 1 && Array.isArray(view.entries));

/** The NewsCache `latest` item (the latest run's topics in the run's order), or null when the view has no complete latest run. */
function latestItemOfView(view) {
  if (!usableToday(view) || !view.latest || !Array.isArray(view.latest.topicIds)) return null;
  const byId = new Map(view.entries.map((e) => [e.topicId, e]));
  const entries = view.latest.topicIds.map((id) => byId.get(id));
  if (!entries.length || entries.some((e) => !e)) return null;
  const topics = entries.map((e) => ({
    ...without(e, [...VIEW_ONLY, 'archivedAt', 'generationId', 'ai']),
    id: e.topicId,
    ...Object.fromEntries(Object.entries(e.latest || {}).filter(([k]) => LATEST_ONLY.includes(k))),
    ...(Array.isArray(e.latest && e.latest.sources) ? { sources: e.latest.sources } : {}), // the topic's sources past the entry's 10 (entriesInbox.js)
  }));
  const { latest } = view;
  return {
    id: 'latest', topics, model: latest.model, limit: latest.limit, updatedAt: latest.updatedAt, generationId: latest.generationId,
    status: 'active', generatedYear: latest.generatedYear, generatedDate: latest.generatedDate,
  };
}

/** The NewsCache `today-archive` item (entries of the last 24 h before the newest write, three sources each), or null when the view is unusable. */
function todayArchiveItemOfView(view) {
  if (!usableToday(view)) return null;
  return {
    id: 'today-archive',
    entries: view.entries.map((e) => ({ ...without(e, VIEW_ONLY), sources: (e.sources || []).slice(0, TODAY_SOURCES) })),
    updatedAt: view.updatedAt,
  };
}

/** A THREAD_ANALYSIS row from a story view's `analysis` (as stored, plus `driftNote`, which the row never had), or null. */
function threadAnalysisRowOfView(storyView, threadId) {
  const a = storyView && !storyView.aliasOf && storyView.analysis;
  if (!a || typeof a !== 'object') return null;
  const row = without(a, ['driftNote', 'model', 'iso3']);
  const at = Date.parse(row.generatedAt);
  return {
    PK: `THREAD#${threadId}`, SK: 'THREAD_ANALYSIS', ...row, threadId,
    ...(Array.isArray(a.iso3) && a.iso3.length ? { iso3: a.iso3 } : {}), // older rows have none; the view lists [] then
    ...(a.model ? { model: a.model } : {}),
    ...(Number.isFinite(at) ? { ttl: Math.floor(at / 1000) + THREAD_TTL_DAYS * 86400 } : {}),
  };
}

/**
 * A COUNTRY_INTELLIGENCE row from a country view's `intelligence` (as stored), or null. The row is keyed by the name it was stored under
 * (COUNTRY#France): a spelling the view's briefing is not stored under (USA for United States) has no row in DynamoDB, so it has none here.
 */
function countryIntelligenceRowOfView(countryView, name) {
  const i = countryView && countryView.intelligence;
  if (!i || typeof i !== 'object' || i.countryName !== name) return null;
  return { PK: `COUNTRY#${name}`, SK: 'COUNTRY_INTELLIGENCE', ...i };
}

/** The differing paths of two JSON values -> [{path, a, b}] (at most `max`). A missing key equals undefined; `ignore` = key names skipped at any depth. */
function diffValues(a, b, { ignore = [], max = 20 } = {}) {
  const out = [];
  const short = (v) => (v === undefined ? undefined : String(JSON.stringify(v)).slice(0, 80));
  const walk = (x, y, path) => {
    if (out.length >= max) return;
    if (x === y) return;
    const ox = x && typeof x === 'object';
    const oy = y && typeof y === 'object';
    if (ox && oy && Array.isArray(x) === Array.isArray(y)) {
      const keys = Array.isArray(x) ? [...Array(Math.max(x.length, y.length)).keys()] : [...new Set([...Object.keys(x), ...Object.keys(y)])];
      for (const k of keys) if (!ignore.includes(k)) walk(x[k], y[k], `${path}${Array.isArray(x) ? `[${k}]` : `.${k}`}`);
      return;
    }
    out.push({ path: path || '$', a: short(x), b: short(y) });
  };
  walk(a, b, '');
  return out;
}

/**
 * The flag applied to one read. `ddb()` and `record()` each return the row (or null / undefined when there is none).
 * ddb: ddb(). record: the record's answer, or ddb() when the record has none or fails (logged; removed when the tables go).
 * compare: both are read, `same(ddbValue, recordValue)` -> [] when equal (or diffValues' list), the difference is logged, ddb's answer is returned.
 */
async function readBy({ mode, label, ddb, record, same = (a, b) => diffValues(a, b), log = console }) {
  if (mode === 'record') {
    try {
      const v = await record();
      if (v !== null && v !== undefined) return v;
      log.warn(`[record-reads] ${label}: the record has no answer, reading DynamoDB`);
    } catch (err) {
      log.warn(`[record-reads] ${label}: record read failed (${err.message}), reading DynamoDB`);
    }
    return ddb();
  }
  const fromDdb = await ddb();
  if (mode !== 'compare') return fromDdb;
  try {
    const fromRecord = await record();
    if (fromRecord === null || fromRecord === undefined) {
      (fromDdb === null || fromDdb === undefined ? log.log : log.warn)(`[record-reads] ${label}: ${fromDdb === null || fromDdb === undefined ? 'both empty' : 'DIFFER, the record has no answer'}`);
    } else if (fromDdb === null || fromDdb === undefined) {
      log.warn(`[record-reads] ${label}: DIFFER, DynamoDB has no row, the record has one`);
    } else {
      const d = same(fromDdb, fromRecord);
      if (!d.length) log.log(`[record-reads] ${label}: equal`);
      else log.warn(`[record-reads] ${label}: DIFFER ${d.length} ${JSON.stringify(d.slice(0, 8))}`);
    }
  } catch (err) {
    log.warn(`[record-reads] ${label}: compare failed (${err.message})`);
  }
  return fromDdb;
}

/**
 * Readers over the S3 view files. `getJson(key)` -> parsed object, or null for a missing key (makeS3Json's getJson); any other error throws.
 * A small memo (ttlMs) shares the manifest and the today view between the reads of one invocation.
 */
function makeRecordReads({ getJson, now = Date.now, ttlMs = 60000 }) {
  const memo = new Map();
  const get = (path) => {
    const hit = memo.get(path);
    if (hit && now() - hit.ts < ttlMs) return hit.p;
    const p = Promise.resolve().then(() => getJson(`${VIEWS}/${path}`));
    memo.set(path, { ts: now(), p });
    p.catch(() => { if (memo.get(path) && memo.get(path).p === p) memo.delete(path); });
    return p;
  };

  /** True when the manifest says the views were built at most MAX_VIEW_AGE_MS ago. */
  async function fresh() {
    const m = await get('manifest.json');
    const built = Date.parse(m && m.builtAt);
    return Number.isFinite(built) && now() - built <= MAX_VIEW_AGE_MS;
  }
  const whileFresh = async (read) => ((await fresh()) ? read() : null);

  return {
    fresh,
    /** index/today.json while the views are fresh, else null. */
    todayView: () => whileFresh(() => get('index/today.json')),
    latestItem: async () => latestItemOfView(await whileFresh(() => get('index/today.json'))),
    todayArchiveItem: async () => todayArchiveItemOfView(await whileFresh(() => get('index/today.json'))),
    threadAnalysisRow: async (threadId) => (ID.test(threadId || '') ? threadAnalysisRowOfView(await whileFresh(() => get(`stories/${threadId}.json`)), threadId) : null),
    /** `name` as the COUNTRY# key spells it (France, United States); a place that is no country has no view. */
    countryIntelligenceRow: async (name) => {
      const r = resolveIso3(name);
      return r ? countryIntelligenceRowOfView(await whileFresh(() => get(`countries/${r.iso3}.json`)), name) : null;
    },
    /** The newest published weekly brief (the WEEKLY_BRIEF# row, status 'published'), or null. */
    latestWeeklyBrief: async () => {
      if (!(await fresh())) return null;
      const index = await get('index/briefs.json');
      const weekOf = index && Array.isArray(index.weekly) && index.weekly[0] && index.weekly[0].weekOf;
      if (!DAY.test(weekOf || '')) return null;
      const view = await get(`briefs/weekly/${weekOf}.json`);
      const brief = view && view.brief;
      return brief && brief.status === 'published' && brief.weekOf === weekOf ? brief : null;
    },
  };
}

// What "the same" means for each row, per consumer (decision 0054). Times the two copies stamp separately (the daily row and the today-archive item,
// under a second apart) are compared to the second; `ttl` is derived (a view has none); `activatedAt` is not in the view (no reader uses it); the story
// analysis note keeps `iso3` sorted, DynamoDB kept the order the entries gave, so only a reader that needs the order compares it (threadAnalysisOrdered).
const trunc = (v) => (typeof v === 'string' ? v.slice(0, 19) : v);
const times = (x) => {
  if (Array.isArray(x)) return x.map(times);
  if (!x || typeof x !== 'object') return x;
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'archivedAt' || k === 'updatedAt' ? trunc(v) : times(v)]));
};
const SAME = {
  latest: (a, b) => diffValues(times(a), times(b), { ignore: ['activatedAt', 'ttl'] }),
  todayArchive: (a, b) => diffValues(times(a), times(b), { ignore: ['ttl'] }),
  threadAnalysis: (a, b) => diffValues(a, b, { ignore: ['ttl', 'iso3'] }),
  threadAnalysisOrdered: (a, b) => diffValues(a, b, { ignore: ['ttl'] }),
  countryIntelligence: (a, b) => diffValues(a, b, { ignore: ['ttl'] }),
  weeklyBrief: (a, b) => diffValues(a, b, { ignore: ['ttl', 'PK', 'SK', 'iso3'] }),
};

const READS = ['fresh', 'todayView', 'latestItem', 'todayArchiveItem', 'threadAnalysisRow', 'countryIntelligenceRow', 'latestWeeklyBrief'];
/** The readers, built on first call: a Lambda in mode 'ddb' never loads the S3 client. */
function lazyRecordReads(env = process.env) {
  let live;
  return Object.fromEntries(READS.map((m) => [m, (...args) => (live = live || liveRecordReads(env))[m](...args)]));
}

/** The readers over the world bucket with the Lambda runtime's S3 client (built on first use, so mode 'ddb' never loads it). */
function liveRecordReads(env = process.env) {
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const { makeS3Json } = require('./s3json');
  const client = new S3Client({ region: env.AWS_REGION || 'ap-northeast-1' });
  const bucket = env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  return makeRecordReads({ getJson: makeS3Json({ client, GetObjectCommand, PutObjectCommand: null, bucket }).getJson });
}

module.exports = {
  SAME, lazyRecordReads, liveRecordReads, MODES, MAX_VIEW_AGE_MS, TODAY_SOURCES, DAY_MS, readMode, readBy, diffValues, makeRecordReads,
  latestItemOfView, todayArchiveItemOfView, threadAnalysisRowOfView, countryIntelligenceRowOfView,
};
