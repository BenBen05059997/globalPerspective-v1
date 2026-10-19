'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { pickLatestBrief, briefKeys } = require('../src/lib');

test('pickLatestBrief: newest dateKey wins, editions newest first', () => {
  const r = pickLatestBrief([{ dateKey: '2026-09-12', h: 'a' }, { dateKey: '2026-09-30', h: 'c' }, { dateKey: '2026-09-20', h: 'b' }]);
  assert.strictEqual(r.item.h, 'c');
  assert.deepStrictEqual(r.editions, ['2026-09-30', '2026-09-20', '2026-09-12']);
});
test('pickLatestBrief: none / junk rows -> null item, empty editions', () => {
  assert.deepStrictEqual(pickLatestBrief([]), { item: null, editions: [] });
  assert.deepStrictEqual(pickLatestBrief([{ dateKey: 'x' }, null, {}]), { item: null, editions: [] });
  assert.deepStrictEqual(pickLatestBrief(undefined), { item: null, editions: [] });
});
test('briefKeys: today back N days, default 30, clamped 1..60', () => {
  const now = Date.parse('2026-09-30T05:00:00Z');
  const k = briefKeys(now);
  assert.strictEqual(k.length, 30); assert.strictEqual(k[0], '2026-09-30'); assert.strictEqual(k[29], '2026-09-01');
  assert.strictEqual(briefKeys(now, 500).length, 60);
  assert.strictEqual(briefKeys(now, 0).length, 30);
  assert.strictEqual(briefKeys(now, 3).length, 3);
});
