'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isCountryName, usableCountryRecord } = require('../src/placeFilter');

const NOW = Date.parse('2026-09-30T12:00:00Z');

test('aggregates and regions are not countries', () => {
  for (const n of ['Europe', 'Asia', 'Middle East', 'Americas', 'Africa', 'Global', 'European Union', 'NATO', 'North America', 'Southeast Asia', '']) {
    assert.strictEqual(isCountryName(n), false, n);
  }
});
test('real countries, territories and common variants are countries', () => {
  for (const n of ['Iran', 'Taiwan', 'Palestine', 'Kosovo', 'Hong Kong', 'USA', 'United States', 'UK', 'DR Congo', 'Türkiye', 'Democratic Republic of the Congo']) {
    assert.strictEqual(isCountryName(n), true, n);
  }
});
test('usableCountryRecord: a real country generated within 30 days', () => {
  assert.strictEqual(usableCountryRecord('Iran', { generatedAt: '2026-09-25T00:00:00Z' }, NOW), true);
});
test('usableCountryRecord: a 31-day-old real record is not usable', () => {
  assert.strictEqual(usableCountryRecord('Iran', { generatedAt: '2026-08-29T00:00:00Z' }, NOW), false);
});
test('usableCountryRecord: a fresh region record is not usable (Europe is fresh until ~11 Oct)', () => {
  assert.strictEqual(usableCountryRecord('Europe', { generatedAt: '2026-09-12T00:00:00Z' }, NOW), false);
});
test('usableCountryRecord: missing generatedAt, garbage or null record -> not usable (fail empty)', () => {
  assert.strictEqual(usableCountryRecord('Iran', {}, NOW), false);
  assert.strictEqual(usableCountryRecord('Iran', { generatedAt: 'nope' }, NOW), false);
  assert.strictEqual(usableCountryRecord('Iran', null, NOW), false);
});
