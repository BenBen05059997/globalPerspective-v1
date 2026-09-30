// notReadyCopy — every "not ready yet" sentence on /track-record, in one place, so the wording and
// the rule for when each line disappears cannot drift between the full page and the text page.
// Rules: every date is computed from real data (a fixture without the date yields no date string);
// every projection says "estimate"; nothing is shown as a placeholder.
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';

const DAY = 86400000;
const ms = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const mondayOnOrAfter = (t) => t + ((8 - new Date(t).getUTCDay()) % 7) * DAY;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function currentWeek(q, now) {
  const today = iso(new Date(now).getTime());
  return (q?.weeks || []).find((w) => w.weekStart <= today && today < iso(ms(w.weekStart) + 7 * DAY)) || null;
}

/** Lines under the status headline. Each entry: { key, text }. */
export function statusNotes(q, now = new Date()) {
  const notes = [];
  if (!q || (!q.issued && !q.firstCommit)) {
    notes.push({ key: 'not-started', text: 'Per-question forecasts have not started yet. When they do, each question will show its own probability and its named source, locked at publication.' });
    return notes;
  }
  if (!q.firstCommit) {
    notes.push({ key: 'no-commit', text: `Questions are being logged since ${fmtDay(q.firstIssuedAt)}. The first weekly sample is not committed yet; questions logged before its first week starts are warm-up and are never scored.` });
    return notes;
  }
  const today = iso(new Date(now).getTime());
  const first = q.weeks[0];
  if (first && first.weekStart > today) {
    notes.push({ key: 'first-week-ahead', text: `The first weekly sample starts on ${fmtDay(first.weekStart)} (commitment published ${fmtDay(first.commit?.committedAt)}). Questions logged before then${q.warmUp ? ` (${q.warmUp} so far)` : ''} are warm-up and are not scored.` });
    return notes;
  }
  const cw = currentWeek(q, now);
  if (cw && cw.commit && !cw.drawn) {
    const drawDay = iso(ms(cw.weekStart) + 7 * DAY);
    notes.push({ key: 'week-locked', text: `This week’s sample is locked but not drawn. Commitment ${String(cw.commit.hash).slice(0, 8)}… published ${fmtDay(cw.commit.committedAt)}. The week ends ${fmtDay(iso(ms(cw.weekStart) + 6 * DAY))}; the draw of up to ${q.method?.K ?? 22} questions (one per story) is published on ${fmtDay(drawDay)}.` });
  }
  const sampled = q.sampled || [];
  if (sampled.length > 0 && (q.counts?.resolved ?? 0) + (q.counts?.void ?? 0) === 0) {
    const earliest = sampled.map((s) => s.deadline).filter(Boolean).sort()[0];
    if (earliest) {
      const review = iso(mondayOnOrAfter(ms(earliest) + 3 * DAY));
      notes.push({ key: 'first-results', text: `First results: the first locked questions reach their deadlines from ${fmtDay(earliest)}; the first verdicts are confirmed the week of ${fmtDay(review)}.` });
    }
  }
  return notes;
}

function windowText(est) {
  if (!est) return null;
  const range = est.earliest === est.latest ? fmtDay(est.earliest) : `between ${fmtDay(est.earliest)} and ${fmtDay(est.latest)}`;
  const b = est.basis;
  const per = b.perWeekSource === 'observed' ? `about ${b.perWeek} sampled questions a week (the average so far)` : `about ${b.perWeek} sampled questions a week (the published plan)`;
  return `${est.earliest === est.latest ? 'Expected around' : 'Expected'} ${range} (estimate: based on ${plural(b.locked, 'locked question', 'locked questions')} and ${per}, with ${Math.round(b.voidLow * 100)}–${Math.round(b.voidHigh * 100)}% voided; it moves as real results arrive).`;
}

/** The locked-accuracy explanation. `est` from estimateAccuracyWindow (or null). */
export function accuracyNotReady(q, est, target = 150) {
  const c = q?.counts || {};
  const base = `Accuracy score: not ready yet. It appears after ${target} questions are resolved (now ${c.resolved ?? 0}, void ${c.void ?? 0}, awaiting ${(c.awaiting ?? 0) + (c.pastDeadlineUnchecked ?? 0)}).`;
  const w = windowText(est);
  return w ? `${base} ${w}` : base;
}

/** Calibration bands (needs Stage 3: 400 resolved and 6 months since the first draw). */
export function calibrationNotReady(q, est400, now = new Date()) {
  const firstDraw = (q?.weeks || []).find((w) => w.drawn)?.weekStart;
  let date = est400?.earliest || null;
  if (firstDraw) {
    const sixMonths = iso(ms(firstDraw) + 183 * DAY);
    if (!date || sixMonths > date) date = sixMonths;
  }
  const when = date && date > iso(new Date(now).getTime()) ? ` Expected after about ${fmtDay(date)} (estimate).` : '';
  return `Calibration by probability band: not ready yet. It is shown once a band has 20 resolved questions and the record has 400 resolved questions over 6 months.${when}`;
}

/** Text for an empty or all-open board. */
export function boardStatus(q, now = new Date()) {
  const c = q?.counts || {};
  if (!q || !c.locked) return 'No questions are locked yet.';
  if ((c.resolved ?? 0) + (c.void ?? 0) > 0) return null;
  const earliest = (q.sampled || []).map((s) => s.deadline).filter(Boolean).sort()[0];
  if (!earliest) return `${plural(c.locked, 'question', 'questions')} locked, none resolved yet.`;
  const days = Math.round((ms(earliest) - ms(iso(new Date(now).getTime()))) / DAY);
  const when = days > 0 ? ` (${plural(days, 'day', 'days')})` : days === 0 ? ' (today)' : '';
  return `${plural(c.locked, 'question', 'questions')} locked, none resolved yet. The first deadline is ${fmtDay(earliest)}${when}.`;
}

/** A drawn week that had fewer eligible stories than the sample size. */
export function drawShort(week, K = 22) {
  if (!week?.drawn || week.picked == null || week.picked >= K) return null;
  return `Only ${plural(week.picked, 'story', 'stories')} had an eligible question in the week of ${fmtDay(week.weekStart)}, so the sample is ${week.picked}; it is never padded.`;
}

/** The pilot is a one-off fact, not a series of missed weeks. */
export function pilotNote(lastResolvedAt, pilotCount) {
  if (!lastResolvedAt) return null;
  return `July pilot: ${pilotCount} triggers were settled once, on ${fmtDay(lastResolvedAt)}, under a retired method (archived, not scored).`;
}
