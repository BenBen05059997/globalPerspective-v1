// "What changed" band on CountryPage — the living-analysis wedge.
// 1a: deterministic risk/trajectory drift from the daily snapshots (no LLM).
// 1b: when the newsDriftCorrector wrote a GROUNDED note for this move, show the "because
// <real cited event>: <why>" line (model judgment, grounded in a real event).
// Correction chain: the full day-by-day history of grounded moves (expandable) — proves the
// read auto-corrects continuously, not just once.
// Renders nothing when the read hasn't materially changed (honest-empty).
import { useState } from 'react';
import { Link } from 'react-router-dom';
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

// Compact from→to label for a history row (level if it changed, else score).
function deltaLabel(n) {
  if (n.changeLevel && n.changeLevel.from !== n.changeLevel.to) return `${n.changeLevel.from} → ${n.changeLevel.to}`;
  const cs = n.changeScore;
  if (cs && cs.from != null && cs.to != null) return `${cs.from} → ${cs.to}`;
  return 'reframed';
}

export default function CountryWhatChanged({ snapshots, driftNotes = [], driftNotesTotal = 0, driftNotesGated = false }) {
  const [openChain, setOpenChain] = useState(false);
  const drift = computeCountryDrift(snapshots);
  if (!drift) return null;

  const notes = Array.isArray(driftNotes) ? driftNotes : [];
  // A grounded note applies only if the corrector explained THIS move (same as-of date).
  const note = notes.find((n) => n.asOf === drift.asOf);
  const grounded = note && note.whyChanged;

  // The earlier corrections (everything except the one shown in the band), newest first.
  const chain = notes
    .filter((n) => n.asOf !== drift.asOf && (n.whyChanged || n.triggerEvent?.title || n.noSingleDriver))
    .sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)));

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
          <span key={i} className={`cwc-dim${d.axis ? ' cwc-dim-axis' : ''}`}>
            {d.k}:{' '}
            {d.shifted
              ? <b>shifted</b>
              : (
                <b>
                  {d.from}{d.from != null ? ' → ' : ''}{d.to}
                  {d.axis && d.delta != null && (
                    <span className="cwc-dim-delta"> ({d.delta > 0 ? '+' : ''}{d.delta})</span>
                  )}
                </b>
              )}
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

      {chain.length > 0 && (
        <div className="cwc-chain">
          <button
            type="button"
            className="cwc-chain-toggle"
            onClick={() => setOpenChain((v) => !v)}
            aria-expanded={openChain}
          >
            {openChain ? '▾ Hide correction history' : `▸ ${chain.length} earlier correction${chain.length > 1 ? 's' : ''}`}
          </button>
          {openChain && (
            <ol className="cwc-chain-list">
              {chain.map((n, i) => (
                <li key={i} className="cwc-chain-row">
                  <span className="cwc-chain-date">{fmtDay(n.asOf)}</span>
                  <span className="cwc-chain-delta">{deltaLabel(n)}</span>
                  <span className="cwc-chain-because">
                    {n.noSingleDriver
                      ? <em>no single driver</em>
                      : (n.triggerEvent?.title || cleanWhy(n.whyChanged))}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Depth gate: the server capped the history for non-members. Honest count + join CTA
          (never a fake/blurred teaser — feedback_no_misinformation_fallback). */}
      {driftNotesGated && driftNotesTotal > notes.length && (
        <Link to="/membership" className="cwc-locked">
          🔒 {driftNotesTotal - notes.length} earlier correction{driftNotesTotal - notes.length > 1 ? 's' : ''} —{' '}
          <span className="cwc-locked-cta">Join to see the full history →</span>
        </Link>
      )}

      <div className="cwc-foot">
        <span>
          {grounded
            ? '💭 Grounded in our coverage of the cited event — interpretation, not a forecast.'
            : 'Computed from our daily risk assessments — not a forecast.'}
        </span>
        <Link className="cwc-foot-link" to="/track-record">All corrections →</Link>
      </div>
    </div>
  );
}
