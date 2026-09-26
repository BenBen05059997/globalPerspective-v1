// HudBriefPanel — top-left HUD panel: the deterministic lede sentence plus a tier breakdown of
// today's open situations. Zero-count tiers are shown dimmed, never hidden (an honest "0 high"
// reads better than a missing row that looks like the data didn't load).
import { TIER_LABEL } from '@/features/map/lib/situationLabels.js';

const TIERS = ['high', 'elevated', 'moderate', 'low'];

export default function HudBriefPanel({ lede, counts }) {
  return (
    <div className="hud-panel hud-brief" aria-label="Situation brief">
      <div className="hud-panel-corner hud-panel-corner-tl" aria-hidden="true" />
      <div className="hud-panel-corner hud-panel-corner-br" aria-hidden="true" />
      <div className="hud-label">Situation brief</div>
      <p className="hud-brief-lede">{lede}</p>
      <ul className="hud-brief-counts">
        {TIERS.map((t) => {
          const n = counts?.[t] || 0;
          return (
            <li key={t} className={`hud-brief-count${n === 0 ? ' hud-brief-count-zero' : ''}`}>
              <span className={`sh-leg-pin sh-pin-${t}`} style={{ '--pin': 'currentColor' }} />
              <span className="hud-brief-count-n">{n}</span>
              <span className="hud-brief-count-label">{TIER_LABEL[t]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
