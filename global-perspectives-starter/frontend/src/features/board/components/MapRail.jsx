import { boardWeek } from '@/features/board/lib/recordProjection.js';

// The map's collapsed rail ("This week on your board"): the week's counts and the first gap, with an arrow that opens
// the full rail. Counts come from the record views, so a board with none shows the title and the arrow only; no gap ->
// no gap line.
export default function MapRail({ board, stories, links, missing, onOpen }) {
  const week = board.recordAvailable ? boardWeek(board, stories, links) : null;
  const counts = week ? [
    [week.moved.length, 'pins moved'],
    [week.strings.length, 'strings changed'],
    [week.branches.filter((b) => b.kind !== 'void').length, 'branches settled'],
  ] : [];
  return (
    <aside className="bm-rail" aria-label="This week on your board, collapsed">
      <button type="button" className="bm-rail__open" aria-label="Expand this week on your board" onClick={onOpen}>‹</button>
      <span className="bm-rail__week">This week on your board</span>
      {counts.length ? (
        <span className="bm-rail__counts">
          {counts.map(([n, word]) => <span key={word} title={word} aria-label={`${n} ${word}`}>{n}</span>)}
        </span>
      ) : null}
      {missing.length ? <span className="bm-rail__gap">{missing.length} gap · {missing[0].name}</span> : null}
    </aside>
  );
}
