'use strict';
// recordReads (decision 0054): the flag, the row-shaped mappers, the freshness rule, and compare/record behaviour of readBy.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/recordReads');

const NOW = Date.parse('2026-10-31T12:00:00.000Z');
const quiet = () => { const l = []; return { log: (m) => l.push(['log', m]), warn: (m) => l.push(['warn', m]), lines: l }; };

const entry = (topicId, extra = {}) => ({
  eventId: `ev-${topicId}`, topicId, threadId: `thread-${topicId}`, title: `T ${topicId}`, category: 'conflict', regions: ['France'],
  sources: [1, 2, 3, 4, 5].map((n) => ({ source: `s${n}`, url: `https://x/${n}` })), archivedAt: '2026-10-31T11:00:00.000Z', generationId: 'g1', ai: { summary: 'x' }, ...extra,
});
const view = () => ({
  schemaVersion: 1, updatedAt: '2026-10-31T11:00:01.000Z',
  latest: { batch: 'b', generationId: 'g1', model: 'm', limit: 13, updatedAt: '2026-10-31T11:00:00.500Z', generatedDate: 'October 31, 2026', generatedYear: 2026, topicIds: ['b', 'a'] },
  entries: [
    entry('a', { latest: { urgency: 'high', x_trending: true, other: 'no' }, notes: { summary: { format: 'markdown', content: 's' } } }),
    entry('b', { latest: { significance: 'high' } }),
    entry('old', { generationId: 'g0' }),
  ],
});

test('readMode: ddb unless the flag is exactly record or compare', () => {
  assert.equal(R.readMode({}), 'ddb');
  assert.equal(R.readMode({ RECORD_READS: 'record' }), 'record');
  assert.equal(R.readMode({ RECORD_READS: ' Compare ' }), 'compare');
  assert.equal(R.readMode({ RECORD_READS: 'recrod' }), 'ddb');
});

test('latestItemOfView: the latest run in its order, entry fields plus the latest-only fields, no view-only or archive fields', () => {
  const item = R.latestItemOfView(view());
  assert.deepEqual(item.topics.map((t) => t.topicId), ['b', 'a']);
  assert.equal(item.topics[1].urgency, 'high');
  assert.equal(item.topics[1].x_trending, true);
  assert.equal(item.topics[1].other, undefined);
  assert.equal(item.topics[0].significance, 'high');
  for (const t of item.topics) for (const k of ['eventId', 'latest', 'notes', 'archivedAt', 'generationId', 'ai']) assert.ok(!(k in t), k);
  assert.equal(item.topics[0].id, 'b');
  assert.equal(item.model, 'm');
  assert.equal(item.generatedDate, 'October 31, 2026');
});

test('latestItemOfView: a topic with more than 10 sources gets them back from the line\'s latest.sources', () => {
  const v = view();
  const twelve = [...Array(12).keys()].map((n) => ({ source: `s${n}`, url: `https://x/${n}` }));
  v.entries[0].latest = { urgency: 'high', sources: twelve };
  assert.equal(R.latestItemOfView(v).topics[1].sources.length, 12);
  assert.equal(R.latestItemOfView(v).topics[0].sources.length, 5);
});

test('latestItemOfView: null without a complete latest run', () => {
  const v = view(); v.latest = null;
  assert.equal(R.latestItemOfView(v), null);
  const w = view(); w.latest.topicIds = ['a', 'missing'];
  assert.equal(R.latestItemOfView(w), null);
  assert.equal(R.latestItemOfView({ schemaVersion: 2, entries: [] }), null);
  assert.equal(R.latestItemOfView(null), null);
});

test('todayArchiveItemOfView: every entry, three sources each, no view-only fields', () => {
  const item = R.todayArchiveItemOfView(view());
  assert.equal(item.entries.length, 3);
  assert.equal(item.entries[0].sources.length, 3);
  assert.equal(item.entries[0].ai.summary, 'x');
  assert.ok(!('eventId' in item.entries[0]) && !('latest' in item.entries[0]) && !('notes' in item.entries[0]));
  assert.equal(item.updatedAt, '2026-10-31T11:00:01.000Z');
});

