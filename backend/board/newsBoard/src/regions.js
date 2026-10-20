'use strict';

// ISO3 -> region for board presets. Only the frontend has a region mapping (shared/lib/countryMapping.js, keyed
// by ISO-2 and ESM), and backend/shared has none, so this is a small hard-coded table. Coarse on purpose: a
// preset is "the riskiest stories of this part of the world". Unlisted countries have no region (no preset).

const REGIONS = {
  'Middle East': 'ARE BHR IRN IRQ ISR JOR KWT LBN OMN PSE QAT SAU SYR TUR YEM',
  'Europe': 'ALB AUT BEL BGR BIH BLR CHE CYP CZE DEU DNK ESP EST FIN FRA GBR GEO GRC HRV HUN IRL ISL ITA LTU LUX LVA MDA MKD MLT MNE NLD NOR POL PRT ROU RUS SRB SVK SVN SWE UKR XKX ARM AZE',
  'East Asia': 'CHN JPN KOR PRK TWN MNG HKG',
  'Southeast Asia': 'BRN IDN KHM LAO MMR MYS PHL SGP THA TLS VNM',
  'South Asia': 'AFG BGD BTN IND LKA MDV NPL PAK',
  'Central Asia': 'KAZ KGZ TJK TKM UZB',
  'Africa': 'AGO BDI BEN BFA BWA CAF CIV CMR COD COG DJI DZA EGY ERI ESH ETH GAB GHA GIN GMB GNB GNQ KEN LBR LBY LSO MAR MDG MLI MOZ MRT MWI NAM NER NGA RWA SDN SEN SLE SOM SSD SWZ TCD TGO TUN TZA UGA ZAF ZMB ZWE',
  'North America': 'CAN USA MEX',
  'Latin America': 'ARG BLZ BOL BRA CHL COL CRI CUB DOM ECU GTM GUY HND HTI JAM NIC PAN PER PRY SLV SUR TTO URY VEN',
  'Oceania': 'AUS FJI NZL PNG SLB VUT',
};

const REGION_OF = new Map();
for (const [region, codes] of Object.entries(REGIONS)) for (const c of codes.split(' ')) REGION_OF.set(c, region);

/** regionOf('IRN') -> 'Middle East'; unknown -> null. */
const regionOf = (iso3) => REGION_OF.get(iso3) || null;

/** presetIdOf('Middle East') -> 'preset-middle-east'. */
const presetIdOf = (region) => `preset-${region.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

module.exports = { REGIONS, regionOf, presetIdOf };
