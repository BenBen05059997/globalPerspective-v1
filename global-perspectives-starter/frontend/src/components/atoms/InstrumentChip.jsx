// InstrumentChip — single-row chip showing instrument + direction + magnitude bar + rationale.
// Props:
//   instrument: {
//     instrumentId, direction, magnitude, rationale,
//     citedTopicIds?: string[]
//   }
//   marketSnap?: { value, asOf }   // from marketContext snapshot
//   compact?: boolean              // strips the rationale line when true

import DirectionArrow from './DirectionArrow.jsx';

const MAG_PIPS = { small: 1, moderate: 2, large: 3 };

function fmtValue(v, id) {
  if (v == null || isNaN(v)) return null;
  const n = Number(v);
  if (id?.startsWith('USD/')) return n.toFixed(4);
  if (['BRENT','WTI','GOLD','COPPER'].includes(id)) return `$${n.toFixed(2)}`;
  if (id?.endsWith('Y') && n < 20) return `${n.toFixed(2)}%`;
  return n.toFixed(2);
}

export default function InstrumentChip({ instrument, marketSnap, compact = false }) {
  if (!instrument) return null;
  const { instrumentId, direction, magnitude, rationale } = instrument;
  const pips = MAG_PIPS[magnitude] || 2;
  const value = marketSnap?.value;
  const formatted = fmtValue(value, instrumentId);

  return (
    <div className={`ichip ${compact ? 'ichip-compact' : ''}`}>
      <div className="ichip-head">
        <span className="ichip-ticker">{instrumentId}</span>
        {formatted && <span className="ichip-val">{formatted}</span>}
        <DirectionArrow dir={direction} />
        <span className={`ichip-mag ichip-mag-${magnitude}`}>
          {[0,1,2].map(i => (
            <span key={i} className={`ichip-pip ${i < pips ? 'on' : ''}`} />
          ))}
        </span>
        <span className="ichip-mag-label">{magnitude}</span>
      </div>
      {!compact && rationale && (
        <div className="ichip-rationale">{rationale}</div>
      )}
    </div>
  );
}
