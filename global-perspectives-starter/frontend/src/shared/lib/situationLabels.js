// situationLabels — presentation helpers for the map-as-home situation feed.
// The world bundle carries ISO-3 codes (USA, IRN); names come from the one country table through
// shared/lib/countries.js. This module adds the region grouping and builds the deterministic
// (template, no LLM) lede sentence. Unknown codes fall back to the raw ISO-3, which an analyst
// audience reads fine — never a fabricated name.
import { COUNTRIES, resolveCountry } from '@/shared/lib/countries.js';

// iso3 -> display name, derived from the one table (kept as an export for callers that scan text).
const ISO3_NAME = Object.fromEntries(Object.entries(COUNTRIES).map(([iso3, c]) => [iso3, c.name]));

const REGION_BY_ISO3 = {};
const _reg = (region, codes) => codes.forEach((c) => { REGION_BY_ISO3[c] = region; });
_reg('the Middle East', ['ISR', 'PSE', 'IRN', 'IRQ', 'SAU', 'ARE', 'TUR', 'SYR', 'LBN', 'JOR', 'YEM', 'OMN', 'QAT', 'KWT', 'BHR']);
_reg('Europe', ['GBR', 'FRA', 'DEU', 'ITA', 'ESP', 'PRT', 'NLD', 'BEL', 'CHE', 'AUT', 'SWE', 'NOR', 'DNK', 'FIN', 'POL', 'CZE', 'GRC', 'IRL', 'ROU', 'HUN', 'UKR', 'SRB', 'HRV', 'BGR', 'SVK', 'SVN', 'ALB', 'BIH', 'XKX', 'MKD', 'MDA', 'BLR', 'RUS']);
_reg('North Africa', ['EGY', 'LBY', 'TUN', 'MAR', 'DZA']);
_reg('the Sahel', ['NER', 'MLI', 'BFA', 'TCD', 'SDN']);
_reg('East Africa', ['SSD', 'SOM', 'ETH', 'ERI', 'KEN', 'TZA', 'UGA', 'RWA', 'COD']);
_reg('West Africa', ['NGA', 'SEN', 'GHA', 'CIV', 'CMR', 'SLE', 'LBR', 'GIN']);
_reg('Southern Africa', ['MOZ', 'ZWE', 'ZMB', 'AGO', 'ZAF', 'MWI', 'MDG']);
_reg('East Asia', ['CHN', 'JPN', 'KOR', 'PRK', 'TWN', 'MNG']);
_reg('South Asia', ['IND', 'PAK', 'BGD', 'LKA', 'NPL', 'AFG']);
_reg('Southeast Asia', ['MMR', 'THA', 'VNM', 'PHL', 'IDN', 'MYS', 'SGP', 'KHM', 'LAO']);
_reg('Central Asia', ['KAZ', 'UZB', 'KGZ', 'TJK', 'TKM']);
_reg('the Caucasus', ['AZE', 'ARM', 'GEO']);
_reg('Latin America', ['BRA', 'MEX', 'ARG', 'COL', 'CHL', 'PER', 'VEN', 'ECU', 'BOL', 'PRY', 'URY', 'CUB', 'HTI', 'DOM', 'GTM', 'HND', 'SLV', 'NIC', 'PAN']);
_reg('North America', ['USA', 'CAN']);

export function iso3Name(code) {
  if (!code) return '';
  return COUNTRIES[code]?.name || code;
}

export function regionOf(iso3List = []) {
  for (const c of iso3List) { if (REGION_BY_ISO3[c]) return REGION_BY_ISO3[c]; }
  return null;
}

// name -> ISO3 (R4b, country risk layer): the weekly archive / country-intelligence flow keys
// everything by display name, but the map draws polygons keyed by ISO3 — this is the one join point.
// Aliases resolve too ("United Arab Emirates" -> ARE); a non-country resolves to null, never a guess.
export function iso3ForName(name) {
  return resolveCountry(name)?.iso3 || null;
}

const TIER_LABEL = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' };
export { TIER_LABEL };

// S6 (track record forecast map): the iso3 -> display-name table, exported so a caller can scan
// free text for a country name. Derived from the one country table — never a hand-typed list.
export { ISO3_NAME };

/**
 * buildLede — deterministic one-sentence summary from counts + the top situation.
 * Counts only, no prose synthesis. Mirrors the design target's lede examples.
 * `emptyMessage` (F4, review R2): the caller's own computed, honest empty-state line (e.g. "no
 * disaster alerts open · news situations paused since <date>") — used instead of the generic
 * "quiet" claim whenever the caller knows something more precise (e.g. that news is paused while
 * GDACS is still live). Falls back to the generic line only when the caller has nothing better.
 */
export function buildLede(open = [], hero = null, emptyMessage = null) {
  const highs = open.filter((s) => s.tier === 'high');
  const elevated = open.filter((s) => s.tier === 'elevated');
  const escalating = open.filter((s) => s.escalating);
  let head;
  if (highs.length) head = `${highs.length} high-tier situation${highs.length === 1 ? '' : 's'} active`;
  else if (elevated.length) head = `No high-tier situations · ${elevated.length} elevated worth watching`;
  else if (open.length) head = `${open.length} situation${open.length === 1 ? '' : 's'} tracked · none high`;
  else return emptyMessage || 'The map is quiet — no situations open right now.';

  // Region clause anchored to the top-ranked situation (the hero) so the sentence and the map
  // callout agree; fall back to the first high/elevated only if the hero has no known region.
  const focus = (hero && regionOf(hero.iso3_affected || [])) ? hero
    : (escalating.find((s) => s.tier === 'high') || highs[0] || elevated[0] || hero);
  const region = focus ? regionOf(focus.iso3_affected || []) : null;
  if (region && focus?.escalating) return `${head} · ${region} escalating`;
  if (region && highs.length) return `${head} · ${region} in focus`;
  return head;
}
