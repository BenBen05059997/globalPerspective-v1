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

module.exports = {
  readMode, iso3Of, makeNoteReader,
  countryIntelligence, countryHistory, countryDrift, storyDrift, storyAnalysis, threadHistory, countryFacts, driftFeed,
};
