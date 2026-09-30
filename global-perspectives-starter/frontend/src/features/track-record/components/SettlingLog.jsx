import { buildWeeklySquares, settlingSummary } from '@/features/track-record/lib/settlingLog.js';
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
import '@/features/track-record/components/SettlingLog.css';

// SettlingLog — one square per real week (questions.weeks[], built by the server from the weekly
// draw / verdict / review records). Grey = nothing was due (a fact, not a miss); red only when
// something fell due, the week ended and nothing was confirmed. See lib/settlingLog.js.
export default function SettlingLog({ weeks = [], firstCommit = null, pilotNote = null, now }) {
  const squares = buildWeeklySquares(weeks, now);
  const sum = settlingSummary(squares);
  return (
    <div className="tr-sl">
      {squares.length === 0 ? (
        <p className="tr-sl-summary">
          No settling weeks yet. The log starts with the first committed weekly sample
          {firstCommit ? ` (${fmtDay(firstCommit.committedAt)})` : ''}; each square below will be a real week.
        </p>
      ) : (
        <>
          <p className="tr-sl-summary">
            {sum.total} week{sum.total === 1 ? '' : 's'} since {fmtDay(weeks[0].weekStart)}:{' '}
            {sum.green + sum.amber} with confirmations, {sum.red} where something was due and nothing was confirmed, {sum.grey + sum.open} with nothing due yet.
          </p>
          <div className="tr-sl-grid" role="list" aria-label="Weekly settling log">
            {squares.map((s) => (
              <div key={s.weekId} role="listitem" className={`tr-sl-sq ${s.kind}`} title={s.label} aria-label={s.label} />
            ))}
          </div>
          <p className="tr-sl-legend">
            <span className="tr-sl-key green" /> all confirmed
            <span className="tr-sl-key amber" /> some confirmed
            <span className="tr-sl-key red" /> due, none confirmed
            <span className="tr-sl-key grey" /> nothing due
          </p>
        </>
      )}
      {pilotNote && <p className="tr-sl-summary">{pilotNote}</p>}
    </div>
  );
}
