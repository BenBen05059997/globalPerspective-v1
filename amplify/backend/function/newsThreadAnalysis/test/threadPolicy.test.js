'use strict';
// Change-driven thread analysis + DeepSeek request body (Batch 2 / D2) — `cd src && npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/threadPolicy');

const th = (id, entries) => ({ threadId: id, entries: entries.map(([topicId, date]) => ({ topicId, date })) });

test('new thread (no stored analysis) is stale', () => {
  assert.deepEqual(P.isStale(null, th('t', [['a', '2026-10-01'], ['b', '2026-10-02']])), { stale: true, reason: 'new-thread' });
});

test('a topicId the stored analysis has not seen => new-events', () => {
  const r = P.isStale({ entryCount: 2, entryTopicIds: ['a', 'b'] }, th('t', [['a', 'd'], ['b', 'd'], ['c', 'd']]));
  assert.deepEqual([r.stale, r.reason], [true, 'new-events']);
  assert.match(r.detail, /1 new entry/);
});

test('entries only ageing OUT of the window (fewer entries, none new) never trigger a re-analysis', () => {
  const r = P.isStale({ entryCount: 4, entryTopicIds: ['a', 'b', 'c', 'd'] }, th('t', [['c', 'd'], ['d', 'd']]));
  assert.deepEqual([r.stale, r.reason], [false, 'no-new-events']);
});

test('same count but different members (one aged out, one new) IS stale (the old count check missed it)', () => {
  const r = P.isStale({ entryCount: 2, entryTopicIds: ['a', 'b'] }, th('t', [['b', 'd'], ['x', 'd']]));
  assert.equal(r.stale, true);
});

test('legacy item without entryTopicIds: only a higher count is stale (no mass regeneration on deploy)', () => {
  assert.equal(P.isStale({ entryCount: 5 }, th('t', Array.from({ length: 5 }, (_, i) => [`e${i}`, 'd']))).stale, false);
  assert.equal(P.isStale({ entryCount: 5 }, th('t', Array.from({ length: 3 }, (_, i) => [`e${i}`, 'd']))).stale, false);
  assert.equal(P.isStale({ entryCount: 5 }, th('t', Array.from({ length: 6 }, (_, i) => [`e${i}`, 'd']))).stale, true);
});

test('selection: only changed threads, newest first, then larger; cap; the rest are skipped with a reason', () => {
  const threads = [
    th('big-old', Array.from({ length: 9 }, (_, i) => [`o${i}`, '2026-09-01'])),
    th('small-fresh', [['s1', '2026-10-02'], ['s2', '2026-10-03']]),
    th('mid-fresh', [['m1', '2026-10-03'], ['m2', '2026-10-03'], ['m3', '2026-10-03']]),
    th('unchanged', [['u1', '2026-10-03'], ['u2', '2026-10-03']]),
    th('third-new', [['n1', '2026-09-20'], ['n2', '2026-09-21']]),
  ];
  const existing = { 'big-old': { entryTopicIds: Array.from({ length: 9 }, (_, i) => `o${i}`) }, unchanged: { entryTopicIds: ['u1', 'u2'] } };
  const plan = P.selectThreads({ threads, existingByThread: existing, maxThreads: 2 });
  assert.deepEqual(plan.filter((p) => p.run).map((p) => p.threadId), ['mid-fresh', 'small-fresh']);   // newest date, then size
  const by = Object.fromEntries(plan.map((p) => [p.threadId, p]));
  assert.equal(by['third-new'].reason, 'over-cap');
  assert.equal(by['big-old'].reason, 'no-new-events');        // a large old thread no longer holds a slot
  assert.equal(by.unchanged.run, false);
});

test('request body: thinking disabled, JSON mode, no Gemini-only fields', () => {
  const b = P.buildRequestBody({ model: 'deepseek-flash', prompt: 'Return JSON', maxTokens: 6000, temperature: 0.2, topP: 0.9 });
  assert.deepEqual(b.thinking, { type: 'disabled' });
  assert.deepEqual(b.response_format, { type: 'json_object' });
  assert.equal(b.model, 'deepseek-flash');
  assert.equal(b.max_tokens, 6000);
  for (const k of ['generationConfig', 'thinking_budget', 'reasoning_effort']) assert.equal(k in b, false);
});

test('entryIds is sorted and de-duplicated', () => {
  assert.deepEqual(P.entryIds(th('t', [['b', 'd'], ['a', 'd'], ['b', 'd']])), ['a', 'b']);
});
