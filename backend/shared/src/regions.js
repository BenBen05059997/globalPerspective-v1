'use strict';

// The one ISO3 -> region table for the backend (decision 0058 rule 2). Coarse on purpose: a region is "this part
// of the world" for board presets and story region lists. Countries not listed have no region. The codes past the
// original 173 are a proposal (0058 "Open details" 1) the operator has not confirmed: change them here, one line
// per region. ATF BVT HMD IOT SGS stay without a region on purpose.

const REGIONS = {
  'Middle East': 'ARE BHR IRN IRQ ISR JOR KWT LBN OMN PSE QAT SAU SYR TUR YEM',
  'Europe': 'ALB AUT BEL BGR BIH BLR CHE CYP CZE DEU DNK ESP EST FIN FRA GBR GEO GRC HRV HUN IRL ISL ITA LTU LUX LVA MDA MKD MLT MNE NLD NOR POL PRT ROU RUS SRB SVK SVN SWE UKR XKX ARM AZE AND LIE MCO SMR VAT ALA FRO GGY GIB IMN JEY SJM',
  'East Asia': 'CHN JPN KOR PRK TWN MNG HKG MAC',
  'Southeast Asia': 'BRN IDN KHM LAO MMR MYS PHL SGP THA TLS VNM',
  'South Asia': 'AFG BGD BTN IND LKA MDV NPL PAK',
  'Central Asia': 'KAZ KGZ TJK TKM UZB',
  'Africa': 'AGO BDI BEN BFA BWA CAF CIV CMR COD COG DJI DZA EGY ERI ESH ETH GAB GHA GIN GMB GNB GNQ KEN LBR LBY LSO MAR MDG MLI MOZ MRT MWI NAM NER NGA RWA SDN SEN SLE SOM SSD SWZ TCD TGO TUN TZA UGA ZAF ZMB ZWE CPV COM MUS SYC STP MYT REU SHN',
  'North America': 'CAN USA MEX BMU GRL SPM',
  'Latin America': 'ARG BLZ BOL BRA CHL COL CRI CUB DOM ECU GTM GUY HND HTI JAM NIC PAN PER PRY SLV SUR TTO URY VEN ATG BHS BRB DMA GRD KNA LCA VCT ABW AIA BES BLM CUW CYM FLK GLP GUF MAF MSR MTQ PRI SXM TCA VGB VIR',
  'Oceania': 'AUS FJI NZL PNG SLB VUT FSM KIR MHL NRU PLW TON TUV WSM ASM CCK COK CXR GUM MNP NCL NFK NIU PCN PYF TKL WLF UMI',
};

const REGION_OF = new Map();
for (const [region, codes] of Object.entries(REGIONS)) for (const c of codes.split(' ')) REGION_OF.set(c, region);

/** regionOf('IRN') -> 'Middle East'; unknown -> null. */
const regionOf = (iso3) => REGION_OF.get(iso3) || null;

/** presetIdOf('Middle East') -> 'preset-middle-east'. */
const presetIdOf = (region) => `preset-${region.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** regionsOfCountries(['IRN','USA','XXX']) -> ['Middle East', 'North America']: sorted, de-duplicated region names
 * of a story's countries (0058 rule 3). EUU counts as Europe; WLD, LAT, UNK and codes with no region give none. */
const regionsOfCountries = (iso3List) => {
  const out = new Set();
  for (const code of iso3List || []) {
    const region = code === 'EUU' ? 'Europe' : regionOf(code);
    if (region) out.add(region);
  }
  return [...out].sort();
};

module.exports = { REGIONS, regionOf, presetIdOf, regionsOfCountries };
