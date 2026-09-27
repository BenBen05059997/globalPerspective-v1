import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTrackRecord } from '@/features/track-record/hooks/useTrackRecord';
import { useCorrectionsFeed } from '@/features/track-record/hooks/useCorrectionsFeed';
import IntelligenceLoader from '@/shared/ui/IntelligenceLoader';
import { splitPilot } from '@/features/track-record/lib/pilotExclusion.js';
import { stageWording } from '@/features/track-record/lib/stageWording.js';
import { accuracyProgress } from '@/features/track-record/lib/accuracyLock.js';
import { computeBrier } from '@/features/track-record/lib/postPilotBrier.js';
import { forecastPlaceCounts } from '@/features/track-record/lib/forecastPlaces.js';
import { buildSettlingLog, settlingSummary } from '@/features/track-record/lib/settlingLog.js';
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
import '@/features/track-record/TrackRecordText.css';

// TrackRecordText — E1, the plain, printable, screen-reader-first text rendering of the same
// service record shown on /track-record (E2's map/board/console). Same numbers, same sources,
// no map chrome, semantic headings top to bottom (TASK_2026-09-27_pages_local.md S6: "a plain
// accessible text rendering... semantic headings; printable").
function brierVerdict(b) {
  if (b == null) return null;
  if (b <= 0.1) return 'excellent';
  if (b <= 0.2) return 'strong';
  if (b <= 0.25) return 'fair';
  return 'weak';
}

export default function TrackRecordText() {
  useEffect(() => { document.title = 'Track Record (text) | Global Perspectives'; }, []);
  const { data, loading, error } = useTrackRecord();
  const { notes, loading: notesLoading } = useCorrectionsFeed(40);

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
    () => stageWording({ postPilotResolved: postPilot.length, lastResolvedAt, eraCutFrom: data?.eraCutFrom, pilotCount: pilotCount }),
    [postPilot.length, lastResolvedAt, data?.eraCutFrom, pilotCount],
  );
  const lock = accuracyProgress(postPilot.length);
  const postPilotBrier = useMemo(() => computeBrier(postPilot), [postPilot]);
  const verdict = !lock.locked ? brierVerdict(postPilotBrier) : null;
  const places = useMemo(() => forecastPlaceCounts(recent), [recent]);
  const weeks = useMemo(
    () => (data?.eraCutFrom ? buildSettlingLog(recent.map((r) => r.confirmedAt).filter(Boolean), data.eraCutFrom) : []),
    [recent, data?.eraCutFrom],
  );
  const settling = settlingSummary(weeks);

  if (loading) return <IntelligenceLoader />;
  if (error || !data) {
    return (
      <article className="tr-text">
        <h1>Accountability (text version)</h1>
        <p>The scoreboard is temporarily unavailable. Please try again shortly.</p>
      </article>
    );
  }

  return (
    <article className="tr-text">
      <header>
        <p className="tr-text-kicker">TRACK RECORD · TEXT VERSION</p>
        <h1>Accountability</h1>
        <p><Link to="/track-record">← Full view (map, board, settling log)</Link></p>
        <p>
          We keep score on ourselves. Every forecast is logged the moment it&apos;s made with dated,
          falsifiable triggers; every read that changes is corrected in the open with the event that moved it.
        </p>
      </header>

      <section>
        <h2>Status</h2>
        <p><strong>{stage.label}.</strong> {stage.headline}</p>
        <p>{stage.detail}</p>
      </section>

      <section>
        <h2>Accuracy</h2>
        {lock.locked ? (
          <>
            <p>{lock.n} resolved of {lock.target} needed. Locked until then: no Brier score, no skill
            number, no word like &ldquo;strong&rdquo; or &ldquo;weak&rdquo;.</p>
            <p>The July pilot&apos;s {pilotCount} triggers don&apos;t count toward this — they were
            scored against the parent scenario&apos;s probability, a method we&apos;ve since retired.</p>
          </>
        ) : (
          <p>
            Brier score {postPilotBrier} across {postPilot.length} resolved questions (post-pilot)
            {verdict ? ` — ${verdict}` : ''}. A plain guess (50% every time) always scores 0.25; lower is
            better, 0 is perfect.
          </p>
        )}
      </section>

      <section>
        <h2>Forecast record</h2>
        <ul>
          <li>{data.totalPredictionsLogged} predictions logged{data.eraCutFrom ? ` (scored from ${fmtDay(data.eraCutFrom)})` : ''}</li>
          <li>{data.totalDatedTriggers} dated trigger signals</li>
          <li>{pilotCount} from the July pilot (archived; method flawed)</li>
          <li>{data.pendingTriggers} not yet checked (includes both deadlines already past and deadlines
          still ahead — the public data doesn&apos;t yet split the two)</li>
        </ul>
      </section>

      <section>
        <h2>Forecast board</h2>
        <p>
          The {recent.length} most recently resolved forecasts the public record serves — all from the
          July pilot, shown for transparency and excluded from the accuracy figure above.
        </p>
        {places.length > 0 && (
          <>
            <h3>By place named in the forecast</h3>
            <ul>
              {places.map((p) => (
                <li key={p.iso3}>{p.name}: {p.fired} happened, {p.notFired} didn&apos;t</li>
              ))}
            </ul>
          </>
        )}
        <h3>Every resolved item</h3>
        <ol>
          {recent.map((r, i) => (
            <li key={i}>
              <strong>{r.verdict === 'fired' ? 'Happened' : 'Didn’t happen'}:</strong> {r.trigger}
              {' — '}{r.title}{r.deadline ? `, due ${r.deadline}` : ''}
              {r.citation && <> (<a href={r.citation} target="_blank" rel="noreferrer">source</a>)</>}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Settling log</h2>
        {weeks.length > 0 ? (
          <p>
            {settling.missed} of {settling.total} week{settling.total === 1 ? '' : 's'} since{' '}
            {fmtDay(data.eraCutFrom)} settled nothing.
          </p>
        ) : (
          <p>No settling weeks to show yet.</p>
        )}
      </section>

      <section>
        <h2>Ledger of changed reads</h2>
        {notesLoading ? (
          <p>Loading recent corrections…</p>
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
          <li>Logged at the moment it&apos;s made, immutably, with dated falsifiable triggers.</li>
          <li>Triggers are gate-validated at capture; malformed ones are dropped and never scored.</li>
          <li>Verified independently as deadlines pass; anything ambiguous is excluded from the score.</li>
          <li>
            The July pilot ({pilotCount} triggers, checked {fmtDay(lastResolvedAt)}) is archived, not
            scored — it used a method (scoring a trigger at its parent scenario&apos;s probability) we no
            longer consider defensible as calibration.
            {data.legacyPredictionsExcluded ? ` A further ${data.legacyPredictionsExcluded} even earlier predictions are excluded for the same reason.` : ''}
          </li>
        </ol>
      </section>
    </article>
  );
}
