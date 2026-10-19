'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { COUNTRIES, resolveCountry, isCountry, parentCountry, normKey } = require('../src/countries');

test('every entry has a display name, an ISO2 code and an aliases list', () => {
  for (const [iso3, c] of Object.entries(COUNTRIES)) {
    assert.match(iso3, /^[A-Z]{3}$/);
    assert.ok(c.name && /^[A-Z]{2}$/.test(c.iso2) && Array.isArray(c.aliases), iso3);
  }
});
test('no name, alias or place belongs to two countries', () => {
  const seen = new Map();
  for (const [iso3, c] of Object.entries(COUNTRIES)) {
    for (const n of [c.name, ...c.aliases, ...(c.places || [])]) {
      const k = normKey(n);
      assert.ok(!seen.has(k) || seen.get(k) === iso3, `${n}: ${seen.get(k)} vs ${iso3}`);
      seen.set(k, iso3);
    }
  }
});
test('short display names; long forms and codes resolve to them', () => {
  assert.deepStrictEqual(resolveCountry('United Arab Emirates'), { iso3: 'ARE', name: 'UAE' });
  assert.deepStrictEqual(resolveCountry('Democratic Republic of Congo'), { iso3: 'COD', name: 'DR Congo' });
  assert.deepStrictEqual(resolveCountry('Democratic Republic of the Congo'), { iso3: 'COD', name: 'DR Congo' });
  assert.deepStrictEqual(resolveCountry('USA'), { iso3: 'USA', name: 'United States' });
  assert.deepStrictEqual(resolveCountry(' türkiye '), { iso3: 'TUR', name: 'Turkey' });
  assert.deepStrictEqual(resolveCountry('GUM'), { iso3: 'GUM', name: 'Guam' });
  assert.deepStrictEqual(resolveCountry('HKG'), { iso3: 'HKG', name: 'Hong Kong' });
  assert.deepStrictEqual(resolveCountry('Vatican City'), { iso3: 'VAT', name: 'Vatican City' });
});
test('the 17 countries missing before resolve', () => {
  for (const n of ['Vatican City', 'Hong Kong', 'Botswana', 'Burundi', 'Costa Rica', 'Djibouti', 'Gambia', 'Iceland',
    'Jamaica', 'Mauritius', 'Seychelles', 'Greenland', 'Bermuda', 'Guam']) assert.ok(isCountry(n), n);
});
test('regions, blocs, seas, noise and lower-case codes are not countries', () => {
  for (const n of ['Europe', 'Middle East', 'European Union', 'NATO', 'Strait of Hormuz', 'Global', 'Various', 'gum', '', null, undefined, 42,
    'Guam, Northern Mariana Islands, Japan']) {
    assert.strictEqual(resolveCountry(n), null, String(n));
    assert.strictEqual(parentCountry(n), null, String(n));
  }
});
test('parentCountry: a sub-national place belongs to its country; a country to itself', () => {
  assert.deepStrictEqual(parentCountry('West Bank'), { iso3: 'PSE', name: 'Palestine' });
  assert.deepStrictEqual(parentCountry('Gaza Strip'), { iso3: 'PSE', name: 'Palestine' });
  assert.deepStrictEqual(parentCountry('Scotland'), { iso3: 'GBR', name: 'United Kingdom' });
  assert.deepStrictEqual(parentCountry('Florida'), { iso3: 'USA', name: 'United States' });
  assert.deepStrictEqual(parentCountry('Puntland'), { iso3: 'SOM', name: 'Somalia' });
  assert.deepStrictEqual(parentCountry('France'), { iso3: 'FRA', name: 'France' });
  assert.strictEqual(resolveCountry('West Bank'), null);
});
