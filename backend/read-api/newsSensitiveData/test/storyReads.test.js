'use strict';
// Stored-row reads that feed the story panels and the country systems page: summary / prediction / trace_cause (shape normalised from
// the SummarizeAndPredict row), systems_analysis (canonical country key first), country_preview / thread_preview (the public SEO preview).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadProxy, invoke } = require('./helpers/proxyHarness');

const nowSec = () => Math.floor(Date.now() / 1000);
const row = (sk, extra = {}) => ({ PK: 'TOPIC#Topic 3-3', SK: sk, ttl: nowSec() + 3600, title: 'T', generatedAt: '2026-11-01T00:00:00.000Z', content: '  body text \n', ...extra });

for (const [action, sk] of [['summary', 'SUMMARY'], ['prediction', 'PREDICTION'], ['trace_cause', 'TRACE_CAUSE']]) {
  test(`${action}: a cached row is read consistently by TOPIC#<id>/${sk} and served with the keys folded into topicId / kind`, async () => {
    const { handler, calls } = loadProxy({ send: async () => ({ Item: row(sk) }) });
    const r = await invoke(handler, { action, payload: { topicId: 'Topic 3-3' } });
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.success, r.body.cached, r.body.stale], [true, true, false]);
    const d = r.body.data;
    assert.deepEqual([d.topicId, d.kind, d.content, d.title, d.generatedAt], ['Topic 3-3', sk, 'body text', 'T', '2026-11-01T00:00:00.000Z']);
    assert.ok(!('PK' in d) && !('SK' in d) && !('ttl' in d));
    assert.ok(d.remainingTtlSeconds > 3500 && d.remainingTtlSeconds <= 3600, String(d.remainingTtlSeconds));
    assert.deepEqual(calls.map((c) => c.input), [{ TableName: 'summary', Key: { PK: 'TOPIC#Topic 3-3', SK: sk }, ConsistentRead: true }]);
  });

  test(`${action}: no row is a 503 cache miss with reason MISSING (the frontend shows nothing rather than a placeholder)`, async () => {
    const { handler } = loadProxy({ send: async () => ({}) });
    const r = await invoke(handler, { action, payload: { topicId: 'nope' } });
    assert.equal(r.status, 503);
    assert.deepEqual(r.body, { success: false, error: 'Cache miss', reason: 'MISSING' });
  });
}

test('summary / prediction / trace_cause: topic_id is accepted as an alias; a missing or non-string id is a 400 with no read', async () => {
  const { handler, calls } = loadProxy({ send: async () => ({ Item: row('SUMMARY') }) });
  const alias = await invoke(handler, { action: 'summary', payload: { topic_id: 'Topic 3-3' } });
  assert.equal(alias.status, 200);
  const before = calls.length;
  for (const action of ['summary', 'prediction', 'trace_cause']) {
    for (const payload of [{}, { topicId: '' }, { topicId: 42 }]) {
      const r = await invoke(handler, { action, payload });
      assert.deepEqual([r.status, r.body], [400, { success: false, error: 'Missing topicId' }], `${action} ${JSON.stringify(payload)}`);
    }
  }
  assert.equal(calls.length, before);
});

test('summary: structured content is pretty-printed JSON text; absent content is an empty string; ttl is clamped and optional', async () => {
  const pick = async (Item) => {
    const { handler } = loadProxy({ send: async () => ({ Item }) });
    return (await invoke(handler, { action: 'prediction', payload: { topicId: 'x' } })).body.data;
  };
  const structured = await pick(row('PREDICTION', { content: { outlook: 'up', odds: [1, 2] } }));
  assert.equal(structured.content, JSON.stringify({ outlook: 'up', odds: [1, 2] }, null, 2));
  assert.equal((await pick(row('PREDICTION', { content: undefined }))).content, '');
  assert.equal((await pick(row('PREDICTION', { ttl: nowSec() - 500 }))).remainingTtlSeconds, 0);
  assert.equal((await pick(row('PREDICTION', { ttl: undefined }))).remainingTtlSeconds, null);
});

test('summary / prediction / trace_cause: a DynamoDB failure is a 500; a missing table setting is a 500 with no read', async () => {
  const failing = loadProxy({ send: async () => { throw new Error('boom'); } });
  const a = await invoke(failing.handler, { action: 'trace_cause', payload: { topicId: 'x' } });
  assert.deepEqual([a.status, a.body.success, a.body.error], [500, false, 'Failed to read summary/prediction cache']);
  const unset = loadProxy({ env: { SUMMARIZE_PREDICT_TABLE: undefined } });
  const b = await invoke(unset.handler, { action: 'summary', payload: { topicId: 'x' } });
  assert.deepEqual([b.status, b.body.error, unset.calls.length], [500, 'Summarize/Prediction table not configured', 0]);
});

