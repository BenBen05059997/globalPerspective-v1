'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { capForTier } = require('../src/lib.js');

const notes = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }];

test('member gets the full array, never gated', () => {
  const r = capForTier(notes, 'member', 1);
  assert.equal(r.items.length, 7);
  assert.equal(r.total, 7);
  assert.equal(r.gated, false);
});

test('free is capped to teaser + honest total + gated flag', () => {
  const r = capForTier(notes, 'free', 1);
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.items, [{ id: 1 }]);
  assert.equal(r.total, 7);
  assert.equal(r.gated, true);
});

test('free teaser of 5 (corrections ledger)', () => {
  const r = capForTier(notes, 'free', 5);
  assert.equal(r.items.length, 5);
  assert.equal(r.total, 7);
  assert.equal(r.gated, true);
});

test('not gated when total <= teaser', () => {
  const r = capForTier([{ id: 1 }], 'free', 1);
  assert.equal(r.items.length, 1);
  assert.equal(r.gated, false); // exactly at teaser → nothing withheld
});

test('empty / non-array input is safe', () => {
  assert.deepEqual(capForTier(null, 'free', 1), { items: [], total: 0, gated: false });
  assert.deepEqual(capForTier(undefined, 'member', 5), { items: [], total: 0, gated: false });
});

test('unknown tier is treated as non-member (fails safe to capped)', () => {
  const r = capForTier(notes, undefined, 1);
  assert.equal(r.items.length, 1);
  assert.equal(r.gated, true);
});

const { dedupeByAsOf } = require('../src/lib.js');

test('dedupeByAsOf: union archive+live, dedup by asOf, newest first', () => {
  const archive = [{ asOf: '2026-07-01', s: 'a' }, { asOf: '2026-06-20', s: 'a' }];
  const live = [{ asOf: '2026-07-06', s: 'L' }, { asOf: '2026-07-01', s: 'L' }]; // 07-01 dup
  const r = dedupeByAsOf([...archive, ...live]);
  assert.deepEqual(r.map(x => x.asOf), ['2026-07-06', '2026-07-01', '2026-06-20']);
  assert.equal(r.find(x => x.asOf === '2026-07-01').s, 'a'); // archive wins (listed first)
});

test('dedupeByAsOf: empty archive returns live unchanged', () => {
  const live = [{ asOf: '2026-07-06' }, { asOf: '2026-07-01' }];
  assert.deepEqual(dedupeByAsOf([...[], ...live]).map(x => x.asOf), ['2026-07-06', '2026-07-01']);
});

test('dedupeByAsOf: skips items without asOf; safe on non-array', () => {
  assert.deepEqual(dedupeByAsOf([{ x: 1 }, { asOf: '2026-07-01' }]).map(x => x.asOf), ['2026-07-01']);
  assert.deepEqual(dedupeByAsOf(null), []);
});
