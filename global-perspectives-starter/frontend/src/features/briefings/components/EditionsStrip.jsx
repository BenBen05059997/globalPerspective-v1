import { useState } from 'react';
import { Link } from 'react-router';
import Button from '@/shared/ui/Button.jsx';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import { previousWeekKey, labelledDateKeys } from '@/features/briefings/lib/editions.js';
import '@/features/briefings/components/EditionsStrip.css';

// EditionsStrip — one mark per day (daily), oldest to newest, left to right, over the real probe
// window (ending at the latest known edition — it never probes past it, see useDailyEditionsIndex),
// plus one appended range mark for the real gap since then (the pause), if any. Never a dead end:
// every dashed/paused mark explains itself and, for the pause, offers the latest edition.
//   solid   (●) — a real edition exists, clickable
//   dashed  (○) — no edition was published for that date (within the probe window; this is a gap
//                 in the archive, NOT the pause — the pause only starts after the latest edition)
//   unknown (?) — not yet probed
//   paused  (a wider ‖ mark at the end) — the real, dated range from the day after the latest
//                 edition through today; the only place the "AI paused" wording appears
export default function EditionsStrip({ marks, pausedSegment, currentDateKey, onSelect, onGoLatest, latestLabel }) {
  const [explain, setExplain] = useState(null); // 'paused' | a dateKey | null
  if (!marks || marks.length === 0) return null;
  const ordered = [...marks].reverse(); // oldest first, reading left to right
  const dateKeysAsc = ordered.map((m) => m.dateKey);
  const labelled = labelledDateKeys(dateKeysAsc, currentDateKey);

  return (
    <div className="bm-editions" role="group" aria-label="Editions">
      <div className="bm-editions-track">
        {ordered.map((m) => {
          const label = formatDateLabel(m.dateKey);
          const showLabel = labelled.has(m.dateKey);
          if (m.status === 'exists') {
            return (
              <button
                key={m.dateKey}
                type="button"
                className={`bm-edition-mark bm-edition-solid${m.current ? ' current' : ''}`}
                title={`${label} — edition available`}
                aria-label={`${label}, edition available${m.current ? ', currently showing' : ''}`}
                onClick={() => onSelect && onSelect(m.dateKey)}
                disabled={!onSelect}
              >
                <span className="bm-edition-dot" aria-hidden="true">●</span>
                {showLabel && <span className="bm-edition-label">{label}</span>}
              </button>
            );
          }
          const dashed = m.status === 'none';
          return (
            <button
              key={m.dateKey}
              type="button"
              className={`bm-edition-mark bm-edition-${dashed ? 'dashed' : 'unknown'}`}
              title={dashed ? `${label} — no edition was published` : `${label} — not yet checked`}
              aria-label={`${label}, ${dashed ? 'no edition was published' : 'not yet checked'}`}
              onClick={() => setExplain(m.dateKey)}
            >
              <span className="bm-edition-dot" aria-hidden="true">{dashed ? '○' : '?'}</span>
              {showLabel && <span className="bm-edition-label">{label}</span>}
            </button>
          );
        })}
        {pausedSegment && (
          <button
            type="button"
            className="bm-edition-mark bm-edition-paused"
            title={`${formatDateLabel(pausedSegment.fromKey)} → today — no editions (AI analysis paused, ${pausedSegment.days} day${pausedSegment.days === 1 ? '' : 's'})`}
            aria-label={`Paused, ${formatDateLabel(pausedSegment.fromKey)} through today, ${pausedSegment.days} day${pausedSegment.days === 1 ? '' : 's'} with no editions`}
            onClick={() => setExplain('paused')}
          >
            <span className="bm-edition-dot" aria-hidden="true">‖</span>
            <span className="bm-edition-label">
              Paused · {formatDateLabel(pausedSegment.fromKey)} → today ({pausedSegment.days}d)
            </span>
          </button>
        )}
      </div>

      {explain && (
        <div className="bm-edition-explain" role="status">
          <span>
            {explain === 'paused'
              ? `No editions since ${latestLabel || formatDateLabel(currentDateKey)} — AI analysis has been paused for ${pausedSegment?.days} day${pausedSegment?.days === 1 ? '' : 's'}.`
              : `No edition was published for ${formatDateLabel(explain)}.`}
          </span>
          {onGoLatest && (
            <Button compact onClick={() => { onGoLatest(); setExplain(null); }}>
              Show the latest edition{latestLabel ? ` (${latestLabel})` : ''} →
            </Button>
          )}
          <Button variant="icon" compact label="Dismiss" onClick={() => setExplain(null)}>×</Button>
        </div>
      )}
    </div>
  );
}

// WeeklyEditionNav — the weekly archive: the one edition shown, a step to the week before (weekly
// editions are keyed by their weekOf, written once a week, so the week before is weekOf − 7 days;
// `weekly_brief` with `week` returns exactly that week's edition or none), and the latest. No row
// of probed marks. A read API without per-week lookup answers with the latest edition; then
// `weekOf` differs from the requested week and the note says so plainly.
//   hrefForWeek(week | null) -> the address for that edition (null = latest)
export function WeeklyEditionNav({ weekOf, requestedWeek, hrefForWeek }) {
  if (!weekOf) return null;
  const label = formatDateLabel(weekOf);
  const notServed = !!requestedWeek && weekOf !== requestedWeek;
  return (
    <div className="bm-editions bm-editions-weekly" role="group" aria-label="Editions">
      <div className="bm-editions-track">
        <Link className="bm-edition-step" to={hrefForWeek(previousWeekKey(weekOf))}>← Week before</Link>
        <span className="bm-edition-mark bm-edition-solid current" aria-label={`Week of ${label}, currently showing`} title={`Week of ${label}`}>
          <span className="bm-edition-dot" aria-hidden="true">●</span>
          <span className="bm-edition-label">Week of {label}</span>
        </span>
        {requestedWeek && <Link className="bm-edition-step" to={hrefForWeek(null)}>Latest edition →</Link>}
      </div>
      {notServed && (
        <p className="bm-editions-weekly-note" role="status">
          The edition for the week of {formatDateLabel(requestedWeek)} is not available here yet; showing the latest edition (week of {label}).
        </p>
      )}
    </div>
  );
}
