// The monthly (artboard 7): everything here is counted or read from what the board and the record views already
// hold; nothing is written by a model. Each part is empty when there is nothing to show, and an empty part is absent.
import { dueBranches } from '@/features/board/components/DueStrip.jsx';
import { isoWeekStart, isoWeekEnd } from '@/features/board/lib/recordViews.js';

const DAY = 86400000;
const MONTH_DAYS = 30;
const QUIET_DAYS = 28;
const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');
const ago = (today, n) => new Date(Date.parse(today) - n * DAY).toISOString().slice(0, 10);

/** The stored weekly summaries, newest first: [{ text, date }]. */
export function summaryVersions(board) {
  return (board?.summary?.versions || []).filter((v) => v?.text && day(v.writtenAt))
    .map((v) => ({ text: v.text, date: day(v.writtenAt) })).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** The first sentence of a stored summary: one line for the arc. */
export const firstLine = (text) => (/^[\s\S]*?[.!?](?=\s|$)/.exec(text.trim())?.[0] || text.trim());

function branchRows(stories) {
  return Object.values(stories || {}).flatMap((s) => (s?.forks || []).flatMap((f) => (f.branches || []).map((b) => ({ ...b, forkId: f.forkId }))));
}

/** The month on this board as of `today` (YYYY-MM-DD): { arc, previous, strings, ours, yours, missed, quiet, dates }. */
export function monthlyView(board, stories, today) {
  const since = ago(today, MONTH_DAYS);
  const versions = summaryVersions(board);
  const branches = branchRows(stories);
  const settledOn = (b) => ['yes', 'no'].includes(b.verdict?.result);

  const ours = {
    settled: branches.filter((b) => settledOn(b) && day(b.verdict.at) >= since).length,
    dueThisWeek: branches.filter((b) => !b.verdict && !b.legacy && day(b.due) >= isoWeekStart(today) && day(b.due) <= isoWeekEnd(today)).length,
  };
  const weighted = Object.entries(board?.weights || {}).flatMap(([forkId, byBranch]) => Object.keys(byBranch).map((branchId) => ({ forkId, branchId })));
  const yours = {
    set: weighted.length,
    settled: weighted.filter((w) => branches.some((b) => b.forkId === w.forkId && b.branchId === w.branchId && settledOn(b))).length,
  };

  const strings = (board?.strings || []).flatMap((s) => {
    if (s.cutAt && day(s.cutAt) >= since && s.owner === 'yours') return [{ ...s, change: 'cut', date: day(s.cutAt) }];
    if (!s.cutAt && s.keptAt && day(s.keptAt) >= since) return [{ ...s, change: s.owner === 'yours' ? 'kept' : 'held', date: day(s.keptAt) }];
    return [];
  }).sort((a, b) => (a.date < b.date ? 1 : -1));

  const quiet = (board?.pins || []).filter((p) => p.kind === 'thread' && day(p.lastMoved) && day(p.lastMoved) <= ago(today, QUIET_DAYS))
    .map((p) => ({ pinId: p.pinId, weeks: Math.floor((Date.parse(today) - Date.parse(day(p.lastMoved))) / (7 * DAY)) }));

  return {
    arc: versions.filter((v) => v.date >= since).reverse(),
    previous: versions.slice(1),
    strings,
    ours: ours.settled || ours.dueThisWeek ? ours : null,
    yours: yours.set ? yours : null,
    missed: board?.coverage?.note || null,
    quiet,
    dates: dueBranches(stories, today),
  };
}
