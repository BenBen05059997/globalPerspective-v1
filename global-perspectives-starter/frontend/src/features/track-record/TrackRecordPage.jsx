import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTrackRecord } from '@/features/track-record/hooks/useTrackRecord';
import { useCorrectionsFeed } from '@/features/track-record/hooks/useCorrectionsFeed';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import { FollowButton } from '@/features/account/components/FollowButton';
import { buildTrackRecordView } from '@/features/track-record/lib/trackRecordView.js';
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
import ForecastBoard from '@/features/track-record/components/ForecastBoard.jsx';
import SettlingLog from '@/features/track-record/components/SettlingLog.jsx';
import DrawRow from '@/features/track-record/components/DrawRow.jsx';
import '@/features/track-record/TrackRecordPage.css';
import { safeWhy, safeTriggerEvent } from '@/shared/lib/driftNote.js';

// S6: this page is the E2 "Service record" one-screen view (TRACK_RECORD_AND_STUDIO_RULING.md,
// "Track record page design"). E1 (a plain, printable text version for search/screen readers)
// lives at TrackRecordText.jsx, reachable via the link below.
//
// The 122 triggers of the July pilot share one confirmedAt (2026-07-24) and were scored against the
// parent SCENARIO's probability, a method the ruling calls flawed: archived, excluded from every
// headline number. Since Batch 4 the numbers come from the server's `questions` block (a weekly
// pre-registered sample of questions with their own probability); see lib/trackRecordView.js.

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
  if (loading) return <BootLoader variant="inline" className="gp-boot--tight" label="Loading recent corrections" text="Loading recent corrections" />;
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
  const view = useMemo(() => (data ? buildTrackRecordView(data, new Date()) : null), [data]);

  if (loading) return <BootLoader variant="inline" label="Loading the track record" text="Loading the track record" />;

  if (error || !data) {
    return (
      <div className="tr-page">
        <header className="tr-head"><h1>Accountability</h1></header>
        <p className="tr-empty">The scoreboard is temporarily unavailable. Please try again shortly.</p>
      </div>
    );
  }

  const { eraCutFrom, legacyPredictionsExcluded, totalDatedTriggers } = data;
  const { q, stage, lock, counts } = view;

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
        {view.notes.map((n) => <p key={n.key} className="tr-status-note" data-notready={n.key}>{n.text}</p>)}
      </section>

      {/* ---- Accuracy: locked until 150 resolved questions ---- */}
      <section className="tr-section">
        <div className="tr-section-head"><h2>Accuracy</h2></div>
        {lock.locked ? (
          <div className="tr-lock">
            <div className="tr-lock-bar"><div className="tr-lock-fill" style={{ width: `${lock.pct}%` }} /></div>
            <p className="tr-lock-label">{lock.n} resolved of {lock.target} needed</p>
            <p className="tr-lock-note" data-notready="accuracy">{view.accuracyText}</p>
            <p className="tr-lock-note">
              No Brier score, skill number, or a word like &ldquo;strong&rdquo;/&ldquo;weak&rdquo; until then.
              The July pilot&apos;s {view.pilotCount} triggers don&apos;t count toward this — they were scored
              against the parent scenario&apos;s probability, a method we&apos;ve since retired.
            </p>
          </div>
        ) : view.scoring ? (
          <div className="tr-brier">
            <div className="tr-brier-score">
              <span className="tr-brier-num">{view.scoring.brier}</span>
              <span className="tr-brier-verdict fair">{view.skillWords}</span>
            </div>
            <p className="tr-brier-explain">
              Brier score across {view.scoring.n} resolved questions; a guess of the overall base rate ({Math.round(view.scoring.baseRate * 100)}% yes)
              every time scores {view.scoring.brierRef}. Skill {view.scoring.skill}
              {view.scoring.ci ? ` (95% interval ${view.scoring.ci.lo} to ${view.scoring.ci.hi}, resampled by story)` : ''}.
              {' '}Voided: {Math.round(view.scoring.voidRate * 1000) / 10}%. Lower Brier is better, 0 is perfect.
            </p>
          </div>
        ) : null}
        {view.calibrationText && <p className="tr-lock-note" data-notready="calibration">{view.calibrationText}</p>}
      </section>

      {/* ---- This week's draw + commitments ---- */}
      {q?.weeks?.length > 0 && (
        <section className="tr-section">
          <div className="tr-section-head"><h2>This week&apos;s draw</h2><span className="tr-section-tag">pre-registered</span></div>
          <DrawRow weeks={q.weeks} />
          {view.drawNotes.map((t) => <p key={t} className="tr-gap-note">{t}</p>)}
        </section>
      )}

      {/* ---- Forecast record — counts that add up, the pilot labelled, never blended in ---- */}
      <section className="tr-section">
        <div className="tr-section-head">
          <h2>Forecast record</h2>
          {q?.firstCommit && <span className="tr-eracut">sampled from {fmtDay(q.firstCommit.committedAt)}</span>}
        </div>
        <section className="tr-stats">
          <div className="tr-stat"><span className="tr-stat-num">{counts.locked}</span><span className="tr-stat-label">Questions locked in samples</span></div>
          <div className="tr-stat"><span className="tr-stat-num">{counts.resolved}</span><span className="tr-stat-label">Resolved ({counts.yes} happened, {counts.no} didn&apos;t)</span></div>
          <div className="tr-stat"><span className="tr-stat-num">{counts.void}</span><span className="tr-stat-label">Void</span></div>
          <div className="tr-stat"><span className="tr-stat-num">{counts.awaiting}</span><span className="tr-stat-label">Open, deadline still ahead</span></div>
          <div className="tr-stat"><span className="tr-stat-num">{counts.pastDeadlineUnchecked}</span><span className="tr-stat-label">Past deadline, not checked</span></div>
          <div className="tr-stat"><span className="tr-stat-num">{view.pilotCount}</span><span className="tr-stat-label">July pilot (archived; method flawed)</span></div>
        </section>
        {q && (
          <p className="tr-gap-note">
            {q.issued} question{q.issued === 1 ? '' : 's'} issued with their own probability{q.warmUp ? ` (${q.warmUp} before the first sample week: warm-up, never scored)` : ''};
            {' '}{q.sampledTotal} in weekly samples; the rest are published but not scored.
            {totalDatedTriggers ? ` ${totalDatedTriggers} earlier dated triggers (issued without a probability of their own) were never scored.` : ''}
          </p>
        )}
      </section>

      {/* ---- Forecast board: MAP (default) | BOARD ---- */}
      <section className="tr-section">
        <div className="tr-section-head"><h2>Forecast board</h2></div>
        <p className="tr-section-sub">
          Every question in a weekly sample, placed at the country it names: counts per place, never an accuracy
          score for a country (too few per place to mean anything).
        </p>
        {view.boardText && <p className="tr-gap-note" data-notready="board">{view.boardText}</p>}
        <ForecastBoard items={view.boardItems} />
        {view.pilot.length > 0 && (
          <details className="tr-pilot-details">
            <summary>July pilot examples ({view.pilot.length} most recent; archived, not scored)</summary>
            <ul className="tr-pilot-list">
              {view.pilot.map((r, i) => (
                <li key={i}>
                  <b>{r.verdict === 'fired' ? '✓ happened' : '✗ didn’t happen'}:</b> {r.trigger}
                  {r.citation && /^https?:\/\//.test(r.citation) && <> (<a href={r.citation} target="_blank" rel="noreferrer">source</a>)</>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ---- Settling log ---- */}
      <section className="tr-section">
        <div className="tr-section-head"><h2>Settling log</h2></div>
        <SettlingLog weeks={q?.weeks || []} firstCommit={q?.firstCommit} pilotNote={view.pilotLine} />
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
            <strong>Each question carries its own probability and a named source, fixed when it is published.</strong>{' '}
            A forecast trigger becomes a yes/no question with the probability we gave that event alone and the
            public record that will settle it. The record is written once and can&apos;t be edited or quietly deleted; a
            correction is a new question.
          </li>
          <li>
            <strong>A random sample is locked each week, in advance.</strong> Before a week starts we publish a
            commitment (a hash of a secret seed). After the week closes we reveal the seed; up to {q?.method?.K ?? 22} questions
            are ranked by a hash of the seed and the question, at most one per story. Anyone can re-run the
            draw (&ldquo;Verify this draw&rdquo;). Only questions with a lead time of 7 to 84 days are eligible; the rest are
            published but not scored.
          </li>
          <li>
            <strong>Resolved with sources by an agent and a person.</strong> An agent that is not shown the
            probability drafts a verdict with a quoted passage and a link; a person confirms it. A YES needs a source,
            a NO is only allowed after the deadline plus 3 days, and anything that cannot be judged is marked{' '}
            <em>void</em> with a reason, published, and excluded from the score.
          </li>
          <li>
            <strong>Scored against a plain guess.</strong> Brier score next to the score of guessing the overall
            base rate every time, with an interval resampled by story. No accuracy is shown before 150 questions are
            resolved, and calibration by probability band only after 400 over six months.
          </li>
          <li>
            <strong>The July pilot is archived, not scored.</strong> Its {view.pilotCount} resolved triggers were
            checked once, on {fmtDay(view.lastResolvedAt)}, against a method — scoring a trigger at its parent
            scenario&apos;s probability — that is not defensible as calibration. They stay on file as
            examples but never feed the accuracy figure.
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
