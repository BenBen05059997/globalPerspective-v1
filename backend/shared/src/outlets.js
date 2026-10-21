// Outlet metadata for source diversity display.
// Maps lowercased outlet domain (matches `source` field on each topic source)
// → { outlet: display name, country: ISO-3166-1 alpha-2, type: 'wire'|'national'|'regional'|'specialist' }
//
// The one outlet table (moved to backend/shared 2026-10-20 from newsInvokeGemini). Used by:
//   - newsInvokeGemini source_enrichment.js (outlet name on each topic source)
//   - newsSituationIngest classifier-core.js (outlet name on corpus rows)
// Unknown domains keep `outlet: null`; never invent a name.
//
// Add new outlets as Brave Search returns them. Unknown outlets degrade
// gracefully — frontend shows count without flag.

const OUTLET_METADATA = {
  // Wires
  'reuters.com':           { outlet: 'Reuters', country: 'GB', type: 'wire' },
  'apnews.com':            { outlet: 'Associated Press', country: 'US', type: 'wire' },
  'afp.com':               { outlet: 'AFP', country: 'FR', type: 'wire' },
  'bloomberg.com':         { outlet: 'Bloomberg', country: 'US', type: 'wire' },
  'upi.com':               { outlet: 'UPI', country: 'US', type: 'wire' },

  // National — Anglosphere
  'bbc.com':               { outlet: 'BBC', country: 'GB', type: 'national' },
  'bbc.co.uk':             { outlet: 'BBC', country: 'GB', type: 'national' },
  'theguardian.com':       { outlet: 'The Guardian', country: 'GB', type: 'national' },
  'npr.org':               { outlet: 'NPR', country: 'US', type: 'national' },
  'cbc.ca':                { outlet: 'CBC', country: 'CA', type: 'national' },
  'nytimes.com':           { outlet: 'The New York Times', country: 'US', type: 'national' },
  'washingtonpost.com':    { outlet: 'The Washington Post', country: 'US', type: 'national' },
  'wsj.com':               { outlet: 'The Wall Street Journal', country: 'US', type: 'national' },
  'cnn.com':               { outlet: 'CNN', country: 'US', type: 'national' },
  'cnbc.com':              { outlet: 'CNBC', country: 'US', type: 'national' },
  'abc.net.au':            { outlet: 'ABC Australia', country: 'AU', type: 'national' },

  // National — Europe
  'france24.com':          { outlet: 'France 24', country: 'FR', type: 'national' },
  'dw.com':                { outlet: 'DW', country: 'DE', type: 'national' },
  'euronews.com':          { outlet: 'Euronews', country: 'EU', type: 'national' },
  'lemonde.fr':            { outlet: 'Le Monde', country: 'FR', type: 'national' },
  'spiegel.de':            { outlet: 'Der Spiegel', country: 'DE', type: 'national' },

  // Middle East
  'aljazeera.com':         { outlet: 'Al Jazeera', country: 'QA', type: 'national' },
  'middleeasteye.net':     { outlet: 'Middle East Eye', country: 'GB', type: 'regional' },
  'al-monitor.com':        { outlet: 'Al-Monitor', country: 'US', type: 'regional' },
  'haaretz.com':           { outlet: 'Haaretz', country: 'IL', type: 'national' },
  'timesofisrael.com':     { outlet: 'The Times of Israel', country: 'IL', type: 'national' },

  // Asia
  'scmp.com':              { outlet: 'South China Morning Post', country: 'HK', type: 'national' },
  'japantimes.co.jp':      { outlet: 'The Japan Times', country: 'JP', type: 'national' },
  'asia.nikkei.com':       { outlet: 'Nikkei Asia', country: 'JP', type: 'national' },
  'asiatimes.com':         { outlet: 'Asia Times', country: 'HK', type: 'regional' },
  'thediplomat.com':       { outlet: 'The Diplomat', country: 'US', type: 'specialist' },
  'channelnewsasia.com':   { outlet: 'CNA', country: 'SG', type: 'national' },
  'dawn.com':              { outlet: 'Dawn', country: 'PK', type: 'national' },
  'bangkokpost.com':       { outlet: 'Bangkok Post', country: 'TH', type: 'national' },
  'koreaherald.com':       { outlet: 'The Korea Herald', country: 'KR', type: 'national' },
  'koreatimes.co.kr':      { outlet: 'The Korea Times', country: 'KR', type: 'national' },
  'www.koreaherald.com':   { outlet: 'The Korea Herald', country: 'KR', type: 'national' },
  'www.koreatimes.co.kr':  { outlet: 'The Korea Times', country: 'KR', type: 'national' },

  // Africa
  'allafrica.com':         { outlet: 'AllAfrica', country: 'ZA', type: 'regional' },
  'dailymaverick.co.za':   { outlet: 'Daily Maverick', country: 'ZA', type: 'national' },
  'theeastafrican.co.ke':  { outlet: 'The EastAfrican', country: 'KE', type: 'regional' },

  // Specialist
  'insideclimatenews.org': { outlet: 'Inside Climate News', country: 'US', type: 'specialist' },
  'grist.org':             { outlet: 'Grist', country: 'US', type: 'specialist' },
  'arstechnica.com':       { outlet: 'Ars Technica', country: 'US', type: 'specialist' },
  'technologyreview.com':  { outlet: 'MIT Technology Review', country: 'US', type: 'specialist' },
  'tomshardware.com':      { outlet: 'Tom’s Hardware', country: 'US', type: 'specialist' },
  'digitimes.com':         { outlet: 'DigiTimes', country: 'TW', type: 'specialist' },

  // Other commonly-seen
  'yahoo.com':             { outlet: 'Yahoo', country: 'US', type: 'national' },
  'usnews.com':            { outlet: 'U.S. News & World Report', country: 'US', type: 'national' },
  'staradvertiser.com':    { outlet: 'Honolulu Star-Advertiser', country: 'US', type: 'regional' },
  'humanresourcesonline.net': { outlet: 'Human Resources Online', country: 'SG', type: 'specialist' },
};

