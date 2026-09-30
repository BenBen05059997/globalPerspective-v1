import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTrackRecord } from '@/features/track-record/hooks/useTrackRecord';
import { useCorrectionsFeed } from '@/features/track-record/hooks/useCorrectionsFeed';
import IntelligenceLoader from '@/shared/ui/IntelligenceLoader';
import { FollowButton } from '@/features/account/components/FollowButton';
import { splitPilot } from '@/features/track-record/lib/pilotExclusion.js';
import { stageWording } from '@/features/track-record/lib/stageWording.js';
import { accuracyProgress } from '@/features/track-record/lib/accuracyLock.js';
import { pastDeadlineSummary } from '@/features/track-record/lib/pastDeadline.js';
import { computeBrier } from '@/features/track-record/lib/postPilotBrier.js';
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
import ForecastBoard from '@/features/track-record/components/ForecastBoard.jsx';
import SettlingLog from '@/features/track-record/components/SettlingLog.jsx';
import '@/features/track-record/TrackRecordPage.css';
import { safeWhy, safeTriggerEvent } from '@/shared/lib/driftNote.js';

// S6: this page is the E2 "Service record" one-screen view (TRACK_RECORD_AND_STUDIO_RULING.md,
// "Track record page design"). E1 (a plain, printable text version for search/screen readers)
// lives at TrackRecordText.jsx, reachable via the link below.
//
// The one fact this whole build turns on: ALL 122 currently-resolved triggers share a single
// confirmedAt (2026-07-24T22:22:14.709Z — verified against the live prediction_track_record
// response) — one scoring run, under a method the ruling calls flawed (scored against the parent
// SCENARIO's probability, not the trigger's own). That run is archived as the "July pilot" and
// excluded from every headline number here; splitPilot() draws that line from the real timestamp,
// never a hand-picked ID list. Nothing has been scored since.

function brierVerdict(b) {
  if (b == null) return null;
  if (b <= 0.1) return 'excellent';
  if (b <= 0.2) return 'strong';
  if (b <= 0.25) return 'fair';
  return 'weak';
}
const VERDICT_LABEL = { excellent: 'excellent', strong: 'strong', fair: 'fair', weak: 'weak' };

