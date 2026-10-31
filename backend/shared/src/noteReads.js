'use strict';

// Readers of the record's notes (decisions 0042, 0053): the country and story rows that the read API and the Lambdas used to read
// from SummarizeAndPredict (COUNTRY_INTELLIGENCE, HISTORY#, DRIFT#/DRIFTLOG#, FACTS#, THREAD_ANALYSIS, THREAD_HISTORY#), rebuilt
// from record/notes/<subtype>/ with the SAME field names, so a caller switches source and keeps its shape. Pure projections over an
// array of notes; makeNoteReader loads the arrays (a subtype's days from its manifest) and keeps them for a short time.
// Gating (member depth) never lives here: these return everything, the caller caps.
const { resolveIso3 } = require('./resolveIso3');

const HISTORY_MAX = 90;
const DRIFT_MAX = 90;

/** NOTES_READS: 'ddb' (default) | 'notes' | 'compare' (answer from DynamoDB, log the differences with the notes). */
function readMode(env = process.env) {
  const v = String(env.NOTES_READS || 'ddb').toLowerCase();
  return v === 'notes' || v === 'compare' ? v : 'ddb';
}

const byAtDesc = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
const copyOf = (n) => n.payload && (n.payload.from === 'archive' || n.payload.from === 'history');
// a note's payload as the stored row had it: the provenance marker of a backfilled copy is the note's, not the row's
const bare = ({ from, ...rest }) => (from === 'archive' || from === 'history' || from === undefined ? rest : { from, ...rest });
const stored = (n) => ({ ...bare(n.payload), generatedAt: n.at });
const iso3Of = (name) => { const r = resolveIso3(String(name || '').trim()); return r ? r.iso3 : null; };

const ofSubtype = (notes, subtype, kind) => (notes || []).filter((n) => n && n.subtype === subtype && n.payload && n.subject && (!kind || n.subject.kind === kind));
const latest = (list) => list.slice().sort(byAtDesc)[0] || null;

/** The newest briefing of a country (a full COUNTRY_INTELLIGENCE row, not a history copy), or null. */
function countryIntelligence(notes, iso3) {
  const n = latest(ofSubtype(notes, 'country', 'country').filter((x) => x.subject.id === iso3 && !copyOf(x)));
  return n ? { ...stored(n), model: n.model } : null;
}

/** HISTORY# rows of a country, newest day first, at most 90: the last run of each day (a briefing, or a history copy for a day with none). */
function countryHistory(notes, iso3, max = HISTORY_MAX) {
  const perDay = new Map();
  for (const n of ofSubtype(notes, 'country', 'country').filter((x) => x.subject.id === iso3)) {
    const cur = perDay.get(n.date);
    if (!cur || n.at > cur.at) perDay.set(n.date, n);
  }
  const KEYS = ['riskLevel', 'riskScore', 'dimensions', 'lead', 'trajectory', 'headline'];
  return [...perDay.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, max).map((n) => {
    const row = { countryName: n.payload.countryName, dateKey: n.date };
    for (const k of KEYS) if (n.payload[k] !== undefined) row[k] = n.payload[k];
    row.generatedAt = n.at;
    return row;
  });
}

/** One drift note as the DRIFT# row held it. */
const driftRow = (n) => stored(n);

/** Drift rows of a country, newest asOf first, one per asOf (the last run), at most 90 (the old DRIFTLOG# + DRIFT# union). */
function countryDrift(notes, iso3, max = DRIFT_MAX) {
  const perDay = new Map();
  for (const n of ofSubtype(notes, 'drift', 'country').filter((x) => x.subject.id === iso3 && x.payload.asOf)) {
    const cur = perDay.get(n.payload.asOf);
    if (!cur || n.at > cur.at) perDay.set(n.payload.asOf, n);
  }
  return [...perDay.values()].sort((a, b) => (a.payload.asOf < b.payload.asOf ? 1 : a.payload.asOf > b.payload.asOf ? -1 : 0)).slice(0, max).map(driftRow);
}

/** The newest drift row of a story (greatest asOf), or null. */
function storyDrift(notes, threadId) {
  const perDay = new Map();
  for (const n of ofSubtype(notes, 'drift', 'story').filter((x) => x.subject.id === threadId && x.payload.asOf)) {
    const cur = perDay.get(n.payload.asOf);
    if (!cur || n.at > cur.at) perDay.set(n.payload.asOf, n);
  }
  const n = [...perDay.values()].sort((a, b) => (a.payload.asOf < b.payload.asOf ? 1 : -1))[0];
  return n ? driftRow(n) : null;
}

