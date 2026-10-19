'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { shapeCountryFacts } = require('../src/lib');

const ROW = {
  PK: 'FACTS#United States', SK: 'COUNTRY_FACTS', ttl: 1, acledData: { eventCount30d: 3 },
  headOfState: { name: 'Donald Trump', since: '2025-01-20' }, headOfGovernment: { name: 'Donald Trump', since: '2025-01-20' },
  leadershipSource: 'wikidata', lastUpdatedAt: '2026-09-28T20:03:23.148Z',
  capital: { names: ['Washington, D.C.'], source: 'wikidata', checkedAt: '2026-09-28T20:03:24Z' },
  population: { value: 340110988, year: 2024, time: '2024-07-01', source: 'wikidata', checkedAt: '2026-09-28T20:03:24Z' },
};

test('full row: each part keeps its source + as-of; no ACLED, no keys, no ttl', () => {
  const s = shapeCountryFacts(ROW);
  assert.deepStrictEqual(Object.keys(s).sort(), ['capital', 'leadership', 'population']);
  assert.strictEqual(s.leadership.checkedAt, '2026-09-28T20:03:23.148Z');
  assert.strictEqual(s.population.year, 2024);
  assert.ok(!('acledData' in s) && !('PK' in s) && !('ttl' in s));
});
test('a part without source or date is omitted (never undated / unsourced)', () => {
  const s = shapeCountryFacts({ ...ROW, capital: { names: ['X'], source: 'wikidata' }, population: { value: 5, year: 2020, checkedAt: 'x' } });
  assert.deepStrictEqual(Object.keys(s), ['leadership']);
  assert.strictEqual(shapeCountryFacts({ ...ROW, lastUpdatedAt: undefined, capital: undefined, population: undefined }), null);
});
test('bad population values are dropped; missing row -> null', () => {
  assert.strictEqual(shapeCountryFacts({ population: { value: 'NaN', year: 2020, source: 's', checkedAt: 'x' } }), null);
  assert.strictEqual(shapeCountryFacts({ population: { value: -1, year: 2020, source: 's', checkedAt: 'x' } }), null);
  assert.strictEqual(shapeCountryFacts(null), null);
  assert.strictEqual(shapeCountryFacts(undefined), null);
});
test('legacy row (leadership only, pre-D2) still yields leadership', () => {
  const s = shapeCountryFacts({ headOfState: { name: 'A', since: null }, leadershipSource: 'wikidata', lastUpdatedAt: '2026-09-28T00:00:00Z' });
  assert.deepStrictEqual(s.leadership.headOfState, { name: 'A', since: null });
  assert.strictEqual(s.leadership.headOfGovernment, null);
});
