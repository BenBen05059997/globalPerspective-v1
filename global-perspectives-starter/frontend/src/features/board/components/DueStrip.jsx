import { dayMonth, branchStatus } from '@/shared/lib/branchWording.js';
import { branchLine, branchScenario, branchPercent } from '@/features/board/lib/branchView.js';

const SHOWN = 4;

/** The open branches (no verdict) of the pinned stories: [{ id, threadId, due, p, line, scenario, late }]. Due today or
 *  later come first, nearest first; past-due ones follow, so they never crowd out what is coming. A branch with no due
 *  date is not listed (nothing to be due). */
export function dueBranches(stories, today) {
  const rows = [];
  for (const story of Object.values(stories || {})) {
    for (const fork of story?.forks || []) {
      for (const b of fork.branches || []) {
        if (branchStatus(b).kind !== 'open' || !dayMonth(b.due)) continue;
        const due = b.due.slice(0, 10);
        rows.push({ id: `${story.threadId}:${b.branchId}`, threadId: story.threadId, due, p: branchPercent(b), line: branchLine(b), scenario: branchScenario(b), late: due < today });
      }
    }
  }
  const cmp = (x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : 0) || (x.id < y.id ? -1 : 1);
  return [...rows.filter((r) => !r.late).sort(cmp), ...rows.filter((r) => r.late).sort(cmp)].slice(0, SHOWN);
}

// "Due on your board": the nearest open questions on the stories you pinned: the story, the question, the scenario it
// belongs to, its date and our percentage. A question past its date with no verdict yet says "past due".
// Nothing to list -> the strip is absent.
export default function DueStrip({ stories, today, labelOf }) {
  const rows = dueBranches(stories, today);
  if (!rows.length) return null;
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
    </section>
  );
}
