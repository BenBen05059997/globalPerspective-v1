import { useState } from 'react';
import { Link } from 'react-router';
import Button from '@/shared/ui/Button.jsx';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import { nearestWeek, labelledDateKeys } from '@/features/briefings/lib/editions.js';
import '@/features/briefings/components/EditionsStrip.css';

// EditionsStrip — one mark per day (daily), oldest to newest, left to right, over the real probe
// window (ending at the latest known edition — it never probes past it, see useDailyEditionsIndex).
// Never a dead end: every dashed mark explains itself and offers the latest edition.
//   solid   (●) — a real edition exists, clickable
//   dashed  (○) — no edition was published for that date
//   unknown (?) — not yet probed
export default function EditionsStrip({ marks, currentDateKey, onSelect, onGoLatest, latestLabel }) {
  const [explain, setExplain] = useState(null); // a dateKey | null
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
      </div>

      {explain && (
        <div className="bm-edition-explain" role="status">
          <span>
            No edition was published for {formatDateLabel(explain)}.
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

// WeeklyEditionNav — the weekly archive: the one edition shown, a step to the nearest earlier edition
// the record's index lists (`weeks`; weekly editions are not every calendar week, so a fixed 7-day step
// lands on empty weeks), and the latest. No row of probed marks. A read API without per-week lookup
// answers with the latest edition; then `weekOf` differs from the requested week and the note says so.
// With no index (`weeks` null) there is no step: an edition is never guessed.
//   hrefForWeek(week | null) -> the address for that edition (null = latest)
export function WeeklyEditionNav({ weekOf, requestedWeek, weeks, hrefForWeek }) {
  if (!weekOf) return null;
  const label = formatDateLabel(weekOf);
  const notServed = !!requestedWeek && weekOf !== requestedWeek;
  const before = nearestWeek(weeks, weekOf, -1);
  return (
    <div className="bm-editions bm-editions-weekly" role="group" aria-label="Editions">
      <div className="bm-editions-track">
        {before && <Link className="bm-edition-step" to={hrefForWeek(before)}>← Week before</Link>}
        <span className="bm-edition-mark bm-edition-solid current" aria-label={`Week ending ${label}, currently showing`} title={`Week ending ${label}`}>
          <span className="bm-edition-dot" aria-hidden="true">●</span>
          <span className="bm-edition-label">Week ending {label}</span>
        </span>
        {requestedWeek && <Link className="bm-edition-step" to={hrefForWeek(null)}>Latest edition →</Link>}
      </div>
      {notServed && (
        <p className="bm-editions-weekly-note" role="status">
          The edition for the week ending {formatDateLabel(requestedWeek)} is not available here yet; showing the latest edition (week ending {label}).
        </p>
      )}
    </div>
  );
}
