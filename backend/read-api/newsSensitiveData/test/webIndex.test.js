'use strict';
// Batch 4 / E: web_index serves the index, or one story's record (only from the current run).
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');
process.env.TOPICS_DDB_TABLE = 'T'; process.env.SUMMARIZE_PREDICT_TABLE = 'T';
const store = {};
const orig = Module._load;
Module._load = function (req, ...r) {
  if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: (t, k) => {
    if (k === 'DynamoDBDocumentClient') return { from: () => ({ send: async (c) => ({ Item: store[`${c.input.Key.PK}|${c.input.Key.SK}`] }) }) };
    return class { constructor(i) { this.input = i; } };
  } });
  return orig.call(this, req, ...r);
};
const { handler } = require('../src/index.js');
Module._load = orig;

const call = async (payload) => JSON.parse((await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'web_index', payload }) })).body);

store['WEB#INDEX|LATEST'] = {
  PK: 'WEB#INDEX', SK: 'LATEST', runId: 'r2', generatedAt: '2026-10-01T05:00:00Z', maxAgeDays: 30, targets: { count: 10, countries: ['Iran'] },
  links: [{ from: 'a', to: 'b' }], coverage: { pctOfAll: 24 },
  threads: { a: { state: 'linked' }, b: { state: 'linked' }, c: { state: 'single_update', entries: 1 }, d: { state: 'analysed_no_links' }, old: { state: 'linked' } },
};
store['THREAD#a|WEB'] = { PK: 'THREAD#a', SK: 'WEB', runId: 'r2', threadId: 'a', state: 'linked', into: [{ other: 'b' }] };
store['THREAD#old|WEB'] = { PK: 'THREAD#old', SK: 'WEB', runId: 'r1', threadId: 'old', state: 'linked', into: [{ other: 'zzz' }] };

test('no index yet: success with data null (the page says so honestly)', async () => {
  const saved = store['WEB#INDEX|LATEST']; delete store['WEB#INDEX|LATEST'];
  const b = await call({});
  assert.strictEqual(b.success, true); assert.strictEqual(b.data, null);
  store['WEB#INDEX|LATEST'] = saved;
});

test('no threadId: the whole index, without table keys', async () => {
  const b = await call({});
  assert.strictEqual(b.data.runId, 'r2');
  assert.strictEqual(b.data.PK, undefined);
  assert.strictEqual(b.data.links.length, 1);
  assert.strictEqual(b.data.coverage.pctOfAll, 24);
});

test('a linked story: its record and state', async () => {
  const b = await call({ threadId: 'a' });
  assert.strictEqual(b.data.state, 'linked');
  assert.strictEqual(b.data.record.into[0].other, 'b');
  assert.strictEqual(b.data.record.PK, undefined);
  assert.strictEqual(b.data.targets.count, 10);
});

test('a story with no record: state from the index, record null (single update)', async () => {
  const b = await call({ threadId: 'c' });
  assert.strictEqual(b.data.state, 'single_update');
  assert.strictEqual(b.data.record, null);
  assert.strictEqual(b.data.meta.entries, 1);
});

test('a record from an OLDER run is never served (the story dropped out of the webs)', async () => {
  const b = await call({ threadId: 'old' });
  assert.strictEqual(b.data.record, null);
  assert.strictEqual(b.data.state, 'linked'); // the index still says linked only if the current run linked it; here the index entry decides
});

test('a story the index has never heard of: state null, record null', async () => {
  const b = await call({ threadId: 'nope' });
  assert.strictEqual(b.data.state, null);
  assert.strictEqual(b.data.record, null);
});
