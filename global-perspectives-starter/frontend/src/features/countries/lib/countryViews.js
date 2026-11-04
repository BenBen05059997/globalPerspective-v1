// The country page mounts several readers of the same record files (the page and its CountryCardV2 both read the country view, plus the history
// hook; the card's stories ask the same forecasts views). While a request for a file is in flight every caller gets that one promise, so a page
// load fetches each file once. Nothing is kept after it settles (the callers' own caches decide freshness).
import { fetchRecordView, makeRecordViews } from '@/shared/api/recordViews.js';

/** once(map, key, run) -> the promise already in flight for `key`, else a new `run()` shared until it settles. */
export function once(inFlight, key, run) {
  if (inFlight.has(key)) return inFlight.get(key);
  const p = Promise.resolve().then(run).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

const files = new Map();
/** The record views with one in-flight request per file (same rules as makeRecordViews). */
export const countryViews = makeRecordViews((path) => once(files, path, () => fetchRecordView(path)));
