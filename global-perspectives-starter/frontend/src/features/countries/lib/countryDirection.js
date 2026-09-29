// countryDirection — the S4 "RISK + DIRECTION" arrow (COUNTRY_VIEW_DISCUSSION.md, "Direction
// rule" / REDESIGN_MASTER_PLAN.md §3.5 C1). Pure, deterministic, no LLM: computed from the
// country's own HISTORY# snapshots (see useCountryHistory.js), never from a prompt.
//
// Rule (revised 2026-09-29, Batch 1 / R1: country briefings are now WEEKLY + early refreshes, so
// the old "3 readings within 5 days" buckets can never fill):
//   - "Now" = the latest reading (the median of the readings within 3 days of it when there are
//     two or more). "Before" = the reading nearest 7 days earlier (accepted 4-10 days earlier).
//   - An arrow needs |delta| >= 15 on the worst-axis score. One reading is noisier than a median of
//     three: in the live history a 10-point day-to-day jump happens in 13% of pairs, 15 in 6%.
//     Name an axis only if its own delta >= 15.
//   - If both are >=95, show "at top of scale" with no arrow.
//   - Compute only if the latest reading is <14 days old (COUNTRY_OLDER_AFTER_DAYS); 14-30 days
//     amber "as of"; over 30 days hidden.
//   - Otherwise "not enough readings (...)".
import { deriveHeadline, AXES, AXIS_LABELS } from '@/shared/lib/riskTiers.js';
import { COUNTRY_OLDER_AFTER_DAYS } from '@/shared/lib/freshness.js';

const NOW_WINDOW_DAYS = 3;
const PRIOR_TARGET_DAYS = 7;
const PRIOR_MIN_DAYS = 4;
const PRIOR_MAX_DAYS = 10;
const ARROW_THRESHOLD = 15;
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

function notEnough(extra = {}) {
  return { state: 'not_enough', arrow: null, ...extra };
}

/**
 * computeCountryDirection(snapshots, now) -> {
 *   state: 'hidden' | 'not_enough' | 'top' | 'arrow' | 'unchanged',
 *   freshness: 'full' | 'amber' | null,   // full <14d, amber 14-30d
 *   asOf: dateKey | null,
 *   ageDays: number | null,
 *   arrow: 'up' | 'down' | null,
 *   delta: number | null,                  // scoreA - scoreB (positive = worsening)
 *   scoreA: number | null,                 // the latest reading (median of readings within 3 days of it)
 *   scoreB: number | null,                 // the reading nearest 7 days earlier
 *   priorAsOf: dateKey | null,             // the date of that earlier reading
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
    return { state: 'hidden', freshness: null, asOf: latest.dateKey, ageDays, arrow: null, delta: null, scoreA: null, scoreB: null, priorAsOf: null, axis: null, reason: null };
  }
  const freshness = ageDays > COUNTRY_OLDER_AFTER_DAYS ? 'amber' : 'full';

  const DAY = 86400000;
  // "Now": the latest reading, or the median of the readings within 3 days of it.
  const nowGroup = sorted.filter((s) => latestDay - parseDay(s.dateKey) <= NOW_WINDOW_DAYS * DAY);
  const nowKeys = new Set(nowGroup.map((s) => s.dateKey));
  const oldestNow = Math.min(...nowGroup.map((s) => parseDay(s.dateKey)));

  // "Before": the reading nearest 7 days earlier (4-10 days before the latest), never one already in "now".
  const target = latestDay - PRIOR_TARGET_DAYS * DAY;
  const candidates = sorted
    .filter((s) => {
      if (nowKeys.has(s.dateKey)) return false;
      const back = (latestDay - parseDay(s.dateKey)) / DAY;
      return back >= PRIOR_MIN_DAYS && back <= PRIOR_MAX_DAYS && parseDay(s.dateKey) < oldestNow;
    })
    .sort((a, b) => Math.abs(parseDay(a.dateKey) - target) - Math.abs(parseDay(b.dateKey) - target));
  if (!candidates.length) {
    return notEnough({ freshness, asOf: latest.dateKey, ageDays, reason: 'no reading about 7 days earlier' });
  }
  const prior = candidates[0];

  const scoreA = median(nowGroup.map(scoreOf));
  const scoreB = scoreOf(prior);
  const delta = scoreA - scoreB;

  const base = { freshness, asOf: latest.dateKey, ageDays, scoreA, scoreB, delta, priorAsOf: prior.dateKey };

  if (scoreA >= TOP_OF_SCALE && scoreB >= TOP_OF_SCALE) {
    return { state: 'top', arrow: null, axis: namedAxis(nowGroup, [prior]), reason: null, ...base };
  }

  if (Math.abs(delta) < ARROW_THRESHOLD) {
    return { state: 'unchanged', arrow: null, axis: null, reason: null, ...base };
  }

  return { state: 'arrow', arrow: delta > 0 ? 'up' : 'down', axis: namedAxis(nowGroup, [prior]), reason: null, ...base };
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
