'use strict';

// newsBoard's view of the world's data for presets and connect. It parses nothing: every raw row is read and
// normalised by `_shared/world/` (the one reader, ARCHITECTURE_TIMELINE.md; row shapes are documented in its
// README). The `store` passed in is the world client (store.js has getItem / batchGet / query); `env` names the
// tables (SUMMARIZE_PREDICT_TABLE, TOPICS_DDB_TABLE). What stays here is board logic over normalised objects:
// which ISO3 codes and actor names a thread has.

const world = require('./_shared/world');
const { resolveIso3 } = require('./_shared/resolveIso3');
const { readMode, readBy, SAME, lazyRecordReads } = require('./_shared/recordReads');
const NR = require('./_shared/noteReads');

// RECORD_READS=ddb|record|compare in `env` (decision 0054): the topic pool (NewsCache `latest`), the thread analyses (THREAD_ANALYSIS), the story
// web (WEB#INDEX/LATEST) and the score histories (THREAD_HISTORY#, COUNTRY# HISTORY#) come from the record. The record's rows go through the same
// normalisers as DynamoDB's (world/readers.js), so the board logic below sees one shape. Views older than 9 h answer nothing (recordReads fresh()),
// and DynamoDB answers, for every family. `store.recordReads` / `store.noteReader` are for tests; the Lambda builds the S3 readers on first use,
// once per env, so a warm instance keeps the notes it loaded (s3NoteReader caches each subtype 5 minutes).
const built = new WeakMap();
const once = (env, name, make) => {
  const m = built.get(env) || {};
  built.set(env, m);
  return m[name] || (m[name] = make());
};
const recordsFor = (store, env) => store.recordReads || once(env, 'views', () => lazyRecordReads(env));
const notesFor = (store, env) => store.noteReader || once(env, 'notes', () => NR.s3NoteReader({ ...(env.WORLD_BUCKET ? { bucket: env.WORLD_BUCKET } : {}), prefix: 'record/' }));
/** `read(records)` while the views are fresh, else null (so DynamoDB answers). */
const whileFresh = async (store, env, read) => { const records = recordsFor(store, env); return (await records.fresh()) ? read(records) : null; };

const webIndex = (store, env) => readBy({
  mode: readMode(env), label: 'board web_index', same: SAME.webIndex,
  ddb: () => world.webIndex(store, { env }),
  record: async () => world.webIndexOfView(await recordsFor(store, env).webIndexView()),
});
const latestTopics = (store, env) => readBy({
  mode: readMode(env), label: 'board latest', same: SAME.latest,
  ddb: () => world.latestTopics(store, { env }),
  record: async () => { const item = await recordsFor(store, env).latestItem(); return item ? world.latestTopicsOfItem(item) : null; },
});
// A story's history is every story_analysis note of it plus the story_history copies of the days before (noteReads.threadHistory).
const threadHistory = (store, env, id) => readBy({
  mode: readMode(env), label: `board thread_history ${id}`, same: SAME.history,
  ddb: () => world.threadHistory(store, id, undefined, undefined, { env }),
  record: () => whileFresh(store, env, async () => {
    const notes = notesFor(store, env);
    const [analysisNotes, historyNotes] = await Promise.all([notes.all('story_analysis'), notes.all('story_history')]);
    return world.threadHistoryOfRows(NR.threadHistory(analysisNotes, historyNotes, id));
  }),
});
// `name` is the COUNTRY# key spelling (resolveIso3's name, connect.js); the country notes are keyed by ISO3. A name that is no country has none.
// Every day, as the HISTORY# query returns them (noteReads caps at 90 days unless told otherwise).
const countryHistory = (store, env, name) => readBy({
  mode: readMode(env), label: `board country_history ${name}`, same: SAME.history,
  ddb: () => world.countryHistory(store, name, undefined, undefined, { env }),
  record: () => whileFresh(store, env, async () => {
    const r = resolveIso3(name);
    return r ? world.countryHistoryOfRows(NR.countryHistory(await notesFor(store, env).all('country'), r.iso3, Infinity)) : [];
  }),
});

/** { threadId -> analysis } as a Map; analyses past their TTL are dropped. */
async function analyses(store, env, threadIds, nowMs) {
  const ids = [...new Set((threadIds || []).filter((id) => typeof id === 'string' && id))];
  const found = await readBy({
    mode: readMode(env), label: 'board thread_analysis',
    same: SAME.threadAnalysis, // iso3 order is not compared: a preset takes every region of the list, so the order never matters
    ddb: () => world.threadAnalysis(store, ids, { env, nowMs }),
    record: async () => {
      if (!ids.length) return null;
      // stale views: DynamoDB answers; fresh views are the whole record, a thread without an analysis has none
      return whileFresh(store, env, async (records) => {
        const rows = (await Promise.all(ids.map((id) => records.threadAnalysisRow(id)))).filter(Boolean);
        return world.threadAnalysisOfRows(rows, { nowMs });
      });
    },
  });
  return new Map(Object.entries(found));
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