test('threadAnalysisRowOfView: the analysis as stored with the row keys and a ttl 90 days after generatedAt; no driftNote; an alias has none', () => {
  const sv = { threadId: 'thread-x', analysis: { threadId: 'thread-x', threadTitle: 'T', entryCount: 4, iso3: ['FRA'], generatedAt: '2026-10-30T05:00:00.000Z', model: 'deepseek', driftNote: { whyChanged: 'z' } } };
  const row = R.threadAnalysisRowOfView(sv, 'thread-x');
  assert.equal(row.PK, 'THREAD#thread-x');
  assert.equal(row.SK, 'THREAD_ANALYSIS');
  assert.equal(row.threadTitle, 'T');
  assert.equal(row.model, 'deepseek');
  assert.equal(row.driftNote, undefined);
  assert.equal(row.ttl, Math.floor(Date.parse('2026-10-30T05:00:00.000Z') / 1000) + 90 * 86400);
  assert.equal(R.threadAnalysisRowOfView({ aliasOf: 'y', analysis: sv.analysis }, 'thread-x'), null);
  assert.equal(R.threadAnalysisRowOfView({ analysis: null }, 'thread-x'), null);
});

test('countryIntelligenceRowOfView: the briefing as stored under the COUNTRY# key', () => {
  const row = R.countryIntelligenceRowOfView({ intelligence: { countryName: 'France', riskLevel: 'high', generatedAt: '2026-10-30T05:15:00.000Z' } }, 'France');
  assert.deepEqual(row, { PK: 'COUNTRY#France', SK: 'COUNTRY_INTELLIGENCE', countryName: 'France', riskLevel: 'high', generatedAt: '2026-10-30T05:15:00.000Z' });
  assert.equal(R.countryIntelligenceRowOfView({ intelligence: null }, 'France'), null);
  assert.equal(R.countryIntelligenceRowOfView({ intelligence: { countryName: 'United States' } }, 'USA'), null, 'a spelling DynamoDB has no row for');
});

test('diffValues: nested paths, a missing key equals undefined, ignore skips a key at any depth', () => {
  assert.deepEqual(R.diffValues({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] }, d: undefined }), []);
  const d = R.diffValues({ a: 1, b: { c: [1, 2] }, ttl: 1 }, { a: 2, b: { c: [1, 3] }, ttl: 9 }, { ignore: ['ttl'] });
  assert.deepEqual(d.map((x) => x.path), ['.a', '.b.c[1]']);
  assert.equal(R.diffValues([1], [1, 2]).length, 1);
});

const reads = (files, nowMs = NOW) => R.makeRecordReads({ getJson: async (key) => files[key] ?? null, now: () => nowMs });
const manifest = (builtAt) => ({ 'record/views/manifest.json': { builtAt } });

test('views answer only while the manifest is fresh (9 h): stale or missing manifest -> null', async () => {
  const files = { ...manifest('2026-10-31T08:00:00.000Z'), 'record/views/index/today.json': view() };
  assert.equal((await reads(files).latestItem()).topics.length, 2);
  assert.equal(await reads({ ...files, ...manifest('2026-10-31T02:00:00.000Z') }).latestItem(), null);
  assert.equal(await reads({ 'record/views/index/today.json': view() }).latestItem(), null);
  assert.equal(await reads(manifest('2026-10-31T08:00:00.000Z')).latestItem(), null, 'no today view yet');
});

test('threadAnalysisRow rejects an unsafe id without a read; countryIntelligenceRow resolves the name to its ISO3 view', async () => {
  const seen = [];
  const r = R.makeRecordReads({ getJson: async (k) => { seen.push(k); return k.endsWith('manifest.json') ? { builtAt: '2026-10-31T10:00:00.000Z' } : { intelligence: { countryName: 'France', generatedAt: '2026-10-30T00:00:00.000Z' } }; }, now: () => NOW });
  assert.equal(await r.threadAnalysisRow('../x'), null);
  assert.deepEqual(seen, []);
  assert.equal((await r.countryIntelligenceRow('France')).countryName, 'France');
  assert.ok(seen.includes('record/views/countries/FRA.json'));
  assert.equal(await r.countryIntelligenceRow('Europe'), null, 'a region has no view');
});

