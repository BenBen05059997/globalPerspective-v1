'use strict';

// Region presets: for each region, up to PRESET_THREADS highest-risk threads as thread pins, with ours-strings
// between them taken from WEB#INDEX (causal links, then shared-actor pairs). Every string is 'inferred'
// (slice 1 rule: the web's own strength is shown at read time, never stored as confirmed).

const { normalizeBoard } = require('./_shared/record');
const { regionOf, presetIdOf } = require('./_shared/regions');
const world = require('./world');

const PRESET_THREADS = 8;
const MIN_THREADS = 2;
const PRESET_TTL_MS = 10 * 60 * 1000;

const pinIdAt = (i) => `p${String(i + 1).padStart(2, '0')}`;

// The web lists a pair once per country web that judged it, in no fixed order (WEB#INDEX keeps the run's, the record's view sorts by story id):
// oldest first, so the newest judgement is the later string, which normalizeBoard keeps, whichever store answered.
const keyOf = (x) => [x.generatedAt || '', x.country || '', x.from || x.a, x.to || x.b].join('|');
const oldestFirst = (list) => list.slice().sort((x, y) => (keyOf(x) < keyOf(y) ? -1 : keyOf(x) > keyOf(y) ? 1 : 0));

async function computePresets(store, env, nowMs) {
  const index = await world.webIndex(store, env);
  const topics = await world.latestTopics(store, env);
  const topicOf = new Map();
  for (const t of topics) if (t.threadId && !topicOf.has(t.threadId)) topicOf.set(t.threadId, t);
  const ids = [...new Set([...Object.keys(index.threads), ...topicOf.keys()])];
  const rows = await world.analyses(store, env, ids, nowMs);

  const byRegion = new Map();
  for (const [id, a] of rows) {
    if (a.riskScore === null) continue;
    // a story belongs to every region its countries fall in (a place involved is a place affected), so the order of iso3 never matters;
    // hence the name "Stories touching <Region>" (board look 2026-11-20, decision 5)
    const regions = new Set(world.threadIso3(a, index.threads[id], topicOf.get(id)).map(regionOf).filter(Boolean));
    const title = a.title || (index.threads[id] && index.threads[id].title) || (topicOf.get(id) && topicOf.get(id).title) || id;
    for (const region of regions) {
      if (!byRegion.has(region)) byRegion.set(region, []);
      byRegion.get(region).push({ threadId: id, title, riskScore: Number(a.riskScore), lead: a.lead || null });
    }
  }

  const generatedAt = new Date(nowMs).toISOString();
  const presets = [];
  for (const [region, list] of byRegion) {
    if (list.length < MIN_THREADS) continue;
    const top = list.sort((x, y) => y.riskScore - x.riskScore || (x.threadId < y.threadId ? -1 : 1)).slice(0, PRESET_THREADS);
    const pinOf = new Map(top.map((t, i) => [t.threadId, pinIdAt(i)]));
    const strings = [];
    for (const s of oldestFirst(index.shared)) {
      if (!pinOf.has(s.a) || !pinOf.has(s.b)) continue;
      const actors = (s.actors || []).slice(0, 4).join(', ');
      strings.push({ a: pinOf.get(s.a), b: pinOf.get(s.b), owner: 'ours', strength: 'inferred', ...(actors ? { mechanism: `Shared actors: ${actors}`.slice(0, 280) } : {}) });
    }
    for (const l of oldestFirst(index.links)) { // after the shared pairs: normalizeBoard keeps the later string, which has the mechanism
      if (!pinOf.has(l.from) || !pinOf.has(l.to)) continue;
      strings.push({ a: pinOf.get(l.from), b: pinOf.get(l.to), owner: 'ours', strength: 'inferred', ...(l.mechanism ? { mechanism: String(l.mechanism).slice(0, 280) } : {}) });
    }
    // read-time only (board look 2026-11-20, QUESTIONS 3): the judged links with their direction and strength, and the shared-name pairs,
    // apart, so a region board can draw them like a theme board. `strings` stay as they were (what a fork stores).
    const judged = new Map();
    for (const l of oldestFirst(index.links)) if (pinOf.has(l.from) && pinOf.has(l.to) && l.from !== l.to) judged.set(`${l.from}|${l.to}`, { from: pinOf.get(l.from), to: pinOf.get(l.to), strength: l.confidence ?? null, judgedAt: l.generatedAt ?? null });
    const pairOf = (a, b) => [pinOf.get(a), pinOf.get(b)].sort().join('|');
    const judgedPairs = new Set([...judged.keys()].map((k) => pairOf(...k.split('|'))));
    const shared = new Map();
    for (const x of index.shared) {
      if (!pinOf.has(x.a) || !pinOf.has(x.b) || x.a === x.b || judgedPairs.has(pairOf(x.a, x.b))) continue;
      const [a, b] = [pinOf.get(x.a), pinOf.get(x.b)].sort();
      const row = shared.get(`${a}|${b}`) || shared.set(`${a}|${b}`, { a, b, actors: new Set() }).get(`${a}|${b}`);
      for (const n of x.actors || []) row.actors.add(n);
    }
    const pins = top.map((t) => ({ pinId: pinOf.get(t.threadId), kind: 'thread', refId: t.threadId, title: t.title, riskScore: t.riskScore, lead: t.lead }));
    const clean = normalizeBoard({ pins, strings });
    presets.push({
      presetId: presetIdOf(region), name: `Stories touching ${region}`, region, pins: clean.pins, strings: clean.strings, generatedAt,
      links: [...judged.values()].sort((x, y) => (x.from + x.to < y.from + y.to ? -1 : 1)),
      shared: [...shared.values()].map((r) => ({ a: r.a, b: r.b, actors: [...r.actors].sort() })).sort((x, y) => (x.a + x.b < y.a + y.b ? -1 : 1)),
    });
  }
  return presets.sort((x, y) => (x.region < y.region ? -1 : 1));
}

/** A cached reader: one computation per PRESET_TTL_MS per handler instance. */
function presetCache(store, env, now) {
  let at = 0;
  let value = null;
  return async () => {
    const nowMs = now();
    if (value && nowMs - at < PRESET_TTL_MS) return value;
    value = await computePresets(store, env, nowMs);
    at = nowMs;
    return value;
  };
}

module.exports = { computePresets, presetCache };
