import { buildSettlingLog, settlingSummary } from '@/features/track-record/lib/settlingLog.js';
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
import '@/features/track-record/components/SettlingLog.css';

// SettlingLog — "one square per week... missed weeks shown in red" (TRACK_RECORD_AND_STUDIO_
// RULING.md, styled on the GitHub contribution graph). Every square is a real ISO week computed
// from real confirmedAt timestamps — see lib/settlingLog.js.
export default function SettlingLog({ confirmedAtDates = [], eraCutFrom, now }) {
  const weeks = buildSettlingLog(confirmedAtDates, eraCutFrom, now);
  if (weeks.length === 0) return null;
  const { total, missed } = settlingSummary(weeks);

  return (
    <div className="tr-sl">
      <p className="tr-sl-summary">
        {missed} of {total} week{total === 1 ? '' : 's'} since {fmtDay(eraCutFrom)} settled nothing.
      </p>
      <div className="tr-sl-grid" role="list" aria-label="Weekly settling log">
        {weeks.map((w) => (
          <div
            key={w.weekKey}
            role="listitem"
            className={`tr-sl-sq${w.missed ? ' missed' : ' settled'}`}
            title={`Week of ${fmtDay(w.weekStart.toISOString().slice(0, 10))}: ${w.missed ? 'missed — nothing settled' : `${w.settled} settled`}`}
          />
        ))}
      </div>
      <p className="tr-sl-legend">
        <span className="tr-sl-key settled" /> settled
        <span className="tr-sl-key missed" /> missed
      </p>
    </div>
  );
}
