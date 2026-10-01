import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import TierChip from '@/shared/ui/TierChip.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import { threadPath } from '@/shared/lib/threadPath';
import { crisisOf, tierOf, timelineLayout, timelineSpan, timelineTicks } from '@/features/threads/lib/storyGroups';
import { placeOf } from '@/features/threads/components/StoryLine.jsx';

// StoriesTimeline — the C view: one line per story across the window, a dot on every day the story
// REALLY had coverage (the thread's own archive day keys, same source as the old dot trail), a line
// from its first to its last day in the crisis hue, tier chip + title on the left, the whole row is
// the story link. Nothing is interpolated: a gap day has no dot. Phone: the lane scrolls sideways
// inside each row (all lanes and the axis scroll together), the page never overflows.
const CAP = 40;

const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Keep every lane (and the axis) at the same horizontal scroll offset.
function syncLanes(e) {
  const t = e.target;
  if (!t.classList || !t.classList.contains('tl-lane-scroll')) return;
  const root = e.currentTarget;
  for (const el of root.querySelectorAll('.tl-lane-scroll')) {
    if (el !== t && el.scrollLeft !== t.scrollLeft) el.scrollLeft = t.scrollLeft;
  }
}

export default function StoriesTimeline({ threads, analyses, windowValue, now }) {
  const [limit, setLimit] = useState(CAP);
  const rootRef = useRef(null);
  const span = timelineSpan(windowValue);
  const ticks = timelineTicks(span, now);
  const shown = threads.slice(0, limit);
  // Phone: the lanes scroll sideways; open them at today (the right end), where the news is.
  const total = threads.length;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const el of root.querySelectorAll('.tl-lane-scroll')) if (el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth;
  }, [windowValue, limit, total]);
  if (!threads.length) return <div className="weekly-empty-state"><p>No stories match your current filters.</p></div>;
  return (
    <div className="tl" ref={rootRef} onScrollCapture={syncLanes}>
      <div className="tl-axis" aria-hidden="true">
        <span className="tl-left" />
        <span className="tl-lane-scroll">
          <span className="tl-lane tl-lane--axis">
            {ticks.map((t) => <span key={t.idx} className="tl-tick" style={{ left: `${t.pct}%` }}>{t.label}</span>)}
          </span>
        </span>
      </div>
      <ul className="tl-list">
        {shown.map((t) => {
          const a = analyses?.[t.threadId];
          const title = a?.threadTitle || t.latestTitle;
          const { tier, score } = tierOf(a);
          const crisis = crisisOf(t);
          const lay = timelineLayout(t.dates, span, now);
          const hue = crisis === 'neutral' ? 'var(--text-dim)' : `var(--hue-${crisis})`;
          return (
            <li key={t.threadId} className="tl-row" style={{ '--row-hue': hue }}>
              <Link
                to={threadPath(t.threadId)}
                className="tl-link"
                aria-label={`${title}. Coverage on ${t.dayCount} ${t.dayCount === 1 ? 'day' : 'days'}, ${fmt(t.dateRange.from)} to ${fmt(t.dateRange.to)}.`}
              >
                <span className="tl-left">
                  <TierChip tier={tier} score={score} />
                  <span className="tl-text">
                    <span className="tl-title">{title}</span>
                    <span className="tl-sub">
                      <CategoryTag category={t.category} />
                      {placeOf(t) ? <span>{placeOf(t)}</span> : null}
                      <span>{fmt(t.dateRange.from)}{t.dateRange.from !== t.dateRange.to ? ` – ${fmt(t.dateRange.to)}` : ''} · {t.dayCount} {t.dayCount === 1 ? 'day' : 'days'}</span>
                    </span>
                  </span>
                </span>
                <span className="tl-lane-scroll">
                  <span className="tl-lane">
                    {ticks.map((k) => <span key={k.idx} className="tl-grid" style={{ left: `${k.pct}%` }} />)}
                    {lay.line ? <span className="tl-line" style={{ left: `${lay.line.from}%`, width: `${lay.line.to - lay.line.from}%` }} /> : null}
                    {lay.dots.map((d) => <span key={d.date} className="tl-dot" style={{ left: `${d.pct}%` }} title={d.date} data-date={d.date} />)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {threads.length > limit ? (
        <button type="button" className="sf-more" onClick={() => setLimit((n) => n + CAP)}>Show {Math.min(CAP, threads.length - limit)} more</button>
      ) : null}
    </div>
  );
}
