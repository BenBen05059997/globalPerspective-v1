'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeSearch } = require('../src/search');

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test('a 429 is retried and the result is returned', async () => {
  let n = 0;
  const f = async () => (n++ === 0 ? { ok: false, status: 429 } : ok({ results: [{ title: 't', description: 'd', url: 'https://a', meta_url: { hostname: 'a' } }, { title: 't2', description: 'd', url: 'https://b' }, { title: 't3', description: 'd', url: 'https://c' }] }));
  const s = makeSearch('k', { fetchImpl: f, gapMs: 0, retryMs: 0, sleep: async () => {} });
  const r = await s('q');
  assert.equal(r.length, 3);
  assert.equal(n, 2);
});

test('requests are serialized (never two in flight)', async () => {
  let inflight = 0; let max = 0;
  const f = async () => { inflight++; max = Math.max(max, inflight); await new Promise((r) => setTimeout(r, 5)); inflight--; return ok({ results: [1, 2, 3].map((i) => ({ title: 't' + i, description: 'd', url: 'https://x/' + i })) }); };
  const s = makeSearch('k', { fetchImpl: f, gapMs: 0, retryMs: 0, sleep: async () => {} });
  await Promise.all([s('a'), s('b'), s('c')]);
  assert.equal(max, 1);
});

test('no key means no calls and no results', async () => {
  let called = false;
  const s = makeSearch('', { fetchImpl: async () => { called = true; return ok({}); } });
  assert.deepEqual(await s('q'), []);
  assert.equal(called, false);
});

test('a persistent failure returns empty (never throws)', async () => {
  const s = makeSearch('k', { fetchImpl: async () => ({ ok: false, status: 500 }), gapMs: 0, retryMs: 0, sleep: async () => {} });
  assert.deepEqual(await s('q'), []);
});

test('gather: entry facts come first, results dated after due are dropped, undated are kept', async () => {
  const { gather } = require('../src/draft');
  const entries = [{ date: '2026-11-09', payload: { title: 'Talks resume', summary: 'Delegates met on Monday.' }, sources: [{ outlet: 'ex.com', url: 'https://ex.com/e', title: 'Talks resume' }] }];
  const search = async () => [
    { title: 'before', snippet: 's', url: 'https://a.com/1', date: '2026-11-01' },
    { title: 'after', snippet: 's', url: 'https://a.com/2', date: '2026-11-12' },
    { title: 'undated', snippet: 's', url: 'https://a.com/3', date: '' },
    { title: 'dup of entry', snippet: 's', url: 'https://ex.com/e', date: '2026-11-09' },
  ];
  const out = await gather(['q'], search, { due: '2026-11-10', entries });
  assert.deepEqual(out.map((r) => r.url), ['https://ex.com/e', 'https://a.com/1', 'https://a.com/3']);
  assert.equal(out[0].snippet, 'Delegates met on Monday.');
});
