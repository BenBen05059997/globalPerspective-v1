import { useState } from 'react';
import { Link } from 'react-router-dom';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import { threadPath } from '@/shared/lib/threadPath';
import StoryLine from '@/features/threads/components/StoryLine.jsx';
import { changedSince, risingThreads, ageDaysOf } from '@/features/threads/lib/storyGroups';

// StoriesChanged — the right rail (desktop) and the changed section at the top of phone READ.
// "Changed since your last visit" is read client-side from a localStorage timestamp (see
// useLastVisit): stories whose REAL last-change time is after it. With no previous-visit baseline
// (a first-ever visit, or storage blocked) the section is NOT drawn at all: "Moving now" already
// heads the main list, so a first-visit copy would only duplicate it. Below it, a compact
// "Rising this week" (desktop rail only).
const LIMIT = 8;

function visitLabel(ms) {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function ChangedList({ threads, analyses, baseline, now, peek }) {
  const [all, setAll] = useState(false);
  if (!Number.isFinite(baseline)) return null;
  const items = changedSince(threads, baseline);
  const shown = all ? items : items.slice(0, LIMIT);
  return (
    <section className="sf-changed" id="sf-changed" aria-labelledby="sf-changed-h">
      <SectionHeader label="Changed since your last visit" count={items.length} hint={`since ${visitLabel(baseline)}`} id="sf-changed-h" />
      {items.length === 0 ? (
        <p className="sf-muted">Nothing has changed since your last visit.</p>
      ) : (
        <ul className="sf-list">
          {shown.map((t) => <StoryLine key={t.threadId} thread={t} analysis={analyses?.[t.threadId]} now={now} peek={peek} showCount={false} showText={false} scope="rail" />)}
        </ul>
      )}
      {items.length > shown.length ? <button type="button" className="sf-more" onClick={() => setAll(true)}>Show {items.length - shown.length} more</button> : null}
    </section>
  );
}

/** railRising(threads, now) -> the compact "Rising this week" items (stories changed within 7 days). */
export function railRising(threads, now) {
  return risingThreads(threads.filter((t) => ageDaysOf(t, now) <= 7), 5);
}

function Rising({ threads, analyses, now }) {
  const items = railRising(threads, now);
  if (!items.length) return null;
  return (
    <section className="sf-rising-rail" aria-labelledby="sf-rising-h">
      <SectionHeader label="Rising this week" id="sf-rising-h" hint="coverage gaining momentum" />
      <ul className="sf-rise-list">
        {items.map((t) => (
          <li key={t.threadId}>
            <Link to={threadPath(t.threadId)} className="sf-rise-row">
              <CategoryTag category={t.category} />
              <span className="sf-rise-title">{analyses?.[t.threadId]?.threadTitle || t.latestTitle}</span>
              <span className="sf-count">{t.articleCount} articles · {t.dayCount} {t.dayCount === 1 ? 'day' : 'days'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StoriesChanged({ threads, analyses, baseline, now, peek, showRising = true }) {
  if (!Number.isFinite(baseline) && !(showRising && railRising(threads, now).length)) return null;
  return (
    <div className="sf-rail">
      <ChangedList threads={threads} analyses={analyses} baseline={baseline} now={now} peek={peek} />
      {showRising ? <Rising threads={threads} analyses={analyses} now={now} /> : null}
    </div>
  );
}
