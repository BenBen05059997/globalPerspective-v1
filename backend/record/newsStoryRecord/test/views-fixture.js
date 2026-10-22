'use strict';
// Hand-written facts for the views tests. Not a test file.
let n = 0;
function fact(kind, threadId, at, {payload = {}, iso3 = [], actorIds = [], sourceIds = [], id, sources} = {}) {
  n += 1;
  return {
    schemaVersion: 1, eventId: id || `${kind}-${String(n).padStart(4, '0')}`, kind, at, date: at.slice(0, 10), precision: 'exact', threadId,
    iso3, actorIds, sourceIds, payload, producer: {lambda: 'newsStoryRecord@test', runId: 'r'}, sourceKey: `k${n}`, sourceRow: {store: 't', key: `k${n}`},
    ...(sources ? {idBasis: 'url', sources} : {}),
  };
}
const src = (id, url = `https://${id}.test/a`) => ({sourceId: id, outlet: id.toUpperCase(), url, title: 't'});
const entry = (threadId, at, title, o = {}) => fact('entry', threadId, at, {
  id: o.id, iso3: o.iso3 || [], actorIds: o.actorIds || [], sourceIds: (o.sources || ['s1']).sort(), sources: (o.sources || ['s1']).map((s) => src(s)),
  payload: {title, summary: null, category: 'conflict', eventType: 'unrest', continuesTopic: null, topicId: `${title}-1`},
});
const born = (threadId, at, day) => fact('story_born', threadId, at, {payload: {born: day, firstTitle: 'x'}});
const branch = (id, due, extra = {}) => ({branchId: id, text: `text ${id}`, p: 40, trigger: `trigger ${id}`, resolutionSource: 'Reuters', due, question: true, qid: `q-${id}`, scenarioP: 50, ...extra});
const forecast = (threadId, at, forkId, branches) => fact('forecast_drawn', threadId, at, {payload: {forkId, topicId: 't', branches}});
const verdict = (threadId, at, branchId, result = 'yes', revision = 1) => fact('verdict', threadId, at, {payload: {qid: `q-${branchId}`, branchId, result, revision, decidedBy: 'agent', evidence: {url: 'https://e.test'}, reason: null, voidReason: null}});
const correction = (threadId, at, corrects) => fact('correction', threadId, at, {payload: {corrects, what: 'wrong date', reason: 'operator'}});
const merged = (into, at, from, reason = 'same event') => fact('story_merged', into, at, {payload: {from, into, reason, evidence: []}});
/** A reading line (record/readings/YYYY-Www.jsonl). `key` makes readingId unique per (week, thread, subtype, key). */
const reading = (week, threadId, subtype, payload, o = {}) => ({
  schemaVersion: 1, readingId: o.readingId || `r-${week}-${threadId}-${subtype}-${o.key ?? ''}`, week, threadId, subtype, payload, cites: o.cites || ['a'.repeat(40)],
  covers: {from: '2026-10-12', to: '2026-10-18'}, supersedes: o.supersedes || null, run: o.run || `review-${week}`, model: 'stub', promptVersion: 'v1', confidence: o.confidence || 'high',
});
const run = (at) => fact('run', null, at, {payload: {runId: 'r', status: 'ok', counts: {}}});

/** The golden set: thread-a (forecast, verdict, correction), thread-b (+ merged thread-c, chain thread-d), thread-old (inactive). */
function golden() {
  n = 0;
  return [
    born('thread-a', '2026-10-18T04:00:00.000Z', '2026-10-18'),
    entry('thread-a', '2026-10-18T04:00:00.000Z', 'A first', {id: 'ea1', iso3: ['FRA'], actorIds: ['name:macron'], sources: ['s1', 's2']}),
    entry('thread-a', '2026-10-20T04:00:00.000Z', 'A second', {id: 'ea2', iso3: ['FRA', 'DEU'], actorIds: ['name:macron'], sources: ['s1']}),
    forecast('thread-a', '2026-10-20T05:00:00.000Z', 'PRED#A/2026-10-20', [branch('a-0', '2026-10-25'), branch('a-1', '2026-10-21'), branch('a-2', '2026-10-22'), branch('a-3', '2026-10-20')]),
    verdict('thread-a', '2026-10-22T06:00:00.000Z', 'a-2', 'yes'),
    verdict('thread-a', '2026-10-20T09:00:00.000Z', 'a-3', 'no'),
    correction('thread-a', '2026-10-21T08:00:00.000Z', 'ea1'),
    born('thread-b', '2026-10-19T04:00:00.000Z', '2026-10-19'),
    entry('thread-b', '2026-10-19T04:00:00.000Z', 'B first', {id: 'eb1', iso3: ['FRA'], actorIds: ['name:putin'], sources: ['s1']}),
    born('thread-c', '2026-10-17T04:00:00.000Z', '2026-10-17'),
    entry('thread-c', '2026-10-17T04:00:00.000Z', 'C first', {id: 'ec1', iso3: ['UKR'], actorIds: ['name:putin'], sources: ['s3']}),
    forecast('thread-c', '2026-10-17T05:00:00.000Z', 'PRED#C/2026-10-17', [branch('c-0', '2026-10-30')]),
    merged('thread-b', '2026-10-21T09:05:00.000Z', 'thread-c'),
    born('thread-old', '2026-07-01T04:00:00.000Z', '2026-07-01'),
    entry('thread-old', '2026-07-01T04:00:00.000Z', 'Old first', {id: 'eo1', iso3: ['FRA'], sources: ['s1']}),
    run('2026-10-21T05:45:00.000Z'),
  ];
}
module.exports = {reading, fact, entry, born, branch, forecast, verdict, correction, merged, run, golden, src};
