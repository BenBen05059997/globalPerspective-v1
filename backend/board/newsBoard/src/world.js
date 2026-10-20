'use strict';

// newsBoard's view of the world's data for presets and connect. It parses nothing: every raw row is read and
// normalised by `_shared/world/` (the one reader, ARCHITECTURE_RECORD.md §0c; row shapes are documented in its
// README). The `store` passed in is the world client (store.js has getItem / batchGet / query); `env` names the
// tables (SUMMARIZE_PREDICT_TABLE, TOPICS_DDB_TABLE). What stays here is board logic over normalised objects:
// which ISO3 codes and actor names a thread has.

const world = require('./_shared/world');
const { resolveIso3 } = require('./_shared/resolveIso3');

const webIndex = (store, env) => world.webIndex(store, { env });
const latestTopics = (store, env) => world.latestTopics(store, { env });
const threadHistory = (store, env, id) => world.threadHistory(store, id, undefined, undefined, { env });
const countryHistory = (store, env, name) => world.countryHistory(store, name, undefined, undefined, { env });

/** { threadId -> analysis } as a Map; analyses past their TTL are dropped. */
async function analyses(store, env, threadIds, nowMs) {
  return new Map(Object.entries(await world.threadAnalysis(store, threadIds, { env, nowMs })));
}

/** ISO3 codes of a thread, most reliable first: the analysis, the web's top places, the topic pool's tags. */
function threadIso3(analysis, indexThread, topic) {
  const out = [];
  const add = (c) => { if (c && !out.includes(c)) out.push(c); };
  for (const c of (analysis && analysis.iso3) || []) add(c);
  for (const p of (indexThread && indexThread.places) || []) { const r = resolveIso3(p.name); if (r) add(r.iso3); }
  for (const c of (topic && topic.iso3) || []) add(c);
  return out;
}

/** Actor names of a thread: analysis key actors, the topic pool's actors, and the actors the web says it shares
 *  with other threads. */
function threadActors(id, analysis, topic, index) {
  const names = [];
  for (const a of (analysis && analysis.keyActors) || []) names.push(a.name);
  for (const a of (topic && topic.actors) || []) names.push(a);
  for (const s of index.shared) if (s.a === id || s.b === id) names.push(...s.actors);
  return names.filter((n) => typeof n === 'string' && n.trim());
}

/** Outlets of a topic in the latest pool (distinct hosts, as the world reader names them). */
const threadOutlets = (topic) => (topic ? world.outletsOf([topic]) : []);

module.exports = { webIndex, latestTopics, analyses, threadHistory, countryHistory, threadIso3, threadActors, threadOutlets };
