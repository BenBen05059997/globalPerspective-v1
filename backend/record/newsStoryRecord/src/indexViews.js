'use strict';

// Index views built for the pages that read MANY stories or countries at once (decision 0042 follow-up): the record's story,
// links and country views are one file each, so a page that needs 120 analyses, the whole story web or 24 briefings made 4 to
// 60 read-API calls. Each index here is the slice of those views one reader needs, in the shape of the action it replaces, built
// from the same intermediate results as the per-story views (judged links, web coverage, standing notes): no second implementation
// of any rule. Pure: no I/O, no clock. Public data only; each index carries no more than the anonymous action does (drift depth
// and member-only fields are never copied).
const {iso3List} = require('./_shared/resolveIso3');
const {addDays} = require('./_shared/world');

const SCHEMA_VERSION = 1;
const INDEX_MAX_BYTES = 2 * 1024 * 1024; // per index; over this the run fails (like index/all.json) rather than truncate
const WEB_MAX_AGE_DAYS = 30; // the story web's window (views.js WEB_MAX_AGE_DAYS; the old web_index maxAgeDays)
const WEEKLY_DAYS = 30; // the archive_range window the weekly readers ask for: today and the 29 days before

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

/** The archive day an entry fact was listed under and its place in that day's list (`archive#YYYY-MM-DD|...`, sourceRow.index), or null. */
function archiveRefOf(f) {
  const m = /^archive#(\d{4}-\d{2}-\d{2})\|/.exec(f.sourceKey || '');
  return m ? {day: m[1], index: Number.isInteger(f.sourceRow && f.sourceRow.index) ? f.sourceRow.index : 0} : null;
}

/**
 * index/weekly.json: the `archive_range` action's days (the last 30 archive days), for the Stories page, the Stories map, the
 * countries list and the map's risk layer, built from the story views' entries (so placement, merges and reassignment apply: an
 * entry is under the story it belongs to now). Per day, in the archive's order: `topicId`, `threadId`, `title`, `category`, `iso3`
 * (the countries of the entry; the page names them from the one country table) and `sources` as `{outlet, url}` (outlet null when
 * unknown; the page falls back to the url's host); nothing else the readers do not show. A day is the archive day the entry was
 * listed under (not the day of its first article), and `updatedAt` is the newest entry time of the day. An archive row that lists
 * an article already on record is not a second entry (the facts rule), so a repeat is shown on its first day only.
 * `refs`: eventId -> {day, index} from the entry facts. Entries without a ref (fixtures) fall back to their fact date.
 */
function weeklyIndex(stories, refs, today, builtFrom) {
  const from = addDays(today, 1 - WEEKLY_DAYS);
  const days = {};
  for (const [id, s] of [...stories].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    for (const e of s.entries || []) {
      if (e.kind === 'article') continue;
      const ref = refs.get(e.eventId) || {day: e.date, index: 0};
      if (ref.day < from || ref.day > today) continue;
      (days[ref.day] ||= []).push({ref, at: e.at, row: {topicId: e.topicId ?? null, threadId: id, title: e.title, category: e.category ?? null, iso3: e.iso3 || [], sources: (e.sources || []).map((x) => ({outlet: x.outlet ?? null, url: x.url ?? null}))}, eventId: e.eventId});
    }
  }
  const out = {};
  for (const day of Object.keys(days).sort()) {
    const list = days[day].sort((a, b) => a.ref.index - b.ref.index || (a.eventId < b.eventId ? -1 : 1));
    out[day] = {updatedAt: maxOf(list.map((x) => x.at)), entries: list.map((x) => x.row)};
  }
  return {schemaVersion: SCHEMA_VERSION, builtFrom, from, to: today, days: out};
}

/** All four indexes, keyed by file name under index/. Throws when one is over INDEX_MAX_BYTES. */
function buildIndexViews({builtFrom, stories, countries, web, weekly}) {
  const out = {'analyses.json': analysesIndex(stories, builtFrom), 'web.json': webIndex(web, builtFrom), 'countries.json': countriesIndex(countries, builtFrom), 'weekly.json': weeklyIndex(stories, weekly.refs, weekly.today, builtFrom)};
  for (const [name, obj] of Object.entries(out)) {
    const size = bytesOf(obj);
    if (size > INDEX_MAX_BYTES) throw new Error(`views: index/${name} is ${size} bytes, over the ${INDEX_MAX_BYTES} cap`);
  }
  return out;
}

module.exports = {buildIndexViews, analysesIndex, countriesIndex, webIndex, weeklyIndex, archiveRefOf, WEEKLY_DAYS, INDEX_MAX_BYTES, ANALYSIS_FIELDS, COUNTRY_FIELDS};
