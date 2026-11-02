'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { keepDayZero, utcDay, archiveRowKey } = require('../src/dayZero');

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

test('archiveRowKey: archive#YYYY-MM-DD of the UTC day, zero-padded', () => {
  assert.strictEqual(archiveRowKey(new Date('2026-09-05T00:00:00Z')), 'archive#2026-09-05');
  assert.strictEqual(archiveRowKey(new Date('2026-12-31T23:59:59.999Z')), 'archive#2026-12-31');
  assert.strictEqual(archiveRowKey(new Date(Date.UTC(2026, 0, 1))), 'archive#2026-01-01');
});
test('archiveRowKey equals the old per-Lambda formatDateKey for every day of two years (UTC parts, no local-time drift)', () => {
  const old = (date) => `archive#${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  for (let ms = Date.UTC(2025, 0, 1, 23, 59); ms < Date.UTC(2027, 0, 1); ms += 86400000) {
    assert.strictEqual(archiveRowKey(new Date(ms)), old(new Date(ms)));
    assert.strictEqual(archiveRowKey(new Date(ms)), `archive#${utcDay(ms)}`);
  }
});
