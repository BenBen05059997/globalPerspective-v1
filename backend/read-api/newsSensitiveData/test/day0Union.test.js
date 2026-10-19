'use strict';
// Post-deploy fix (2026-09-30): day 0 = `latest` (newest generation) UNION today's archive row (every run of the day).
// Row shapes follow the real 2026-09-30 items: archive entries carry generationId/archivedAt, latest topics do not.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');
process.env.TOPICS_DDB_TABLE = 'NewsCache'; process.env.SUMMARIZE_PREDICT_TABLE = 'T';

const TODAY = new Date().toISOString().slice(0, 10);
const arch = (id, gen, at, thread) => ({ topicId: id, threadId: thread, title: 'Title ' + id, category: 'politics', regions: ['Iran'], sources: [{ url: 'u' }], generationId: gen, archivedAt: at, ai: { summary: 's' } });
const G1 = 'gen-1790734536168'; const G2 = 'gen-1790741754173';
const earlier = ['a', 'b', 'c'].map((k) => arch('t-' + k, G1, TODAY + 'T02:17:05.890Z', 'thread-' + k));            // 02:15 run only
const both = arch('t-d', G2, TODAY + 'T04:26:43.234Z', 'thread-d');                                                  // in both runs
const newest = ['e', 'f'].map((k) => arch('t-' + k, G2, TODAY + 'T04:26:43.234Z', 'thread-' + k));
const todayRow = { id: 'archive#' + TODAY, entries: [...earlier, both, ...newest], updatedAt: TODAY + 'T04:26:42.945Z' };
const topic = (e) => ({ topicId: e.topicId, title: e.title, category: e.category, regions: e.regions, sources: e.sources, threadId: e.threadId });
const mkLatest = (updatedAt, ents) => ({ id: 'latest', updatedAt, topics: ents.map(topic) });

function load(rows) {
  const orig = Module._load;
  Module._load = function (req, ...r) {
    if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: (t, k) => (k === 'DynamoDBDocumentClient' ? { from: () => ({ send: async (c) => ({ Item: rows[c.input.Key.id] }) }) } : class { constructor(i) { this.input = i; } }) });
    return orig.call(this, req, ...r);
  };
  delete require.cache[require.resolve('../src/index.js')];
  try { return require('../src/index.js').handler; } finally { Module._load = orig; }
}
const call = async (handler, action, payload) => JSON.parse((await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action, payload }) })).body);

const rowsNow = { latest: mkLatest(TODAY + 'T04:15:54.173Z', [both, ...newest]), ['archive#' + TODAY]: todayRow };

test('narrative_thread: a thread only in an EARLIER run today (not in latest) is still found, dated today', async () => {
  const h = load(rowsNow);
  const r = await call(h, 'narrative_thread', { threadId: 'thread-a', days: 30 });
  assert.deepStrictEqual(r.data.map((e) => e.date + ':' + e.source), [TODAY + ':archive']);
});
test('narrative_thread: a thread in both latest and today\'s row appears once', async () => {
  const r = await call(load(rowsNow), 'narrative_thread', { threadId: 'thread-d', days: 30 });
  assert.strictEqual(r.data.length, 1);
});
test('archive_range days:1: day 0 = latest UNION today\'s row (all 6 unique entries of the day), source stays "latest"', async () => {
  const r = await call(load(rowsNow), 'archive_range', { days: 1 });
  assert.deepStrictEqual(Object.keys(r.data), [TODAY]);
  assert.strictEqual(r.data[TODAY].entries.length, 6);
  assert.strictEqual(r.data[TODAY].source, 'latest');
  assert.strictEqual(new Set(r.data[TODAY].entries.map((e) => e.topicId)).size, 6);
  assert.ok(!('ai' in r.data[TODAY].entries[0]));                         // light entries only (payload limit)
});
test('stale latest (13 Sep generation) and no row for today: labelled with ITS OWN date, nothing re-dated to today', async () => {
  const stale = mkLatest('2026-09-13T00:07:03.058Z', earlier);
  const h = load({ latest: stale });
  const range = await call(h, 'archive_range', { days: 30 });
  assert.deepStrictEqual(Object.keys(range.data), ['2026-09-13']);
  const th = await call(h, 'narrative_thread', { threadId: 'thread-a', days: 30 });
  assert.deepStrictEqual(th.data.map((e) => e.date), ['2026-09-13']);
});
test('stale latest but today\'s row exists: two days, today\'s entries under today (source archive)', async () => {
  const r = await call(load({ latest: mkLatest('2026-09-13T00:07:03.058Z', earlier), ['archive#' + TODAY]: todayRow }), 'archive_range', { days: 30 });
  assert.ok(r.data['2026-09-13'] && r.data[TODAY]);
  assert.strictEqual(r.data[TODAY].source, 'archive');
  assert.strictEqual(r.data[TODAY].entries.length, 6);
});
