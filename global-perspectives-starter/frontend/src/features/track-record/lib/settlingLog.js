// settlingLog — one square per real week, from `questions.weeks[]` (the server builds them from
// the weekly draw / verdict / review records). Colours mean:
//   grey   nothing was due that week (a fact, not a miss)
//   open   the week has not ended yet
//   green  everything that fell due was settled
//   amber  some of what fell due was settled
//   red    something fell due, the week is over, and nothing was settled
// "Due" = a sampled question whose deadline + 3 days falls in the week.
import { fmtDay } from '@/shared/lib/trFormatDate.js';

export function weekSquare(w, now = new Date()) {
  const start = Date.parse(`${w.weekStart}T00:00:00Z`);
  const ended = new Date(now).getTime() >= start + 7 * 86400000;
  const due = w.due || 0;
  const settled = w.settled || 0;
  const of = fmtDay(w.weekStart);
  if (due === 0) {
    return settled > 0
      ? { kind: 'green', label: `Week of ${of}: nothing new fell due; ${settled} earlier question${settled === 1 ? '' : 's'} settled` }
      : { kind: ended ? 'grey' : 'open', label: ended ? `Week of ${of}: nothing due` : `Week of ${of}: in progress, nothing due yet` };
  }
  if (settled >= due) return { kind: 'green', label: `Week of ${of}: ${due} due, ${settled} settled` };
  if (settled > 0) return { kind: 'amber', label: `Week of ${of}: ${due} due, ${settled} settled so far` };
  if (!ended) return { kind: 'open', label: `Week of ${of}: ${due} due, review still to come` };
  return { kind: 'red', label: `Week of ${of}: ${due} due, none settled` };
}

export function buildWeeklySquares(weeks = [], now = new Date()) {
  return (weeks || []).map((w) => ({ weekId: w.weekId, weekStart: w.weekStart, due: w.due || 0, ...weekSquare(w, now) }));
}

// Weeks not over yet that already have questions falling due are "ahead" (review still to come), not
// "nothing due": the server counts due questions in the running and coming weeks too.
export function settlingSummary(squares = []) {
  const count = (k) => squares.filter((s) => s.kind === k).length;
  const ahead = squares.filter((s) => s.kind === 'open' && s.due > 0).length;
  return { total: squares.length, red: count('red'), green: count('green'), amber: count('amber'), grey: count('grey'), open: count('open'), ahead };
}

/** The log's one-line summary, shared by the page and the text version. */
export function settlingSentence(squares, firstWeekStart) {
  const s = settlingSummary(squares);
  return `${s.total} week${s.total === 1 ? '' : 's'} since ${fmtDay(firstWeekStart)}: ${s.green + s.amber} with settled questions, `
    + `${s.red} where something was due and nothing was settled, ${s.grey + s.open - s.ahead} with nothing due, `
    + `${s.ahead} not over yet with questions falling due.`;
}
