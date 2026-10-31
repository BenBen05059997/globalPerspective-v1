'use strict';
// RECORD_READS (decision 0054) for the board's server side: presets and connect read the topic pool and the thread analyses from DynamoDB (ddb, the
// default), from the record's views (record) or from DynamoDB with a logged comparison (compare). The presets are the same either way.
const test = require('node:test');
const assert = require('node:assert');
const world = require('../src/world');
const { computePresets } = require('../src/presets');
const { fakeStore, ENV, NOW } = require('./helpers');
const { makeRecordReads } = require('../src/_shared/recordReads');

const iso = (offsetH) => new Date(NOW - offsetH * 3600000).toISOString();
const ANALYSES = {
  'thread-a': { threadTitle: 'A', riskScore: 70, lead: 'political', iso3: ['IRN', 'ISR'], generatedAt: iso(10) },
  'thread-b': { threadTitle: 'B', riskScore: 50, lead: 'conflict', iso3: ['IRQ'], generatedAt: iso(12) },
  'thread-c': { threadTitle: 'C', riskScore: 30, lead: 'economic', iso3: ['FRA'], generatedAt: iso(9) },
};
const TOPICS = [
  { topicId: 'Topic 1-1', id: 'Topic 1-1', threadId: 'thread-a', title: 'One', category: 'conflict', regions: ['Iran'], iso3: ['IRN'], actors: ['Iran'], significance: 'high', sources: [{ source: 'bbc.com', url: 'https://bbc.com/a' }] },
  { topicId: 'Topic 2-2', id: 'Topic 2-2', threadId: 'thread-c', title: 'Two', category: 'politics', regions: ['France'], iso3: ['FRA'], actors: [], significance: 'low', sources: [] },
];

function worldWith() {
  const store = fakeStore();
  for (const [id, a] of Object.entries(ANALYSES)) store.put('world', `THREAD#${id}`, 'THREAD_ANALYSIS', { PK: `THREAD#${id}`, SK: 'THREAD_ANALYSIS', threadId: id, ...a, ttl: Math.floor((NOW + 86400000) / 1000) });
  store.put('news', 'latest', '', { id: 'latest', topics: TOPICS, updatedAt: iso(2) });
  store.put('world', 'WEB#INDEX', 'LATEST', { links: [], shared: [], threads: { 'thread-a': {}, 'thread-b': {}, 'thread-c': {} } });
  const files = {
    'record/views/manifest.json': { builtAt: iso(1) },
    'record/views/index/today.json': {
      schemaVersion: 1, updatedAt: iso(2),
      latest: { updatedAt: iso(2), topicIds: TOPICS.map((t) => t.topicId), model: 'm', limit: 13, generationId: 'g', generatedDate: 'd', generatedYear: 2026 },
      entries: TOPICS.map((t, i) => { const { significance, ...rest } = t; return { ...rest, eventId: `e${i}`, archivedAt: iso(2), generationId: 'g', ai: null, latest: { significance } }; }),
    },
    ...Object.fromEntries(Object.entries(ANALYSES).map(([id, a]) => [`record/views/stories/${id}.json`, { threadId: id, analysis: { ...a, threadId: id, iso3: [...a.iso3].sort() } }])),
  };
  const reads = [];
  store.recordReads = makeRecordReads({ getJson: async (k) => { reads.push(k); return files[k] ?? null; }, now: () => NOW });
  return { store, reads, files };
}
const env = (mode) => ({ ...ENV, ...(mode ? { RECORD_READS: mode } : {}) });

test('record: the same latest pool and the same analyses as DynamoDB, read from the views', async () => {
  const { store, reads } = worldWith();
  const d = await world.latestTopics(store, env());
  const r = await world.latestTopics(store, env('record'));
  const shape = (t) => [t.topicId, t.threadId, t.title, t.category, t.regions, t.iso3, t.actors, t.sources];
  assert.deepStrictEqual(r.map(shape), d.map(shape));
  assert.ok(reads.some((k) => k.endsWith('index/today.json')));
  const ids = ['thread-a', 'thread-b', 'thread-c', 'thread-none'];
  const da = await world.analyses(store, env(), ids, NOW);
  const ra = await world.analyses(store, env('record'), ids, NOW);
  assert.deepStrictEqual([...ra.keys()], [...da.keys()]);
  for (const [id, a] of da) {
    for (const k of ['title', 'riskScore', 'tier', 'lead', 'trajectory', 'keyActors', 'entryCount', 'generatedAt']) assert.deepStrictEqual(ra.get(id)[k], a[k], `${id}.${k}`);
    assert.deepStrictEqual([...ra.get(id).iso3].sort(), [...a.iso3].sort());
  }
});

test('record presets list the same stories under the same regions as ddb presets', async () => {
  const { store } = worldWith();
  const d = await computePresets(store, env(), NOW);
  const r = await computePresets(store, env('record'), NOW);
  assert.ok(d.length > 0);
  assert.deepStrictEqual(r.map((p) => [p.title, p.pins.map((x) => x.refId)]), d.map((p) => [p.title, p.pins.map((x) => x.refId)]));
});

test('stale views: record mode reads DynamoDB (never an empty pool); compare returns DynamoDB\'s answer', async () => {
  const { store, files } = worldWith();
  files['record/views/manifest.json'] = { builtAt: iso(30) };
  const ra = await world.analyses(store, env('record'), ['thread-a'], NOW);
  assert.deepStrictEqual([...ra.keys()], ['thread-a']);
  const topics = await world.latestTopics(store, env('record'));
  assert.strictEqual(topics.length, 2);
  files['record/views/manifest.json'] = { builtAt: iso(1) };
  const cmp = await world.analyses(store, env('compare'), ['thread-a'], NOW);
  assert.deepStrictEqual([...cmp.keys()], ['thread-a']);
});
