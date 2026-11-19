import '@/shared/ui/blocks.css';

// HowWeRead — "How we read the world": the fixed pipeline behind the map (what we track, how severity is scored, how often it
// updates). The Map's About drawer passes the live pause and coverage note; the "?" panel shows the general text.
export default function HowWeRead({ paused = null, coverageNote = null }) {
  return (
    <div className="gp-howread">
      <h2>How we read the world</h2>
      <p className="gp-howread__dim">The map is the output of a fixed pipeline, not an editor’s judgement call.</p>
      {coverageNote ? <p className="gp-howread__dim">{coverageNote}</p> : null}
      <div className="gp-howread__cols">
        <div><h4>What we track</h4><p>Every situation belongs to one of four axes — conflict, political, economic, humanitarian. A situation opens when independent outlets converge on the same event in the same place, and it stays open while coverage continues. Severe natural disasters come straight from the UN/EU GDACS feed.</p></div>
        <div><h4>How severity is scored</h4><p>The tier — low, moderate, elevated, high — is derived from how many outlets are covering a situation, how far it has spread, and how fast that is changing since the last run. Disaster tiers come from the reported hazard values. The inputs are shown on every situation.</p></div>
        <div><h4>How often it updates</h4><p>
          {paused
            ? `The GDACS disaster feed is checked on a fixed cycle. News situations are re-scored when the classification pipeline runs — that has been paused since ${paused.beyondLookback ? paused.text : paused.label}.`
            : 'The GDACS disaster feed is checked on a fixed cycle, and news situations are re-scored each time the classification pipeline runs.'}
          {' '}The freshness stamps on this page show the age of the data you are looking at, not the age of the page. Alerts and situation cards show how each situation is trending.
        </p></div>
      </div>
    </div>
  );
}
