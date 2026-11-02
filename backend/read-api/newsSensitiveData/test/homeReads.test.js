'use strict';
// The actions Home and Briefings call on every load: topics, today, latest_daily_brief. The fake DynamoDB serves rows in the stored
// shape; the assertions are on what the frontend reads (shared/data/contentService.js: success / data.topics / stale / data.entries,
// shared/hooks/useDailyBrief.js: data / dateKey / editions).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadProxy, invoke, hoursAgo, dayKey } = require('./helpers/proxyHarness');

const topic = (n) => ({ topicId: `T${n}`, title: `Title ${n}`, category: 'politics', regions: ['France'], sources: [{ url: 'https://x.test/' + n }] });
const latestRow = (updatedAt) => ({ id: 'latest', updatedAt, model: 'm', limit: 13, topics: [topic(1), topic(2)] });

test('topics: a fresh `latest` row is served as cached, not stale, with its updatedAt as asOf', async () => {
  const row = latestRow(hoursAgo(1));
  const { handler, calls } = loadProxy({ send: async () => ({ Item: row }) });
  const r = await invoke(handler, { action: 'topics' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.success, r.body.cached, r.body.stale, r.body.asOf], [true, true, false, row.updatedAt]);
  assert.deepEqual(r.body.data.topics.map((t) => t.topicId), ['T1', 'T2']);
  assert.deepEqual(calls.map((c) => [c.name, c.input.TableName, c.input.Key]), [['GetCommand', 'topics', { id: 'latest' }]]);
});

test('topics: a row older than the max age is still served (200) but marked stale', async () => {
  const { handler } = loadProxy({ send: async () => ({ Item: latestRow(hoursAgo(5)) }) });
  const r = await invoke(handler, { action: 'topics' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.success, r.body.stale], [true, true]);
  assert.equal(r.body.data.topics.length, 2);
});

test('topics: a row with no usable updatedAt counts as stale, not fresh', async () => {
  const { handler } = loadProxy({ send: async () => ({ Item: { id: 'latest', topics: [topic(1)] } }) });
  const r = await invoke(handler, { action: 'topics' });
  assert.deepEqual([r.status, r.body.stale, r.body.asOf], [200, true, undefined]);
});

test('topics: no row is a 503 cache miss with no data', async () => {
  const { handler } = loadProxy({ send: async () => ({}) });
  const r = await invoke(handler, { action: 'topics' });
  assert.equal(r.status, 503);
  assert.deepEqual(r.body, { success: false, error: 'Topics cache miss' });
});

test('topics: a DynamoDB failure is a 500, and a missing table setting is a 500 with no read', async () => {
  const failing = loadProxy({ send: async () => { throw new Error('boom'); } });
  const a = await invoke(failing.handler, { action: 'topics' });
  assert.deepEqual([a.status, a.body.success, a.body.error], [500, false, 'Failed to read topics cache']);
  const unset = loadProxy({ env: { TOPICS_DDB_TABLE: undefined } });
  const b = await invoke(unset.handler, { action: 'topics' });
  assert.deepEqual([b.status, b.body.error, unset.calls.length], [500, 'Topics table not configured', 0]);
});

