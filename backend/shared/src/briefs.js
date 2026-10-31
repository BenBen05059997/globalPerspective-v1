'use strict';

// The daily and weekly briefs as the site serves them (decision 0048). One place for the countries every reader gets: the stored
// rows (DAILY_BRIEF#, WEEKLY_BRIEF#, and the brief notes made from them) carry iso3 only on rows written after the writers
// added it; the others get it here from their names. Used by the read API's brief actions and by the record's brief views, so
// the two answer the same.
const { iso3List } = require('./resolveIso3');

/** Daily brief: top stories and the country to watch carry iso3[]; everything else passes through. */
function briefWithIso3(brief) {
  if (!brief || typeof brief !== 'object') return brief;
  const out = { ...brief };
  if (Array.isArray(brief.topStories)) {
    out.topStories = brief.topStories.map((s) => (s && typeof s === 'object' ? { ...s, iso3: Array.isArray(s.iso3) ? s.iso3 : iso3List(s.regions) } : s));
  }
  const ctw = brief.countryToWatch;
  if (ctw && typeof ctw === 'object') out.countryToWatch = { ...ctw, iso3: Array.isArray(ctw.iso3) ? ctw.iso3 : iso3List([ctw.countryName]) };
  return out;
}

/** Weekly brief: signals carry iso3[] (older rows: from the "A · B" region text). */
function weeklyWithIso3(brief) {
  if (!brief || !Array.isArray(brief.signals)) return brief;
  return { ...brief, signals: brief.signals.map((s) => (s && typeof s === 'object'
    ? { ...s, iso3: Array.isArray(s.iso3) ? s.iso3 : iso3List(String(s.region || '').split('·').map((x) => x.trim())) } : s)) };
}

/** Every country a brief (in the shape the readers get) names: sorted, unique ISO3 codes. */
function briefCountries(brief) {
  const lists = [];
  for (const s of brief.topStories || []) if (s && Array.isArray(s.iso3)) lists.push(s.iso3);
  if (brief.countryToWatch && Array.isArray(brief.countryToWatch.iso3)) lists.push(brief.countryToWatch.iso3);
  for (const s of brief.signals || []) if (s && Array.isArray(s.iso3)) lists.push(s.iso3);
  return [...new Set(lists.flat())].sort();
}

module.exports = { briefWithIso3, weeklyWithIso3, briefCountries };
