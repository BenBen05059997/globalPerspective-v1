import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import { ageShortFrom } from '@/shared/lib/age.js';
import { peekData } from '@/shared/lib/peekData.js';
import { threadPath } from '@/shared/lib/threadPath';
import {
  BOARD_RULE, BOARD_SPARK_DAYS, boardColumns, crisisOf, dayCounts, groupKeyOf, tierOf,
} from '@/features/threads/lib/storyGroups';
import { placeOf } from '@/features/threads/components/StoryLine.jsx';

// StoriesBoard — the BOARD view (B4): four status columns, a card per story. Status is derived from
// the story's own per-day article counts (storyGroups.deriveBoardStatus) and the rule is printed
// under the board (BOARD_RULE). Card = crisis-hue edge, kicker, title, a 14-day activity sparkline
// (real counts; a zero day is a thin tick, never padded), TierChip, sources, last change. The whole
// card is one link to the story; StoryPeek opens on hover/focus. Under 900 px the columns stack into
// one list grouped by status.
const INITIAL = 12;

function Spark({ counts, title }) {
  const max = Math.max(3, ...counts);
  return (
    <span className="sb-spark" role="img" aria-label={title}>
      {counts.map((n, i) => (
        <span key={i} className="sb-spark__bar" data-zero={n === 0 ? 'true' : undefined} style={{ height: n === 0 ? 2 : Math.max(3, Math.round((n / max) * 16)) }} />
      ))}
    </span>
  );
}

function Card({ item, analysis, now, peek, colKey }) {
  const { thread } = item;
  const title = analysis?.threadTitle || thread.latestTitle;
  const { tier, score } = tierOf(analysis);
  const crisis = crisisOf(thread);
  const hue = crisis === 'neutral' ? 'var(--text-dim)' : `var(--hue-${crisis})`;
  const counts = dayCounts(thread, BOARD_SPARK_DAYS, now);
  const total = counts.reduce((a, b) => a + b, 0);
  const age = ageShortFrom(thread.changedAt, now);
  const id = `board:${thread.threadId}`;
  const open = !!(peek && peek.openId === id);
  const data = peekData(
    { title, category: thread.category, regions: thread.regions, sources: thread.sourceCount },
    { asOf: thread.changedAt },
  );
  if (data) data.hint = 'Click to open the story';
  return (
    <li className="sb-card" style={{ '--row-hue': hue }} data-status={colKey} data-thread={thread.threadId}>
      <Link
        to={threadPath(thread.threadId)}
        className="sb-card__link"
        aria-describedby={open ? `peek-${id}` : undefined}
        onMouseEnter={peek ? (e) => peek.openOnHover(id, e.currentTarget) : undefined}
        onMouseLeave={peek ? () => peek.close() : undefined}
        onFocus={peek ? (e) => peek.openOnFocus(id, e.currentTarget) : undefined}
        onBlur={peek ? () => peek.close() : undefined}
      >
        <span className="sb-card__kicker">
          <CategoryTag category={thread.category} />
          {placeOf(thread) ? <span className="sb-card__place">{placeOf(thread)}</span> : null}
        </span>
        <span className="sb-card__title">{title}</span>
        <Spark
          counts={counts}
          title={`Articles per day, last ${BOARD_SPARK_DAYS} days, oldest first: ${counts.join(', ')}. ${total} in total.`}
        />
        <span className="sb-card__meta">
          <TierChip tier={tier} score={score} />
          <span>{thread.sourceCount} {thread.sourceCount === 1 ? 'source' : 'sources'}</span>
          {age ? <span className="sb-card__age" data-fresh={Date.parse(thread.changedAt) < now - 7 * 86400000 ? 'older' : 'ok'}>updated {age === 'just now' ? age : `${age} ago`}</span> : null}
        </span>
      </Link>
      {open && typeof document !== 'undefined' ? createPortal(<StoryPeek id={`peek-${id}`} data={data} style={peek.style} />, document.body) : null}
    </li>
  );
}

function Column({ col, analyses, now, peek }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? col.items : col.items.slice(0, INITIAL);
  const hidden = col.items.length - visible.length;
  return (
    <section className={`sb-col sb-col--${col.key}`} aria-labelledby={`sb-h-${col.key}`}>
      <h2 className="sb-col__head" id={`sb-h-${col.key}`}>
        <span className="sb-col__glyph" aria-hidden="true">{col.glyph}</span>
        <span className="sb-col__label">{col.label}</span>
        <span className="sb-col__n">{col.items.length}</span>
      </h2>
      {col.items.length ? (
        <ul className="sb-col__list">
          {visible.map((item) => (
            <Card key={item.thread.threadId} item={item} analysis={analyses?.[item.thread.threadId]} now={now} peek={peek} colKey={col.key} />
          ))}
        </ul>
      ) : <p className="sb-col__empty">No stories</p>}
      {hidden > 0 ? <button type="button" className="sf-more" onClick={() => setShowAll(true)}>Show {hidden} more</button> : null}
    </section>
  );
}

export default function StoriesBoard({ threads, analyses, now, peek }) {
  // Same 30-day horizon as the list: a story whose last change is older than 30 days stays in the
  // list's Archive and is not laid out on the board (the count is shown, never silently dropped).
  const open = threads.filter((t) => groupKeyOf(t, now) !== 'archive');
  const archived = threads.length - open.length;
  if (!open.length) {
    return (
      <div className="weekly-empty-state">
        <p>{archived ? `No stories changed in the last 30 days match your filters (${archived} older in the List archive).` : 'No stories match your current filters.'}</p>
      </div>
    );
  }
  const cols = boardColumns(open, now);
  return (
    <div className="sb">
      <div className="sb-grid">
        {cols.map((col) => <Column key={col.key} col={col} analyses={analyses} now={now} peek={peek} />)}
      </div>
      <p className="sb-rule" data-testid="board-rule">{BOARD_RULE}</p>
      {archived ? <p className="sb-rule sb-rule--archive">{archived} {archived === 1 ? 'story' : 'stories'} last changed more than 30 days ago {archived === 1 ? 'is' : 'are'} not on the board; they are in the List view's Archive.</p> : null}
    </div>
  );
}
