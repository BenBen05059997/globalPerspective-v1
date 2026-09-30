// settlingLog — one square per real week, from `questions.weeks[]` (the server builds them from
// the weekly draw / verdict / review records). Colours mean:
//   grey   nothing was due that week (a fact, not a miss)
//   open   the week has not ended yet
//   green  everything that fell due was confirmed
//   amber  some of what fell due was confirmed
//   red    something fell due, the week is over, and nothing was confirmed
// "Due" = a sampled question whose deadline + 3 days falls in the week.
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';

export function weekSquare(w, now = new Date()) {
  const start = Date.parse(`${w.weekStart}T00:00:00Z`);
  const ended = new Date(now).getTime() >= start + 7 * 86400000;
  const due = w.due || 0;
  const settled = w.settled || 0;
  const of = fmtDay(w.weekStart);
  if (due === 0) {
    return settled > 0
      ? { kind: 'green', label: `Week of ${of}: nothing new fell due; ${settled} earlier question${settled === 1 ? '' : 's'} confirmed` }
      : { kind: ended ? 'grey' : 'open', label: ended ? `Week of ${of}: nothing due` : `Week of ${of}: in progress, nothing due yet` };
  }
  if (settled >= due) return { kind: 'green', label: `Week of ${of}: ${due} due, ${settled} confirmed` };
  if (settled > 0) return { kind: 'amber', label: `Week of ${of}: ${due} due, ${settled} confirmed so far` };
  if (!ended) return { kind: 'open', label: `Week of ${of}: ${due} due, review still to come` };
  return { kind: 'red', label: `Week of ${of}: ${due} due, none confirmed` };
}

export function buildWeeklySquares(weeks = [], now = new Date()) {
  return (weeks || []).map((w) => ({ weekId: w.weekId, weekStart: w.weekStart, ...weekSquare(w, now) }));
}

export function settlingSummary(squares = []) {
  const count = (k) => squares.filter((s) => s.kind === k).length;
  return { total: squares.length, red: count('red'), green: count('green'), amber: count('amber'), grey: count('grey'), open: count('open') };
}
