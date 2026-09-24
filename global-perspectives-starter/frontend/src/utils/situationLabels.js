// situationLabels — presentation helpers for the map-as-home situation feed.
// The world bundle carries ISO-3 codes (USA, IRN); the older countryMapping tables are
// ISO-2/name based, so this dedicated module resolves ISO-3 → display name / region and
// builds the deterministic (template, no LLM) lede sentence. Unknown codes fall back to the
// raw ISO-3, which an analyst audience reads fine — never a fabricated name.

// Crisis-prone + major countries. Fallback is the code itself, so this need not be exhaustive.
const ISO3_NAME = {
  USA: 'United States', GBR: 'United Kingdom', FRA: 'France', DEU: 'Germany', ITA: 'Italy',
  ESP: 'Spain', PRT: 'Portugal', NLD: 'Netherlands', BEL: 'Belgium', CHE: 'Switzerland',
  AUT: 'Austria', SWE: 'Sweden', NOR: 'Norway', DNK: 'Denmark', FIN: 'Finland', POL: 'Poland',
  CZE: 'Czechia', GRC: 'Greece', IRL: 'Ireland', ROU: 'Romania', HUN: 'Hungary', UKR: 'Ukraine',
  SRB: 'Serbia', HRV: 'Croatia', BGR: 'Bulgaria', SVK: 'Slovakia', SVN: 'Slovenia', ALB: 'Albania',
  BIH: 'Bosnia', XKX: 'Kosovo', MKD: 'North Macedonia', MDA: 'Moldova', BLR: 'Belarus', RUS: 'Russia',
  ISR: 'Israel', PSE: 'Palestine', IRN: 'Iran', IRQ: 'Iraq', SAU: 'Saudi Arabia', ARE: 'UAE',
  TUR: 'Turkey', SYR: 'Syria', LBN: 'Lebanon', JOR: 'Jordan', YEM: 'Yemen', OMN: 'Oman',
  QAT: 'Qatar', KWT: 'Kuwait', BHR: 'Bahrain', EGY: 'Egypt', LBY: 'Libya', TUN: 'Tunisia',
  MAR: 'Morocco', DZA: 'Algeria', SDN: 'Sudan', SSD: 'South Sudan', SOM: 'Somalia', ETH: 'Ethiopia',
  ERI: 'Eritrea', KEN: 'Kenya', TZA: 'Tanzania', UGA: 'Uganda', RWA: 'Rwanda', COD: 'DR Congo',
  COG: 'Congo', NGA: 'Nigeria', NER: 'Niger', MLI: 'Mali', BFA: 'Burkina Faso', TCD: 'Chad',
  SEN: 'Senegal', GHA: 'Ghana', CIV: "Côte d'Ivoire", CMR: 'Cameroon', CAF: 'Central African Rep.',
  MOZ: 'Mozambique', ZWE: 'Zimbabwe', ZMB: 'Zambia', AGO: 'Angola', ZAF: 'South Africa',
  MWI: 'Malawi', MDG: 'Madagascar', SLE: 'Sierra Leone', LBR: 'Liberia', GIN: 'Guinea',
  CHN: 'China', JPN: 'Japan', KOR: 'South Korea', PRK: 'North Korea', TWN: 'Taiwan', MNG: 'Mongolia',
  IND: 'India', PAK: 'Pakistan', BGD: 'Bangladesh', LKA: 'Sri Lanka', NPL: 'Nepal', AFG: 'Afghanistan',
  MMR: 'Myanmar', THA: 'Thailand', VNM: 'Vietnam', PHL: 'Philippines', IDN: 'Indonesia', MYS: 'Malaysia',
  SGP: 'Singapore', KHM: 'Cambodia', LAO: 'Laos', KAZ: 'Kazakhstan', UZB: 'Uzbekistan', KGZ: 'Kyrgyzstan',
  TJK: 'Tajikistan', TKM: 'Turkmenistan', AZE: 'Azerbaijan', ARM: 'Armenia', GEO: 'Georgia',
  BRA: 'Brazil', MEX: 'Mexico', ARG: 'Argentina', COL: 'Colombia', CHL: 'Chile', PER: 'Peru',
  VEN: 'Venezuela', ECU: 'Ecuador', BOL: 'Bolivia', PRY: 'Paraguay', URY: 'Uruguay', CUB: 'Cuba',
  HTI: 'Haiti', DOM: 'Dominican Rep.', GTM: 'Guatemala', HND: 'Honduras', SLV: 'El Salvador',
  NIC: 'Nicaragua', PAN: 'Panama', CAN: 'Canada', AUS: 'Australia', NZL: 'New Zealand', PNG: 'Papua New Guinea', FJI: 'Fiji',
};

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
  return ISO3_NAME[code] || code;
}

export function regionOf(iso3List = []) {
  for (const c of iso3List) { if (REGION_BY_ISO3[c]) return REGION_BY_ISO3[c]; }
  return null;
}

const TIER_LABEL = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' };
export { TIER_LABEL };

/**
 * buildLede — deterministic one-sentence summary from counts + the top situation.
 * Counts only, no prose synthesis. Mirrors the design target's lede examples.
 */
export function buildLede(open = [], hero = null) {
  const highs = open.filter((s) => s.tier === 'high');
  const elevated = open.filter((s) => s.tier === 'elevated');
  const escalating = open.filter((s) => s.escalating);
  let head;
  if (highs.length) head = `${highs.length} high-tier situation${highs.length === 1 ? '' : 's'} active`;
  else if (elevated.length) head = `No high-tier situations · ${elevated.length} elevated worth watching`;
  else if (open.length) head = `${open.length} situation${open.length === 1 ? '' : 's'} tracked · none high`;
  else return 'The map is quiet — no situations open right now.';

  // Region clause anchored to the top-ranked situation (the hero) so the sentence and the map
  // callout agree; fall back to the first high/elevated only if the hero has no known region.
  const focus = (hero && regionOf(hero.iso3_affected || [])) ? hero
    : (escalating.find((s) => s.tier === 'high') || highs[0] || elevated[0] || hero);
  const region = focus ? regionOf(focus.iso3_affected || []) : null;
  if (region && focus?.escalating) return `${head} · ${region} escalating`;
  if (region && highs.length) return `${head} · ${region} in focus`;
  return head;
}
