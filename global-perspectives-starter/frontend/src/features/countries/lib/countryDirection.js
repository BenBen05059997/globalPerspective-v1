// countryDirection — the S4 "RISK + DIRECTION" arrow (COUNTRY_VIEW_DISCUSSION.md, "Direction
// rule" / REDESIGN_MASTER_PLAN.md §3.5 C1). Pure, deterministic, no LLM: computed from the
// country's own HISTORY# snapshots (see useCountryHistory.js), never from a prompt.
//
// Rule (design doc, verbatim):
//   - Compare the median of the last 3 readings against the median of the 3 nearest to 14 days
//     earlier (±3 days); each bucket needs >=3 readings within <=5 days of each other.
//   - An arrow needs |delta| >= 10 on the worst-axis score. Name an axis only if its own
//     delta >= 15.
//   - If both medians are >=95, show "at top of scale" with no arrow.
//   - Compute only if the latest reading is <=7 days old; 7-30 days amber "as of";
//     over 30 days hidden.
//   - Otherwise "not enough readings (gap ...)".
import { deriveHeadline, AXES, AXIS_LABELS } from '@/shared/lib/riskTiers.js';

const BUCKET_SPAN_MAX_DAYS = 5;
const PRIOR_TARGET_DAYS = 14;
const PRIOR_WINDOW_DAYS = 3;
const ARROW_THRESHOLD = 10;
const AXIS_NAME_THRESHOLD = 15;
const TOP_OF_SCALE = 95;

function parseDay(dateKey) {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return null;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function scoreOf(snap) {
  return deriveHeadline(snap).score;
}

function axisScoreOf(snap, axis) {
  const dims = snap && snap.dimensions;
  const v = dims && dims[axis];
  if (v == null) return null;
  const n = Number(typeof v === 'object' ? v.score : v);
  return Number.isFinite(n) ? n : null;
}

// The bucket's own date span in days (max - min), or null if it can't be measured.
function spanDays(bucket) {
  const days = bucket.map((s) => parseDay(s.dateKey)).filter((d) => d != null);
  if (days.length < 2) return 0;
  return (Math.max(...days) - Math.min(...days)) / 86400000;
}

function notEnough(extra = {}) {
  return { state: 'not_enough', arrow: null, ...extra };
}

/**
 * computeCountryDirection(snapshots, now) -> {
 *   state: 'hidden' | 'not_enough' | 'top' | 'arrow' | 'unchanged',
 *   freshness: 'full' | 'amber' | null,   // full <=7d, amber 7-30d
 *   asOf: dateKey | null,
 *   ageDays: number | null,
 *   arrow: 'up' | 'down' | null,
 *   delta: number | null,                  // scoreA - scoreB (positive = worsening)
 *   scoreA: number | null,                 // median of the latest 3 readings
 *   scoreB: number | null,                 // median of the 3 nearest 14 days earlier
 *   axis: { key, label, delta } | null,    // only when its own |delta| >= 15
 *   reason: string | null,                 // for not_enough: what's missing
 * }
 */
export function computeCountryDirection(snapshots, now = Date.now()) {
  if (!Array.isArray(snapshots) || !snapshots.length) {
    return notEnough({ reason: 'no readings' });
  }

  const sorted = [...snapshots]
    .filter((s) => s && s.dateKey && scoreOf(s) != null && parseDay(s.dateKey) != null)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  if (!sorted.length) return notEnough({ reason: 'no scored readings' });

  const latest = sorted[sorted.length - 1];
  const latestDay = parseDay(latest.dateKey);
  const ageDays = (now - latestDay) / 86400000;

  if (ageDays > 30) {
    return { state: 'hidden', freshness: null, asOf: latest.dateKey, ageDays, arrow: null, delta: null, scoreA: null, scoreB: null, axis: null, reason: null };
  }
  const freshness = ageDays > 7 ? 'amber' : 'full';

  const bucketA = sorted.slice(-3);
  if (bucketA.length < 3 || spanDays(bucketA) > BUCKET_SPAN_MAX_DAYS) {
    return notEnough({ freshness, asOf: latest.dateKey, ageDays, reason: 'gap in recent readings' });
  }

  const targetDay = latestDay - PRIOR_TARGET_DAYS * 86400000;
  const windowMs = PRIOR_WINDOW_DAYS * 86400000;
  // Candidates strictly before the recent bucket, within +/-3 days of the 14-day-ago target —
  // never reuse a reading already in bucketA.
  const bucketAKeys = new Set(bucketA.map((s) => s.dateKey));
  const candidates = sorted
    .filter((s) => !bucketAKeys.has(s.dateKey) && Math.abs(parseDay(s.dateKey) - targetDay) <= windowMs)
    .sort((a, b) => Math.abs(parseDay(a.dateKey) - targetDay) - Math.abs(parseDay(b.dateKey) - targetDay));
  if (candidates.length < 3) {
    return notEnough({ freshness, asOf: latest.dateKey, ageDays, reason: 'gap around 14 days earlier' });
  }
  const bucketB = candidates.slice(0, 3);
  if (spanDays(bucketB) > BUCKET_SPAN_MAX_DAYS) {
    return notEnough({ freshness, asOf: latest.dateKey, ageDays, reason: 'gap around 14 days earlier' });
  }

  const scoreA = median(bucketA.map(scoreOf));
  const scoreB = median(bucketB.map(scoreOf));
  const delta = scoreA - scoreB;

  const base = { freshness, asOf: latest.dateKey, ageDays, scoreA, scoreB, delta };

  if (scoreA >= TOP_OF_SCALE && scoreB >= TOP_OF_SCALE) {
    return { state: 'top', arrow: null, axis: namedAxis(bucketA, bucketB), reason: null, ...base };
  }

  if (Math.abs(delta) < ARROW_THRESHOLD) {
    return { state: 'unchanged', arrow: null, axis: null, reason: null, ...base };
  }

  return { state: 'arrow', arrow: delta > 0 ? 'up' : 'down', axis: namedAxis(bucketA, bucketB), reason: null, ...base };
}

// The single named axis (only when its own |delta| >= 15), worst-mover-first.
function namedAxis(bucketA, bucketB) {
  let best = null;
  for (const axis of AXES) {
    const a = median(bucketA.map((s) => axisScoreOf(s, axis)).filter((v) => v != null));
    const b = median(bucketB.map((s) => axisScoreOf(s, axis)).filter((v) => v != null));
    if (a == null || b == null) continue;
    const d = a - b;
    if (Math.abs(d) >= AXIS_NAME_THRESHOLD && (!best || Math.abs(d) > Math.abs(best.delta))) {
      best = { key: axis, label: AXIS_LABELS[axis], delta: d };
    }
  }
  return best;
}

// A short, honest label for the direction line — used by CountryCardV2 and the country page.
export function directionLabel(direction) {
  if (!direction) return null;
  switch (direction.state) {
    case 'hidden':
      return null;
    case 'top':
      return 'at top of scale';
    case 'unchanged':
      return 'unchanged';
    case 'arrow':
      return direction.arrow === 'up' ? 'worse' : 'better';
    case 'not_enough':
    default:
      return `not enough readings (${direction.reason || 'gap'})`;
  }
}
