// HudIntelFeed — the console's intel feed: the map's accessible twin. Every situation the map
// plots is also a keyboard-reachable row here (tier chip, escalating marker, place, one line),
// so nothing on the map is only reachable by pointing at a pin. Rows are the shared StoryRow. M5a adds a STORIES group below
// the situations: the current topics feed, honestly dated, with StoryPeek on every row.
import { iso3Name } from '@/features/map/lib/situationLabels.js';
import { crisisTypeForCategory } from '@/shared/lib/crisisHue.js';
import { freshnessState } from '@/shared/lib/freshness.js';
import { peekData } from '@/shared/lib/peekData.js';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import { gdacsLevelBadge } from '@/features/map/lib/gdacsLevel.js';

function placeOf(s) {
  if (s.affected_names?.length) return s.affected_names[0];
  if (s.iso3_affected?.length) return iso3Name(s.iso3_affected[0]);
  return null;
}

function storiesDateLabel(asOf) {
  if (!asOf) return null;
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();
}

export default function HudIntelFeed({
  ranked, focusId, newIds, scannedIds, loading, error, world, onSelect,
  topics = [], topicsAsOf = null, storyFocusId = null, onSelectStory = null, peek = null,
  label = 'Intel feed', emptyMessage = null,
}) {
  const dateLabel = storiesDateLabel(topicsAsOf);
  const now = Date.now();
  const ageDays = topicsAsOf ? (now - new Date(topicsAsOf).getTime()) / 86400000 : null;
  const state = ageDays != null ? freshnessState(ageDays) : null;
  const visibleTopics = state === 'hidden' ? [] : topics.filter((t) => t && t.title);
  const hiddenCount = state === 'hidden' ? topics.filter((t) => t && t.title).length : 0;

  return (
    <div className="hud-feed" role="region" aria-label={label}>
      <SectionHeader className="hud-feed-head" label={label} count={ranked.length ? `${ranked.length} active` : null} />
      {loading && !world ? <BootLoader variant="inline" label="Loading situations" text="Loading situations" /> : null}
      {error && !world ? <p className="sh-muted">Couldn’t load the feed. Retrying automatically.</p> : null}
      {world && !ranked.length ? <p className="sh-muted">{emptyMessage || 'No situations open right now.'}</p> : null}
      <ul className="hud-feed-list">
        {ranked.map((s) => (
          <StoryRow
            key={s.id}
            active={s.id === focusId}
            onClick={() => onSelect(s.id)}
            title={s.verb_label}
            place={placeOf(s)}
            crisis={s.axis}
            tier={s.tier}
            situation={s}
            changedAt={s.last_change_at || s.opened_at || null}
            now={now}
            meta={(
              <>
                {newIds?.has(s.id) ? <span className="sh-new">◇ new</span> : null}
                {gdacsLevelBadge(s) ? <span className="sh-gdacs-badge">{gdacsLevelBadge(s)}</span> : null}
                {/* Radar mode (M4): a brief, non-scrolling, non-focus-stealing mark that the
                    sweep just passed this situation. Never used outside radar mode. */}
                {scannedIds?.has(s.id) ? <span className="hud-scanned" aria-label="just scanned by the radar sweep">◉ scanned</span> : null}
              </>
            )}
          />
        ))}
      </ul>

      {visibleTopics.length ? (
        <>
          <SectionHeader
            className="hud-feed-head hud-stories-head" label="Stories" count={dateLabel ? `from ${dateLabel}` : null}
            hint={state === 'older' ? <span className="sh-paused">paused</span> : null}
          />
          <ul className="hud-feed-list hud-stories-list">
            {visibleTopics.map((t, i) => {
              // F2.7: one id rule for a story everywhere (threadId || topicId) — this used to read
              // topicId first, so a selected story never matched `storyFocusId` (computed the
              // other way round in SituationHome) and never highlighted here.
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
        </>
      ) : hiddenCount ? (
        <p className="sh-muted hud-stories-hidden">{hiddenCount} older stor{hiddenCount === 1 ? 'y' : 'ies'} past 30 days, hidden from the map.</p>
      ) : null}
    </div>
  );
}
