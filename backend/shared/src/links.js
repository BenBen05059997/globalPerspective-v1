'use strict';

// links — the site's page addresses for backend writers (emails, posts), built by the same rules as the
// frontend's shared/lib/links.js; scripts/check-shared-sync.mjs keeps the block between the markers identical.
// Functions return site paths; absoluteUrl() adds the site origin for an email. Pure: no AWS, no network.

const { parentCountry } = require('./countries');

const SITE_URL = 'https://globalperspective.net';

// --- link rules core (identical in the frontend copy) ---
const ROUTE = {
  map: '/',
  today: '/today',
  stories: '/weekly',
  story: '/weekly/thread/:threadId',
  countries: '/weekly/countries',
  country: '/weekly/country/:countryName',
  briefings: '/briefings',
  trackRecord: '/track-record',
  breaking: '/breaking/:id',
};

const BRIEFING_MODES = ['read', 'weekly', 'present'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// path + the params that have a value, in the order given.
function withQuery(path, params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  return qs ? `${path}?${qs}` : path;
}

/** storyHref('thread-a-1', { tab, from, country }) -> '/weekly/thread/thread-a-1?tab=…'. No id -> the stories list. */
function storyHref(threadId, opts = {}) {
  if (!threadId) return ROUTE.stories;
  const path = ROUTE.story.replace(':threadId', encodeURIComponent(threadId));
  return withQuery(path, { tab: opts.tab, from: opts.from, country: opts.country });
}

/** countryHref('United Arab Emirates' | 'ARE' | 'West Bank') -> '/weekly/country/UAE' (or Palestine for West
 *  Bank). The URL keeps the canonical display name. Not a country (Strait of Hormuz, Europe, NATO) -> null. */
function countryHref(nameOrIso3) {
  const c = parentCountry(nameOrIso3);
  return c ? ROUTE.country.replace(':countryName', encodeURIComponent(c.name)) : null;
}

/** mapHref({ situation }) -> '/?focus=<id>'; ({ story }) -> '/?story=<threadId>'; ({ country }) -> '/?country=<ISO3>';
 *  optional layer ('situations' | 'risk'). A country that is not one -> null; no target -> the map. */
function mapHref({ situation, story, country, layer } = {}) {
  const params = {};
  if (situation) params.focus = situation;
  else if (story) params.story = story;
  else if (country) {
    const c = parentCountry(country);
    if (!c) return null;
    params.country = c.iso3;
  }
  if (layer) params.layer = layer;
  return withQuery(ROUTE.map, params);
}

/** briefingHref({ mode: 'read'|'weekly'|'present', date: 'YYYY-MM-DD', week: 'YYYY-MM-DD', deck: 'weekly' }) -> '/briefings?…'.
 *  `deck: 'weekly'` picks the weekly deck in present mode (daily is the default deck).
 *  An unknown mode or a malformed day is left out rather than building a broken address. */
function briefingHref({ mode, date, week, deck } = {}) {
  return withQuery(ROUTE.briefings, {
    mode: BRIEFING_MODES.includes(mode) ? mode : null,
    date: DAY.test(date || '') ? date : null,
    week: DAY.test(week || '') ? week : null,
    deck: deck === 'weekly' ? 'weekly' : null,
  });
}

/** The DOM id of one forecast on a page (track record board, story page): 'q-<qid>'. */
function forecastAnchorId(qid) {
  return `q-${qid}`;
}

/** forecastHref('q123') -> '/track-record?q=q123'. No qid -> the track record. */
function forecastHref(qid) {
  return qid ? withQuery(ROUTE.trackRecord, { q: qid }) : ROUTE.trackRecord;
}

function todayHref() {
  return ROUTE.today;
}

/** breakingHref('alert-1') -> '/breaking/alert-1': a breaking alert's resolver address (the client redirect
 *  sends it to the alert's story when it has one, else to the map). No id -> the map. */
function breakingHref(alertId) {
  return alertId ? ROUTE.breaking.replace(':id', encodeURIComponent(alertId)) : ROUTE.map;
}

/** entityHref(kind, id): the canonical address of one entity, or null when it cannot be addressed (no id,
 *  or a "country" that is not one). kind: 'story' | 'country' | 'situation' | 'forecast'. */
function entityHref(kind, id) {
  if (!id) return null;
  if (kind === 'story') return storyHref(id);
  if (kind === 'country') return countryHref(id);
  if (kind === 'situation') return mapHref({ situation: id });
  if (kind === 'forecast') return forecastHref(id);
  return null;
}
// --- end link rules core ---

/** absoluteUrl('/weekly/country/UAE') -> 'https://globalperspective.net/weekly/country/UAE'. A null path
 *  (an entity that has no page) stays null. `site` overrides the origin (e.g. the SITE_URL env). */
function absoluteUrl(path, site = SITE_URL) {
  if (path == null) return null;
  return `${String(site || SITE_URL).replace(/\/$/, '')}${path}`;
}

module.exports = {
  SITE_URL, ROUTE, storyHref, countryHref, mapHref, briefingHref, forecastHref, forecastAnchorId, todayHref,
  breakingHref, entityHref, absoluteUrl,
};
