import { Link } from 'react-router-dom';
import { useTrackRecord } from '../hooks/useTrackRecord';
import IntelligenceLoader from './IntelligenceLoader';
import './TrackRecordPage.css';

function brierVerdict(b) {
  if (b == null) return null;
  if (b <= 0.1) return 'excellent';
  if (b <= 0.2) return 'strong';
  if (b <= 0.25) return 'fair';
  return 'weak';
}

function VerdictPill({ verdict }) {
  const fired = verdict === 'fired';
  return (
    <span className={`tr-verdict ${fired ? 'fired' : 'notfired'}`}>
      {fired ? '✓ Fired' : '✗ Did not fire'}
    </span>
  );
}

export default function TrackRecordPage() {
  const { data, loading, error } = useTrackRecord();

  if (loading) return <IntelligenceLoader />;

  if (error || !data) {
    return (
      <div className="tr-page">
        <header className="tr-head">
          <h1>Forecast Track Record</h1>
        </header>
        <p className="tr-empty">Track record is temporarily unavailable. Please try again shortly.</p>
      </div>
    );
  }

  const {
    totalPredictionsLogged, totalDatedTriggers, resolvedTriggers,
    pendingTriggers, firedTriggers, brierScore, calibration, recent,
  } = data;

  const hasResolved = resolvedTriggers > 0;
  const verdict = brierVerdict(brierScore);

  return (
    <div className="tr-page">
      <header className="tr-head">
        <h1>Forecast Track Record</h1>
        <p className="tr-sub">
          Every prediction we publish is logged with dated, falsifiable trigger signals.
          As each deadline passes, the trigger is checked against the news record and confirmed
          by a human reviewer. This page is the running scoreboard — accountability for the forecasts,
          not a marketing claim.
        </p>
      </header>

      <section className="tr-stats">
        <div className="tr-stat">
          <span className="tr-stat-num">{totalPredictionsLogged}</span>
          <span className="tr-stat-label">Predictions logged</span>
        </div>
        <div className="tr-stat">
          <span className="tr-stat-num">{totalDatedTriggers}</span>
          <span className="tr-stat-label">Dated trigger signals</span>
        </div>
        <div className="tr-stat">
          <span className="tr-stat-num">{resolvedTriggers}</span>
          <span className="tr-stat-label">Resolved &amp; scored</span>
        </div>
        <div className="tr-stat">
          <span className="tr-stat-num">{pendingTriggers}</span>
          <span className="tr-stat-label">Awaiting their deadline</span>
        </div>
      </section>

      {hasResolved ? (
        <>
          <section className="tr-brier">
            <div className="tr-brier-score">
              <span className="tr-brier-num">{brierScore}</span>
              {verdict && <span className={`tr-brier-verdict ${verdict}`}>{verdict}</span>}
            </div>
            <p className="tr-brier-explain">
              Brier score across {resolvedTriggers} resolved triggers ({firedTriggers} fired).
              Lower is better: 0 is perfect, 0.25 is the score of always guessing 50%.
              It measures both accuracy and how well-calibrated the stated probabilities are.
            </p>
          </section>

          {calibration.length > 0 && (
            <section className="tr-cal">
              <h2>Calibration</h2>
              <p className="tr-cal-sub">
                When we say a scenario is X% likely, how often do its triggers actually fire?
                Well-calibrated forecasts track the diagonal.
              </p>
              <table className="tr-cal-table">
                <thead>
                  <tr><th>Stated probability</th><th>Triggers</th><th>Avg. predicted</th><th>Actually fired</th></tr>
                </thead>
                <tbody>
                  {calibration.map((c) => (
                    <tr key={c.bucket}>
                      <td>{c.bucket}</td>
                      <td>{c.n}</td>
                      <td>{Math.round(c.meanPredicted * 100)}%</td>
                      <td>
                        <div className="tr-bar-wrap">
                          <div className="tr-bar" style={{ width: `${Math.round(c.actualFiredRate * 100)}%` }} />
                          <span>{Math.round(c.actualFiredRate * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="tr-recent">
            <h2>Recently resolved</h2>
            <ul className="tr-list">
              {recent.map((r, i) => (
                <li key={i} className="tr-item">
                  <div className="tr-item-top">
                    <VerdictPill verdict={r.verdict} />
                    {r.probability != null && (
                      <span className="tr-item-prob">{r.scenario} · {Math.round(r.probability * 100)}%</span>
                    )}
                    {r.deadline && <span className="tr-item-date">due {r.deadline}</span>}
                  </div>
                  <p className="tr-item-trigger">{r.trigger}</p>
                  <p className="tr-item-meta">{r.title}</p>
                  {r.citation && <p className="tr-item-cite">{r.citation}</p>}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className="tr-pending">
          <h2>Scoring begins as deadlines pass</h2>
          <p>
            {totalDatedTriggers > 0 ? (
              <>We&apos;re tracking <strong>{totalDatedTriggers}</strong> dated trigger
              {totalDatedTriggers === 1 ? '' : 's'} across <strong>{totalPredictionsLogged}</strong> logged
              prediction{totalPredictionsLogged === 1 ? '' : 's'}. None have reached their deadline and been
              confirmed yet, so there is no score to report.</>
            ) : (
              <>No dated predictions have been logged yet. As forecasts are published with dated trigger
              signals, they will appear here and be scored once their deadlines pass.</>
            )}
          </p>
          <p className="tr-pending-note">
            We deliberately show nothing rather than a placeholder number — an invented track record would be
            worse than none.
          </p>
        </section>
      )}

      <section className="tr-support">
        <p>
          Keeping forecasts honest — logging every prediction, resolving each trigger, publishing the score even when
          it&apos;s unflattering — is the work. Reading stays <strong>free for everyone</strong>; an optional{' '}
          <Link to="/membership">membership</Link> funds it and unlocks running your own analysis on our compute.
          It buys compute, not access.
        </p>
      </section>
    </div>
  );
}
