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

// freshnessState — the console's shared freshness ramp (REDESIGN_MASTER_PLAN.md §3.1):
//   live   <24h    — glows, counts as "now"
//   plain  1–7d    — shown at normal weight, no glow
//   older  7–30d   — desaturated + an honest "older · <date>" label
//   hidden 30d+    — dropped from the map/feed, only counted (never silently rendered as current)
// Pure function of an age in days so callers (map shading, feed rows, StoryPeek) never each
// invent their own thresholds. `ageDays` should already be `(now - timestamp) / 86400000`.
export function freshnessState(ageDays) {
  if (!Number.isFinite(ageDays)) return 'hidden';
  // F2.4 (map-console review R1): a slightly-future timestamp (clock skew between the browser and
  // whatever generated the record) used to compute a negative age and fall straight to 'hidden' —
  // every story on the page could read "hidden, older than 30 days" from a few seconds of skew.
  // Clamp to 0 (i.e. "just now") instead of guessing a real age for a timestamp that hasn't
  // happened yet.
  if (ageDays < 0) ageDays = 0;
  if (ageDays < 1) return 'live';
  if (ageDays < 7) return 'plain';
  if (ageDays < 30) return 'older';
  return 'hidden';
}

/**
 * olderLabel — the honest "older · <date>" note the map/feed show for stories in the `older`
 * (7–30d) freshness band. `date` accepts anything `new Date()` accepts; returns null when it
 * can't be parsed, rather than inventing a placeholder date.
 */
export function olderLabel(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `older · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
