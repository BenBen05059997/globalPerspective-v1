// Real-country rule for the frontend (Batch 3 / phase F): the `regions` on archive entries include aggregates
// (Europe, Asia, Middle East, Americas, Africa, Global, European Union, NATO ...) that are not countries.
// The block below is a byte-for-byte copy of `isCountryName` + its alias table from
// amplify/backend/function/newsCountryIntelligence/src/refreshPolicy.js (renamed export only); the name
// tables in shared/data are copies of that Lambda's iso3Names.json / placeNames.json. All are kept identical
// by scripts/check-shared-sync.mjs.
import ISO3_NAMES from '@/shared/data/iso3Names.json';
import PLACE_NAMES from '@/shared/data/placeNames.json';

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

/** isRealCountryName - a country or territory (not a region / aggregate). Same rule as the briefing Lambdas. */
export const isRealCountryName = isCountryName;
