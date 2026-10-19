'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pickSpreadEntries } = require('../src/spreadEntries');

const mk = (n) => Array.from({ length: n }, (_, i) => ({ topicId: `t${i}`, date: `2026-09-${String(1 + Math.floor(i / 2)).padStart(2, '0')}`, title: `Headline ${i}` }));

test('fewer than 10 entries: all kept, ascending by date', () => {
  const out = pickSpreadEntries(mk(6).reverse());
  assert.strictEqual(out.length, 6);
  assert.deepStrictEqual(out.map((e) => e.topicId), ['t0', 't1', 't2', 't3', 't4', 't5']);
});

test('30 entries keep 10, always the oldest and the newest, spread over the whole span', () => {
  const all = mk(30);
  const out = pickSpreadEntries(all);
  assert.strictEqual(out.length, 10);
  assert.strictEqual(out[0].topicId, 't0');
  assert.strictEqual(out[9].topicId, 't29');
  const idx = out.map((e) => Number(e.topicId.slice(1)));
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i] > idx[i - 1]);
  // even spread: no gap is more than twice the average step
  const avg = 29 / 9;
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i] - idx[i - 1] <= Math.ceil(avg) + 1);
});

test('deterministic, de-duplicated by topicId, titles cleaned and clipped', () => {
  const a = [{ topicId: 'x', date: '2026-09-01', title: 'A "quoted"\n title ' + 'z'.repeat(200) }, { topicId: 'x', date: '2026-09-02', title: 'dup' }];
  const out = pickSpreadEntries(a);
  assert.strictEqual(out.length, 1);
  assert.ok(out[0].title.length <= 110);
  assert.ok(!/["\n]/.test(out[0].title));
  assert.deepStrictEqual(pickSpreadEntries(mk(40)), pickSpreadEntries(mk(40)));
});

test('empty / junk input is safe', () => {
  assert.deepStrictEqual(pickSpreadEntries(null), []);
  assert.deepStrictEqual(pickSpreadEntries([null, {}, { topicId: '' }]), []);
});
