// HudIntelFeed — the console's intel feed: the map's accessible twin. Every situation the map
// plots is also a keyboard-reachable row here (tier chip, escalating marker, place, one line),
// so nothing on the map is only reachable by pointing at a pin. M5a adds a STORIES group below
// the situations: the current topics feed, honestly dated, with StoryPeek on every row.
import { AXIS_HUE } from '@/features/map/components/SituationMap.jsx';
import { TIER_LABEL, iso3Name } from '@/features/map/lib/situationLabels.js';
import { crisisHueForCategory } from '@/features/map/lib/crisisHue.js';
import { freshnessState } from '@/shared/lib/freshness.js';
import { peekData } from '@/shared/lib/peekData.js';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
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
    <div className="hud-panel hud-feed" aria-label={label}>
      <div className="hud-panel-corner hud-panel-corner-tl" aria-hidden="true" />
      <div className="hud-panel-corner hud-panel-corner-br" aria-hidden="true" />
      <div className="hud-label hud-feed-label">
        {label}
        {ranked.length ? <span className="hud-feed-count"> · {ranked.length} active</span> : null}
      </div>
      {loading && !world ? <p className="sh-muted">Loading…</p> : null}
      {error && !world ? <p className="sh-muted">Couldn’t load the feed. Retrying automatically.</p> : null}
      {world && !ranked.length ? <p className="sh-muted">{emptyMessage || 'No situations open right now.'}</p> : null}
      <ul className="hud-feed-list">
        {ranked.map((s) => {
          const place = placeOf(s);
          return (
            <li key={s.id} className={s.id === focusId ? 'sh-active' : ''}>
              <button onClick={() => onSelect(s.id)}>
                <span className={`hud-tier-chip hud-tier-chip-${s.tier}`} style={{ '--pin': AXIS_HUE[s.axis] || '#9aa4b2' }}>
                  {TIER_LABEL[s.tier]}
                </span>
                <span className="sh-row-main">
                  <span className="sh-row-tags">
                    {s.escalating ? <span className="hud-esc" aria-label="escalating">▲</span> : null}
                    {newIds?.has(s.id) ? <span className="sh-new">◇ new</span> : null}
                    {gdacsLevelBadge(s) ? <span className="sh-gdacs-badge sh-gdacs-badge-sm">{gdacsLevelBadge(s)}</span> : null}
                    {place ? <span className="hud-feed-place">{place}</span> : null}
                    {/* Radar mode (M4): a brief, non-scrolling, non-focus-stealing mark that the
                        sweep just passed this situation. Never used outside radar mode. */}
                    {scannedIds?.has(s.id) ? <span className="hud-scanned" aria-label="just scanned by the radar sweep">◉ scanned</span> : null}
                  </span>
                  <span className="sh-row-title">{s.verb_label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {visibleTopics.length ? (
        <>
          <div className="hud-label hud-feed-label hud-stories-label">
            Stories
            {dateLabel ? <span className="hud-feed-count"> · from {dateLabel}</span> : null}
            {state === 'older' ? <span className="hud-feed-count hud-feed-paused"> · paused</span> : null}
          </div>
          <ul className="hud-feed-list hud-stories-list">
            {visibleTopics.map((t, i) => {
              // F2.7: one id rule for a story everywhere (threadId || topicId) — this used to read
              // topicId first, so a selected story never matched `storyFocusId` (computed the
              // other way round in SituationHome) and never highlighted here.
              const rowId = t.threadId || t.topicId || `story-${i}`;
              const data = peekData(t, { asOf: topicsAsOf });
              const hue = crisisHueForCategory(t.category);
              return (
                <li key={rowId} className={rowId === storyFocusId ? 'sh-active' : ''}>
                  <button
                    className={state === 'older' ? 'hud-story-older' : ''}
                    onClick={() => onSelectStory && onSelectStory(t)}
                    onMouseEnter={(e) => peek?.openOnHover(rowId, e.currentTarget)}
                    onMouseLeave={() => peek?.close()}
                    onFocus={(e) => peek?.openOnFocus(rowId, e.currentTarget)}
                    onBlur={() => peek?.close()}
                    aria-describedby={peek?.openId === rowId ? `peek-${rowId}` : undefined}
                  >
                    <span className="hud-tier-chip hud-story-chip" style={{ '--pin': hue }}>
                      {t.category || '—'}
                    </span>
                    <span className="sh-row-main">
                      <span className="sh-row-tags">
                        {t.primaryCountry ? <span className="hud-feed-place">{t.primaryCountry}</span> : null}
                      </span>
                      <span className="sh-row-title">{t.title}</span>
                    </span>
                  </button>
                  {peek?.openId === rowId ? <StoryPeek id={`peek-${rowId}`} data={data} style={peek.style} /> : null}
                </li>
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
