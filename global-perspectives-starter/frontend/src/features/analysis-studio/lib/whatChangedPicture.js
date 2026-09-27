// imported by Node tooling outside src/ — keep relative imports
import { checkDirection } from './directionCheck.js';

// "What changed" lens picture (S5c F1 §2): a risk chart WITH GAPS (never interpolated —
// only dates we actually have a reading for) built from the stored country/thread history
// the proxy already serves, plus the change log (the DRIFT notes), each entry run through
// the direction-check heuristic (directionCheck.js) and labelled as a flag, never
// auto-corrected. Pure — the caller supplies whatever history/notes it already fetched.

function daysBetweenISO(a, b) {
  const x = Date.parse(`${a}T00:00:00Z`);
  const y = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.round((y - x) / 86400000);
}

const GAP_THRESHOLD_DAYS = 14;

// buildRiskSeries(history) -> { points, gaps }
//   - history: [{ date: 'YYYY-MM-DD', score: number }] in any order.
//   - points: sorted ascending by date, invalid entries dropped.
//   - gaps: consecutive-point spans over GAP_THRESHOLD_DAYS apart — drawn as a visible
//     break in the chart, never bridged with an invented value.
export function buildRiskSeries(history) {
  const points = (Array.isArray(history) ? history : [])
    .filter((h) => h && typeof h.date === 'string' && typeof h.score === 'number' && Number.isFinite(h.score))
    .map((h) => ({ date: h.date, score: h.score }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const gaps = [];
  for (let i = 1; i < points.length; i++) {
    const days = daysBetweenISO(points[i - 1].date, points[i].date);
    if (days != null && days > GAP_THRESHOLD_DAYS) gaps.push({ from: points[i - 1].date, to: points[i].date, days });
  }
  return { points, gaps };
}

// buildChangeLog(driftNotes) -> [{ date, text, flag: {flag, reason}|null }]
//   - driftNotes: [{ date, text, scoreBefore, scoreAfter }] — whatever grounded drift
//     material the caller has (today: the single latest DRIFT note per thread; a fuller
//     history is a logged backend gap, S5b).
export function buildChangeLog(driftNotes) {
  return (Array.isArray(driftNotes) ? driftNotes : [])
    .filter((n) => n && typeof n.text === 'string' && n.text.trim())
    .map((n) => {
      const dir = (typeof n.scoreBefore === 'number' && typeof n.scoreAfter === 'number')
        ? checkDirection({ text: n.text, scoreBefore: n.scoreBefore, scoreAfter: n.scoreAfter })
        : null;
      return { date: n.date || null, text: n.text, flag: dir && dir.flag ? dir : null };
    });
}
