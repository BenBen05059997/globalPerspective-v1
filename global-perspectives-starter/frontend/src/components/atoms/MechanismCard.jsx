// MechanismCard — center-tab content for ThreadPage Economy tab.
// Renders: mechanism paragraph + winners/losers split + historical analog + watch signals.
// Props:
//   impact: full economic_impact record from useEconomicImpact

import { Link } from 'react-router-dom';
import InstrumentChip from './InstrumentChip.jsx';
import SeverityBadge from './SeverityBadge.jsx';

function EntityLine({ ent }) {
  if (!ent?.name) return null;
  // Only countries get linked (existing route); sectors/companies stay static
  const isCountry = ent.type === 'country';
  const nameNode = isCountry
    ? <Link className="mc-ent-link" to={`/weekly/country/${encodeURIComponent(ent.name)}`}>{ent.name}</Link>
    : <span className="mc-ent-static">{ent.name}</span>;
  return (
    <li className="mc-ent">
      {nameNode}
      <span className="mc-ent-type">{ent.type}</span>
      {ent.why && <span className="mc-ent-why">— {ent.why}</span>}
    </li>
  );
}

export default function MechanismCard({ impact }) {
  if (!impact || impact.hasImpact === false) return null;
  const {
    headline, severity, severityScore, confidence, horizon,
    instruments = [], winners = [], losers = [],
    mechanism, historicalAnalog, watchSignals = [],
    marketContext = {}, generatedAt,
  } = impact;

  const updatedAgo = generatedAt
    ? Math.max(1, Math.round((Date.now() - new Date(generatedAt).getTime()) / 3600000))
    : null;

  return (
    <div className="mc-card">
      <div className="mc-header">
        <h2 className="mc-headline">{headline || 'Economic disruption'}</h2>
        <div className="mc-meta">
          <SeverityBadge level={severity} score={severityScore} size="sm" />
          <span className="mc-meta-item">Confidence: <b>{confidence || 'medium'}</b></span>
          <span className="mc-meta-item">Horizon: <b>{horizon || 'days'}</b></span>
          {updatedAgo && <span className="mc-meta-ago">upd {updatedAgo}h ago</span>}
        </div>
      </div>

      {instruments.length > 0 && (
        <div className="mc-section">
          <div className="mc-section-label">Instruments</div>
          <div className="mc-instruments">
            {instruments.map((inst, i) => (
              <InstrumentChip
                key={inst.instrumentId || i}
                instrument={inst}
                marketSnap={marketContext[inst.instrumentId]}
              />
            ))}
          </div>
        </div>
      )}

      {mechanism && (
        <div className="mc-section">
          <div className="mc-section-label">Mechanism</div>
          <p className="mc-mechanism">{mechanism}</p>
        </div>
      )}

      {(winners.length > 0 || losers.length > 0) && (
        <div className="mc-winlose">
          <div className="mc-wl-col">
            <div className="mc-wl-label">Winners</div>
            <ul className="mc-wl-list">
              {winners.map((w, i) => <EntityLine key={i} ent={w} />)}
            </ul>
          </div>
          <div className="mc-wl-col">
            <div className="mc-wl-label">Losers</div>
            <ul className="mc-wl-list">
              {losers.map((l, i) => <EntityLine key={i} ent={l} />)}
            </ul>
          </div>
        </div>
      )}

      {historicalAnalog?.event && (
        <div className="mc-section mc-analog">
          <div className="mc-section-label">Historical analog</div>
          <div className="mc-analog-body">
            <span className="mc-analog-mark">⚑</span>
            <b className="mc-analog-event">{historicalAnalog.event}</b>
            {historicalAnalog.year && <span className="mc-analog-year">({historicalAnalog.year})</span>}
            {historicalAnalog.outcome && <div className="mc-analog-outcome">{historicalAnalog.outcome}</div>}
            {historicalAnalog.caveat && <div className="mc-analog-caveat">Caveat: {historicalAnalog.caveat}</div>}
          </div>
        </div>
      )}

      {watchSignals.length > 0 && (
        <div className="mc-section">
          <div className="mc-section-label">Watch signals</div>
          <ul className="mc-watch">
            {watchSignals.map((s, i) => <li key={i}>⚡ {s}</li>)}
          </ul>
        </div>
      )}

      <div className="mc-disclaimer">
        Not investment advice. Severity and direction are qualitative analyst judgments — see <Link to="/disclosures">methodology</Link>.
      </div>
    </div>
  );
}
