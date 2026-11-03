// HudIntelFeed — the console's intel feed: today's STORIES only, honestly dated, with StoryPeek on
// every row. Situations are not listed here: the Alerts stack is the one list of them (and the
// keyboard-reachable twin of the map pins). A topic whose thread a situation already carries is left
// out (it has its pin and its Alerts row; same rule as the map's country shading). A quiet day is
// simply fewer rows under the dated header.
import { crisisTypeForCategory } from '@/shared/lib/crisisHue.js';
import { freshnessState } from '@/shared/lib/freshness.js';
import { peekData } from '@/shared/lib/peekData.js';
import { topicsWithoutSituation } from '@/features/map/lib/storyShading.js';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';

function storiesDateLabel(asOf) {
  if (!asOf) return null;
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();
}

export default function HudIntelFeed({
  situations = [], topics = [], topicsAsOf = null, storyFocusId = null, onSelectStory = null, peek = null,
  label = 'Intel feed',
}) {
  const dateLabel = storiesDateLabel(topicsAsOf);
  const ageDays = topicsAsOf ? (Date.now() - new Date(topicsAsOf).getTime()) / 86400000 : null;
  const state = ageDays != null ? freshnessState(ageDays) : null;
  const titled = topicsWithoutSituation(topics, situations).filter((t) => t.title);
  const visibleTopics = state === 'hidden' ? [] : titled;
  const hiddenCount = state === 'hidden' ? titled.length : 0;

  return (
    <div className="hud-feed" role="region" aria-label={label}>
      <SectionHeader
        className="hud-feed-head hud-stories-head" label="Stories" count={dateLabel ? `from ${dateLabel}` : null}
        hint={state === 'older' ? <span className="sh-paused">paused</span> : null}
      />
      {visibleTopics.length ? (
        <ul className="hud-feed-list hud-stories-list">
          {visibleTopics.map((t, i) => {
            // One id rule for a story everywhere (threadId || topicId), so a selected story matches `storyFocusId`.
            const rowId = t.threadId || t.topicId || `story-${i}`;
            const data = peekData(t, { asOf: topicsAsOf });
            const crisis = crisisTypeForCategory(t.category);
            return (
              <StoryRow
                key={rowId}
                id={rowId}
                active={rowId === storyFocusId}
                dim={state === 'older'}
                onClick={() => onSelectStory && onSelectStory(t)}
                title={t.title}
                place={t.primaryCountry || null}
                crisis={crisis === 'neutral' ? null : crisis}
                chip={t.category ? <CategoryTag category={t.category} /> : null}
                peek={peek}
                peekData={data}
              />
            );
          })}
        </ul>
      ) : hiddenCount ? (
        <p className="sh-muted hud-stories-hidden">{hiddenCount} older stor{hiddenCount === 1 ? 'y' : 'ies'} past 30 days, hidden from the map.</p>
      ) : null}
    </div>
  );
}
