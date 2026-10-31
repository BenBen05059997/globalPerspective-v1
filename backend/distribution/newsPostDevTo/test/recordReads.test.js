'use strict';
// RECORD_READS (decision 0054): the daily brief's day entries, thread analyses and country briefings come from the record's views in record mode,
// from DynamoDB in ddb mode (the default), and from DynamoDB with a logged comparison in compare mode.
const test = require('node:test');
const assert = require('node:assert/strict');
const { stubAws, hoursAgo, freshManifest } = require('../../../shared/test/stubAws');

const todayStamp = () => new Date().toISOString();
const ddbRows = {
  'THREAD#thread-a': { PK: 'THREAD#thread-a', SK: 'THREAD_ANALYSIS', threadId: 'thread-a', threadTitle: 'Arc A', storyArc: 'arc', entryCount: 4, generatedAt: hoursAgo(5), ttl: 1 },
  'COUNTRY#France': { PK: 'COUNTRY#France', SK: 'COUNTRY_INTELLIGENCE', countryName: 'France', riskLevel: 'high', headline: 'H', generatedAt: hoursAgo(30) },
};
const entry = { topicId: 'T-1', threadId: 'thread-a', title: 'T', regions: ['France'], sources: [], archivedAt: todayStamp(), generationId: 'g' };
const files = () => ({
  ...freshManifest(),
  'record/views/stories/thread-a.json': { threadId: 'thread-a', analysis: { threadId: 'thread-a', threadTitle: 'Arc A', storyArc: 'arc', entryCount: 4, generatedAt: ddbRows['THREAD#thread-a'].generatedAt, iso3: [] } },
  'record/views/countries/FRA.json': { intelligence: { countryName: 'France', riskLevel: 'high', headline: 'H', generatedAt: ddbRows['COUNTRY#France'].generatedAt } },
  'record/views/index/today.json': { schemaVersion: 1, updatedAt: todayStamp(), latest: null, entries: [{ ...entry, eventId: 'e1' }] },
});
const setup = (env, over = {}) => {
  const aws = stubAws({
    files: over.files || files(),
    ddb: (input) => ({ Item: input.Key.id === 'today-archive' ? { id: 'today-archive', entries: [entry], updatedAt: todayStamp() } : ddbRows[input.Key.PK] }),
  });
  const mod = aws.load(require('node:path').resolve(__dirname, '../src/index.js'), { TOPICS_DDB_TABLE: 'T', SUMMARIZE_PREDICT_TABLE: 'S', RECORD_READS: env });
  return { aws, mod };
};
const run = async (env, over) => {
  const { aws, mod } = setup(env, over);
  try {
    const analyses = await mod.loadThreadAnalyses([{ threadId: 'thread-a' }]);
    const intel = await mod.loadCountryIntelligence([{ regions: ['France'] }]);
    const archive = await mod.loadTodayArchive();
    return { analyses, intel, archive, reads: aws.reads };
  } finally { aws.restore(); }
};

test('ddb (default): only DynamoDB is read', async () => {
  const r = await run(undefined);
  assert.equal(r.analyses['thread-a'].threadTitle, 'Arc A');
  assert.deepEqual(Object.keys(r.intel), ['France']);
  assert.equal(r.archive.entries.length, 1);
  assert.ok(r.reads.every((x) => x.startsWith('ddb:')), r.reads.join());
});

test('record: the same answers from the views, DynamoDB not read', async () => {
  const d = await run('ddb');
  const r = await run('record');
  assert.equal(r.analyses['thread-a'].threadTitle, d.analyses['thread-a'].threadTitle);
  assert.equal(r.analyses['thread-a'].entryCount, 4);
  assert.deepEqual(Object.keys(r.intel), ['France']);
  assert.equal(r.intel.France.riskLevel, 'high');
  assert.equal(r.archive.entries.length, 1);
  assert.equal(r.archive.entries[0].topicId, 'T-1');
  assert.ok(r.reads.every((x) => x.startsWith('s3:')), r.reads.join());
});

test('record with no views (or a stale manifest) falls back to DynamoDB', async () => {
  for (const f of [{}, { 'record/views/manifest.json': { builtAt: hoursAgo(30) } }]) {
    const r = await run('record', { files: f });
    assert.equal(r.analyses['thread-a'].threadTitle, 'Arc A');
    assert.equal(r.archive.entries.length, 1);
    assert.ok(r.reads.some((x) => x.startsWith('ddb:')));
  }
});

test('compare: DynamoDB answers, both are read', async () => {
  const r = await run('compare');
  assert.equal(r.analyses['thread-a'].threadTitle, 'Arc A');
  assert.ok(r.reads.some((x) => x.startsWith('ddb:')) && r.reads.some((x) => x.startsWith('s3:')));
});
