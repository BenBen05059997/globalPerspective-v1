// "What changed" band on CountryPage — the first pixel of the living-analysis wedge.
// Deterministic, from the daily risk snapshots we already log (no LLM). Renders nothing
// when the read hasn't materially changed (honest-empty). See utils/countryDrift.js.
import { computeCountryDrift } from '../../utils/countryDrift';
import RiskDeltaPill from './RiskDeltaPill';
import './CountryWhatChanged.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}` : s;
}

export default function CountryWhatChanged({ snapshots }) {
  const drift = computeCountryDrift(snapshots);
  if (!drift) return null;

  return (
    <div className="cwc" aria-label="What changed in this country's read">
      <div className="cwc-head">
        <span className="cwc-label">What changed</span>
        <span className="cwc-since">
          since {fmtDay(drift.since)}{drift.daysSince != null ? ` · ${drift.daysSince}d ago` : ''}
        </span>
        <RiskDeltaPill snapshots={[drift.prior, drift.current]} size="sm" />
      </div>

      <div className="cwc-dims">
        {drift.dims.map((d, i) => (
          <span key={i} className="cwc-dim">
            {d.k}:{' '}
            {d.shifted
              ? <b>shifted</b>
              : <b>{d.from}{d.from != null ? ' → ' : ''}{d.to}</b>}
          </span>
        ))}
      </div>

      {drift.headlineChanged && (
        <div className="cwc-heads">
          <div className="cwc-prev">“{drift.prior.headline}”</div>
          <div className="cwc-now">“{drift.current.headline}”</div>
        </div>
      )}

      <div className="cwc-foot">Computed from our daily risk assessments — not a forecast.</div>
    </div>
  );
}
