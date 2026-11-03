// Pure helpers behind the drawn story tree and the zoom ladder (artboards 6 and 11). Dates are ISO day strings and are compared as
// strings, never through the local timezone. A branch's wording stays in shared/lib/branchWording.js.
import { isOldNode, isDeadBranch } from '@/features/board/lib/folding.js';
import { isOpen, isLate } from '@/features/board/lib/branchDays.js';
const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');
export { isOpen, isLate };

/** The day the facts run to ('2026-10-18'), or '' when the view does not say. The tree's "present" is today (UTC); this
 *  is shown beside it when the facts stop short of today. */
export const factsThrough = (story) => day(story?.builtFrom?.factsThrough);

/** The newest fork that still has an open branch (the "open fork"). */
export const openFork = (forks) => [...(forks || [])].filter((f) => (f.branches || []).some(isOpen))
  .sort((a, b) => String(b.drawnAt).localeCompare(String(a.drawnAt)))[0] || null;

/** The open branches of the open fork. */
export const openForkBranches = (forks) => (openFork(forks)?.branches || []).filter(isOpen);

const DRAWN_BRANCHES = 6;

/** The branches the drawing shows: the open ones of the open fork, at most DRAWN_BRANCHES. A branch under
 *  DEAD_BRANCH_P percent starts folded (not drawn) until `unfoldLow`; `folded` is how many are left out for that.
 *  Older forks stay in the text list. `low` is how many are under the line, folded or not. -> { shown, folded, low } */
export function drawnBranches(forks, unfoldLow = false) {
  const open = openForkBranches(forks);
  const low = open.filter(isDeadBranch);
  const kept = unfoldLow ? open : open.filter((b) => !isDeadBranch(b));
  return { shown: kept.slice(0, DRAWN_BRANCHES), folded: unfoldLow ? 0 : low.length, low: low.length };
}

/** Counts of one fork's branches by outcome: { total, open, late, happened, notReported, unchecked }. */
export function forkOutcome(fork, today) {
  const out = { total: 0, open: 0, late: 0, happened: 0, notReported: 0, unchecked: 0 };
  for (const b of fork.branches || []) {
    out.total += 1;
    if (isLate(b, today)) out.late += 1;
    else if (isOpen(b)) out.open += 1;
    else if (b.verdict?.result === 'yes') out.happened += 1;
    else if (b.verdict?.result === 'no') out.notReported += 1;
    else if (b.verdict?.result === 'void') out.unchecked += 1;
  }
  return out;
}

/** A fork is closed when none of its branches is still open or late. */
export const forkClosed = (o) => o.open + o.late === 0;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** '3 branches · 1 happened · 1 not reported · 1 late': zero parts are left out. */
export function outcomeText(o) {
  const parts = [plural(o.total, 'branch', 'branches')];
  if (o.happened) parts.push(`${o.happened} happened`);
  if (o.notReported) parts.push(`${o.notReported} not reported`);
  if (o.unchecked) parts.push(`${o.unchecked} could not be checked`);
  if (o.late) parts.push(`${o.late} late`);
  if (o.open) parts.push(`${o.open} open`);
  return parts.join(' · ');
}

/** Events of one chapter and the forks drawn in it: the whole story when no chapter is chosen. */
export function inChapter(story, chapter) {
  const within = (d) => !chapter || (day(d) >= day(chapter.from) && day(d) <= day(chapter.to));
  return {
    entries: (story.entries || []).filter((e) => within(e.date)),
    forks: (story.forks || []).filter((f) => within(f.drawnAt)),
  };
}

/** The trunk is drawn with the events of the last FOLD_AFTER_DAYS before `present` (the board's folding rule, lib/folding.js);
 *  older ones fold into one button. The newest event always shows. No `present`: nothing folds.
 *  -> { shown, folded: { before: 'YYYY-MM-DD', events, branches, taken } | null } */
export function foldTrunk(entries, forks, present) {
  const sorted = [...entries].sort((a, b) => day(a.date).localeCompare(day(b.date)));
  const now = Date.parse(present);
  const recent = Number.isFinite(now) ? sorted.filter((e) => !isOldNode(day(e.date), now)) : sorted;
  const shown = recent.length ? recent : sorted.slice(-1);
  if (shown.length === sorted.length) return { shown: sorted, folded: null };
  const before = day(shown[0].date);
  const older = (forks || []).filter((f) => day(f.drawnAt) < before).flatMap((f) => f.branches || []);
  return { shown, folded: { before, events: sorted.length - shown.length, branches: older.length, taken: older.filter((b) => b.verdict?.result === 'yes').length } };
}
