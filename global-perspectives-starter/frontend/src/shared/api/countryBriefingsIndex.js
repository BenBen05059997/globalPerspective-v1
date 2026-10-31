// The record's countries index (/data/record/views/index/countries.json, decision 0042): the briefing fields the
// countries list and the map's country-risk layer read (countryName, riskScore, riskLevel, dimensions, headline,
// trajectory, the first risk signal, generatedAt) for every briefed country, keyed by ISO3. One request replaces up
// to four `country_intelligence` calls (15 names each). Fields beyond those stay with the action and the country view.
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { resolveCountry } from '@/shared/lib/countries.js';

const TTL_MS = 30 * 60 * 1000;
let memo = null; // { ts, promise }

/** True when the index can answer: an object of countries. */
export const countriesIndexUsable = (index) => Boolean(index && index.countries && typeof index.countries === 'object' && !Array.isArray(index.countries));

/** @returns {Object<string, object>} name -> briefing for the names the index has a briefing for (the action's shape and keys) */
export function briefingsFromIndex(index, names) {
  const out = {};
  if (!countriesIndexUsable(index)) return out;
  for (const name of names || []) {
    const iso3 = resolveCountry(name)?.iso3;
    if (iso3 && index.countries[iso3]) out[name] = index.countries[iso3];
  }
  return out;
}

/**
 * The index for the next ~30 minutes (one request shared by every caller), or null when it is not generated or could not be
 * read (a failed read is reported); the caller then asks the action. `getViews` is for tests.
 */
export function loadCountriesIndex(getViews = makeRecordViews()) {
  if (memo && Date.now() - memo.ts < TTL_MS) return memo.promise;
  const promise = getViews.fetchCountriesIndex()
    .then((index) => (countriesIndexUsable(index) ? index : null))
    .catch((err) => { reportFetchError('countries-index', err); return null; });
  memo = { ts: Date.now(), promise };
  promise.then((index) => { if (!index && memo && memo.promise === promise) memo = null; }); // never keep a miss
  return promise;
}

/** Tests: forget the shared index. */
export function clearCountriesIndexCache() { memo = null; }
