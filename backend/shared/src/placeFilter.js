'use strict';

// Real-country rule + record policy (Batch 3 / phase F). The `regions` an LLM puts on a story include
// aggregates (Europe, Asia, Middle East, Americas, Africa, Global, European Union, NATO ...); those must
// not be briefed or read as countries. Country identity (names, aliases, sub-national places) comes from
// the one resolver, ./countries.js over ./iso3Names.json. One copy, used by the Lambdas through src/_shared.
// Pure: no AWS, no network.

const { normKey, isCountry, parentCountry } = require('./countries');

// Names in briefings come from the LLM's `regions` and the record keys keep them verbatim, so both
// "USA" and "United States" exist as separate COUNTRY# records. The canonical form (the lower-cased
// display name of the country a name belongs to) joins them; text that is no country is only trimmed.
function canonicalName(name) {
  const c = parentCountry(name);
  return c ? c.name.toLowerCase() : String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// R1b: only real countries / territories are briefed, so the top-20 slots do not go to region or
// aggregate keys (Europe, Asia, Middle East, Americas, Africa, Global, European Union, NATO, ...).
const isCountryName = isCountry;

// A COUNTRY# record a reader may use: a real country AND generated within the last 30 days. The old
// region records are frozen (no job refreshes them any more) and stay in DynamoDB; readers ignore them.
const RECORD_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
function usableCountryRecord(name, rec, nowMs = Date.now()) {
  if (!rec || !isCountryName(name)) return false;
  const t = Date.parse(rec.generatedAt);
  return Number.isFinite(t) && nowMs - t <= RECORD_MAX_AGE_MS && t <= nowMs + 86400000;
}

module.exports = { isCountryName, usableCountryRecord, normKey, canonicalName, RECORD_MAX_AGE_MS };
