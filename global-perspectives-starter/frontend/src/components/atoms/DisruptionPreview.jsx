// DisruptionPreview — right-rail teaser card.
// Shows: severity badge + headline + top 3 instrument tickers + click-through.
// Props:
//   impact: economic_impact record (must have hasImpact:true)
//   onExpand?: () => void    // optional click handler (e.g. scroll to Economy tab)

import SeverityBadge from './SeverityBadge.jsx';
import DirectionArrow from './DirectionArrow.jsx';
import QualityFlag from './QualityFlag.jsx';

export default function DisruptionPreview({ impact, onExpand }) {
  if (!impact || impact.hasImpact === false) return null;
  const { headline, severity, severityScore, instruments = [] } = impact;
  const top = instruments.slice(0, 3);

  return (
    <button
      type="button"
      className="dprev"
      onClick={onExpand}
      title="Open economic disruption details"
    >
      <div className="dprev-label">Economic Disruption</div>
      <div className="dprev-badge">
        <SeverityBadge level={severity} score={severityScore} size="sm" />
        <QualityFlag impact={impact} size="sm" />
      </div>
      <div className="dprev-headline">{headline || 'Disruption detected'}</div>
      {top.length > 0 && (
        <div className="dprev-tickers">
          {top.map(i => (
            <span key={i.instrumentId} className="dprev-tick">
              <b>{i.instrumentId}</b>
              <DirectionArrow dir={i.direction} />
            </span>
          ))}
          {instruments.length > 3 && <span className="dprev-more">+{instruments.length - 3}</span>}
        </div>
      )}
      <div className="dprev-cta">Read full →</div>
    </button>
  );
}
