import { useState } from 'react';
import { dayMonth } from '@/shared/lib/branchWording.js';

// The week scrubber: drag back through the weeks the board has snapshots for. `weeks` is the list of week-ending
// dates (oldest first, ISO); `onChange(weekEnd)` tells the page which week is chosen; `note` is an optional line
// about the chosen week (for example a day with no archive). Fewer than two weeks kept -> absent.
export default function WeekScrubber({ weeks, note, onChange }) {
  const [at, setAt] = useState(weeks.length - 1);
  if (weeks.length < 2) return null;
  return (
    <section className="board-scrub" aria-label="Week scrubber">
      <div className="board-scrub__ticks" aria-hidden="true">
        {weeks.map((w, i) => <span key={w} className={i === at ? 'is-on' : undefined}>{i === 0 ? 'Week of ' : ''}{dayMonth(w)}</span>)}
      </div>
      <input
        className="board-scrub__range"
        type="range"
        min={0}
        max={weeks.length - 1}
        step={1}
        value={at}
        aria-label="Week"
        aria-valuetext={`Week ending ${dayMonth(weeks[at])}`}
        onChange={(e) => { const i = Number(e.target.value); setAt(i); onChange?.(weeks[i]); }}
      />
      <div className="board-scrub__foot">
        <span>Drag to replay the board as it stood in an earlier week.</span>
        {note ? <span className="board-scrub__note">{note}</span> : null}
      </div>
    </section>
  );
}
