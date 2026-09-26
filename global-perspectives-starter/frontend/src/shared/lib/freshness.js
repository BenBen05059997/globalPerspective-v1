// freshness — honesty helper for the map console (M2). Computes whether "new stories and
// analysis" have been paused (news classification hasn't produced anything fresh) from a real
// timestamp — never a typed/guessed date. See CLAUDE.md: never invent dates.

const PAUSE_THRESHOLD_MS = 36 * 60 * 60 * 1000; // 36h

/**
 * pausedSince — given the timestamp of the newest AI analysis (e.g. a daily brief's
 * `generatedAt`), returns null when analysis is fresh (or the input is missing/invalid), or
 * `{ date, label }` when it is older than the 36h threshold.
 *   - `date`: the newestAnalysisAt Date object, for callers that want to format it themselves.
 *   - `label`: a short human date (e.g. "Sep 12") derived from that same Date — never typed.
 *
 * @param {{ newestAnalysisAt?: string | number | Date | null, now?: string | number | Date }} args
 */
export function pausedSince({ newestAnalysisAt, now = Date.now(), searched = false, lookbackDays = null } = {}) {
  // Nothing found after a completed search: the pause is older than the search window. Say so
  // (it is the MOST stale case), instead of rendering nothing. Monitor fix, M2 review 2026-09-26.
  if (newestAnalysisAt == null) {
    if (searched && Number.isFinite(lookbackDays)) {
      return { date: null, label: null, beyondLookback: true, text: `no analysis in the last ${lookbackDays} days` };
    }
    return null;
  }
  const then = new Date(newestAnalysisAt).getTime();
  if (!Number.isFinite(then)) return null;
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) return null;
  const age = nowMs - then;
  if (age <= PAUSE_THRESHOLD_MS) return null;
  const date = new Date(then);
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { date, label, beyondLookback: false, text: `analysis paused since ${label}` };
}
