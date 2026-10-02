// analysisFreshness — one tiny module store for "when was the newest AI-generated content on this
// site made" (REDESIGN_MASTER_PLAN §3.1 status line: computed from the newest `generatedAt`, never
// typed). Hooks that ALREADY load analysis content report its real timestamp here
// (daily brief, stories feed, country intelligence); the site-wide status line reads the newest.
// No fetch happens in this file — nothing extra goes to the proxy (concurrency cap 4).
import { useSyncExternalStore } from 'react';

const sources = new Map(); // source name -> epoch ms
const listeners = new Set();
let newest = null;

const FUTURE_SLACK_MS = 10 * 60 * 1000; // clock skew allowance; a later timestamp is not "generated" yet

/** newestOf(values) -> epoch ms of the newest valid timestamp, or null */
export function newestOf(values) {
  let best = null;
  for (const v of values || []) {
    const t = typeof v === 'number' ? v : new Date(v).getTime();
    if (Number.isFinite(t) && (best === null || t > best)) best = t;
  }
  return best;
}

/** reportAnalysisAt(source, iso) — record a real generation timestamp (ignored when invalid or in the future;
 *  a source only ever moves forward, so a second call with an older stamp never lowers it). */
export function reportAnalysisAt(source, iso, now = Date.now()) {
  if (!source || iso == null) return;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t > now + FUTURE_SLACK_MS) return;
  if ((sources.get(source) ?? -Infinity) >= t) return;
  sources.set(source, t);
  const next = newestOf(sources.values());
  if (next !== newest) {
    newest = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
const getSnapshot = () => newest;

/** useNewestAnalysisAt() -> epoch ms | null (re-renders when a newer timestamp is reported) */
export function useNewestAnalysisAt() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function __resetAnalysisFreshness() { sources.clear(); newest = null; listeners.forEach((l) => l()); }
