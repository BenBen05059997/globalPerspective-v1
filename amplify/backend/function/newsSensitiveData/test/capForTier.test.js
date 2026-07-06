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
