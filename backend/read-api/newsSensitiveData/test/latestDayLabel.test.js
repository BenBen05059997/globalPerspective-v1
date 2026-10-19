'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { latestDayLabel, dedupeTopicDate } = require('../src/lib');

test('latestDayLabel uses the item own date, not today', () => {
  assert.strictEqual(latestDayLabel({ updatedAt: '2026-09-13T00:07:03.058Z' }), '2026-09-13');
  assert.strictEqual(latestDayLabel({ activatedAt: '2026-09-30T02:17:05.603Z' }), '2026-09-30');
});
test('latestDayLabel: missing or unparsable -> null (caller skips day 0)', () => {
  assert.strictEqual(latestDayLabel({}), null);
  assert.strictEqual(latestDayLabel({ updatedAt: 'garbage' }), null);
  assert.strictEqual(latestDayLabel(null), null);
});
test('dedupeTopicDate: same topicId + date once; same topicId other date kept', () => {
  const out = dedupeTopicDate([
    { topicId: 't1', date: '2026-09-13', source: 'latest' },
    { topicId: 't1', date: '2026-09-13', source: 'archive' },
    { topicId: 't1', date: '2026-09-14' },
    { title: 'no id', date: '2026-09-14' },
  ]);
  assert.strictEqual(out.length, 3);
  assert.strictEqual(out[0].source, 'latest');
});
