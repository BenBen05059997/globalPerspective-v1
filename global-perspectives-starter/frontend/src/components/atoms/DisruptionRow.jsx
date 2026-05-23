// DisruptionRow — list-item form for /economy and other index views.
// Click navigates to the source thread's Economy tab.
// Props:
//   disruption: economic_impact record
//   showTime?: boolean

import { Link } from 'react-router-dom';
import SeverityBadge from './SeverityBadge.jsx';
import DirectionArrow from './DirectionArrow.jsx';
import QualityFlag from './QualityFlag.jsx';

function timeAgo(iso) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DisruptionRow({ disruption, showTime = true }) {
  if (!disruption || disruption.hasImpact === false) return null;
  const {
    scopeId, headline, severity, severityScore,
    instruments = [], confidence, horizon, generatedAt,
  } = disruption;
  const top = instruments.slice(0, 3);
  const moreCount = instruments.length - top.length;
  const href = scopeId ? `/weekly/thread/${encodeURIComponent(scopeId)}?tab=economy` : null;

  const body = (
    <>
      <div className="drow-head">
        <SeverityBadge level={severity} score={severityScore} size="sm" />
        <div className="drow-headline">{headline || 'Disruption detected'}</div>
        <QualityFlag impact={disruption} size="sm" />
      </div>

      {top.length > 0 && (
        <div className="drow-tickers">
          {top.map(i => (
            <span key={i.instrumentId} className="drow-tick" title={i.rationale || ''}>
              <b>{i.instrumentId}</b>
              <DirectionArrow dir={i.direction} />
              <span className="drow-mag">{i.magnitude || 'moderate'}</span>
            </span>
          ))}
          {moreCount > 0 && <span className="drow-more">+{moreCount} more</span>}
        </div>
      )}

      <div className="drow-meta">
        {confidence && <span>Conf: <b>{confidence}</b></span>}
        {horizon && <span>· Horizon: <b>{horizon}</b></span>}
        {showTime && generatedAt && <span className="drow-ago">· {timeAgo(generatedAt)}</span>}
      </div>
    </>
  );

  if (href) return <Link to={href} className="drow drow-link">{body}</Link>;
  return <div className="drow">{body}</div>;
}
