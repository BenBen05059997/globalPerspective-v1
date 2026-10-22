'use strict';

// Readings (the weekly review's output, record/readings/YYYY-Www.jsonl) -> what the views take from them. Pure: lines in,
// plain objects out. A reading is never trusted past its shape: a malformed line is skipped, never thrown on.
const {addDays} = require('./_shared/world');

const SUBTYPES = ['line', 'chapter', 'branch_status', 'link', 'merge_proposal', 'alias'];
const WEEK = /^\d{4}-W\d{2}$/;
const WIKIDATA = /^Q\d+$/;

/** ISO 8601 week label of a UTC day ('2026-10-19' -> '2026-W43'). */
function isoWeekOf(day) {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(d.getTime() + (3 - dow) * 86400000);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / 86400000 / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Every ISO week from the one holding `from` to the one holding `to`, oldest first (so no listing is needed to find the files). */
function weeksBetween(from, to) {
  const weeks = [];
  for (let d = from; d <= to; d = addDays(d, 7)) weeks.push(isoWeekOf(d));
  const last = isoWeekOf(to);
  if (weeks[weeks.length - 1] !== last) weeks.push(last);
  return [...new Set(weeks)];
}

// What identifies "the same reading" across weeks: a re-reading of the same thing replaces the older one.
const KEY = {
  line: () => '',
  chapter: (p) => p.from,
  branch_status: (p) => p.branchId,
  link: (p) => p.otherThreadId,
  merge_proposal: (p) => p.otherThreadId,
  alias: (p) => p.canonical,
};
const text = (x) => typeof x === 'string' && x.length > 0;

function valid(r) {
  if (!r || typeof r !== 'object' || !SUBTYPES.includes(r.subtype) || !text(r.threadId) || !WEEK.test(r.week || '') || !r.payload || typeof r.payload !== 'object') return false;
  const p = r.payload;
  switch (r.subtype) {
    case 'line': return text(p.text);
    case 'chapter': return text(p.title) && text(p.from) && text(p.to) && text(p.summary);
    case 'branch_status': return text(p.branchId) && ['fired', 'dead', 'holding', 'late'].includes(p.status);
    case 'link': return text(p.otherThreadId) && text(p.mechanism) && ['drives', 'driven_by', 'shared_cause'].includes(p.direction);
    case 'merge_proposal': return text(p.otherThreadId);
    default: return Array.isArray(p.variants) && p.variants.every(text) && text(p.canonical);
  }
}

/**
 * The readings that stand: valid ones, minus any that another reading supersedes, and per (threadId, subtype, key) only the
 * latest (week, then run, then readingId). Returned in a stable order.
 */
function standing(lines) {
  const readings = (lines || []).filter(valid);
  const superseded = new Set(readings.map((r) => r.supersedes).filter(Boolean));
  const best = new Map();
  const order = (r) => `${r.week}|${r.run || ''}|${r.readingId || ''}`;
  for (const r of readings) {
    if (r.readingId && superseded.has(r.readingId)) continue;
    const k = `${r.threadId}\u0000${r.subtype}\u0000${KEY[r.subtype](r.payload)}`;
    const cur = best.get(k);
    if (!cur || order(r) > order(cur)) best.set(k, r);
  }
  return [...best.values()].sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0));
}

const maxWeek = (rs) => rs.reduce((m, r) => (m === null || r.week > m ? r.week : m), null);

/** thread -> {line, chapters, branchStatus: {branchId: reading}, links: [reading], week} from the standing readings. */
function byThread(rs) {
  const out = new Map();
  for (const r of rs) {
    if (!['line', 'chapter', 'branch_status', 'link'].includes(r.subtype)) continue;
    const t = out.get(r.threadId) || out.set(r.threadId, {line: null, chapters: [], branchStatus: new Map(), links: [], week: null}).get(r.threadId);
    if (r.subtype === 'line') t.line = r;
    else if (r.subtype === 'chapter') t.chapters.push(r);
    else if (r.subtype === 'branch_status') t.branchStatus.set(r.payload.branchId, r);
    else t.links.push(r);
    if (!t.week || r.week > t.week) t.week = r.week;
  }
  return out;
}

const cites = (r) => (Array.isArray(r.cites) ? r.cites.filter(text) : []);

/**
 * actorId -> canonical actorId. The operator file (record/operator/aliases.json: {aliases:[{canonical, variants, wikidataId, generic}]})
 * is applied first and always wins. Then the review's alias readings, oldest first, each only if it carries a Wikidata Q-number and
 * does not conflict with what is already mapped (a variant already mapped to another canonical, or a canonical that is itself a
 * variant, or a variant that is another entry's canonical). A conflicting reading is a proposal and changes nothing.
 * Canonical id form (0040 answer 7): an entry with a wikidataId canonicalises to `wd:Q...` (its `canonical` name and variants all map
 * to it), else to `canonical` itself (`name:...`). An entry with `generic:true` (protesters, the government) is not an entity: it
 * never takes a wd: id, its variants map to its canonical, and that canonical is in `generic`, which the links rule excludes.
 * Returns {map, canon(id), generic: Set, isGeneric(id)}. Facts are never rewritten; this is applied to the views only.
 */
function actorAliases(operator, rs) {
  const map = new Map();
  const canonicals = new Set();
  const generic = new Set();
  const add = (target, names, isGeneric) => { canonicals.add(target); if (isGeneric) generic.add(target); for (const v of names) if (v !== target) map.set(v, target); };
  const targetOf = (canonical, wikidataId, isGeneric) => (!isGeneric && WIKIDATA.test(wikidataId || '') ? `wd:${wikidataId}` : canonical);
  const entries = operator && Array.isArray(operator.aliases) ? operator.aliases : [];
  for (const a of entries) {
    if (!a || !text(a.canonical) || (a.variants !== undefined && !Array.isArray(a.variants))) continue;
    const variants = (a.variants || []).filter(text);
    const isGeneric = a.generic === true;
    const target = targetOf(a.canonical, a.wikidataId, isGeneric);
    if (map.has(a.canonical) || variants.some((v) => canonicals.has(v) || (map.has(v) && map.get(v) !== target))) continue; // inside the operator file, the first entry wins
    add(target, [a.canonical, ...variants], isGeneric);
  }
  for (const r of rs.filter((x) => x.subtype === 'alias')) {
    const {canonical, variants, wikidataId} = r.payload;
    if (!WIKIDATA.test(wikidataId || '')) continue;
    const target = targetOf(canonical, wikidataId, false);
    if (map.has(canonical) || variants.some((v) => v !== canonical && (canonicals.has(v) || (map.has(v) && map.get(v) !== target)))) continue;
    add(target, [canonical, ...variants], false);
  }
  return {map, canon: (id) => map.get(id) ?? id, generic, isGeneric: (id) => generic.has(id)};
}

module.exports = {actorAliases, SUBTYPES, WIKIDATA, isoWeekOf, weeksBetween, standing, maxWeek, byThread, cites, text};