// ── systems_analysis ──────────────────────────────────────────────────────────────────────────────────────────────────
test('systems_analysis: the canonical country record is tried first and wins; keys and ttl are stripped', async () => {
  const stored = { PK: 'SYSTEMS#United States', SK: 'SYSTEMS_ANALYSIS', ttl: 5, countryName: 'United States', systems: [{ name: 'energy', score: 3 }], generatedAt: 'g' };
  const { handler, calls } = loadProxy({ send: async () => ({ Item: stored }) });
  const r = await invoke(handler, { action: 'systems_analysis', payload: { countryName: 'USA' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { success: true, data: { countryName: 'United States', systems: [{ name: 'energy', score: 3 }], generatedAt: 'g' } });
  assert.deepEqual(calls.map((c) => c.input.Key), [{ PK: 'SYSTEMS#United States', SK: 'SYSTEMS_ANALYSIS' }]);
});

test('systems_analysis: a record not yet merged under the canonical name is found under the requested spelling', async () => {
  const { handler, calls } = loadProxy({ send: async (_n, input) => (input.Key.PK === 'SYSTEMS#USA' ? { Item: { PK: 'SYSTEMS#USA', SK: 'SYSTEMS_ANALYSIS', countryName: 'USA' } } : {}) });
  const r = await invoke(handler, { action: 'systems_analysis', payload: { countryName: 'USA' } });
  assert.deepEqual([r.status, r.body.data.countryName], [200, 'USA']);
  assert.deepEqual(calls.map((c) => c.input.Key.PK), ['SYSTEMS#United States', 'SYSTEMS#USA']);
});

test('systems_analysis: a country with no analysis is a 404, a missing name a 400, a failed read a 500', async () => {
  const none = loadProxy({ send: async () => ({}) });
  const a = await invoke(none.handler, { action: 'systems_analysis', payload: { countryName: 'Atlantis' } });
  assert.deepEqual([a.status, a.body], [404, { success: false, error: 'Systems analysis not found for this country' }]);
  const b = await invoke(none.handler, { action: 'systems_analysis', payload: {} });
  assert.deepEqual([b.status, b.body.error], [400, 'Missing countryName']);
  const failing = loadProxy({ send: async () => { throw new Error('boom'); } });
  const c = await invoke(failing.handler, { action: 'systems_analysis', payload: { countryName: 'Iran' } });
  assert.deepEqual([c.status, c.body], [500, { success: false, error: 'Lookup failed' }]);
});

test('systems_analysis: countryName may come from the query string (GET)', async () => {
  const { handler, calls } = loadProxy({ send: async () => ({ Item: { PK: 'p', SK: 's', countryName: 'Iran' } }) });
  const r = await invoke(handler, { method: 'GET', qs: { action: 'systems_analysis', countryName: 'Iran' } });
  assert.equal(r.status, 200);
  assert.equal(calls[0].input.Key.PK, 'SYSTEMS#Iran');
});

// ── public previews ───────────────────────────────────────────────────────────────────────────────────────────────────
test('country_preview: serves only the public preview fields, with defaults for absent ones', async () => {
  const stored = { PK: 'COUNTRY#Iran', SK: 'COUNTRY_INTELLIGENCE', headline: 'H', bluf: 'B', riskScore: 80, dimensions: { political: 1 }, keyDevelopments: ['k'], riskLevel: 'high', generatedAt: 'g' };
  const { handler, calls } = loadProxy({ send: async () => ({ Item: stored }) });
  const r = await invoke(handler, { action: 'country_preview', payload: { countryName: 'Iran' } });
  assert.deepEqual(r.body.data, { headline: 'H', bluf: 'B', keyDevelopments: ['k'], riskLevel: 'high', trajectory: null, totalArticles: 0, dayCount: 0, generatedAt: 'g' });
  assert.deepEqual(calls[0].input.Key, { PK: 'COUNTRY#Iran', SK: 'COUNTRY_INTELLIGENCE' });
});

test('thread_preview: serves only title, short titles and generatedAt', async () => {
  const stored = { PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', threadTitle: 'T', entryShortTitles: [{ shortTitle: 's' }], storyArc: 'private', riskScore: 5 };
  const { handler } = loadProxy({ send: async () => ({ Item: stored }) });
  const r = await invoke(handler, { action: 'thread_preview', payload: { threadId: 't1' } });
  assert.deepEqual(r.body.data, { threadTitle: 'T', entryShortTitles: [{ shortTitle: 's' }], generatedAt: null });
});

test('country_preview / thread_preview: no row and a failed read both answer 200 with data null; a missing name is a 400', async () => {
  for (const send of [async () => ({}), async () => { throw new Error('boom'); }]) {
    const { handler } = loadProxy({ send });
    const c = await invoke(handler, { action: 'country_preview', payload: { countryName: 'Iran' } });
    const t = await invoke(handler, { action: 'thread_preview', payload: { threadId: 't1' } });
    assert.deepEqual([c.status, c.body, t.status, t.body], [200, { success: true, data: null }, 200, { success: true, data: null }]);
  }
  const { handler } = loadProxy();
  const c = await invoke(handler, { action: 'country_preview', payload: {} });
  const t = await invoke(handler, { action: 'thread_preview', payload: {} });
  assert.deepEqual([c.status, c.body.error, t.status, t.body.error], [400, 'Missing countryName', 400, 'Missing threadId']);
});