test('latestWeeklyBrief: the newest weekly of the index, only when published and for that week', async () => {
  const weekly = { weekOf: '2026-10-25', status: 'published', signals: [] };
  const files = { ...manifest('2026-10-31T08:00:00.000Z'), 'record/views/index/briefs.json': { weekly: [{ weekOf: '2026-10-25' }, { weekOf: '2026-10-18' }] }, 'record/views/briefs/weekly/2026-10-25.json': { brief: weekly } };
  assert.deepEqual(await reads(files).latestWeeklyBrief(), weekly);
  assert.equal(await reads({ ...files, 'record/views/briefs/weekly/2026-10-25.json': { brief: { ...weekly, status: 'draft' } } }).latestWeeklyBrief(), null);
  assert.equal(await reads({ ...files, 'record/views/index/briefs.json': { weekly: [] } }).latestWeeklyBrief(), null);
});

test('readBy ddb: only DynamoDB is read', async () => {
  let rec = 0;
  const v = await R.readBy({ mode: 'ddb', label: 'x', ddb: async () => 'd', record: async () => { rec += 1; return 'r'; }, log: quiet() });
  assert.equal(v, 'd');
  assert.equal(rec, 0);
});

test('readBy record: the record answers; a null or a failure reads DynamoDB and says so', async () => {
  const l = quiet();
  assert.equal(await R.readBy({ mode: 'record', label: 'x', ddb: async () => 'd', record: async () => 'r', log: l }), 'r');
  assert.equal(await R.readBy({ mode: 'record', label: 'x', ddb: async () => 'd', record: async () => null, log: l }), 'd');
  assert.equal(await R.readBy({ mode: 'record', label: 'x', ddb: async () => 'd', record: async () => { throw new Error('403'); }, log: l }), 'd');
  assert.deepEqual(l.lines.map((x) => x[0]), ['warn', 'warn']);
  assert.match(l.lines[1][1], /record read failed \(403\)/);
});

test('readBy compare: returns the DynamoDB answer, logs equal or the differing paths, never throws', async () => {
  const l = quiet();
  const same = await R.readBy({ mode: 'compare', label: 'a', ddb: async () => ({ x: 1 }), record: async () => ({ x: 1 }), log: l });
  assert.deepEqual(same, { x: 1 });
  const diff = await R.readBy({ mode: 'compare', label: 'b', ddb: async () => ({ x: 1 }), record: async () => ({ x: 2 }), log: l });
  assert.deepEqual(diff, { x: 1 });
  await R.readBy({ mode: 'compare', label: 'c', ddb: async () => ({ x: 1 }), record: async () => { throw new Error('boom'); }, log: l });
  await R.readBy({ mode: 'compare', label: 'd', ddb: async () => ({ x: 1 }), record: async () => null, log: l });
  assert.deepEqual(l.lines.map((x) => x[0]), ['log', 'warn', 'warn', 'warn']);
  assert.match(l.lines[0][1], /a: equal/);
  assert.match(l.lines[1][1], /b: DIFFER 1 .*"path":"\.x"/);
  assert.match(l.lines[2][1], /compare failed \(boom\)/);
  assert.match(l.lines[3][1], /the record has no answer/);
});

test('threadAnalysisRow follows an alias view to the surviving story and answers with that story\'s row', async () => {
  const files = {
    ...manifest('2026-10-31T10:00:00.000Z'),
    'record/views/stories/thread-old.json': { threadId: 'thread-old', aliasOf: 'thread-new' },
    'record/views/stories/thread-new.json': { threadId: 'thread-new', analysis: { threadId: 'thread-new', threadTitle: 'Survivor', generatedAt: '2026-10-30T05:00:00.000Z', iso3: ['COD'] } },
    'record/views/stories/thread-loop.json': { threadId: 'thread-loop', aliasOf: 'thread-loop' },
  };
  const row = await reads(files).threadAnalysisRow('thread-old');
  assert.equal(row.threadId, 'thread-new');
  assert.equal(row.PK, 'THREAD#thread-new');
  assert.equal(row.threadTitle, 'Survivor');
  assert.equal((await reads(files).threadAnalysisRow('thread-new')).threadTitle, 'Survivor');
  assert.equal(await reads(files).threadAnalysisRow('thread-loop'), null);
  assert.equal(await reads(files).threadAnalysisRow('thread-none'), null);
});
