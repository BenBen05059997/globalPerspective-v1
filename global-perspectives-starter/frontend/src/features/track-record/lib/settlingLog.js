// settlingLog — "one square per week... missed weeks shown in red" (TRACK_RECORD_AND_STUDIO_
// RULING.md, Track record page design). Buckets real `confirmedAt` timestamps into ISO weeks
// (Mon-Sun) from `eraCutFrom` through `now`, and marks any week with zero settlements as missed.
// Pure and real-date-driven: no week is invented and no count is guessed — a week with no
// confirmedAt in range is simply zero.
import { weekStart, isoWeekKey } from '@/features/track-record/lib/trFormatDate.js';

const WEEK_MS = 7 * 24 * 3600 * 1000;

/**
 * @param {string[]} confirmedAtDates - ISO timestamps of every resolution (pilot + post-pilot;
 *   the log is about settling activity, not accuracy, so the pilot's one run still counts as a week
 *   that *did* settle something — it's the calibration/headline numbers that exclude it, not this).
 * @param {string} eraCutFrom - 'YYYY-MM-DD', the first week to show
 * @param {Date|string|number} now - the current time (injected for pure/testable output)
 * @returns {{weekStart: Date, weekKey: string, settled: number, missed: boolean}[]}
 */
export function buildSettlingLog(confirmedAtDates, eraCutFrom, now = new Date()) {
  const start = weekStart(eraCutFrom);
  const end = weekStart(now);
  if (!start || !end) return [];

  const counts = new Map();
  for (const at of confirmedAtDates || []) {
    const key = isoWeekKey(at);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const weeks = [];
  for (let t = start.getTime(); t <= end.getTime(); t += WEEK_MS) {
    const d = new Date(t);
    const key = isoWeekKey(d);
    const settled = counts.get(key) || 0;
    weeks.push({ weekStart: d, weekKey: key, settled, missed: settled === 0 });
  }
  return weeks;
}

export function settlingSummary(weeks) {
  const total = weeks.length;
  const missed = weeks.filter((w) => w.missed).length;
  return { total, missed, settled: total - missed };
}
