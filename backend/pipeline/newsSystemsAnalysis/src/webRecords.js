'use strict';

// Batch 4 / E: builds the per-story web records (`THREAD#<id>/WEB`) and the one-read index
// (`WEB#INDEX/LATEST`) from ALL current SYSTEMS# rows, plus the measured coverage. Pure: no AWS,
// no LLM, `now` is passed in. Each web keeps its OWN confidence (never the max across webs).
// Freshness: rows older than 30 days are ignored here; readers also apply amber at 7 days.

const MAX_AGE_DAYS = 30;
const SCOPE_DAYS = 14;
const DAY = 86400000;
const CONF_RANK = { strong: 3, medium: 2, weak: 1 };

const ageDays = (iso, nowMs) => (nowMs - Date.parse(iso)) / DAY;
const day = (s) => String(s || '').slice(0, 10);

function threadInfoFrom(entries, isCountry) {
  const info = new Map();
  for (const e of entries || []) {
    if (!e || !e.threadId) continue;
    const t = info.get(e.threadId) || { threadId: e.threadId, n: 0, lastDate: '', title: '', regions: new Map(), topicIds: new Set() };
    if (!t.topicIds.has(e.topicId)) { t.topicIds.add(e.topicId); t.n++; }
    if (day(e.date) >= t.lastDate) { t.lastDate = day(e.date); t.title = e.title || t.title; }
    for (const r of e.regions || []) if (isCountry(r)) t.regions.set(r, (t.regions.get(r) || 0) + 1);
    info.set(e.threadId, t);
  }
  return info;
}

function topPlaces(t) {
  return [...t.regions.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([name, n]) => ({ name, n }));
}

/**
 * @param {{rows:Array, entries:Array, now:Date|number|string, targets?:string[], runId?:string, isCountry:Function}} a
 * @returns {{index:object, records:Array}}
 */
function buildWebIndex({ rows, entries, now, targets = [], runId = null, isCountry, scopeDays = SCOPE_DAYS }) {
  const nowMs = new Date(now).getTime();
  const nowIso = new Date(nowMs).toISOString();
  const fresh = (rows || []).filter((r) => r && isCountry(r.countryName) && r.generatedAt && ageDays(r.generatedAt, nowMs) <= MAX_AGE_DAYS);
  const info = threadInfoFrom(entries, isCountry);
  const recs = new Map();
  const rec = (id) => {
    if (!recs.has(id)) recs.set(id, { threadId: id, into: [], from: [], shared: [], analysedIn: [] });
    return recs.get(id);
  };
  const titleOf = (id, node) => (info.get(id) && info.get(id).title) || (node && (node.summary || node.title)) || null;
  const flat = [];
  const sharedFlat = [];

  for (const row of fresh) {
    const nodeById = new Map((row.nodes || []).map((n) => [n.threadId, n]));
    for (const n of row.nodes || []) { const x = rec(n.threadId); if (!x.summary && n.summary) x.summary = n.summary; }
    for (const n of row.nodes || []) rec(n.threadId).analysedIn.push({ country: row.countryName, generatedAt: row.generatedAt, nodes: (row.nodes || []).length });
    for (const e of row.edges || []) {
      if (!nodeById.has(e.from) || !nodeById.has(e.to)) continue;
      const cited = Array.isArray(e.cited) && e.cited.length ? e.cited : (e.citedEntries || []).map((topicId) => ({ topicId }));
      const base = { confidence: e.confidence || null, lagDays: e.lagDays ?? null, mechanism: e.mechanism || null, cited, country: row.countryName, generatedAt: row.generatedAt };
      rec(e.from).into.push({ other: e.to, title: titleOf(e.to, nodeById.get(e.to)), ...base });
      rec(e.to).from.push({ other: e.from, title: titleOf(e.from, nodeById.get(e.from)), ...base });
      flat.push({ from: e.from, to: e.to, ...base });
    }
    for (const b of row.backbone || []) {
      if (!nodeById.has(b.from) || !nodeById.has(b.to)) continue;
      const s = { actors: b.sharedActors || [], weight: b.weight || (b.sharedActors || []).length, country: row.countryName, generatedAt: row.generatedAt };
      rec(b.from).shared.push({ other: b.to, title: titleOf(b.to, nodeById.get(b.to)), ...s });
      rec(b.to).shared.push({ other: b.from, title: titleOf(b.from, nodeById.get(b.from)), ...s });
      sharedFlat.push({ a: b.from, b: b.to, ...s });
    }
  }
  const byConf = (x, y) => (CONF_RANK[y.confidence] || 0) - (CONF_RANK[x.confidence] || 0);
  for (const r of recs.values()) { r.into.sort(byConf); r.from.sort(byConf); r.shared.sort((x, y) => y.weight - x.weight); }

  // ---- scope + state + coverage ----
  const scopeFrom = day(new Date(nowMs - scopeDays * DAY).toISOString());
  const scope = [...info.values()].filter((t) => t.lastDate >= scopeFrom);
  const stateOf = (id, n) => {
    const r = recs.get(id);
    if (r && (r.into.length || r.from.length)) return 'linked';
    if (r && r.analysedIn.length) return 'analysed_no_links';
    return n < 2 ? 'single_update' : 'country_not_analysed';
  };
  const threads = {};
  const ids = new Set([...scope.map((t) => t.threadId), ...recs.keys()]);
  for (const id of ids) {
    const t = info.get(id);
    const r = recs.get(id);
    threads[id] = {
      state: stateOf(id, t ? t.n : 0),
      title: (t && t.title) || (r && r.summary) || null,
      entries: t ? t.n : null,
      places: t ? topPlaces(t) : [],
      analysedIn: r ? r.analysedIn.map((a) => ({ country: a.country, generatedAt: a.generatedAt })) : [],
    };
  }
  const eligible = scope.filter((t) => t.n >= 2);
  const inAnyWeb = scope.filter((t) => recs.has(t.threadId) && recs.get(t.threadId).analysedIn.length);
  const linked = scope.filter((t) => threads[t.threadId].state === 'linked');
  const byState = {};
  for (const t of scope) byState[threads[t.threadId].state] = (byState[threads[t.threadId].state] || 0) + 1;
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const coverage = {
    asOf: nowIso, scopeDays,
    threadsInScope: scope.length, eligible: eligible.length, inAnyWeb: inAnyWeb.length, withLink: linked.length,
    eligibleInAnyWeb: eligible.filter((t) => recs.has(t.threadId) && recs.get(t.threadId).analysedIn.length).length,
    pctOfAll: pct(inAnyWeb.length, scope.length), pctOfEligible: pct(eligible.filter((t) => recs.has(t.threadId) && recs.get(t.threadId).analysedIn.length).length, eligible.length),
    pctLinked: pct(linked.length, scope.length), byState,
  };

  const records = [...recs.values()].map((r) => ({
    threadId: r.threadId, runId, generatedAt: nowIso, state: threads[r.threadId].state, title: threads[r.threadId].title,
    places: threads[r.threadId].places, into: r.into, from: r.from, shared: r.shared, analysedIn: r.analysedIn,
  }));
  const index = {
    runId, generatedAt: nowIso, maxAgeDays: MAX_AGE_DAYS,
    targets: { count: targets.length, countries: targets },
    websUsed: fresh.map((r) => ({ country: r.countryName, generatedAt: r.generatedAt, nodes: (r.nodes || []).length })),
    links: flat, shared: sharedFlat, threads, coverage,
  };
  return { index, records };
}

module.exports = { buildWebIndex, MAX_AGE_DAYS, SCOPE_DAYS };
