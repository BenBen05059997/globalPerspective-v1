// Are the record's views fresh enough to answer for "the newest days" (decision 0050)? newsStoryRecord rebuilds them after every ingest and
// every brief, and nightly, so `manifest.builtAt` is never more than 8 hours old (the longest gap between two builds); MAX_VIEW_AGE_MS (9 h) adds an hour. Fresh: the views carry today (provisional entries included) and a page does not ask the DynamoDB-backed actions for the
// newest days. Not fresh (older, no manifest, unreadable): the page asks the action as it did before, and the reason is reported, never hidden.
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';

export const MAX_VIEW_AGE_MS = 9 * 60 * 60 * 1000;
const TTL_MS = 5 * 60 * 1000;
let memo = null; // { ts, promise }

/** True when the manifest says the views were built at most MAX_VIEW_AGE_MS ago. Pure. */
export function manifestFresh(manifest, now = Date.now()) {
  const built = Date.parse(manifest?.builtAt);
  return Number.isFinite(built) && now - built <= MAX_VIEW_AGE_MS;
}

/**
 * { fresh, manifest } for the next ~5 minutes (one request shared by every caller). A stale or missing manifest is reported as
 * `record-views-stale`, one that cannot be read as `record-manifest`; both answer fresh: false, and nothing is cached on a failed read.
 * `views` and `now` are for tests.
 */
export function loadViewsFresh(views = makeRecordViews(), now = Date.now) {
  if (memo && now() - memo.ts < TTL_MS) return memo.promise;
  const promise = Promise.resolve().then(() => views.fetchManifest()).then((manifest) => {
    const fresh = manifestFresh(manifest, now());
    if (!fresh) reportFetchError('record-views-stale', new Error(manifest ? `record views built ${manifest.builtAt}, over ${MAX_VIEW_AGE_MS / 3600000} h old` : 'record views manifest not generated'));
    return { fresh, manifest: manifest ?? null };
  }, (err) => {
    reportFetchError('record-manifest', err);
    if (memo && memo.promise === promise) memo = null; // never keep a failed read
    return { fresh: false, manifest: null };
  });
  memo = { ts: now(), promise };
  return promise;
}

/** Tests: forget the shared answer. */
export function clearViewsFreshCache() { memo = null; }
