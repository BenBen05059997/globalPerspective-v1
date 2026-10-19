// HudCountryRiskFeed — the COUNTRY RISK layer's accessible twin (R4b): the ranked country list the
// map's polygons draw from, keyboard-reachable, StoryPeek on every row. Rows are the shared
// StoryRow (stripe = the worst axis's crisis hue, neutral TierChip with the score), like the
// intel feed, so the two layers' feeds read as one system, not two designs.
import { riskPeekData } from '@/features/map/lib/countryRiskLayer.js';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';

export default function HudCountryRiskFeed({
  drawn = [], hiddenOld = 0, loading = false, focusIso3 = null, onSelect, peek = null,
}) {
  return (
    <div className="hud-feed" role="region" aria-label="Country risk feed">
      <SectionHeader className="hud-feed-head" label="Country risk" count={drawn.length ? `${drawn.length} briefed` : null} />
      {loading && !drawn.length ? <BootLoader variant="inline" label="Loading country briefings" text="Loading country briefings" /> : null}
      {!loading && !drawn.length ? <p className="sh-muted">No country briefings available right now.</p> : null}
      <ul className="hud-feed-list">
        {drawn.map((c) => (
          <StoryRow
            key={c.iso3}
            id={c.iso3}
            active={c.iso3 === focusIso3}
            onClick={() => onSelect && onSelect(c)}
            title={c.name}
            place={c.leadLabel || null}
            crisis={c.leadAxis || null}
            tier={c.tier}
            score={c.score}
            meta={c.older ? <span className="sh-older">older</span> : null}
            peek={peek}
            peekData={riskPeekData(c)}
          />
        ))}
      </ul>
      {hiddenOld ? (
        <p className="sh-muted hud-stories-hidden">
          {hiddenOld} countr{hiddenOld === 1 ? 'y’s' : 'ies’'} briefings older than 30 days, not shown.
        </p>
      ) : null}
    </div>
  );
}
