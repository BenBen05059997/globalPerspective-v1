'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { REGIONS, regionOf, presetIdOf, regionsOfCountries } = require('../src/regions');
const COUNTRIES = require('../src/iso3Names.json');

const NO_REGION = ['ATF', 'BVT', 'HMD', 'IOT', 'SGS'];

test('every site country has a region except the five ocean and sub-Antarctic territories', () => {
  assert.equal(Object.keys(COUNTRIES).length, 249);
  const none = Object.keys(COUNTRIES).filter((c) => !regionOf(c)).sort();
  assert.deepEqual(none, NO_REGION);
});
test('no region code is unknown to the country table, and none is in two regions', () => {
  const seen = new Map();
  for (const [region, codes] of Object.entries(REGIONS)) {
    for (const c of codes.split(' ')) {
      assert.ok(COUNTRIES[c], `${c} is not in iso3Names.json`);
      assert.ok(!seen.has(c), `${c} is in ${seen.get(c)} and ${region}`);
      seen.set(c, region);
    }
  }
});
test('presetIdOf builds a slug', () => {
  assert.equal(presetIdOf('Middle East'), 'preset-middle-east');
});
test('regionsOfCountries: sorted, de-duplicated, every region a story touches', () => {
  assert.deepEqual(regionsOfCountries([]), []);
  assert.deepEqual(regionsOfCountries(undefined), []);
  assert.deepEqual(regionsOfCountries(['USA', 'IRN', 'ISR', 'MEX']), ['Middle East', 'North America']);
  assert.deepEqual(regionsOfCountries(['UKR', 'CHN', 'RUS']), ['East Asia', 'Europe']);
});
test('regionsOfCountries: EUU is Europe; WLD, LAT, UNK, unknown and region-less codes give nothing', () => {
  assert.deepEqual(regionsOfCountries(['EUU']), ['Europe']);
  assert.deepEqual(regionsOfCountries(['EUU', 'FRA']), ['Europe']);
  assert.deepEqual(regionsOfCountries(['WLD', 'LAT', 'UNK', 'ATF', 'ZZZ']), []);
  assert.deepEqual(regionsOfCountries(['WLD', 'JPN']), ['East Asia']);
});