/** The newest analysis of a story as THREAD_ANALYSIS stored it, or null. */
function storyAnalysis(notes, threadId) {
  const n = latest(ofSubtype(notes, 'story_analysis', 'story').filter((x) => x.subject.id === threadId));
  // an analysis stored before iso3 was kept has none; a note without countries says nothing, so the field stays absent
  return n ? { ...stored(n), threadId, ...(n.iso3.length ? { iso3: n.iso3 } : {}), model: n.model } : null;
}

/** THREAD_HISTORY# rows of a story, oldest day first: every story_analysis note carries the scalars, story_history copies fill the days before. */
function threadHistory(analysisNotes, historyNotes, threadId) {
  const perDay = new Map();
  const add = (n, row) => { const cur = perDay.get(n.date); if (!cur || n.at > cur.at) perDay.set(n.date, { at: n.at, row }); };
  for (const n of ofSubtype(analysisNotes, 'story_analysis', 'story').filter((x) => x.subject.id === threadId)) {
    const p = n.payload;
    add(n, { threadId, dateKey: n.date, threadTitle: p.threadTitle, trajectory: p.trajectory, riskScore: p.riskScore, dimensions: p.dimensions, lead: p.lead, entryCount: p.entryCount, generatedAt: n.at });
  }
  for (const n of ofSubtype(historyNotes, 'story_history', 'story').filter((x) => x.subject.id === threadId)) {
    const p = n.payload;
    add(n, { threadId, dateKey: p.dateKey || n.date, threadTitle: p.threadTitle, trajectory: p.trajectory, riskScore: p.riskScore, dimensions: p.dimensions, lead: p.lead, entryCount: p.entryCount, generatedAt: n.at });
  }
  return [...perDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v.row);
}

/** The newest FACTS# COUNTRY_FACTS row of a country, or null. */
function countryFacts(notes, iso3) {
  const n = latest(ofSubtype(notes, 'country_facts', 'country').filter((x) => x.subject.id === iso3));
  return n ? { ...n.payload, lastUpdatedAt: n.at } : null;
}

/**
 * Every drift row, one per subject and asOf, as the corrections ledger reads them: [{scope: 'country'|'thread', name, asOf, row}]
 * where name is the country name or the threadId. The DRIFT# rows never expired (TTL is off on the table), so there is no window.
 */
function driftFeed(notes) {
  const perKey = new Map();
  for (const n of ofSubtype(notes, 'drift').filter((x) => x.payload.asOf)) {
    const key = `${n.subject.kind}|${n.subject.id}|${n.payload.asOf}`;
    const cur = perKey.get(key);
    if (!cur || n.at > cur.at) perKey.set(key, n);
  }
  return [...perKey.values()].map((n) => ({
    scope: n.subject.kind === 'story' ? 'thread' : 'country',
    name: n.subject.kind === 'story' ? n.subject.id : (n.payload.countryName || n.subject.id),
    asOf: n.payload.asOf, row: driftRow(n),
  }));
}

/**
 * Loads a subtype's notes (every day in record/notes/<subtype>/manifest.json) through an s3json (getJson, getLines) and keeps them
 * for ttlMs, so one warm Lambda reads each file once per window. A subtype with no manifest is empty. `days` limits the read to the
 * newest n days of the manifest.
 */
