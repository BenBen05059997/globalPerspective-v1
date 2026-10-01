// HudCountryRiskFeed — the COUNTRY RISK layer's accessible twin (R4b): the ranked country list the
// map's polygons draw from, keyboard-reachable, StoryPeek on every row. Reuses HudIntelFeed's
// panel/list classes so the two layers' feeds read as one system, not two designs.
import { riskPeekData } from '@/features/map/lib/countryRiskLayer.js';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';

export default function HudCountryRiskFeed({
  drawn = [], hiddenOld = 0, loading = false, focusIso3 = null, onSelect, peek = null,
}) {
  return (
    <div className="hud-panel hud-feed" role="region" aria-label="Country risk feed">
      <div className="hud-panel-corner hud-panel-corner-tl" aria-hidden="true" />
      <div className="hud-panel-corner hud-panel-corner-br" aria-hidden="true" />
      <div className="hud-label hud-feed-label">
        Country risk
        {drawn.length ? <span className="hud-feed-count"> · {drawn.length} briefed</span> : null}
      </div>
      {loading && !drawn.length ? <BootLoader variant="inline" label="Loading country briefings" text="Loading country briefings" /> : null}
      {!loading && !drawn.length ? <p className="sh-muted">No country briefings available right now.</p> : null}
      <ul className="hud-feed-list">
        {drawn.map((c) => {
          const data = riskPeekData(c);
          return (
            <li key={c.iso3} className={c.iso3 === focusIso3 ? 'sh-active' : ''}>
              <button
                onClick={() => onSelect && onSelect(c)}
                onMouseEnter={(e) => peek?.openOnHover(c.iso3, e.currentTarget)}
                onMouseLeave={() => peek?.close()}
                onFocus={(e) => peek?.openOnFocus(c.iso3, e.currentTarget)}
                onBlur={() => peek?.close()}
                aria-describedby={peek?.openId === c.iso3 ? `peek-risk-${c.iso3}` : undefined}
              >
                <span className={`hud-tier-chip hud-tier-chip-${c.tier}`} style={{ '--pin': c.hue }}>
                  {c.tierLabel}
                </span>
                <span className="sh-row-main">
                  <span className="sh-row-tags">
                    <span className="hud-feed-place">{c.leadLabel || '—'}</span>
                    <span className="sh-dim">RISK {c.score}</span>
                    {c.older ? <span className="hud-feed-paused">· older</span> : null}
                  </span>
                  <span className="sh-row-title">{c.name}</span>
                </span>
              </button>
              {peek?.openId === c.iso3 ? <StoryPeek id={`peek-risk-${c.iso3}`} data={data} style={peek.style} /> : null}
            </li>
          );
        })}
      </ul>
      {hiddenOld ? (
        <p className="sh-muted hud-stories-hidden">
          {hiddenOld} countr{hiddenOld === 1 ? 'y’s' : 'ies’'} briefings older than 30 days, not shown.
        </p>
      ) : null}
    </div>
  );
}
