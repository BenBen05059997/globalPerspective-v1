// branchDays: the one place that decides what "today", "live", "late" and "due this week" mean on the board.
// Days are UTC 'YYYY-MM-DD' strings compared as text, never through the local timezone (the record's own days).
//   open  a branch with no verdict (branchWording's 'open')
//   late  open and due before today
//   live  open and not late (due today or later, or no due date)
// Every count and flag on the card, pin list, tree, due strip, unsettled zone, monthly and rail comes from here.
import { branchStatus } from '@/shared/lib/branchWording.js';
import { isoWeekEnd } from '@/features/board/lib/recordViews.js';

const day = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

/** Today as the board counts it: the UTC day. */
export const todayUTC = (now = new Date()) => now.toISOString().slice(0, 10);

export const isOpen = (b) => Boolean(b) && branchStatus(b).kind === 'open';
export const isLate = (b, today) => isOpen(b) && Boolean(day(b.due)) && day(b.due) < today;
export const isLive = (b, today) => isOpen(b) && !isLate(b, today);
/** Live and due by the Sunday that ends this ISO week. */
export const isDueThisWeek = (b, today) => isLive(b, today) && Boolean(day(b.due)) && day(b.due) <= isoWeekEnd(today);

/** The story views of a record map ({ pinRefId: view }) once each: two pins merged into one survivor give one view. */
export function uniqueStories(stories) {
  const seen = new Set();
  const out = [];
  for (const [key, story] of Object.entries(stories || {})) {
    if (!story) continue;
    const id = story.threadId || key;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ key, story });
  }
  return out;
}

/** Every branch of every fork of one story view, with its fork id. */
export const branchesOf = (story) => (story?.forks || []).flatMap((f) => (f.branches || []).map((b) => ({ ...b, forkId: f.forkId })));

/** { live, late } over the open branches of the forks. */
export function branchCounts(forks, today) {
  const all = (forks || []).flatMap((f) => f.branches || []);
  return { live: all.filter((b) => isLive(b, today)).length, late: all.filter((b) => isLate(b, today)).length };
}

/** '34 live branches · 5 late': zero parts are left out. */
export function branchCountText({ live, late }) {
  return [live && `${live} live ${live === 1 ? 'branch' : 'branches'}`, late && `${late} late`].filter(Boolean).join(' · ');
}

/** { dueThisWeek, late } over every open branch of the pinned stories (each story once). */
export function dueCounts(stories, today) {
  const all = uniqueStories(stories).flatMap(({ story }) => branchesOf(story));
  return { dueThisWeek: all.filter((b) => isDueThisWeek(b, today)).length, late: all.filter((b) => isLate(b, today)).length };
}
