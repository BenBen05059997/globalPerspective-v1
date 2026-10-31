'use strict';
// RECORD_READS (decision 0054): the topic pool that is ranked for readers comes from NewsCache `latest` (ddb, the default), the record's today view
// (record) or DynamoDB with a logged comparison (compare). The ranking is identical in every mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws, hoursAgo, freshManifest } = require('../../../shared/test/stubAws');
const { rankRecommendations, buildInterestProfile } = require('../src/scoring');

const src = (n) => ({ source: `s${n}.com`, url: `https://s${n}.com/a` });
const topics = [
  { topicId: 'Topic 1-1', id: 'Topic 1-1', threadId: 'thread-a', title: 'One', category: 'conflict', regions: ['Iran'], significance: 'high', urgency: 'high', sources: [...Array(12).keys()].map(src) },
  { topicId: 'Topic 2-2', id: 'Topic 2-2', threadId: 'thread-b', title: 'Two', category: 'politics', regions: ['France'], significance: 'low', sources: [src(1), src(2)] },
  { topicId: 'Topic 3-3', id: 'Topic 3-3', threadId: null, title: 'Three', category: 'economy', regions: ['Japan'], significance: 'medium', sources: [src(1)] },
];
const view = () => ({
  schemaVersion: 1, updatedAt: hoursAgo(2),
  latest: { updatedAt: hoursAgo(2), topicIds: topics.map((t) => t.topicId), model: 'm', limit: 13, generationId: 'g', generatedDate: 'd', generatedYear: 2026 },
  entries: topics.map((t, i) => {
    const { significance, urgency, ...rest } = t;
    return { ...rest, sources: rest.sources.slice(0, 10), eventId: `e${i}`, archivedAt: hoursAgo(2), generationId: 'g', ai: null, latest: { significance, ...(urgency ? { urgency } : {}), ...(rest.sources.length > 10 ? { sources: rest.sources } : {}) } };
  }),
});

const run = async (mode, files) => {
  const aws = stubAws({ files, ddb: () => ({ Item: { id: 'latest', topics, updatedAt: hoursAgo(2) } }) });
  try {
    const mod = aws.load(path.resolve(__dirname, '../src/index.js'), { TOPICS_DDB_TABLE: 'T', RECORD_READS: mode });
    return { topics: await mod.loadTopics(), reads: aws.reads };
  } finally { aws.restore(); }
};

test('record ranks the same pool as ddb (same topics, same order, same scores); DynamoDB is not read', async () => {
  const files = { ...freshManifest(), 'record/views/index/today.json': view() };
  const d = await run(undefined, files);
  const r = await run('record', files);
  assert.deepEqual(r.topics, d.topics);
  const now = Date.now();
  const profile = buildInterestProfile([{ kind: 'thread', refId: 'thread-b' }], { 'thread-a': { category: 'conflict', regions: ['Iran'] } });
  assert.deepEqual(rankRecommendations(r.topics, profile, { limit: 8, now }), rankRecommendations(d.topics, profile, { limit: 8, now }));
  assert.ok(r.reads.every((x) => x.startsWith('s3:')), r.reads.join());
});

test('record with no fresh view reads DynamoDB; compare reads both and returns DynamoDB\'s', async () => {
  const none = await run('record', {});
  assert.equal(none.topics.length, 3);
  assert.ok(none.reads.some((x) => x.startsWith('ddb:')));
  const cmp = await run('compare', { ...freshManifest(), 'record/views/index/today.json': view() });
  assert.equal(cmp.topics.length, 3);
  assert.ok(cmp.reads.some((x) => x.startsWith('ddb:')) && cmp.reads.some((x) => x.startsWith('s3:')));
});
