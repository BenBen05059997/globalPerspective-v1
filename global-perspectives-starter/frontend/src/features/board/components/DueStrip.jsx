import { dayMonth } from '@/shared/lib/branchWording.js';
import { isOpen, isLate, uniqueStories } from '@/features/board/lib/branchDays.js';
import { branchLine, branchScenario, branchPercent } from '@/features/board/lib/branchView.js';

const SHOWN = 4;

/** The open branches (no verdict; the first `limit`, default four) of the pinned stories: [{ id, threadId, due, p, line, scenario, late }] (`threadId` is the pin's own story id). Due today or
 *  later come first, nearest first; past-due ones follow, so they never crowd out what is coming. A branch with no due
 *  date is not listed (nothing to be due). */
export function dueBranches(stories, today, limit = SHOWN) {
  const rows = [];
  for (const { key, story } of uniqueStories(stories)) {
    for (const fork of story.forks || []) {
      for (const b of fork.branches || []) {
        if (!isOpen(b) || !dayMonth(b.due)) continue;
        rows.push({ id: `${key}:${b.branchId}`, threadId: key, due: b.due.slice(0, 10), p: branchPercent(b), line: branchLine(b), scenario: branchScenario(b), late: isLate(b, today) });
      }
    }
  }
  const cmp = (x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : 0) || (x.id < y.id ? -1 : 1);
  return [...rows.filter((r) => !r.late).sort(cmp), ...rows.filter((r) => r.late).sort(cmp)].slice(0, limit);
}

// "Due on your board": the nearest open questions on the stories you pinned: the story, the question, the scenario it
// belongs to, its date and our percentage. A question past its date with no verdict yet says "past due".
// Nothing to list -> the strip is absent.
export default function DueStrip({ stories, today, labelOf }) {
  const all = dueBranches(stories, today, Infinity);
  if (!all.length) return null;
  const rows = all.slice(0, SHOWN);
  const more = all.length - rows.length;
  return (
    <section className="board-due" aria-label="Due on your board">
      <h2 className="board-eyebrow">Due on your board</h2>
      <ul className="board-due__row">
        {rows.map((r) => (
          <li key={r.id} className={`board-due__item${r.late ? ' is-late' : ''}`}>
            <span className="board-due__when">{dayMonth(r.due)}{r.p != null ? ` · ${r.p}%` : ''}{r.late ? ' · past due' : ''}</span>
            {labelOf ? <span className="board-due__story">{labelOf(r.threadId)}</span> : null}
            <span className="board-due__text">{r.line}</span>
            {r.scenario ? <span className="board-note">{r.scenario}</span> : null}
          </li>
        ))}
      </ul>
      {more > 0 ? <p className="board-note">+{more} more due</p> : null}
    </section>
  );
}
