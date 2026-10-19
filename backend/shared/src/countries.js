'use strict';

// Country identity — the one resolver over the one country table (iso3Names.json:
// { ISO3: { name, iso2, aliases[], places?[] } }). `name` is the display name the site uses in URLs and
// record keys (short forms: "UAE", "DR Congo"); `aliases` are other names for the same country; `places`
// are sub-national places that sit inside exactly one country (West Bank, Scotland, Florida). Pure: no
// AWS, no network. The frontend copy is global-perspectives-starter/frontend/src/shared/lib/countries.js;
// scripts/check-shared-sync.mjs keeps the block between the markers identical and the JSON byte-identical.

const COUNTRIES = require('./iso3Names.json');

// --- country resolver core (identical in the frontend copy) ---
function normKey(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const BY_NAME = new Map();
const BY_PLACE = new Map();
for (const [iso3, c] of Object.entries(COUNTRIES)) {
  for (const n of [c.name, ...(c.aliases || [])]) BY_NAME.set(normKey(n), iso3);
  for (const p of c.places || []) BY_PLACE.set(normKey(p), iso3);
}

const found = (iso3) => (iso3 ? { iso3, name: COUNTRIES[iso3].name } : null);

/** resolveCountry('United Arab Emirates') -> { iso3: 'ARE', name: 'UAE' }. Accepts a display name, an alias
 *  or an upper-case ISO3 code. A region, bloc, sea or sub-national place -> null. */
function resolveCountry(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (/^[A-Z]{3}$/.test(t) && COUNTRIES[t]) return found(t);
  return found(BY_NAME.get(normKey(t)));
}

/** isCountry('Strait of Hormuz') -> false; isCountry('USA') -> true. */
function isCountry(text) {
  return resolveCountry(text) !== null;
}

/** parentCountry('West Bank') -> { iso3: 'PSE', name: 'Palestine' }: the country a name belongs to (a country
 *  belongs to itself); null for regions, blocs, seas and unknown text. */
function parentCountry(text) {
  return resolveCountry(text) || (typeof text === 'string' ? found(BY_PLACE.get(normKey(text))) : null);
}
// --- end country resolver core ---

module.exports = { COUNTRIES, normKey, resolveCountry, isCountry, parentCountry };
