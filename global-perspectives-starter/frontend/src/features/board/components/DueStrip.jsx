import { dayMonth, branchStatus } from '@/shared/lib/branchWording.js';

const SHOWN = 4;

/** The open branches of the pinned stories, nearest due date first: [{ id, due, p, text, late }]. A branch with no
 *  due date is not listed (nothing to be due). */
export function dueBranches(stories, today) {
  const rows = [];
  for (const story of Object.values(stories || {})) {
    for (const fork of story?.forks || []) {
      for (const b of fork.branches || []) {
        if (branchStatus(b).kind !== 'open' || !dayMonth(b.due)) continue;
        rows.push({ id: `${story.threadId}:${b.branchId}`, due: b.due.slice(0, 10), p: Number.isFinite(b.p) ? Math.round(b.p) : null, text: b.text, late: b.due.slice(0, 10) < today });
      }
    }
  }
  return rows.sort((x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : 0) || (x.id < y.id ? -1 : 1)).slice(0, SHOWN);
}

// "Due on your board": the nearest open questions on the stories you pinned, each with its date and our percentage.
// A question past its date with no verdict yet says "past due". Nothing to list -> the strip is absent.
export default function DueStrip({ stories, today }) {
  const rows = dueBranches(stories, today);
  if (!rows.length) return null;
  return (
    <section className="board-due" aria-label="Due on your board">
      <h2 className="board-eyebrow">Due on your board</h2>
      <ul className="board-due__row">
        {rows.map((r) => (
          <li key={r.id} className={`board-due__item${r.late ? ' is-late' : ''}`}>
            <span className="board-due__when">{dayMonth(r.due)}{r.p != null ? ` · ${r.p}%` : ''}{r.late ? ' · past due' : ''}</span>
            <span className="board-due__text">{r.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
