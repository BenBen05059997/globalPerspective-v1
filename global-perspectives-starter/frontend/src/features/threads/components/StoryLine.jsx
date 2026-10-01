import StoryRow from '@/shared/ui/StoryRow.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import { peekData } from '@/shared/lib/peekData.js';
import { threadPath } from '@/shared/lib/threadPath';
import { crisisOf, tierOf, storySummary, watchingOf } from '@/features/threads/lib/storyGroups';

// StoryLine — one story as the shared StoryRow: crisis-hue bar, TierChip (word + ring weight, the
// number only when the analysis has a score, "Not scored" otherwise), title (the thread analysis
// title when present, else the latest entry title), place, last-change age. The whole row is the
// link to the story page; StoryPeek opens on hover/focus. A dim one-line summary (first sentence of the
// analysis story arc, else of the newest entry's summary) and a "Watching: <question>" line appear
// only when the data has them. Coverage "rising" is a small text mark
// computed from the archive's own counts; the row shows no tracker status because story threads
// carry none (the StatusGlyph vocabulary is the situations' tracker states, not coverage volume).
export function placeOf(thread) {
  const r = thread.regions || [];
  if (!r.length) return null;
  return r.slice(0, 2).join(' · ') + (r.length > 2 ? ` +${r.length - 2}` : '');
}

export default function StoryLine({ thread, analysis = null, now, peek = null, dim = false, showCount = true, showText = true, scope = 'feed' }) {
  const title = analysis?.threadTitle || thread.latestTitle;
  const { tier, score } = tierOf(analysis);
  const crisis = crisisOf(thread);
  const data = peekData(
    { title, category: thread.category, regions: thread.regions, sources: thread.sourceCount },
    { asOf: thread.changedAt },
  );
  if (data) data.hint = 'Click to open the story';
  return (
    <StoryRow
      id={`${scope}:${thread.threadId}`}
      to={threadPath(thread.threadId)}
      title={title}
      place={placeOf(thread)}
      crisis={crisis === 'neutral' ? null : crisis}
      tier={tier}
      score={score}
      changedAt={thread.changedAt}
      now={now}
      dim={dim}
      summary={showText ? storySummary(thread, analysis) : null}
      watching={showText ? watchingOf(analysis) : null}
      peek={peek}
      peekData={data}
      meta={(
        <>
          <CategoryTag category={thread.category} />
          {showCount ? (
            <span className="sf-count">
              {thread.articleCount} article{thread.articleCount !== 1 ? 's' : ''}
              {thread.dayCount > 1 ? ` · ${thread.dayCount} days` : ''}
            </span>
          ) : null}
          {thread.trend === 'rising' ? <span className="sf-rising" title="Coverage is rising (more articles in the recent half of its days)">▲ rising</span> : null}
        </>
      )}
    />
  );
}
