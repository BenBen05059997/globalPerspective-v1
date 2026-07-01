// "What changed" band on CountryPage — the living-analysis wedge.
// 1a: deterministic risk/trajectory drift from the daily snapshots (no LLM).
// 1b: when the newsDriftCorrector wrote a GROUNDED note for this move, show the "because
// <real cited event>: <why>" line (model judgment, grounded in a real event).
// Renders nothing when the read hasn't materially changed (honest-empty).
import { computeCountryDrift } from '../../utils/countryDrift';
import RiskDeltaPill from './RiskDeltaPill';
import './CountryWhatChanged.css';

// The corrector sometimes references the event by its prompt number ("event [6] shows…").
// Strip that artifact for display — the triggerEvent already names the event.
function cleanWhy(s) {
  return String(s || '').replace(/\bevent\s*\[\d+\]/gi, 'the cited event').replace(/\s*\[\d+\]/g, '').trim();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}` : s;
}

export default function CountryWhatChanged({ snapshots, driftNotes = [] }) {
  const drift = computeCountryDrift(snapshots);
  if (!drift) return null;

  // A grounded note applies only if the corrector explained THIS move (same as-of date).
  const note = (Array.isArray(driftNotes) ? driftNotes : []).find((n) => n.asOf === drift.asOf);
  const grounded = note && note.whyChanged;

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

      {grounded && (
        <div className="cwc-why">
          {note.triggerEvent?.title && (
            <div className="cwc-because">
              ↳ Because: <b>{note.triggerEvent.title}</b>
              {note.triggerEvent.date ? <span className="cwc-evdate"> · {fmtDay(note.triggerEvent.date)}</span> : null}
            </div>
          )}
          <div className="cwc-whytext">{cleanWhy(note.whyChanged)}</div>
        </div>
      )}

      {!grounded && drift.headlineChanged && (
        <div className="cwc-heads">
          <div className="cwc-prev">“{drift.prior.headline}”</div>
          <div className="cwc-now">“{drift.current.headline}”</div>
        </div>
      )}

      <div className="cwc-foot">
        {grounded
          ? '💭 Grounded in our coverage of the cited event — interpretation, not a forecast.'
          : 'Computed from our daily risk assessments — not a forecast.'}
      </div>
    </div>
  );
}
