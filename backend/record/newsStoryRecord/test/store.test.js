'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fakeS3} = require('./fake-s3');
const {makeHandler} = require('../src/index');
const {makeStore} = require('../src/store');
const {fakeClient} = require('../../../shared/test/world.fake');

const date = '2026-10-10';
const pred = (topicId, extra = {}) => ({
  PK: `PRED#${topicId}`, SK: date, topicId, generatedAt: `${date}T04:26:07.851Z`, methodologyVersion: 1, questionSchema: 1,
  scenarios: [{label: 'L', probability: 0.5, triggers: [{id: '0-0', text: 'X happens', deadline: '2026-11-10', p: 40, question: true, qid: `q-${topicId}`}]}], ...extra,
});
const entry = (n) => ({topicId: `T ${n}-${n}`, threadId: 'thread-x', title: `Title ${n}`, sources: [{source: 'bbc.com', url: `https://bbc.com/${n}`}], archivedAt: `${date}T03:00:00.000Z`, generationId: 'g'});

test('a PRED# row whose topic is not among the day\'s entries still becomes a forecast_drawn fact (own threadId, else the topic\'s entry in the window)', async () => {
  const c = fakeClient();
  c.put('NewsCache', {id: `archive#${date}`, entries: Array.from({length: 20}, (_, n) => entry(n))});
  c.put('NewsCache', {id: 'archive#2026-10-05', entries: [{...entry(99), topicId: 'Older topic-3', threadId: 'thread-old'}]});
  c.put('GlobalPerspectivePredictionLog', pred('T 1-1')); // in the day's entries
  c.put('GlobalPerspectivePredictionLog', pred('Elsewhere-1', {threadId: 'thread-own'})); // not in the entries: the row names its thread
  c.put('GlobalPerspectivePredictionLog', pred('Older topic-3', {questionSchema: undefined})); // not in the day's entries: an older entry gives the thread
  c.put('GlobalPerspectivePredictionLog', pred('Nowhere-2')); // no thread anywhere: skipped
  const f = fakeS3();
  const handler = makeHandler({store: makeStore(c), s3json: f.s3json, manifest: f.manifest, now: () => `${date}T05:45:00.000Z`});
  await handler({date});
  const drawn = f.lines('record/shadow/facts/2026-10-10.jsonl').filter((x) => x.kind === 'forecast_drawn');
  assert.deepEqual(drawn.map((x) => [x.payload.topicId, x.threadId]).sort(), [['Elsewhere-1', 'thread-own'], ['Older topic-3', 'thread-old'], ['T 1-1', 'thread-x']]);
  // a second run of the same day is the same facts (eventId rule unchanged)
  await handler({date});
  assert.equal(f.lines('record/shadow/facts/2026-10-10.jsonl').filter((x) => x.kind === 'forecast_drawn').length, 3);
});
