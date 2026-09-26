// HudIntelFeed — the console's intel feed: the map's accessible twin. Every situation the map
// plots is also a keyboard-reachable row here (tier chip, escalating marker, place, one line),
// so nothing on the map is only reachable by pointing at a pin.
import { AXIS_HUE } from '@/features/map/components/SituationMap.jsx';
import { TIER_LABEL, iso3Name } from '@/features/map/lib/situationLabels.js';

function placeOf(s) {
  if (s.affected_names?.length) return s.affected_names[0];
  if (s.iso3_affected?.length) return iso3Name(s.iso3_affected[0]);
  return null;
}

export default function HudIntelFeed({ ranked, focusId, newIds, loading, error, world, onSelect }) {
  return (
    <div className="hud-panel hud-feed" aria-label="Intel feed">
      <div className="hud-panel-corner hud-panel-corner-tl" aria-hidden="true" />
      <div className="hud-panel-corner hud-panel-corner-br" aria-hidden="true" />
      <div className="hud-label hud-feed-label">
        Intel feed
        {ranked.length ? <span className="hud-feed-count"> · {ranked.length} active</span> : null}
      </div>
      {loading && !world ? <p className="sh-muted">Loading…</p> : null}
      {error && !world ? <p className="sh-muted">Couldn’t load the feed. Retrying automatically.</p> : null}
      {world && !ranked.length ? <p className="sh-muted">No situations open right now — the map is quiet.</p> : null}
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
                    {place ? <span className="hud-feed-place">{place}</span> : null}
                  </span>
                  <span className="sh-row-title">{s.verb_label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
