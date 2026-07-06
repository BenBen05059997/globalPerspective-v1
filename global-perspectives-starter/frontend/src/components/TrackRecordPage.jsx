import { Link } from 'react-router-dom';
import { useTrackRecord } from '../hooks/useTrackRecord';
import { useCorrectionsFeed } from '../hooks/useCorrectionsFeed';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}` : s;
}

function changeLabel(n) {
  if (n.changeLevel && n.changeLevel.from && n.changeLevel.to && n.changeLevel.from !== n.changeLevel.to) {
    return `${n.changeLevel.from} → ${n.changeLevel.to}`;
  }
  if (n.changeScore && n.changeScore.from != null && n.changeScore.to != null) {
    return `risk ${n.changeScore.from} → ${n.changeScore.to}`;
  }
  return 'read revised';
}

function CorrectionsLedger() {
  const { notes, loading } = useCorrectionsFeed(40);
  if (loading) return <p className="tr-cl-loading">Loading recent corrections…</p>;
  if (!notes || notes.length === 0) {
    return (
      <p className="tr-cl-empty">
        No conclusion changes recorded in the current window. When a country or story read materially
        moves — and only when a real cited event explains it — it appears here.
      </p>
    );
  }
  return (
    <ul className="tr-cl-list">
      {notes.map((n, i) => {
        const to = n.scope === 'country'
          ? `/weekly/country/${encodeURIComponent(n.name)}`
          : `/weekly/thread/${encodeURIComponent(n.name)}`;
        return (
          <li key={i} className="tr-cl-item">
            <div className="tr-cl-top">
              <span className={`tr-cl-scope ${n.scope}`}>{n.scope === 'country' ? 'Country' : 'Story'}</span>
              <Link className="tr-cl-name" to={to}>{n.scope === 'country' ? n.name : `thread ${String(n.name).slice(0, 24)}…`}</Link>
              <span className="tr-cl-delta">{changeLabel(n)}</span>
              <span className="tr-cl-date">{fmtDay(n.asOf)}</span>
            </div>
            {n.noSingleDriver ? (
              <p className="tr-cl-why nsd">No single driver — a gradual shift across the coverage, not one event.</p>
            ) : n.triggerEvent?.title ? (
              <p className="tr-cl-why">↳ Because: <strong>{n.triggerEvent.title}</strong>
                {n.triggerEvent.date ? <span className="tr-cl-evdate"> · {fmtDay(n.triggerEvent.date)}</span> : null}
              </p>
            ) : n.whyChanged ? (
              <p className="tr-cl-why">{n.whyChanged}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function TrackRecordPage() {
  const { data, loading, error } = useTrackRecord();

  if (loading) return <IntelligenceLoader />;

  if (error || !data) {
    return (
      <div className="tr-page">
        <header className="tr-head"><h1>Accountability</h1></header>
        <p className="tr-empty">The scoreboard is temporarily unavailable. Please try again shortly.</p>
      </div>
    );
  }

  const {
    totalPredictionsLogged, totalDatedTriggers, resolvedTriggers,
    pendingTriggers, firedTriggers, brierScore, calibration, recent,
    eraCutFrom, legacyPredictionsExcluded,
  } = data;

  const hasResolved = resolvedTriggers > 0;
  const verdict = brierVerdict(brierScore);

  return (
    <div className="tr-page">
      <header className="tr-head">
        <h1>Accountability</h1>
        <p className="tr-sub">
          We keep score on ourselves. Every forecast is logged the moment it&apos;s made with dated,
          falsifiable triggers; every read that changes is corrected in the open with the event that moved it.
          This page is the running record — the forecasts scored, and the analysis corrected — not a marketing claim.
        </p>
      </header>

      {/* ---- Scored forecast record (methodology v1) ---- */}
      <section className="tr-section">
        <div className="tr-section-head">
          <h2>Forecast record</h2>
          {eraCutFrom && (
            <span className="tr-eracut">scored from {fmtDay(eraCutFrom)}</span>
          )}
        </div>

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
            <div className="tr-brier">
              <div className="tr-brier-score">
                <span className="tr-brier-num">{brierScore}</span>
                {verdict && <span className={`tr-brier-verdict ${verdict}`}>{verdict}</span>}
              </div>
              <p className="tr-brier-explain">
                Brier score across {resolvedTriggers} resolved triggers ({firedTriggers} fired).
                Lower is better: 0 is perfect, 0.25 is the score of always guessing 50%.
                It measures both accuracy and how well-calibrated the stated probabilities are.
              </p>
            </div>

            {calibration.length > 0 && (
              <div className="tr-cal">
                <h3>Calibration</h3>
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
              </div>
            )}

            <div className="tr-recent">
              <h3>Recently resolved</h3>
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
            </div>
          </>
        ) : (
          <div className="tr-pending">
            <h3>Scoring begins as deadlines pass</h3>
            <p>
              {totalDatedTriggers > 0 ? (
                <>We&apos;re tracking <strong>{totalDatedTriggers}</strong> dated trigger
                {totalDatedTriggers === 1 ? '' : 's'} across <strong>{totalPredictionsLogged}</strong> logged
                prediction{totalPredictionsLogged === 1 ? '' : 's'}. None have reached their deadline and been
                verified yet, so there is no score to report.</>
              ) : (
                <>No dated predictions have been logged yet under the current methodology. As forecasts are
                published with dated trigger signals, they will appear here and be scored once their deadlines pass.</>
              )}
            </p>
            <p className="tr-pending-note">
              We deliberately show nothing rather than a placeholder number — an invented track record would be
              worse than none.
            </p>
          </div>
        )}

        <p className="tr-section-foot">
          Every forecast lives on its story&apos;s page as a checklist that resolves in public.{' '}
          <Link to="/weekly">See the live forecast boards →</Link>
        </p>
      </section>

      {/* ---- Corrections ledger (the living-analysis loop) ---- */}
      <section className="tr-section">
        <div className="tr-section-head">
          <h2>Corrections ledger</h2>
          <span className="tr-section-tag">self-correcting analysis</span>
        </div>
        <p className="tr-section-sub">
          Our country and story reads update as news arrives. When a <em>conclusion</em> moves — a risk level,
          a trajectory — we record what changed and ground the <em>why</em> in a real, cited event. Never a silent
          overwrite. This is the public log of those corrections.
        </p>
        <CorrectionsLedger />
      </section>

      {/* ---- Published methodology ---- */}
      <section className="tr-section tr-method">
        <h2>How this works</h2>
        <ol className="tr-method-list">
          <li>
            <strong>Logged at the moment it&apos;s made.</strong> Every prediction is written to an immutable,
            point-in-time record with dated, falsifiable triggers. It can&apos;t be edited or quietly deleted later.
          </li>
          <li>
            <strong>Triggers are gate-validated at capture.</strong> Each trigger must be a single, forward-dated,
            checkable event (absolute deadline, within ~180 days). Malformed triggers are dropped at capture and
            recorded — they never enter the score.
          </li>
          <li>
            <strong>Verified independently as deadlines pass.</strong> Each due trigger is checked against the news
            record with real sources; every &ldquo;fired&rdquo; is double-checked by a second independent pass. Anything
            genuinely ambiguous is marked <em>unclear</em> and <strong>excluded from the score</strong> — we&apos;d rather
            report nothing than guess.
          </li>
          <li>
            <strong>Scored honestly.</strong> The Brier score and calibration count only resolved triggers.
            {eraCutFrom && (
              <> The record is scored from <strong>{fmtDay(eraCutFrom)}</strong>
              {legacyPredictionsExcluded ? (
                <>; <strong>{legacyPredictionsExcluded}</strong> earlier prediction{legacyPredictionsExcluded === 1 ? '' : 's'} predate
                the current capture methodology and are kept on file but excluded from scoring — we found
                trigger-generation defects in them and chose to exclude rather than cherry-pick.</>
              ) : '.'}</>
            )}
          </li>
        </ol>
      </section>

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
