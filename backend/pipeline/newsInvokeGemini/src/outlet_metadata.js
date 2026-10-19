// Outlet metadata for source diversity display.
// Maps lowercased outlet domain (matches `source` field on each topic source)
// → { country: ISO-3166-1 alpha-2, type: 'wire'|'national'|'regional'|'specialist' }
//
// Used by:
//   - Frontend Home.jsx to render country flags / outlet count
//   - (future) outlet diversity scoring during enrichment
//
// Add new outlets as Brave Search returns them. Unknown outlets degrade
// gracefully — frontend shows count without flag.

const OUTLET_METADATA = {
  // Wires
  'reuters.com':           { country: 'GB', type: 'wire' },
  'apnews.com':            { country: 'US', type: 'wire' },
  'afp.com':               { country: 'FR', type: 'wire' },
  'bloomberg.com':         { country: 'US', type: 'wire' },
  'upi.com':               { country: 'US', type: 'wire' },

  // National — Anglosphere
  'bbc.com':               { country: 'GB', type: 'national' },
  'bbc.co.uk':             { country: 'GB', type: 'national' },
  'theguardian.com':       { country: 'GB', type: 'national' },
  'npr.org':               { country: 'US', type: 'national' },
  'cbc.ca':                { country: 'CA', type: 'national' },
  'nytimes.com':           { country: 'US', type: 'national' },
  'washingtonpost.com':    { country: 'US', type: 'national' },
  'wsj.com':               { country: 'US', type: 'national' },
  'cnn.com':               { country: 'US', type: 'national' },
  'cnbc.com':              { country: 'US', type: 'national' },
  'abc.net.au':            { country: 'AU', type: 'national' },

  // National — Europe
  'france24.com':          { country: 'FR', type: 'national' },
  'dw.com':                { country: 'DE', type: 'national' },
  'euronews.com':          { country: 'EU', type: 'national' },
  'lemonde.fr':            { country: 'FR', type: 'national' },
  'spiegel.de':            { country: 'DE', type: 'national' },

  // Middle East
  'aljazeera.com':         { country: 'QA', type: 'national' },
  'middleeasteye.net':     { country: 'GB', type: 'regional' },
  'al-monitor.com':        { country: 'US', type: 'regional' },
  'haaretz.com':           { country: 'IL', type: 'national' },
  'timesofisrael.com':     { country: 'IL', type: 'national' },

  // Asia
  'scmp.com':              { country: 'HK', type: 'national' },
  'japantimes.co.jp':      { country: 'JP', type: 'national' },
  'asia.nikkei.com':       { country: 'JP', type: 'national' },
  'asiatimes.com':         { country: 'HK', type: 'regional' },
  'thediplomat.com':       { country: 'US', type: 'specialist' },
  'channelnewsasia.com':   { country: 'SG', type: 'national' },
  'dawn.com':              { country: 'PK', type: 'national' },
  'bangkokpost.com':       { country: 'TH', type: 'national' },
  'koreaherald.com':       { country: 'KR', type: 'national' },
  'koreatimes.co.kr':      { country: 'KR', type: 'national' },
  'www.koreaherald.com':   { country: 'KR', type: 'national' },
  'www.koreatimes.co.kr':  { country: 'KR', type: 'national' },

  // Africa
  'allafrica.com':         { country: 'ZA', type: 'regional' },
  'dailymaverick.co.za':   { country: 'ZA', type: 'national' },
  'theeastafrican.co.ke':  { country: 'KE', type: 'regional' },

  // Specialist
  'insideclimatenews.org': { country: 'US', type: 'specialist' },
  'grist.org':             { country: 'US', type: 'specialist' },
  'arstechnica.com':       { country: 'US', type: 'specialist' },
  'technologyreview.com':  { country: 'US', type: 'specialist' },
  'tomshardware.com':      { country: 'US', type: 'specialist' },
  'digitimes.com':         { country: 'TW', type: 'specialist' },

  // Other commonly-seen
  'yahoo.com':             { country: 'US', type: 'national' },
  'usnews.com':            { country: 'US', type: 'national' },
  'staradvertiser.com':    { country: 'US', type: 'regional' },
  'humanresourcesonline.net': { country: 'SG', type: 'specialist' },
};

// Normalize a domain — strip leading www.
function normalizeOutlet(source) {
  if (!source) return '';
  return String(source).toLowerCase().replace(/^www\./, '');
}

function getOutletMeta(source) {
  const normalized = normalizeOutlet(source);
  return OUTLET_METADATA[normalized] || OUTLET_METADATA[`www.${normalized}`] || null;
}

module.exports = { OUTLET_METADATA, normalizeOutlet, getOutletMeta };
