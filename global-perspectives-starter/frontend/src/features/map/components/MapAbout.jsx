// MapAbout — "How we read the world" + the "Elsewhere" teasers + the active-situations index. On
// phones this still sits below the map (the page scrolls there); on the desktop full-bleed console
// (R4a) the map is the whole page, so the same content opens from a small "About this map" control
// as a drawer instead — nothing was dropped, it moved. Every date is computed by the caller.
import { Link } from 'react-router-dom';
import { AXIS_HUE } from '@/features/map/components/SituationMap.jsx';
import { TIER_LABEL, iso3Name } from '@/features/map/lib/situationLabels.js';

const AXES = ['conflict', 'political', 'economic', 'humanitarian'];
const AXIS_LABEL = { conflict: 'Conflict', political: 'Political', economic: 'Economic', humanitarian: 'Humanitarian' };

function affectedNames(s) {
  const codes = (s.iso3_affected || []).slice(0, 3);
  return codes.length ? ` · ${codes.map(iso3Name).join(', ')}` : '';
}

export default function MapAbout({
  paused, latestDailyEditionLabel, latestWeeklyEditionLabel, ranked = [], onSelect, coverageNote = null,
}) {
  return (
    <>
      <div className="sh-fold-method">
        <h2>How we read the world</h2>
        <p className="sh-dim">The map is the output of a fixed pipeline, not an editor’s judgement call.</p>
        {coverageNote ? <p className="sh-coverage">{coverageNote}</p> : null}
        <div className="sh-fold-cols">
          <div><h4>What we track</h4><p>Every situation belongs to one of four axes — conflict, political, economic, humanitarian. A situation opens when independent outlets converge on the same event in the same place, and it stays open while coverage continues. Severe natural disasters come straight from the UN/EU GDACS feed.</p></div>
          <div><h4>How severity is scored</h4><p>The tier — low, moderate, elevated, high — is derived from how many outlets are covering a situation, how far it has spread, and how fast that is changing since the last run. Disaster tiers come from the reported hazard values. The inputs are shown on every situation.</p></div>
          <div><h4>How often it updates</h4><p>
            {paused
              ? `The GDACS disaster feed is checked on a fixed cycle. News situations are re-scored when the classification pipeline runs — that has been paused since ${paused.beyondLookback ? paused.text : paused.label}.`
              : 'The GDACS disaster feed is checked on a fixed cycle, and news situations are re-scored each time the classification pipeline runs.'}
            {' '}The freshness stamps on this page show the age of the data you are looking at, not the age of the page. A situation marked escalating has moved up since the last run.
          </p></div>
        </div>
      </div>

      <div className="sh-fold-teasers">
        <h4 className="sh-lbl">Elsewhere on Global Perspectives</h4>
        <div className="sh-teasers">
          <Link to="/daily"><b>Daily Brief</b><span>
            {latestDailyEditionLabel ? `Latest edition ${latestDailyEditionLabel}` : 'The day’s developments, gathered and synthesised'}
            {paused ? ' — analysis paused.' : '.'}
          </span></Link>
          <Link to="/weekly-brief"><b>Weekly</b><span>
            {latestWeeklyEditionLabel ? `Latest edition ${latestWeeklyEditionLabel}, with the reasoning shown.` : 'A long synthesis, with the reasoning shown.'}
          </span></Link>
          <Link to="/track-record"><b>Track Record</b><span>Every forecast scored against what happened, including the misses.</span></Link>
          <Link to="/analyze"><b>Analysis Studio</b><span>Bring a question and get a cited, structured analysis.</span></Link>
        </div>
      </div>

      {ranked.length ? (
        <div className="sh-fold-index">
          <h4 className="sh-lbl">Active situations · {ranked.length} open</h4>
          {AXES.map((a) => {
            const items = ranked.filter((s) => s.axis === a);
            if (!items.length) return null;
            return (
              <div key={a} className="sh-idx-group">
                <h5><span className="sh-leg-dot" style={{ background: AXIS_HUE[a] }} />{AXIS_LABEL[a]} · {items.length}</h5>
                <ul>
                  {items.map((s) => (
                    <li key={s.id}>
                      <button className="sh-idx-link" onClick={() => onSelect && onSelect(s.id)}>{s.verb_label}</button>
                      <span className="sh-dim"> — {TIER_LABEL[s.tier]}{s.escalating ? ' · escalating' : ''}{affectedNames(s)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
