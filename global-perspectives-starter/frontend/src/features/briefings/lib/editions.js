// editions.js — pure date-range helpers for the /briefings editions strip (S3). No fetching, no
// fabricated dates: every dateKey/weekKey these functions produce is a real calendar date derived
// from a real anchor the caller already has (e.g. the last edition the daily-brief hook served,
// or the weekOf of the one weekly brief the backend can return). Kept pure + tested per CLAUDE.md
// ("pure logic in lib/ with vitest tests").

/** todayKey — UTC date key (YYYY-MM-DD), the same convention useDailyBrief uses. */
export function todayKey(now = new Date()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** addDaysKey — dateKey shifted by `days` (may be negative), UTC-safe. */
export function addDaysKey(dateKey, days) {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * lastNDateKeys — the `n` calendar dates ending at `anchorDateKey` (inclusive), newest first.
 * Used to size the daily editions-strip probe window (capped by the caller, not here).
 */
export function lastNDateKeys(anchorDateKey, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(addDaysKey(anchorDateKey, -i));
  return out;
}

/**
 * buildDailyEditionMarks — merges a date-key list with a known exists-map (dateKey -> true/false/
 * undefined) into strip marks. `undefined` (not yet probed) renders as 'unknown', not 'no edition'.
 * Every date in this list is on or before `currentDateKey` (the probe window never looks past the
 * latest known edition — see `useDailyEditionsIndex`), so a 'none' mark here is a real gap in the
 * archive, never explained by the ongoing pause (the pause only covers days AFTER the latest
 * edition — see `buildPausedSegment`).
 */
export function buildDailyEditionMarks(dateKeys, existsIndex, currentDateKey) {
  return dateKeys.map((dateKey) => {
    const known = existsIndex ? existsIndex[dateKey] : undefined;
    const status = known === true ? 'exists' : known === false ? 'none' : 'unknown';
    return { dateKey, status, current: dateKey === currentDateKey };
  });
}

/** daysBetween — whole calendar days from `aKey` to `bKey` (positive when b is after a). */
export function daysBetween(aKey, bKey) {
  const a = new Date(aKey + 'T00:00:00Z').getTime();
  const b = new Date(bKey + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * buildPausedSegment — the real gap between the NEWEST published edition and today, as a single
 * dashed range mark (never one mark per paused day — that's the fan-out §S3 warns against, and a
 * wall of identical dashes carries no more information than one labelled range). Null unless the
 * newest edition is 2+ days before today: a range that starts on today ("Today → today") is no
 * gap, and the day after the newest edition is simply the brief not yet out. The caller passes the
 * newest edition, never the one on screen.
 */
export function buildPausedSegment(newestDateKey, todayDateKey) {
  const days = daysBetween(newestDateKey, todayDateKey);
  if (!Number.isFinite(days) || days < 2) return null;
  return { fromKey: addDaysKey(newestDateKey, 1), toKey: todayDateKey, days };
}

/** The daily brief is published 23:00 JST = 14:00 UTC and the views rebuild at 14:15 UTC: after this UTC time a missing brief for today is late. */
export const DAILY_BRIEF_LATE_UTC = { hour: 14, minute: 30 };

/**
 * dailyPauseState — what to say when the brief for today is not the one served, from the NEWEST
 * published edition (UTC date keys). 'paused': that edition is 2+ days before today, or today's is
 * still missing after 14:30 UTC. 'due': today's is just not out yet. null: today's is out, or the
 * newest edition is unknown (say nothing rather than guess).
 */
export function dailyPauseState(newestDateKey, now = new Date()) {
  if (!newestDateKey) return null;
  const days = daysBetween(newestDateKey, todayKey(now));
  if (!(days > 0)) return null;
  const late = now.getUTCHours() * 60 + now.getUTCMinutes() >= DAILY_BRIEF_LATE_UTC.hour * 60 + DAILY_BRIEF_LATE_UTC.minute;
  return days >= 2 || late ? 'paused' : 'due';
}

/** nearestWeek — the existing weekly edition closest to `weekOf` in direction `dir` (-1 earlier, 1 later), or null. `weeks` are weekOf keys, any order. */
export function nearestWeek(weeks, weekOf, dir) {
  const sorted = (weeks || []).filter((w) => (dir < 0 ? w < weekOf : w > weekOf)).sort();
  return (dir < 0 ? sorted[sorted.length - 1] : sorted[0]) || null;
}

/**
 * labelledDateKeys — which dateKeys in a chronological (oldest-first) list should carry a visible
 * date label on the editions strip (every mark still gets a full aria-label/title regardless):
 * the first, the last, the current/selected one, and the first mark of each new month. Returns a
 * Set for O(1) lookup.
 */
export function labelledDateKeys(dateKeysAsc, currentDateKey) {
  const out = new Set();
  dateKeysAsc.forEach((dateKey, i) => {
    if (i === 0 || i === dateKeysAsc.length - 1) { out.add(dateKey); return; }
    if (dateKey === currentDateKey) { out.add(dateKey); return; }
    if (dateKey.slice(5, 7) !== dateKeysAsc[i - 1].slice(5, 7)) out.add(dateKey);
  });
  return out;
}
