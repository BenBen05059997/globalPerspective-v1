// InstrumentChip — single-row chip showing instrument + direction + magnitude bar + rationale.
// Props:
//   instrument: {
//     instrumentId, direction, magnitude, rationale,
//     citedTopicIds?: string[]
//   }
//   marketSnap?: { value, asOf }   // from marketContext snapshot
//   compact?: boolean              // strips the rationale line when true

import DirectionArrow from './DirectionArrow.jsx';
import { gateInstrument } from '../../utils/disruptionGate.js';

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
  const { instrumentId, magnitude, rationale } = instrument;
  const pips = MAG_PIPS[magnitude] || 2;
  const value = marketSnap?.value;
  const formatted = fmtValue(value, instrumentId);
  // Deterministic gate: relabels FX pairs to the foreign currency and derives a trustworthy
  // direction from the rationale; suppresses the arrow when undetectable/conflicting.
  const gated = gateInstrument(instrument);

  return (
    <div className={`ichip ${compact ? 'ichip-compact' : ''}`}>
      <div className="ichip-head">
        <span className="ichip-ticker">{gated.label}</span>
        {formatted && <span className="ichip-val">{formatted}</span>}
        {gated.suppressed ? <span className="ichip-dir-na" title="Direction not determinable from rationale">·</span> : <DirectionArrow dir={gated.direction} />}
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