function VerdictPill({ verdict }) {
  const fired = verdict === 'fired';
  return (
    <span className={`tr-verdict ${fired ? 'fired' : 'notfired'}`}>
      {fired ? '✓ Fired' : '✗ Did not fire'}
    </span>
  );
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
  const { notes, total, gated, loading } = useCorrectionsFeed(40);
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
    <>
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
                {n.scope === 'country' && (
                  <span className="tr-cl-follow"><FollowButton country={n.name} /></span>
                )}
              </div>
              {n.noSingleDriver ? (
                <p className="tr-cl-why nsd">No single driver — a gradual shift across the coverage, not one event.</p>
              ) : safeTriggerEvent(n)?.title ? (
                <p className="tr-cl-why">↳ Because: <strong>{safeTriggerEvent(n).title}</strong>
                  {safeTriggerEvent(n).date ? <span className="tr-cl-evdate"> · {fmtDay(safeTriggerEvent(n).date)}</span> : null}
                </p>
              ) : safeWhy(n) ? (
                <p className="tr-cl-why">{safeWhy(n)}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {gated && total > notes.length && (
        <Link to="/membership" className="tr-cl-locked">
          Showing the {notes.length} most recent of <strong>{total}</strong> corrections.{' '}
          <span className="tr-cl-locked-cta">Members see the full history →</span>
        </Link>
      )}
    </>
  );
}

export default function TrackRecordPage() {
  useEffect(() => { document.title = 'Track Record | Global Perspectives'; }, []);
  const { data, loading, error } = useTrackRecord();

  const recent = useMemo(() => data?.recent || [], [data?.recent]);
  const { pilot, postPilot } = useMemo(() => splitPilot(recent), [recent]);
  // `recent` is a 30-item sample; the pilot's real size is the API's own `resolvedTriggers` minus
  // what the sample shows was resolved after the pilot (monitor, S6: the page said "30" for 122).
  // Once post-pilot resolutions outgrow the sample this needs a server count (D6).
  const pilotCount = Math.max(pilot.length, (data?.resolvedTriggers ?? 0) - postPilot.length);
  const lastResolvedAt = useMemo(
    () => recent.reduce((max, r) => (r.confirmedAt && (!max || r.confirmedAt > max) ? r.confirmedAt : max), null),
    [recent],
  );
  const stage = useMemo(
    () => stageWording({
      postPilotResolved: postPilot.length,
      lastResolvedAt,
      eraCutFrom: data?.eraCutFrom,
      pilotCount: pilotCount,
    }),
    [postPilot.length, lastResolvedAt, data?.eraCutFrom, pilotCount],
  );
  const lock = accuracyProgress(postPilot.length);
  const pastDeadline = useMemo(
    () => pastDeadlineSummary({ pendingTriggers: data?.pendingTriggers }),
    [data?.pendingTriggers],
  );

  // Accuracy figures, once unlocked, are computed ONLY from postPilot — never blended with the
  // archived pilot's 122, and never trusting the backend's all-time-blended brierScore (see
  // lib/postPilotBrier.js).
  const postPilotBrier = useMemo(() => computeBrier(postPilot), [postPilot]);

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
    totalPredictionsLogged, totalDatedTriggers, pendingTriggers,
    eraCutFrom, legacyPredictionsExcluded,
  } = data;

  const verdict = !lock.locked ? brierVerdict(postPilotBrier) : null;

  return (
    <div className="tr-page">
      <header className="tr-head">
        <h1>Accountability</h1>
        <p className="tr-sub">
          We keep score on ourselves. Every forecast is logged the moment it&apos;s made with dated,
          falsifiable triggers; every read that changes is corrected in the open with the event that moved it.
          This page is the running record — the forecasts scored, and the analysis corrected — not a marketing claim.
        </p>
        <p className="tr-textlink"><Link to="/track-record/text">Read as text →</Link></p>
      </header>

      {/* ---- Status line (stage 0-3, TRACK_RECORD_AND_STUDIO_RULING.md) ---- */}
      <section className="tr-status">
        <span className="tr-status-tag">{stage.label}</span>
        <h2 className="tr-status-headline">{stage.headline}</h2>
        <p className="tr-status-detail">{stage.detail}</p>
      </section>

      {/* ---- Accuracy: locked until 150 post-pilot resolved ---- */}
      <section className="tr-section">
        <div className="tr-section-head"><h2>Accuracy</h2></div>
        {lock.locked ? (
          <div className="tr-lock">
            <div className="tr-lock-bar"><div className="tr-lock-fill" style={{ width: `${lock.pct}%` }} /></div>
            <p className="tr-lock-label">{lock.n} resolved of {lock.target} needed</p>
            <p className="tr-lock-note">
              No Brier score, skill number, or a word like &ldquo;strong&rdquo;/&ldquo;weak&rdquo; until then.
              The July pilot&apos;s {pilotCount} triggers don&apos;t count toward this — they were scored
              against the parent scenario&apos;s probability, a method we&apos;ve since retired.
            </p>
          </div>
        ) : (
          <div className="tr-brier">
            <div className="tr-brier-score">
              <span className="tr-brier-num">{postPilotBrier}</span>
              {verdict && <span className={`tr-brier-verdict ${verdict}`}>{VERDICT_LABEL[verdict]}</span>}
            </div>
            <p className="tr-brier-explain">
              Brier score across {postPilot.length} resolved questions (post-pilot).
              A plain guess (50% every time) always scores 0.25 — lower is better, 0 is perfect.
            </p>
          </div>
        )}
      </section>

      {/* ---- Forecast record — the raw counts, with the pilot labelled, never blended in ---- */}
      <section className="tr-section">
        <div className="tr-section-head">
          <h2>Forecast record</h2>
          {eraCutFrom && <span className="tr-eracut">scored from {fmtDay(eraCutFrom)}</span>}
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
            <span className="tr-stat-num">{pilotCount}</span>
            <span className="tr-stat-label">July pilot (archived; method flawed)</span>
          </div>
          <div className="tr-stat">
            <span className="tr-stat-num">{pendingTriggers}</span>
            <span className="tr-stat-label">
              Not yet checked
              {!pastDeadline.computable && <sup title={pastDeadline.reason}> †</sup>}
            </span>
          </div>
        </section>
        {!pastDeadline.computable && (
          <p className="tr-gap-note">
            † includes deadlines already past and deadlines still ahead — the public data doesn&apos;t
            yet serve a deadline per pending trigger to split &ldquo;past deadline, not checked&rdquo;
            from &ldquo;not yet due&rdquo;. Never shown as &ldquo;awaiting&rdquo;.
          </p>
        )}
      </section>

      {/* ---- Forecast board: MAP (default) | BOARD ---- */}
      <section className="tr-section">
        <div className="tr-section-head"><h2>Forecast board</h2></div>
        <p className="tr-section-sub">
          The {recent.length} most recently resolved forecasts the public record serves — all from the
          July pilot (archived; method flawed), shown here for transparency and excluded from the
          accuracy figure above. Never a per-country accuracy score: too few resolved per place to mean
          anything yet.
        </p>
        <ForecastBoard items={recent} />
      </section>

      {/* ---- Settling log ---- */}
      <section className="tr-section">
        <div className="tr-section-head"><h2>Settling log</h2></div>
        <SettlingLog confirmedAtDates={recent.map((r) => r.confirmedAt).filter(Boolean)} eraCutFrom={eraCutFrom} />
      </section>

      {/* ---- Ledger of changed reads (the living-analysis loop) ---- */}
      <section className="tr-section">
        <div className="tr-section-head">
          <h2>Ledger of changed reads</h2>
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
            checkable event (absolute deadline, within ~180 days) that carries a real geopolitical, economic, or
            institutional signal. Malformed or out-of-scope triggers are dropped at capture and recorded — they
            never enter the score.
          </li>
          <li>
            <strong>Verified independently as deadlines pass.</strong> Each due trigger is checked against the news
            record with real sources. Anything genuinely ambiguous is marked <em>unclear</em> and <strong>excluded
            from the score</strong> — we&apos;d rather report nothing than guess.
          </li>
          <li>
            <strong>The July pilot is archived, not scored.</strong> Its {pilotCount} resolved triggers were
            checked once, on {fmtDay(lastResolvedAt)}, against a method — scoring a trigger at its parent
            scenario&apos;s probability — the ruling calls not defensible as calibration. They stay on file as
            examples but never feed the headline accuracy figure.
            {eraCutFrom && legacyPredictionsExcluded ? (
              <> Separately, <strong>{legacyPredictionsExcluded}</strong> even earlier predictions predate the
              current capture methodology entirely and are excluded from scoring on file for the same reason:
              trigger-generation defects, kept rather than cherry-picked.</>
            ) : null}
          </li>
        </ol>
      </section>

      <section className="tr-support">
        <p>
          Keeping forecasts honest — logging every prediction, resolving each trigger, publishing the score even when
          it&apos;s unflattering — is the work. Reading stays <strong>free for everyone</strong>: every forecast, every
          score, and the latest correction on each read. An optional <Link to="/membership">membership</Link> funds this
          work and adds the depth — the full correction history and running your own analysis on our compute.
        </p>
      </section>
    </div>
  );
}
