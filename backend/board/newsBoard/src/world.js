'use strict';

// Reads of the world's data for presets and connect. Read-only: SummarizeAndPredict (WEB#INDEX, THREAD_ANALYSIS,
// THREAD_HISTORY#, COUNTRY# HISTORY#) and NewsCache `latest`. Row shapes (checked against live rows 2026-10-20):
//   WEB#INDEX/LATEST   { links:[{from,to,confidence,lagDays,mechanism,cited,country,generatedAt}],
//                        shared:[{a,b,actors[],weight,country,generatedAt}],
//                        threads:{ <threadId>: {state,title,entries,places:[{name,n}],analysedIn[]} } }
//   THREAD#<id>/THREAD_ANALYSIS  { threadId, threadTitle, riskScore, lead, iso3 (array; absent on older rows),
//                        keyActors:[{name,role,mentionCount}], entryCount, generatedAt, ttl }
//   THREAD#<id>/THREAD_HISTORY#<date>  { dateKey, riskScore, trajectory, threadTitle }
//   COUNTRY#<name>/HISTORY#<date>      { dateKey, riskScore, riskLevel, trajectory, headline }
//   NewsCache id='latest'  { topics:[{threadId,title,actors[],iso3[],regions[],sources:[{source,...}]}] }
// There is no `type` field on a thread analysis; `lead` (the leading risk dimension) is the nearest thing.

const { resolveIso3 } = require('./_shared/resolveIso3');

const tables = (env) => ({ world: env.SUMMARIZE_PREDICT_TABLE, news: env.TOPICS_DDB_TABLE });

async function webIndex(store, env) {
  const row = await store.getItem(tables(env).world, { PK: 'WEB#INDEX', SK: 'LATEST' });
  return {
    links: (row && row.links) || [],
    shared: (row && row.shared) || [],
    threads: (row && row.threads) || {},
  };
}

async function latestTopics(store, env) {
  const row = await store.getItem(tables(env).news, { id: 'latest' });
  return (row && Array.isArray(row.topics) && row.topics) || [];
}

async function analyses(store, env, threadIds, nowMs) {
  if (!threadIds.length) return new Map();
  const rows = await store.batchGet(tables(env).world, threadIds.map((id) => ({ PK: `THREAD#${id}`, SK: 'THREAD_ANALYSIS' })));
  const out = new Map();
  for (const r of rows) {
    if (!r || !r.threadId) continue;
    if (Number.isFinite(r.ttl) && r.ttl * 1000 < nowMs) continue; // expired, TTL deletion lags
    out.set(r.threadId, r);
  }
  return out;
}

const history = (rows, dateOf) => rows
  .map((r) => ({ date: r.dateKey || dateOf(r), score: Number(r.riskScore) }))
  .filter((p) => p.date && Number.isFinite(p.score));

const threadHistory = async (store, env, id) =>
  history(await store.query(tables(env).world, `THREAD#${id}`, 'THREAD_HISTORY#'), (r) => String(r.SK || '').replace('THREAD_HISTORY#', ''));

const countryHistory = async (store, env, name) =>
  history(await store.query(tables(env).world, `COUNTRY#${name}`, 'HISTORY#'), (r) => String(r.SK || '').replace('HISTORY#', ''));

/** ISO3 codes of a thread, most reliable first: the analysis, the web's top places, the topic pool's tags. */
function threadIso3(analysis, indexThread, topic) {
  const out = [];
  const add = (c) => { if (c && !out.includes(c)) out.push(c); };
  for (const c of (analysis && Array.isArray(analysis.iso3) ? analysis.iso3 : [])) add(c);
  for (const p of (indexThread && indexThread.places) || []) { const r = resolveIso3(p.name); if (r) add(r.iso3); }
  for (const c of (topic && topic.iso3) || []) add(c);
  return out;
}

/** Actor names of a thread: analysis key actors, the topic pool's actors, and the actors the web says it shares
 *  with other threads. */
function threadActors(id, analysis, topic, index) {
  const names = [];
  for (const a of (analysis && analysis.keyActors) || []) names.push(typeof a === 'string' ? a : a && a.name);
  for (const a of (topic && topic.actors) || []) names.push(a);
  for (const s of index.shared) if (s.a === id || s.b === id) names.push(...(s.actors || []));
  return names.filter((n) => typeof n === 'string' && n.trim());
}

module.exports = { webIndex, latestTopics, analyses, threadHistory, countryHistory, threadIso3, threadActors };
