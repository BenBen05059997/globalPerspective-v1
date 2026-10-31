// Pure helpers behind the drawn story tree and the zoom ladder (artboards 6 and 11). Dates are ISO day strings and are compared as
// strings, never through the local timezone. A branch's wording stays in shared/lib/branchWording.js.
const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

/** The day the facts run to ('2026-10-18'), or '' when the view does not say. It is the "present" of the tree. */
export const presentOf = (story) => day(story?.builtFrom?.factsThrough);

/** A branch with no verdict yet (the old, unscored kind aside). */
export const isOpen = (b) => !b.verdict && !b.legacy;

/** Open and past its due day: shown as late, never as dead. */
export const isLate = (b, present) => isOpen(b) && Boolean(present) && Boolean(day(b.due)) && day(b.due) < present;

export const liveBranches = (forks) => (forks || []).flatMap((f) => f.branches || []).filter(isOpen);

/** Counts of one fork's branches by outcome: { total, open, late, happened, notReported, unchecked }. */
export function forkOutcome(fork, present) {
  const out = { total: 0, open: 0, late: 0, happened: 0, notReported: 0, unchecked: 0 };
  for (const b of fork.branches || []) {
    out.total += 1;
    if (isLate(b, present)) out.late += 1;
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

/** The trunk is drawn with its last `keep` events; older ones fold into one button.
 *  -> { shown, folded: { before: 'YYYY-MM-DD', branches, taken } | null } */
export function foldTrunk(entries, forks, keep = 4) {
  const sorted = [...entries].sort((a, b) => day(a.date).localeCompare(day(b.date)));
  if (sorted.length <= keep) return { shown: sorted, folded: null };
  const shown = sorted.slice(-keep);
  const before = day(shown[0].date);
  const older = (forks || []).filter((f) => day(f.drawnAt) < before).flatMap((f) => f.branches || []);
  return { shown, folded: { before, branches: older.length, taken: older.filter((b) => b.verdict?.result === 'yes').length } };
}
