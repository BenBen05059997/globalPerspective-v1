'use strict';

// Index views built for the pages that read MANY stories or countries at once (decision 0042 follow-up): the record's story,
// links and country views are one file each, so a page that needs 120 analyses, the whole story web or 24 briefings made 4 to
// 60 read-API calls. Each index here is the slice of those views one reader needs, in the shape of the action it replaces, built
// from the same intermediate results as the per-story views (judged links, web coverage, standing notes): no second implementation
// of any rule. Pure: no I/O, no clock. Public data only; each index carries no more than the anonymous action does (drift depth
// and member-only fields are never copied).
const {iso3List} = require('./_shared/resolveIso3');

const SCHEMA_VERSION = 1;
const INDEX_MAX_BYTES = 2 * 1024 * 1024; // per index; over this the run fails (like index/all.json) rather than truncate
const WEB_MAX_AGE_DAYS = 30; // the story web's window (views.js WEB_MAX_AGE_DAYS; the old web_index maxAgeDays)

// the analysis fields the Stories page, its map-less views and the country page's arc list read: title, arc text, questions to
// watch, and what deriveHeadline needs for the tier (dimensions, riskScore, riskLevel)
const ANALYSIS_FIELDS = ['threadTitle', 'storyArc', 'watchQuestions', 'dimensions', 'riskScore', 'riskLevel', 'generatedAt'];
// the briefing fields the countries list and the country-risk map layer read
const COUNTRY_FIELDS = ['countryName', 'riskScore', 'riskLevel', 'dimensions', 'headline', 'trajectory', 'generatedAt'];

const pick = (obj, fields) => Object.fromEntries(fields.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const bytesOf = (obj) => Buffer.byteLength(`${JSON.stringify(obj)}\n`);
const maxOf = (xs) => xs.reduce((m, x) => (m === null || x > m ? x : m), null);

/** index/analyses.json: threadId -> the analysis fields above, for every story whose view carries an analysis (never an alias). */
function analysesIndex(stories, builtFrom) {
  const out = {};
  for (const [id, s] of [...stories].sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (s.analysis) out[id] = {threadId: id, ...pick(s.analysis, ANALYSIS_FIELDS)};
  return {schemaVersion: SCHEMA_VERSION, builtFrom, analyses: out};
}

/** index/countries.json: ISO3 -> the briefing fields above (and the first risk signal, the only one the list shows), for every country with a briefing. */
function countriesIndex(countries, builtFrom) {
  const out = {};
  for (const [iso3, c] of [...countries].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const i = c.intelligence;
    if (!i || !i.generatedAt) continue;
    out[iso3] = {...pick(i, COUNTRY_FIELDS), ...(Array.isArray(i.riskSignals) ? {riskSignals: i.riskSignals.slice(0, 1)} : {})};
  }
  return {schemaVersion: SCHEMA_VERSION, builtFrom, countries: out};
}

/**
 * index/web.json: the old web_index action's object from the same results the links views use. `judged` (judgedLinksBy: each pair's
 * rows sit under both stories, so a link is taken once, from the story it starts at), `coverage` (webCoverageBy: state, entry count,
 * places, the webs a story is a node of, and its shared-actor backbone: a pair is taken once, from the smaller id), `webs`
 * (newestWebs: iso3 -> newest web note) and `titleOf`. Not in it: the run's `targets`, `coverage` totals and `runId` (no note carries
 * them); `generatedAt` is the newest web's time.
 */
function webIndex({judged, coverage, webs, titleOf}, builtFrom) {
  const iso3Of = (country) => iso3List([country]);
  const websUsed = [...webs].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, w]) => ({country: w.payload.country, generatedAt: w.at, nodes: new Set(w.payload.nodes.map((x) => x.threadId)).size}));
  const links = [];
  for (const [id, rows] of [...judged].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    for (const r of rows) {
      if (r.from !== id) continue;
      links.push({from: r.from, to: r.to, confidence: r.confidence || null, lagDays: r.lagDays ?? null, mechanism: r.mechanism || null, cited: r.cited || [], country: r.country, generatedAt: r.generatedAt, iso3: iso3Of(r.country)});
    }
  }
  const shared = [];
  const threads = {};
  for (const [id, c] of [...coverage].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (c.state === null) continue; // not in the index: no entry in the scope window and in no web
    for (const b of c.backbone) if (id < b.otherThreadId) shared.push({a: id, b: b.otherThreadId, actors: b.actors, weight: b.weight, country: b.country, generatedAt: b.generatedAt, iso3: iso3Of(b.country)});
    const places = c.places.map(({name, n}) => ({name, n}));
    threads[id] = {state: c.state, title: titleOf(id), entries: c.entries, places, analysedIn: c.analysedIn.map(({country, generatedAt}) => ({country, generatedAt})), iso3: iso3List(places.map((p) => p.name))};
  }
  return {schemaVersion: SCHEMA_VERSION, builtFrom, generatedAt: maxOf(websUsed.map((w) => w.generatedAt)), maxAgeDays: WEB_MAX_AGE_DAYS, websUsed, links, shared, threads};
}

/** All three indexes, keyed by file name under index/. Throws when one is over INDEX_MAX_BYTES. */
function buildIndexViews({builtFrom, stories, countries, web}) {
  const out = {'analyses.json': analysesIndex(stories, builtFrom), 'web.json': webIndex(web, builtFrom), 'countries.json': countriesIndex(countries, builtFrom)};
  for (const [name, obj] of Object.entries(out)) {
    const size = bytesOf(obj);
    if (size > INDEX_MAX_BYTES) throw new Error(`views: index/${name} is ${size} bytes, over the ${INDEX_MAX_BYTES} cap`);
  }
  return out;
}

module.exports = {buildIndexViews, analysesIndex, countriesIndex, webIndex, INDEX_MAX_BYTES, ANALYSIS_FIELDS, COUNTRY_FIELDS};
