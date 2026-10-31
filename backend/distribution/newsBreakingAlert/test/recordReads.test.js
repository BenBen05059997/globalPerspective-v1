'use strict';
// RECORD_READS (decision 0054): the topic pool that decides an alert comes from DynamoDB (ddb, the default), from the record's views (record) or
// from DynamoDB with a logged comparison (compare). Story analyses and region risk follow NOTES_READS (0053). A story's source count (the score's
// input) is the same in every mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws, hoursAgo, freshManifest } = require('../../../shared/test/stubAws');

const src = (n) => ({ source: `s${n}.com`, title: `t${n}`, url: `https://s${n}.com/a` });
const twelve = [...Array(12).keys()].map(src);
const topics = [
  { topicId: 'Topic 1-1', id: 'Topic 1-1', threadId: 'thread-a', title: 'One', category: 'conflict', regions: ['Iran'], significance: 'high', urgency: 'high', sources: twelve },
  { topicId: 'Topic 2-2', id: 'Topic 2-2', threadId: null, title: 'Two', category: 'politics', regions: ['Europe', 'USA'], significance: 'low', sources: [src(1)] },
];
const analysis = { PK: 'THREAD#thread-a', SK: 'THREAD_ANALYSIS', threadId: 'thread-a', threadTitle: 'Arc', entryCount: 5, generatedAt: hoursAgo(10) };
const iran = { PK: 'COUNTRY#Iran', SK: 'COUNTRY_INTELLIGENCE', countryName: 'Iran', riskScore: 70, riskLevel: 'high', generatedAt: hoursAgo(30), dimensions: { conflict: 70, political: 70, economic: 70, humanitarian: 70 } };
const ddbRows = { 'THREAD#thread-a': analysis, 'COUNTRY#Iran': iran };

const todayView = () => ({
  schemaVersion: 1, updatedAt: hoursAgo(2),
  latest: { updatedAt: hoursAgo(2), topicIds: ['Topic 1-1', 'Topic 2-2'], model: 'm', limit: 13, generationId: 'g', generatedDate: 'd', generatedYear: 2026 },
  entries: topics.map((t, i) => {
    const { significance, urgency, ...rest } = t;
    return { ...rest, sources: rest.sources.slice(0, 10), eventId: `e${i}`, archivedAt: hoursAgo(2), generationId: 'g', ai: null, latest: { significance, ...(urgency ? { urgency } : {}), ...(rest.sources.length > 10 ? { sources: rest.sources } : {}) } };
  }),
});
const files = () => ({
  ...freshManifest(), 'record/views/index/today.json': todayView(),
  'record/views/stories/thread-a.json': { threadId: 'thread-a', analysis: { threadId: 'thread-a', threadTitle: 'Arc', entryCount: 5, generatedAt: analysis.generatedAt, iso3: [] } },
  'record/views/countries/IRN.json': { intelligence: { countryName: 'Iran', riskScore: 70, riskLevel: 'high', generatedAt: iran.generatedAt, dimensions: iran.dimensions } },
  'record/views/countries/USA.json': { intelligence: { countryName: 'United States', riskScore: 90, riskLevel: 'high', generatedAt: hoursAgo(5), dimensions: iran.dimensions } },
});

const run = async (mode, over) => {
  const aws = stubAws({ files: over || files(), ddb: (input) => ({ Item: input.Key.id === 'latest' ? { id: 'latest', topics, updatedAt: hoursAgo(2) } : ddbRows[input.Key.PK] }) });
  try {
    const mod = aws.load(path.resolve(__dirname, '../src/index.js'), { TOPICS_DDB_TABLE: 'T', SUMMARIZE_PREDICT_TABLE: 'S', BREAKING_ALERTS_TABLE: 'A', RECORD_READS: mode });
    return {
      topics: await mod.loadLatestTopics(),
      analysis: await mod.getRecord('THREAD#thread-a', 'THREAD_ANALYSIS'),
      risk: await mod.maxRegionRisk(['Iran', 'Europe', 'USA'], 'conflict'),
      reads: aws.reads,
    };
  } finally { aws.restore(); }
};

test('record gives the alert code the same topics (all 12 sources kept), analysis fields and region risk as DynamoDB; NewsCache latest is not read', async () => {
  const d = await run(undefined);
  const r = await run('record');
  assert.deepEqual(r.topics, d.topics);
  assert.equal(r.topics[0].sources.length, 12);
  assert.equal(r.analysis.entryCount, d.analysis.entryCount);
  assert.equal(r.analysis.threadTitle, 'Arc');
  assert.equal(r.risk, d.risk);
  assert.ok(d.risk > 0);
  assert.ok(d.reads.every((x) => x.startsWith('ddb:')));
  assert.ok(!r.reads.some((x) => x.includes('"id":"latest"')), r.reads.join());
  assert.ok(r.reads.includes('s3:record/views/index/today.json'), r.reads.join());
});

test('a spelling DynamoDB has no row for (USA) adds no risk in record mode either', async () => {
  const r = await run('record');
  const d = await run('ddb');
  assert.equal(r.risk, d.risk);
});

test('record without views reads DynamoDB for every one of them', async () => {
  const d = await run('ddb');
  const r = await run('record', {});
  assert.deepEqual(r.topics, d.topics);
  assert.equal(r.analysis.entryCount, 5);
  assert.equal(r.risk, d.risk);
});

test('compare: DynamoDB decides', async () => {
  const d = await run('ddb');
  const c = await run('compare');
  assert.deepEqual(c.topics, d.topics);
  assert.equal(c.risk, d.risk);
  assert.ok(c.reads.some((x) => x.startsWith('s3:')));
});
