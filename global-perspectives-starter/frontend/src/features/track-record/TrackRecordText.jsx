import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTrackRecord } from '@/features/track-record/hooks/useTrackRecord';
import { useCorrectionsFeed } from '@/features/track-record/hooks/useCorrectionsFeed';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import { buildTrackRecordView } from '@/features/track-record/lib/trackRecordView.js';
import { forecastPlaceCounts } from '@/features/track-record/lib/forecastPlaces.js';
import { buildWeeklySquares, settlingSummary } from '@/features/track-record/lib/settlingLog.js';
import { itemState, stateMeta } from '@/features/track-record/lib/questionStates.js';
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
import '@/features/track-record/TrackRecordText.css';

// TrackRecordText — E1, the plain, printable, screen-reader-first text rendering of the same
// service record shown on /track-record (E2's map/board/console). Same numbers, same sources,
// same wording (both build from lib/trackRecordView.js), no map chrome, semantic headings.
export default function TrackRecordText() {
  useEffect(() => { document.title = 'Track Record (text) | Global Perspectives'; }, []);
  const { data, loading, error } = useTrackRecord();
  const { notes, loading: notesLoading } = useCorrectionsFeed(40);

  const view = useMemo(() => (data ? buildTrackRecordView(data, new Date()) : null), [data]);
  const places = useMemo(() => forecastPlaceCounts(view?.boardItems || []), [view]);
  const squares = useMemo(() => buildWeeklySquares(view?.q?.weeks || []), [view]);
  const settling = settlingSummary(squares);

  if (loading) return <BootLoader variant="inline" label="Loading the track record" text="Loading the track record" />;
  if (error || !data) {
    return (
      <article className="tr-text">
        <h1>Accountability (text version)</h1>
        <p>The scoreboard is temporarily unavailable. Please try again shortly.</p>
      </article>
    );
  }

  const { q, stage, lock, counts } = view;
  return (
    <article className="tr-text">
      <header>
        <p className="tr-text-kicker">TRACK RECORD · TEXT VERSION</p>
        <h1>Accountability</h1>
        <p><Link to="/track-record">← Full view (map, board, settling log)</Link></p>
        <p>
          We keep score on ourselves. Every forecast is logged the moment it&apos;s made; every read that
          changes is corrected in the open with the event that moved it.
        </p>
      </header>

      <section>
        <h2>Status</h2>
        <p><strong>{stage.label}.</strong> {stage.headline}</p>
        <p>{stage.detail}</p>
        {view.notes.map((n) => <p key={n.key}>{n.text}</p>)}
      </section>

      <section>
        <h2>Accuracy</h2>
        {lock.locked ? (
          <>
            <p>{lock.n} resolved of {lock.target} needed. {view.accuracyText}</p>
            <p>No Brier score, skill number, or a word like &ldquo;strong&rdquo; or &ldquo;weak&rdquo; until then. The July
            pilot&apos;s {view.pilotCount} triggers don&apos;t count toward this: they were scored against the parent
            scenario&apos;s probability, a method we&apos;ve since retired.</p>
          </>
        ) : view.scoring ? (
          <p>
            Brier score {view.scoring.brier} across {view.scoring.n} resolved questions; guessing the base rate
            ({Math.round(view.scoring.baseRate * 100)}% yes) every time scores {view.scoring.brierRef}. Skill {view.scoring.skill}
            {view.scoring.ci ? ` (95% interval ${view.scoring.ci.lo} to ${view.scoring.ci.hi}, resampled by story)` : ''}: {view.skillWords}.
            Voided: {Math.round(view.scoring.voidRate * 1000) / 10}%.
          </p>
        ) : null}
        {view.calibrationText && <p>{view.calibrationText}</p>}
      </section>

      <section>
        <h2>Forecast record</h2>
        <ul>
          <li>{counts.locked} questions locked in weekly samples</li>
          <li>{counts.resolved} resolved ({counts.yes} happened, {counts.no} didn&apos;t); {counts.void} void</li>
          <li>{counts.awaiting} awaiting their deadline; {counts.pastDeadlineUnchecked} past deadline, not checked</li>
          {q && <li>{q.issued} questions issued with their own probability; {q.sampledTotal} in samples{q.warmUp ? `; ${q.warmUp} warm-up (before the first sample week, never scored)` : ''}</li>}
          <li>{view.pilotCount} from the July pilot (archived; method flawed)</li>
          {data.totalDatedTriggers ? <li>{data.totalDatedTriggers} earlier dated triggers (issued without a probability of their own) were never scored</li> : null}
        </ul>
        {q?.weeks?.filter((w) => w.commit).map((w) => (
          <p key={w.weekId}>
            Week of {fmtDay(w.weekStart)}: commitment {w.commit.hash} published {fmtDay(w.commit.committedAt)}
            {w.reveal ? `; seed revealed ${fmtDay(w.reveal.revealedAt)}` : ''}
            {w.drawn ? `; ${w.picked} of ${w.eligible} eligible questions drawn` : ''}.
          </p>
        ))}
        {view.drawNotes.map((t) => <p key={t}>{t}</p>)}
      </section>

      <section>
        <h2>Forecast board</h2>
        {view.boardText && <p>{view.boardText}</p>}
        {places.length > 0 && (
          <>
            <h3>By place named in the question</h3>
            <ul>
              {places.map((p) => (
                <li key={p.iso3}>{p.name}: {p.fired} happened, {p.notFired} didn&apos;t, {p.awaiting + p.pastUnchecked} open, {p.void} void</li>
              ))}
            </ul>
          </>
        )}
        {view.boardItems.length > 0 && (
          <>
            <h3>Every question in a weekly sample</h3>
            <ol>
              {view.boardItems.map((r) => {
                const meta = stateMeta(itemState(r));
                return (
                  <li key={r.qid}>
                    <strong>{meta ? meta.label : ''}:</strong> {r.question}
                    {typeof r.p === 'number' ? ` — ${r.p}% when locked` : ''}
                    {r.resolutionSource ? `; source: ${r.resolutionSource}` : ''}
                    {r.deadline ? `; by ${fmtDay(r.deadline)}` : ''}
                    {r.verdict?.url && /^https?:\/\//.test(r.verdict.url) && <> (<a href={r.verdict.url} target="_blank" rel="noreferrer">source</a>)</>}
                  </li>
                );
              })}
            </ol>
          </>
        )}
        {view.pilot.length > 0 && (
          <>
            <h3>July pilot examples (archived, not scored)</h3>
            <ol>
              {view.pilot.map((r, i) => (
                <li key={i}>
                  <strong>{r.verdict === 'fired' ? 'Happened' : 'Didn’t happen'}:</strong> {r.trigger}
                  {' — '}{r.title}{r.deadline ? `, due ${r.deadline}` : ''}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section>
        <h2>Settling log</h2>
        {squares.length > 0 ? (
          <p>
            {settling.total} week{settling.total === 1 ? '' : 's'} since {fmtDay(q.weeks[0].weekStart)}: {settling.green + settling.amber} with
            confirmations, {settling.red} where something was due and nothing was confirmed, {settling.grey + settling.open} with nothing due yet.
          </p>
        ) : (
          <p>No settling weeks yet. The log starts with the first committed weekly sample.</p>
        )}
        {view.pilotLine && <p>{view.pilotLine}</p>}
      </section>

      <section>
        <h2>Ledger of changed reads</h2>
        {notesLoading ? (
          <BootLoader variant="inline" className="gp-boot--tight" label="Loading recent corrections" text="Loading recent corrections" />
        ) : !notes || notes.length === 0 ? (
          <p>No conclusion changes recorded in the current window.</p>
        ) : (
          <ul>
            {notes.map((n, i) => (
              <li key={i}>
                <strong>{n.scope === 'country' ? n.name : `thread ${String(n.name).slice(0, 24)}…`}</strong>
                {' — '}{fmtDay(n.asOf)}
                {n.triggerEvent?.title ? ` — because: ${n.triggerEvent.title}` : ''}
                {n.noSingleDriver ? ' — no single driver' : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>How this works</h2>
        <ol>
          <li>Each question carries its own probability and a named source, fixed when it is published; the record is written once.</li>
          <li>Before each week we publish a commitment (a hash of a secret seed); after the week closes the seed is revealed and up to {q?.method?.K ?? 22} questions are drawn by hash, at most one per story. Only questions with a 7 to 84 day lead time are eligible.</li>
          <li>An agent that is not shown the probability drafts a verdict with a quote and a link; a person confirms it. A NO is only allowed after the deadline plus 3 days; anything unjudgeable is marked void with a reason and excluded.</li>
          <li>Scored against a guess of the overall base rate, with an interval resampled by story. No accuracy before 150 resolved; calibration by band only after 400 over six months.</li>
          <li>
            The July pilot ({view.pilotCount} triggers, checked {fmtDay(view.lastResolvedAt)}) is archived, not scored: it scored a
            trigger at its parent scenario&apos;s probability, which we no longer consider defensible as calibration.
            {data.legacyPredictionsExcluded ? ` A further ${data.legacyPredictionsExcluded} even earlier predictions are excluded for the same reason.` : ''}
          </li>
        </ol>
      </section>
    </article>
  );
}
