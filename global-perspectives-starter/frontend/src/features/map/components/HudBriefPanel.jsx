// HudBriefPanel — the console's situation brief. R4a (top-left): the computed
// lede line, the LEAD item (the top-ranked open situation, else the first story in the latest
// stories feed, honestly dated), its reading link and map action, and the tier breakdown. Zero-count tiers
// are shown dimmed, never hidden (an honest "0 high" reads better than a missing row that looks
// like the data didn't load). The tier dots use the legend's size steps + HIGH double ring.
import { useId } from 'react';
import { createPortal } from 'react-dom';
import { usePeek } from '@/shared/hooks/usePeek.js';
import Tooltip from '@/shared/ui/Tooltip.jsx';
import { Link } from 'react-router';
import { TIER_LABEL } from '@/shared/lib/situationLabels.js';
import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';

const TIERS = ['high', 'elevated', 'moderate', 'low'];

/**
 * lead: { kicker, title, href?, onOpen?, older? } | null
 *   href   → a real story page (threadId) — rendered as a link;
 *   onOpen → select it on the map.
 */
export default function HudBriefPanel({ counts, lede = null, lead = null, heading = 'Situation brief', readingFallback = null }) {
  const tipId = useId();
  const tip = usePeek({ peekHeight: 200 });
  const explain = tip.openId === tipId;
  return (
    <Card level="hud" pad="sm" className="hud-panel hud-brief" role="region" aria-label="Situation brief">
      <div className="hud-panel-corner hud-panel-corner-tl" aria-hidden="true" />
      <div className="hud-panel-corner hud-panel-corner-br" aria-hidden="true" />
      <SectionHeader label={heading} />
      {lede ? <p className="hud-brief-lede">{lede}</p> : null}
      {lead ? (
        <div className="hud-brief-lead">
          <div className="hud-brief-kicker">
            {lead.kicker}
            {lead.older ? <span className="hud-brief-older"> · older</span> : null}
          </div>
          {lead.href ? (
            <Link className="hud-brief-title" to={lead.href}>Read · {lead.title}</Link>
          ) : <div className="hud-brief-title">{lead.title}</div>}
          {lead.onOpen ? <button type="button" className="hud-brief-open" onClick={lead.onOpen}>Show on map →</button> : null}
          {!lead.href && readingFallback ? (
            <Link className="hud-brief-title" to={readingFallback.href}>Read · {readingFallback.title}</Link>
          ) : null}
        </div>
      ) : null}
      {counts ? (
        <button type="button" className="hud-brief-open hud-brief-counts"
          aria-label={`Explain tiers. ${TIERS.map((t) => `${counts[t] || 0} ${TIER_LABEL[t]}`).join(', ')}`}
          aria-describedby={explain ? tipId : undefined}
          onMouseEnter={(e) => tip.openOnHover(tipId, e.currentTarget)}
          onMouseLeave={tip.close}
          onFocus={(e) => tip.openOnFocus(tipId, e.currentTarget)}
          onBlur={tip.close}
          onClick={(e) => tip.openNow(tipId, e.currentTarget)}
        >
          {TIERS.map((t) => {
            const n = counts[t] || 0;
            return (
              <span key={t} className={`hud-brief-count${n === 0 ? ' hud-brief-count-zero' : ''}`}>
                <span className={`sh-leg-pin sh-pin-${t}`} style={{ '--pin': 'currentColor' }} />
                <span className="hud-brief-count-n">{n}</span>
                <span className="hud-brief-count-label">{TIER_LABEL[t]}</span>
              </span>
            );
          })}
        </button>
      ) : null}
      {explain ? createPortal(
        <Tooltip id={tipId} style={tip.style} title="Situation severity"
          note="High is the top news severity or a GDACS red alert. Elevated is the next band or GDACS orange. Moderate is the middle news band and the cap for one outlet. Low is the bottom two news bands or GDACS green."
          hint="Two outlets cap a news situation at Elevated. Three or more remove the corroboration cap."
        />, document.body,
      ) : null}
    </Card>
  );
}
