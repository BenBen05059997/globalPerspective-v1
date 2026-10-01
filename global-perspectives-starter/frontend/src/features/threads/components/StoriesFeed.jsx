import { useState } from 'react';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import StoryLine from '@/features/threads/components/StoryLine.jsx';
import { GROUPS, groupByAge } from '@/features/threads/lib/storyGroups';

// StoriesFeed — the list view (A): groups Moving now / This week / Older (amber) as StoryRow lists,
// each with "Show N more"; stories older than 30 days sit behind an Archive control; single
// mentions (entries with no thread) stay reachable as a collapsed list at the bottom.
function Group({ group, items, analyses, now, peek }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, group.initial);
  const hidden = items.length - visible.length;
  return (
    <section className={`sf-group sf-group--${group.key}`} aria-labelledby={`sf-g-${group.key}`}>
      <SectionHeader label={group.label} count={items.length} hint={group.hint} id={`sf-g-${group.key}`} />
      <ul className="sf-list">
        {visible.map((t) => (
          <StoryLine key={t.threadId} thread={t} analysis={analyses?.[t.threadId]} now={now} peek={peek} dim={group.key === 'older' || group.key === 'archive'} />
        ))}
      </ul>
      {hidden > 0 ? (
        <button type="button" className="sf-more" onClick={() => setShowAll(true)}>Show {hidden} more</button>
      ) : null}
    </section>
  );
}

function Archive({ items, analyses, now, peek }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const group = GROUPS.find((g) => g.key === 'archive');
  return (
    <div className="sf-archive">
      <button type="button" className="sf-more sf-archive__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Archive · {items.length} {items.length === 1 ? 'story' : 'stories'} more than 30 days old {open ? '▴' : '▾'}
      </button>
      {open ? <Group group={group} items={items} analyses={analyses} now={now} peek={peek} /> : null}
    </div>
  );
}

function SingleMentions({ entries }) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  const byDate = {};
  for (const e of entries) (byDate[e.date] ||= []).push(e);
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  return (
    <section className="sf-single">
      <button type="button" className="sf-more sf-archive__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Single mentions · {entries.length} · appeared once, not yet part of a multi-day story {open ? '▴' : '▾'}
      </button>
      {open ? (
        <div className="sf-single__body">
          {dates.map((date) => (
            <div key={date} className="sf-single__day">
              <div className="sf-single__date">{formatDateLabel(date)}</div>
              <ul className="sf-single__list">
                {byDate[date].map((e, i) => (
                  <li key={e.topicId || i} className="sf-single__item">
                    <span className="sf-single__title">{e.title}</span>
                    <CategoryTag category={e.category} />
                    {e.regions?.length ? <span className="sf-single__place">{e.regions.slice(0, 2).join(' · ')}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function StoriesFeed({ threads, standalone, analyses, now, peek }) {
  const g = groupByAge(threads, now);
  const empty = threads.length === 0 && standalone.length === 0;
  return (
    <div className="sf-feed">
      {empty ? <div className="weekly-empty-state"><p>No stories match your current filters.</p></div> : null}
      {GROUPS.filter((x) => x.key !== 'archive' && g[x.key].length > 0).map((grp) => (
        <Group key={grp.key} group={grp} items={g[grp.key]} analyses={analyses} now={now} peek={peek} />
      ))}
      <Archive items={g.archive} analyses={analyses} now={now} peek={peek} />
      <SingleMentions entries={standalone} />
    </div>
  );
}
