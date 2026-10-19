'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { keepDayZero, utcDay } = require('../src/dayZero');

const NOW = Date.parse('2026-09-30T12:00:00Z');
const e = (id, at) => ({ topicId: id, archivedAt: at });

test('keeps an entry archived today (UTC)', () => {
  assert.deepStrictEqual(keepDayZero([e('a', '2026-09-30T04:25:00.000Z')], NOW).map((x) => x.topicId), ['a']);
});
test('drops a stale entry left in today-archive by a stalled pipeline (13 Sep shown as 27 Sep)', () => {
  const stale = [e('afd', '2026-09-13T00:07:03.058Z')];
  assert.deepStrictEqual(keepDayZero(stale, Date.parse('2026-09-27T09:00:00Z')), []);
});
test('drops missing / invalid archivedAt (fail empty)', () => {
  assert.deepStrictEqual(keepDayZero([{ topicId: 'x' }, e('y', 'nope'), null], NOW), []);
});
test('UTC midnight boundary: 23:55 yesterday is not day 0 (it lives in archive#yesterday)', () => {
  const at = Date.parse('2026-10-01T00:10:00Z');
  assert.deepStrictEqual(keepDayZero([e('late', '2026-09-30T23:55:00Z'), e('new', '2026-10-01T00:05:00Z')], at).map((x) => x.topicId), ['new']);
});
test('non-array input', () => {
  assert.deepStrictEqual(keepDayZero(undefined, NOW), []);
  assert.strictEqual(utcDay(NOW), '2026-09-30');
});
