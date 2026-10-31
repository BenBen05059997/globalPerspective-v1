'use strict';
// RECORD_READS (decision 0054): the topic pool that decides what is posted comes from NewsCache `latest` (ddb, the default), from the record's today view
// (record) or from DynamoDB with a logged comparison (compare). The same topics reach the posting code in every mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws, hoursAgo, freshManifest } = require('../../../shared/test/stubAws');

const topic = (n, extra = {}) => ({ topicId: `Topic ${n}-${n}`, id: `Topic ${n}-${n}`, title: `Title ${n}`, category: 'conflict', regions: ['France'], threadId: `thread-${n}`, significance: 'high',
  sources: [{ source: 'bbc.com', url: 'https://bbc.com/a' }], ...extra });
const topics = [topic(2), topic(1, { threadId: null })];
const view = () => ({
  schemaVersion: 1, updatedAt: hoursAgo(2),
  latest: { updatedAt: hoursAgo(2), topicIds: ['Topic 2-2', 'Topic 1-1'], model: 'm', limit: 13, generationId: 'g', generatedDate: 'd', generatedYear: 2026 },
  entries: [1, 2].map((n) => ({ ...topics[n === 2 ? 0 : 1], eventId: `e${n}`, archivedAt: hoursAgo(2), generationId: 'g', ai: null, latest: { significance: 'high' } })),
});

const run = async (mode, files) => {
  const aws = stubAws({ modules: { './mapImageGenerator': { generateTopicMapImage: async () => null } }, files, ddb: () => ({ Item: { id: 'latest', topics, updatedAt: hoursAgo(2) } }) });
  try {
    const mod = aws.load(path.resolve(__dirname, '../src/index.js'), { TOPICS_DDB_TABLE: 'T', SUMMARIZE_PREDICT_TABLE: 'S', SOCIAL_POSTS_TABLE: 'P', RECORD_READS: mode });
    return { topics: await mod.loadLatestTopics(), reads: aws.reads };
  } finally { aws.restore(); }
};

test('ddb (default) and record give the same posting topics, in the same order; record does not touch DynamoDB', async () => {
  const files = { ...freshManifest(), 'record/views/index/today.json': view() };
  const d = await run(undefined, files);
  const r = await run('record', files);
  assert.deepEqual(r.topics, d.topics);
  assert.deepEqual(d.topics.map((t) => t.topicId), ['Topic 2-2', 'Topic 1-1']);
  assert.equal(d.topics[1].threadId, null);
  assert.ok(d.reads.every((x) => x.startsWith('ddb:')));
  assert.ok(r.reads.every((x) => x.startsWith('s3:')), r.reads.join());
});

test('record without a fresh today view posts from DynamoDB (never from nothing)', async () => {
  for (const files of [{}, { ...freshManifest(), 'record/views/index/today.json': { ...view(), latest: null } }, { 'record/views/manifest.json': { builtAt: hoursAgo(30) }, 'record/views/index/today.json': view() }]) {
    const r = await run('record', files);
    assert.deepEqual(r.topics.map((t) => t.topicId), ['Topic 2-2', 'Topic 1-1']);
    assert.ok(r.reads.some((x) => x.startsWith('ddb:')));
  }
});

test('compare: DynamoDB decides, both are read', async () => {
  const r = await run('compare', { ...freshManifest(), 'record/views/index/today.json': view() });
  assert.deepEqual(r.topics.map((t) => t.topicId), ['Topic 2-2', 'Topic 1-1']);
  assert.ok(r.reads.some((x) => x.startsWith('ddb:')) && r.reads.some((x) => x.startsWith('s3:')));
});
