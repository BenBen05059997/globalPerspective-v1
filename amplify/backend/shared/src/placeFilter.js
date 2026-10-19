'use strict';

// Real-country rule + record policy (Batch 3 / phase F). The `regions` an LLM puts on a story include
// aggregates (Europe, Asia, Middle East, Americas, Africa, Global, European Union, NATO ...); those must
// not be briefed or read as countries. The logic below is a byte-for-byte copy of `isCountryName` in
// newsCountryIntelligence/src/refreshPolicy.js (R1b) together with its two name tables; the copies are
// kept identical by scripts/check-shared-sync.mjs. Pure: no AWS, no network.

const ISO3_NAMES = require('./iso3Names.json');
const PLACE_NAMES = require('./placeNames.json');

// Names in briefings come from the LLM's `regions` and the record keys keep them verbatim, so both
// "USA" and "United States" exist as separate COUNTRY# records. Canonical form joins them to the
// names used by GDACS / the iso3 table.
const ALIASES = {
  'usa': 'united states', 'us': 'united states', 'u.s.': 'united states', 'u.s.a.': 'united states',
  'united states of america': 'united states', 'america': 'united states',
  'uk': 'united kingdom', 'u.k.': 'united kingdom', 'great britain': 'united kingdom', 'britain': 'united kingdom',
  'uae': 'united arab emirates', 'dr congo': 'democratic republic of the congo', 'drc': 'democratic republic of the congo',
  'congo-kinshasa': 'democratic republic of the congo', 'democratic republic of congo': 'democratic republic of the congo',
  'russian federation': 'russia', 'republic of korea': 'south korea', 'korea, south': 'south korea',
  'dprk': 'north korea', "democratic people's republic of korea": 'north korea', 'korea, north': 'north korea',
  'iran, islamic republic of': 'iran', 'islamic republic of iran': 'iran',
  'palestinian territories': 'palestine', 'state of palestine': 'palestine', 'gaza': 'palestine', 'west bank': 'palestine',
  'gaza strip': 'palestine', 'palestinian territory': 'palestine',
  'turkiye': 'turkey', 'türkiye': 'turkey', 'burma': 'myanmar', 'czech republic': 'czechia',
  'bosnia and herzegovina': 'bosnia', 'ivory coast': "côte d'ivoire", "cote d'ivoire": "côte d'ivoire",
  'republic of the congo': 'congo', 'congo-brazzaville': 'congo', 'central african republic': 'central african rep.',
  'dominican republic': 'dominican rep.', 'syrian arab republic': 'syria', 'viet nam': 'vietnam',
  'lao pdr': 'laos', 'timor-leste': 'east timor', 'the netherlands': 'netherlands', 'holland': 'netherlands',
  'taiwan, province of china': 'taiwan', 'republic of china': 'taiwan', 'north macedonia': 'north macedonia',
};

function canonicalName(name) {
  const k = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIASES[k] || k;
}

// R1b: only real countries / territories are briefed, so the top-20 slots do not go to region or
// aggregate keys the LLM puts in `regions` (Europe, Asia, Middle East, Americas, Africa, Global,
// European Union, NATO, ...). Allowed = a name in the ISO3 table OR in placeNames.json (the CLDR list
// of every country / territory + the variants briefings use: Kosovo, Hong Kong, Taiwan, Palestine, ...).
// Everything else is EXCLUDED and reported by the dry run. Existing region records stay in DynamoDB.
const normKey = (n) => String(n || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const PLACE_KEYS = new Set([...Object.values(ISO3_NAMES), ...PLACE_NAMES].map(normKey));

function isCountryName(name) {
  return PLACE_KEYS.has(normKey(name)) || PLACE_KEYS.has(normKey(canonicalName(name)));
}

// A COUNTRY# record a reader may use: a real country AND generated within the last 30 days. The old
// region records are frozen (no job refreshes them any more) and stay in DynamoDB; readers ignore them.
const RECORD_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
function usableCountryRecord(name, rec, nowMs = Date.now()) {
  if (!rec || !isCountryName(name)) return false;
  const t = Date.parse(rec.generatedAt);
  return Number.isFinite(t) && nowMs - t <= RECORD_MAX_AGE_MS && t <= nowMs + 86400000;
}

module.exports = { isCountryName, usableCountryRecord, normKey, canonicalName, RECORD_MAX_AGE_MS };
