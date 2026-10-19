'use strict';
// Temporary country resolver (replaced by L1-LINKS resolveCountry) — `node --test backend/shared/test/`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveIso3, iso3List } = require('../src/resolveIso3');

test('aliases resolve to the canonical short name', () => {
  for (const [text, iso3, name] of [
    ['USA', 'USA', 'United States'], ['United States of America', 'USA', 'United States'], ['United States', 'USA', 'United States'],
    ['Democratic Republic of the Congo', 'COD', 'DR Congo'], ['Democratic Republic of Congo', 'COD', 'DR Congo'], ['DRC', 'COD', 'DR Congo'],
    ['United Arab Emirates', 'ARE', 'UAE'], ['UAE', 'ARE', 'UAE'],
    ['West Bank', 'PSE', 'Palestine'], ['Gaza Strip', 'PSE', 'Palestine'], ['Palestinian Territories', 'PSE', 'Palestine'],
    ['Bosnia', 'BIH', 'Bosnia and Herzegovina'], ['Bosnia and Herzegovina', 'BIH', 'Bosnia and Herzegovina'],
    ['france', 'FRA', 'France'], ['FRA', 'FRA', 'France'],
  ]) assert.deepEqual(resolveIso3(text), { iso3, name }, text);
});

test('regions, aggregates and unknown places resolve to null', () => {
  for (const t of ['Europe', 'Middle East', 'Global', 'Strait of Hormuz', 'Arctic', '', null]) assert.equal(resolveIso3(t), null, String(t));
});

test('iso3List dedupes in first-seen order', () => {
  assert.deepEqual(iso3List(['USA', 'Russia', 'United States', 'Europe', 'Gaza']), ['USA', 'RUS', 'PSE']);
});
