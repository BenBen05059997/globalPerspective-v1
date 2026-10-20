'use strict';

// Region presets: for each region, up to PRESET_THREADS highest-risk threads as thread pins, with ours-strings
// between them taken from WEB#INDEX (causal links, then shared-actor pairs). Every string is 'inferred'
// (slice 1 rule: the web's own strength is shown at read time, never stored as confirmed).

const { normalizeBoard } = require('./_shared/record');
const { regionOf, presetIdOf } = require('./regions');
const world = require('./world');

const PRESET_THREADS = 8;
const MIN_THREADS = 2;
const PRESET_TTL_MS = 10 * 60 * 1000;

const pinIdAt = (i) => `p${String(i + 1).padStart(2, '0')}`;

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
    const iso3 = world.threadIso3(a, index.threads[id], topicOf.get(id));
    const iso = iso3.find((c) => regionOf(c));
    if (!iso) continue;
    const region = regionOf(iso);
    const title = a.title || (index.threads[id] && index.threads[id].title) || (topicOf.get(id) && topicOf.get(id).title) || id;
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push({ threadId: id, title, riskScore: Number(a.riskScore), lead: a.lead || null });
  }

  const generatedAt = new Date(nowMs).toISOString();
  const presets = [];
  for (const [region, list] of byRegion) {
    if (list.length < MIN_THREADS) continue;
    const top = list.sort((x, y) => y.riskScore - x.riskScore || (x.threadId < y.threadId ? -1 : 1)).slice(0, PRESET_THREADS);
    const pinOf = new Map(top.map((t, i) => [t.threadId, pinIdAt(i)]));
    const strings = [];
    for (const s of index.shared) {
      if (!pinOf.has(s.a) || !pinOf.has(s.b)) continue;
      const actors = (s.actors || []).slice(0, 4).join(', ');
      strings.push({ a: pinOf.get(s.a), b: pinOf.get(s.b), owner: 'ours', strength: 'inferred', ...(actors ? { mechanism: `Shared actors: ${actors}`.slice(0, 280) } : {}) });
    }
    for (const l of index.links) { // after the shared pairs: normalizeBoard keeps the later string, which has the mechanism
      if (!pinOf.has(l.from) || !pinOf.has(l.to)) continue;
      strings.push({ a: pinOf.get(l.from), b: pinOf.get(l.to), owner: 'ours', strength: 'inferred', ...(l.mechanism ? { mechanism: String(l.mechanism).slice(0, 280) } : {}) });
    }
    const pins = top.map((t) => ({ pinId: pinOf.get(t.threadId), kind: 'thread', refId: t.threadId, title: t.title, riskScore: t.riskScore, lead: t.lead }));
    const clean = normalizeBoard({ pins, strings });
    presets.push({ presetId: presetIdOf(region), name: `${region}: highest-risk stories`, region, pins: clean.pins, strings: clean.strings, generatedAt });
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

module.exports = { computePresets, presetCache, PRESET_TTL_MS, PRESET_THREADS };