function makeNoteReader({ s3json, prefix = 'record/', ttlMs = 300000, now = Date.now, batch = 24 }) {
  const cache = new Map();
  async function load(subtype, days) {
    const manifest = await s3json.getJson(`${prefix}notes/${subtype}/manifest.json`);
    const list = (manifest && Array.isArray(manifest.days) ? manifest.days : []).slice().sort();
    const use = days ? list.slice(-days) : list;
    const out = [];
    for (let i = 0; i < use.length; i += batch) {
      const parts = await Promise.all(use.slice(i, i + batch).map((d) => s3json.getLines(`${prefix}notes/${subtype}/${d}.jsonl`)));
      for (const p of parts) out.push(...p.lines);
    }
    return out;
  }
  function all(subtype, days) {
    const key = `${subtype}|${days || ''}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.promise;
    const promise = load(subtype, days).catch((e) => { cache.delete(key); throw e; });
    cache.set(key, { at: now(), promise });
    return promise;
  }
  return { all, clear: () => cache.clear() };
}

/** The notes reader of the live bucket (the AWS SDK is required here, so a caller in `ddb` mode never loads it). */
function s3NoteReader({ bucket = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938', prefix = process.env.NOTES_READ_PREFIX || 'record/', region = process.env.AWS_REGION || 'ap-northeast-1', ttlMs }) {
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { makeS3Json } = require('./s3json');
  return makeNoteReader({ s3json: makeS3Json({ client: new S3Client({ region }), GetObjectCommand, PutObjectCommand, bucket }), prefix, ttlMs });
}

/** A change description between two JSON-able values, '' when equal. Key order, iso3 order, ttl and undefined fields do not count. */
function diff(a, b) {
  const norm = (v, key) => {
    if (Array.isArray(v)) { const out = v.map((x) => norm(x)); return key === 'iso3' ? out.slice().sort() : out; }
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined && k !== 'ttl').map((k) => [k, norm(v[k], k)]));
    return v;
  };
  const na = norm(a === undefined ? null : a);
  const nb = norm(b === undefined ? null : b);
  if (JSON.stringify(na) === JSON.stringify(nb)) return '';
  // the first place they part, so a log line says what differs rather than printing both rows
  const where = (p, q, path) => {
    if (JSON.stringify(p) === JSON.stringify(q)) return null;
    if (Array.isArray(p) && Array.isArray(q)) {
      if (p.length !== q.length) return `${path}.length ddb=${p.length} notes=${q.length}`;
      for (let i = 0; i < p.length; i += 1) { const w = where(p[i], q[i], `${path}[${i}]`); if (w) return w; }
    }
    if (p && q && typeof p === 'object' && typeof q === 'object' && !Array.isArray(p) && !Array.isArray(q)) {
      for (const k of new Set([...Object.keys(p), ...Object.keys(q)])) { const w = where(p[k], q[k], `${path}.${k}`); if (w) return w; }
    }
    return `${path} ddb=${JSON.stringify(p)?.slice(0, 100)} notes=${JSON.stringify(q)?.slice(0, 100)}`;
  };
  return where(na, nb, '$');
}

/**
 * Runs a read under NOTES_READS: `ddb` -> fromDdb(); `notes` -> fromNotes(); `compare` -> fromDdb() answers and every difference to
 * fromNotes() (or a failed notes read) is logged as `[notes-compare] <label>`. `normalise` shapes both sides before the comparison.
 */
async function viaMode({ mode, label, fromDdb, fromNotes, normalise = (x) => x, log = console }) {
  if (mode === 'notes') return fromNotes();
  const out = await fromDdb();
  if (mode === 'compare') {
    try {
      const d = diff(normalise(out), normalise(await fromNotes()));
      if (d) log.warn(`[notes-compare] ${label}: ${d}`); else log.info(`[notes-compare] ${label}: same`);
    } catch (e) { log.warn(`[notes-compare] ${label}: notes read failed: ${e.message}`); }
  }
  return out;
}

/**
 * What a Lambda needs to read these rows from the record: `mode` (env NOTES_READS), `notes.all(subtype)` (built on first use,
 * cached `ttlMs`, default 60 s; `reset()` drops it, called at the start of an invocation so a run never reads older notes than its
 * own previous run wrote), and `via(label, fromDdb, fromNotes, normalise)`.
 */
function lambdaSource({ env = process.env, log = console, ttlMs = Number(env.NOTES_CACHE_SECONDS || '60') * 1000, reader } = {}) {
  const mode = readMode(env);
  let live = reader || null;
  const notes = { all: (...a) => (live || (live = s3NoteReader({ ttlMs }))).all(...a) };
  return {
    mode, notes,
    reset: () => { if (!reader) live = null; },
    via: (label, fromDdb, fromNotes, normalise) => viaMode({ mode, label, fromDdb, fromNotes, normalise, log }),
  };
}

/**
 * The two rows the distribution Lambdas read, `COUNTRY#<name>/COUNTRY_INTELLIGENCE` and `THREAD#<id>/THREAD_ANALYSIS`, under
 * NOTES_READS. `ddbGet(pk, sk)` -> the stored item or null (the Lambda's own read). A country is matched by the exact name its record
 * was keyed by, as the DynamoDB key was: an alias ("USA") has no record there, so none here. -> {country(name), thread(threadId)}.
 */
function rowReaders(src, ddbGet) {
  return {
    country: (name) => src.via(`COUNTRY_INTELLIGENCE ${name}`, () => ddbGet(`COUNTRY#${name}`, 'COUNTRY_INTELLIGENCE'), async () => {
      const iso3 = iso3Of(name);
      const row = iso3 && countryIntelligence(await src.notes.all('country'), iso3);
      return row && row.countryName === name ? { PK: `COUNTRY#${name}`, SK: 'COUNTRY_INTELLIGENCE', ...row } : null;
    }),
    thread: (threadId) => src.via(`THREAD_ANALYSIS ${threadId}`, () => ddbGet(`THREAD#${threadId}`, 'THREAD_ANALYSIS'), async () => {
      const row = storyAnalysis(await src.notes.all('story_analysis'), threadId);
      return row ? { PK: `THREAD#${threadId}`, SK: 'THREAD_ANALYSIS', ...row } : null;
    }),
  };
}

module.exports = {
  s3NoteReader, diff, viaMode, lambdaSource, rowReaders,
  readMode, iso3Of, makeNoteReader,
  countryIntelligence, countryHistory, countryDrift, storyDrift, storyAnalysis, threadHistory, countryFacts, driftFeed,
};
