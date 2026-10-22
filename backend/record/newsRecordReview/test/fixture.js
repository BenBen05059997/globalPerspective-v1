'use strict';
// A tiny record for the week 2026-W42 (2026-10-12..2026-10-18), shadow prefix. Not a test file.
const {fakeS3} = require('./fake-s3');

const P = 'record/shadow/';
const WEEK = '2026-W42';

const fact = (kind, threadId, date, eventId, payload, extra = {}) => ({
  schemaVersion: 1, eventId, kind, at: `${date}T09:00:00.000Z`, date, precision: 'exact', threadId, iso3: [], actorIds: [], sourceIds: [], payload,
  producer: {lambda: 'newsStoryRecord@0.3.0', runId: `${date}-1`}, sourceKey: `k-${eventId}`, sourceRow: {store: 'x', key: eventId}, ...extra,
});
const entry = (threadId, date, eventId, title, extra = {}) => fact('entry', threadId, date, eventId, {title, summary: null, category: 'politics', eventType: 'diplomacy', continuesTopic: null, topicId: title},
  {iso3: ['UKR'], actorIds: ['name:tusk'], sources: [{sourceId: 's1', outlet: 'BBC', url: `https://x/${eventId}`, title}], ...extra});
const forecast = (threadId, date, eventId, branches) => fact('forecast_drawn', threadId, date, eventId, {forkId: `PRED#${threadId}/${date}`, topicId: 't', branches});
const branch = (branchId, due, qid = `q-${branchId}`) => ({branchId, text: `Outcome ${branchId}`, p: 60, trigger: 'x', resolutionSource: 'y', due, question: true, qid, scenarioP: 60});
const verdict = (threadId, date, eventId, branchId, result, extra = {}) => fact('verdict', threadId, date, eventId, {qid: `q-${branchId}`, branchId, result, revision: 1, decidedBy: 'agent', evidence: null, reason: null, voidReason: null, ...extra});

const row = (threadId, over = {}) => ({
  threadId, born: '2026-10-05', lastFactAt: '2026-10-15T09:00:00.000Z', iso3: ['UKR'], actorIds: ['name:tusk'], sourceCount: 1, entryCount: 2, forkCount: 0, branchCount: 0,
  liveBranchCount: 0, latestVerdictAt: null, aliasOf: null, aliases: [], title: `Title ${threadId}`, ...over,
});

/** 45 filler stories (so a shared actor of two stories stays under the 5% share) + thread-a, thread-b, thread-c. */
function world(over = {}) {
  const f = fakeS3();
  const filler = Array.from({length: 45}, (_, i) => row(`filler-${i}`, {iso3: ['USA'], actorIds: ['name:filler'], lastFactAt: '2026-10-01T00:00:00.000Z'}));
  const rows = over.rows || [row('thread-a', {iso3: ['UKR', 'POL'], actorIds: ['name:tusk', 'name:zelensky'], born: '2026-10-05'}), row('thread-b', {born: '2026-10-08', lastFactAt: '2026-10-14T09:00:00.000Z'}), row('thread-c', {iso3: ['JPN'], actorIds: ['name:kishida'], lastFactAt: '2026-10-13T09:00:00.000Z'})];
  f.put(`${P}views/manifest.json`, {schemaVersion: 1, builtAt: '2026-10-19T00:00:00.000Z', runId: 'r', factsManifestDays: 3, factsThrough: over.factsThrough || '2026-10-18', readingsThrough: null});
  f.put(`${P}views/index/active.json`, {schemaVersion: 1, builtFrom: {factsThrough: '2026-10-18', readingsThrough: null}, stories: [...rows, ...filler]});
  const days = over.days || {
    '2026-10-13': [entry('thread-a', '2026-10-13', 'a1', 'A one'), forecast('thread-a', '2026-10-13', 'fa', [branch('b1', '2026-10-16'), branch('b2', '2026-10-30'), branch('b3', '2026-10-17'), branch('b4', '2026-10-17')]),
      entry('thread-c', '2026-10-13', 'c1', 'C one', {iso3: ['JPN'], actorIds: ['name:kishida']})],
    '2026-10-14': [entry('thread-b', '2026-10-14', 'b1e', 'B one')],
    '2026-10-15': [entry('thread-a', '2026-10-15', 'a2', 'A two'), verdict('thread-a', '2026-10-15', 'va1', 'b1', 'yes'), verdict('thread-a', '2026-10-15', 'va3', 'b3', 'no'), verdict('thread-a', '2026-10-15', 'va4', 'b4', 'void', {voidReason: 'unclear'})],
  };
  for (const [d, facts] of Object.entries(days)) f.putLines(`${P}facts/${d}.jsonl`, facts);
  f.put(`${P}facts/manifest.json`, {schemaVersion: 1, days: Object.keys(days).sort()});
  return f;
}

module.exports = {P, WEEK, fact, entry, forecast, branch, verdict, row, world};
