// HudIntelFeed — the console's intel feed: today's STORIES only, honestly dated, with StoryPeek on
// every row. Situations are not listed here: the Alerts stack is the one list of them (and the
// keyboard-reachable twin of the map pins). A topic whose thread a situation already carries is left
// out (it has its pin and its Alerts row; same rule as the map's country shading). A quiet day is
// simply fewer rows under the dated header.
import { crisisTypeForCategory } from '@/shared/lib/crisisHue.js';
import { freshnessState } from '@/shared/lib/freshness.js';
import { peekData } from '@/shared/lib/peekData.js';
import { topicsWithoutSituation } from '@/features/map/lib/storyShading.js';
import { storyHref } from '@/shared/lib/links.js';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { NewestStepLine, StoryName, storyName } from '@/shared/ui/StoryCard.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';

function storiesDateLabel(asOf) {
  if (!asOf) return null;
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();
}

export default function HudIntelFeed({
  situations = [], topics = [], topicsAsOf = null, storyFocusId = null, onSelectStory = null, peek = null,
  label = 'Intel feed', directLimit = 0, stories = null,
}) {
  const dateLabel = storiesDateLabel(topicsAsOf);
  const ageDays = topicsAsOf ? (Date.now() - new Date(topicsAsOf).getTime()) / 86400000 : null;
  const state = ageDays != null ? freshnessState(ageDays) : null;
  // One row per story (R1): a story's later items in the edition are dropped (its row shows the story's title).
  const seen = new Set();
  const oncePerStory = (t) => !t.storyId || (seen.has(t.storyId) ? false : (seen.add(t.storyId), true));
  const titled = directLimit
    ? topics.filter((t) => t?.title && t.threadId).filter(oncePerStory).slice(0, directLimit)
    : topicsWithoutSituation(topics, situations).filter((t) => t.title).filter(oncePerStory);
  const visibleTopics = state === 'hidden' ? [] : titled;
  const hiddenCount = state === 'hidden' ? titled.length : 0;

  if (directLimit && !visibleTopics.length) return null;

  return (
    <div className="hud-feed" role="region" aria-label={label}>
      <SectionHeader
        className="hud-feed-head hud-stories-head"
        label={directLimit ? 'Top stories' : 'More from today'}
        count={directLimit ? (dateLabel ? `from ${dateLabel}` : null) : `${visibleTopics.length}${dateLabel ? ` · from ${dateLabel}` : ''}`}
        hint={state === 'older' ? <span className="sh-paused">paused</span> : null}
      />
      {!directLimit ? <p className="hud-stories-hidden sh-muted">{ageDays != null && ageDays < 1 ? 'Stories in today’s edition that have no alert on the map.' : 'Stories in the latest edition that have no alert on the map.'}</p> : null}
      {visibleTopics.length ? (
        <ul className="hud-feed-list hud-stories-list">
          {visibleTopics.map((t, i) => {
            // One id rule for a story everywhere (threadId || topicId), so a selected story matches `storyFocusId`.
            const rowId = t.threadId || t.topicId || `story-${i}`;
            const data = peekData(t, { asOf: topicsAsOf });
            const crisis = crisisTypeForCategory(t.category);
            const name = storyName(stories?.[t.storyId]?.name, stories?.[t.storyId]?.title || t.title); // §6b: name + tag, else the headline
            return (
              <StoryRow
                key={rowId}
                id={rowId}
                active={rowId === storyFocusId}
                dim={state === 'older'}
                to={directLimit ? storyHref(t.storyId || t.threadId) : null}
                onClick={directLimit ? null : () => onSelectStory && onSelectStory(t)}
                title={name ? <StoryName name={name} interactive={false} small /> : (stories?.[t.storyId]?.title || t.title)}
                place={t.primaryCountry || null}
                crisis={crisis === 'neutral' ? null : crisis}
                chip={t.category ? <CategoryTag category={t.category} /> : null}
                meta={<NewestStepLine story={stories?.[t.storyId]} role={t.role} />}
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
