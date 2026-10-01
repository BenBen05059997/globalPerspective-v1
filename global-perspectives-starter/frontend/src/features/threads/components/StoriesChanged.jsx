import { useState } from 'react';
import { Link } from 'react-router-dom';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import { threadPath } from '@/shared/lib/threadPath';
import StoryLine from '@/features/threads/components/StoryLine.jsx';
import { changedSince, groupKeyOf, risingThreads, ageDaysOf } from '@/features/threads/lib/storyGroups';

// StoriesChanged — the right rail (and the phone CHANGES tab). "Changed since your last visit" is
// read client-side from a localStorage timestamp (see useLastVisit): stories whose REAL last-change
// time is after it. A first-ever visit has no timestamp, so the list is "Moving now" instead (stories
// that changed in the last 24 h) under that honest label. Below it, a compact "Rising this week".
const LIMIT = 8;

function visitLabel(ms) {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function ChangedList({ threads, analyses, baseline, now, peek }) {
  const [all, setAll] = useState(false);
  const hasBaseline = Number.isFinite(baseline);
  const items = hasBaseline
    ? changedSince(threads, baseline)
    : threads.filter((t) => groupKeyOf(t, now) === 'moving').sort((a, b) => Date.parse(b.changedAt || 0) - Date.parse(a.changedAt || 0));
  const shown = all ? items : items.slice(0, LIMIT);
  return (
    <section className="sf-changed" aria-labelledby="sf-changed-h">
      <SectionHeader
        label={hasBaseline ? 'Changed since your last visit' : 'Moving now'}
        count={items.length}
        hint={hasBaseline ? `since ${visitLabel(baseline)}` : 'changed in the last 24 h'}
        id="sf-changed-h"
      />
      {items.length === 0 ? (
        <p className="sf-muted">{hasBaseline ? 'Nothing has changed since your last visit.' : 'No story changed in the last 24 hours.'}</p>
      ) : (
        <ul className="sf-list">
          {shown.map((t) => <StoryLine key={t.threadId} thread={t} analysis={analyses?.[t.threadId]} now={now} peek={peek} showCount={false} scope="rail" />)}
        </ul>
      )}
      {items.length > shown.length ? <button type="button" className="sf-more" onClick={() => setAll(true)}>Show {items.length - shown.length} more</button> : null}
    </section>
  );
}

function Rising({ threads, analyses, now }) {
  const week = threads.filter((t) => ageDaysOf(t, now) <= 7);
  const items = risingThreads(week, 5);
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
  return (
    <div className="sf-rail">
      <ChangedList threads={threads} analyses={analyses} baseline={baseline} now={now} peek={peek} />
      {showRising ? <Rising threads={threads} analyses={analyses} now={now} /> : null}
    </div>
  );
}