// Normalize a domain — strip leading www.
function normalizeOutlet(source) {
  if (!source) return '';
  return String(source).trim().toLowerCase().replace(/^www\./, '');
}

function getOutletMeta(source) {
  const normalized = normalizeOutlet(source);
  return OUTLET_METADATA[normalized] || OUTLET_METADATA[`www.${normalized}`] || null;
}

// Two-level public suffixes whose registrable domain has three labels (decision 0036 section 3). Extend with a
// note in 0036 when an outlet needs another.
const TWO_LEVEL_SUFFIXES = ['co.uk', 'org.uk', 'ac.uk', 'co.jp', 'co.kr', 'co.in', 'co.za', 'com.au', 'com.br', 'com.cn', 'com.mx', 'com.ar', 'com.tr'];
const HOST_PREFIXES = ['www', 'm', 'amp'];

/** 'https://m.bbc.co.uk/x' or 'm.bbc.co.uk' -> 'bbc.co.uk': lower-case host, leading www./m./amp. dropped, then the last two
 *  labels (three after a listed two-level suffix). '' when there is no host. */
function registrableDomain(input) {
  let host = String(input == null ? '' : input).trim().toLowerCase();
  if (!host) return '';
  try { host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(host) ? host : `//${host}`, 'http://x').hostname; } catch (e) { return ''; }
  let labels = host.split('.').filter(Boolean);
  while (labels.length > 2 && HOST_PREFIXES.includes(labels[0])) labels = labels.slice(1);
  if (labels.length <= 2 || /^\d+(\.\d+){3}$/.test(host)) return labels.join('.');
  const take = TWO_LEVEL_SUFFIXES.includes(labels.slice(-2).join('.')) ? 3 : 2;
  return labels.slice(-take).join('.');
}

module.exports = { OUTLET_METADATA, TWO_LEVEL_SUFFIXES, normalizeOutlet, getOutletMeta, registrableDomain };