test('today: only entries archived in the last 24 h are served, with the row updatedAt', async () => {
  const entries = [
    { topicId: 'new', archivedAt: hoursAgo(3), title: 'New' },
    { topicId: 'old', archivedAt: hoursAgo(30), title: 'Old' },
    { topicId: 'edge', archivedAt: hoursAgo(23), title: 'Edge' },
  ];
  const updatedAt = hoursAgo(2);
  const { handler, calls } = loadProxy({ send: async () => ({ Item: { id: 'today-archive', entries, updatedAt } }) });
  const r = await invoke(handler, { action: 'today' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.entries.map((e) => e.topicId), ['new', 'edge']);
  assert.equal(r.body.data.updatedAt, updatedAt);
  assert.deepEqual(calls[0].input.Key, { id: 'today-archive' });
});

test('today: no row, or a row with no entries, is an honest empty list (200), not an error', async () => {
  for (const Item of [undefined, { id: 'today-archive', entries: [], updatedAt: hoursAgo(1) }, { id: 'today-archive', updatedAt: hoursAgo(1) }]) {
    const { handler } = loadProxy({ send: async () => ({ Item }) });
    const r = await invoke(handler, { action: 'today' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { success: true, data: { entries: [], updatedAt: null } });
  }
});

test('today: a DynamoDB failure is a 500 so the page can fall back to its other source', async () => {
  const { handler } = loadProxy({ send: async () => { throw new Error('boom'); } });
  const r = await invoke(handler, { action: 'today' });
  assert.deepEqual([r.status, r.body.success, r.body.error], [500, false, 'Failed to read today archive']);
});

// ── latest_daily_brief ────────────────────────────────────────────────────────────────────────────────────────────────
const brief = (daysAgo, extra = {}) => ({
  PK: `DAILY_BRIEF#${dayKey(daysAgo)}`, SK: 'DAILY_BRIEF', ttl: 1, dateKey: dayKey(daysAgo), headline: `H${daysAgo}`,
  topStories: [{ title: 'S', regions: ['France'] }], countryToWatch: { countryName: 'Iran' }, ...extra,
});
const batchResponse = (rows, unprocessed) => ({ Responses: { summary: rows }, ...(unprocessed ? { UnprocessedKeys: unprocessed } : {}) });

test('latest_daily_brief: one BatchGet over the last 30 keys; the newest brief wins, keys/ttl stripped, iso3 added, editions newest first', async () => {
  const { handler, calls } = loadProxy({ send: async () => batchResponse([brief(5), brief(0), brief(2)]) });
  const r = await invoke(handler, { action: 'latest_daily_brief', payload: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.dateKey, dayKey(0));
  assert.deepEqual(r.body.editions, [dayKey(0), dayKey(2), dayKey(5)]);
  assert.equal(r.body.data.headline, 'H0');
  assert.ok(!('PK' in r.body.data) && !('SK' in r.body.data) && !('ttl' in r.body.data));
  assert.deepEqual(r.body.data.topStories[0].iso3, ['FRA']);
  assert.deepEqual(r.body.data.countryToWatch.iso3, ['IRN']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'BatchGetCommand');
  const keys = calls[0].input.RequestItems.summary.Keys;
  assert.equal(keys.length, 30);
  assert.deepEqual(keys[0], { PK: `DAILY_BRIEF#${dayKey(0)}`, SK: 'DAILY_BRIEF' });
  assert.deepEqual(keys[29], { PK: `DAILY_BRIEF#${dayKey(29)}`, SK: 'DAILY_BRIEF' });
});

test('latest_daily_brief: lookbackDays shortens the key list (clamped to 1..60)', async () => {
  const sizes = [];
  const { handler } = loadProxy({ send: async (_n, input) => { sizes.push(input.RequestItems.summary.Keys.length); return batchResponse([]); } });
  for (const lookbackDays of [3, 500, 0]) await invoke(handler, { action: 'latest_daily_brief', payload: { lookbackDays } });
  assert.deepEqual(sizes, [3, 60, 30]);
});

test('latest_daily_brief: nothing published in the window is the empty reply the page reads as "no brief"', async () => {
  const { handler } = loadProxy({ send: async () => batchResponse([]) });
  const r = await invoke(handler, { action: 'latest_daily_brief' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { success: true, data: null, dateKey: null, editions: [] });
});

test('latest_daily_brief: rows without a valid dateKey are never served', async () => {
  const { handler } = loadProxy({ send: async () => batchResponse([{ PK: 'DAILY_BRIEF#x', SK: 'DAILY_BRIEF', headline: 'junk' }, brief(1)]) });
  const r = await invoke(handler, { action: 'latest_daily_brief' });
  assert.deepEqual([r.body.dateKey, r.body.editions], [dayKey(1), [dayKey(1)]]);
});

test('latest_daily_brief: UnprocessedKeys are retried once, and what the retry returns can be the newest brief', async () => {
  const pending = { summary: { Keys: [{ PK: `DAILY_BRIEF#${dayKey(0)}`, SK: 'DAILY_BRIEF' }] } };
  let n = 0;
  const { handler, calls } = loadProxy({ send: async () => (++n === 1 ? batchResponse([brief(4)], pending) : batchResponse([brief(0)])) });
  const r = await invoke(handler, { action: 'latest_daily_brief' });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].input.RequestItems, pending);
  assert.equal(r.body.dateKey, dayKey(0));
  assert.deepEqual(r.body.editions, [dayKey(0), dayKey(4)]);
});

test('latest_daily_brief: the retry loop stops after two attempts even if keys stay unprocessed', async () => {
  const pending = { summary: { Keys: [{ PK: 'DAILY_BRIEF#x', SK: 'DAILY_BRIEF' }] } };
  const { handler, calls } = loadProxy({ send: async () => batchResponse([brief(3)], pending) });
  const r = await invoke(handler, { action: 'latest_daily_brief' });
  assert.equal(calls.length, 2);
  assert.equal(r.body.dateKey, dayKey(3));
});

test('latest_daily_brief: a read error answers like "no brief" (200, data null), logged but not distinguishable by the caller', async () => {
  // Current behaviour, pinned; whether a failed read should say so is listed in the PR under "Left for a decision".
  const { handler } = loadProxy({ send: async () => { throw new Error('throttled'); } });
  const r = await invoke(handler, { action: 'latest_daily_brief' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { success: true, data: null, dateKey: null, editions: [] });
});
