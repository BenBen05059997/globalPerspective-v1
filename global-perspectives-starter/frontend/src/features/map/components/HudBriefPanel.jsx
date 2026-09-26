// HudBriefPanel — the console's situation brief. R4a (Console.dc.html, top-left): the computed
// lede line, the LEAD item (the top-ranked open situation, else the first story in the latest
// stories feed, honestly dated) with "open story →", and the tier breakdown. Zero-count tiers
// are shown dimmed, never hidden (an honest "0 high" reads better than a missing row that looks
// like the data didn't load). The tier dots use the legend's size steps + HIGH double ring.
import { Link } from 'react-router-dom';
import { TIER_LABEL } from '@/features/map/lib/situationLabels.js';

const TIERS = ['high', 'elevated', 'moderate', 'low'];

/**
 * lead: { kicker, title, href?, onOpen?, openLabel, older? } | null
 *   href   → a real story page (threadId) — rendered as a link;
 *   onOpen → select it on the map (a GDACS alert with no story page).
 */
export default function HudBriefPanel({ counts, lede = null, lead = null, heading = 'Situation brief', className = '' }) {
  return (
    <div className={`hud-panel hud-brief ${className}`.trim()} role="region" aria-label="Situation brief">
      <div className="hud-panel-corner hud-panel-corner-tl" aria-hidden="true" />
      <div className="hud-panel-corner hud-panel-corner-br" aria-hidden="true" />
      <div className="hud-label">{heading}</div>
      {lede ? <p className="hud-brief-lede">{lede}</p> : null}
      {lead ? (
        <div className="hud-brief-lead">
          <div className="hud-brief-kicker">
            {lead.kicker}
            {lead.older ? <span className="hud-brief-older"> · older</span> : null}
          </div>
          <div className="hud-brief-title">{lead.title}</div>
          {lead.href ? (
            <Link className="hud-brief-open" to={lead.href}>{lead.openLabel || 'open story →'}</Link>
          ) : lead.onOpen ? (
            <button type="button" className="hud-brief-open" onClick={lead.onOpen}>{lead.openLabel || 'open story →'}</button>
          ) : null}
        </div>
      ) : null}
      {counts ? (
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
      ) : null}
    </div>
  );
}
