// stageWording — the public status line, staged 0-3 per TRACK_RECORD_AND_STUDIO_RULING.md
// ("Public wording by stage"). Every number and date comes from the server's `questions` block
// (or the archived pilot's own record); this module never invents a count or a date.
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
import { ACCURACY_UNLOCK_AT } from '@/features/track-record/lib/accuracyLock.js';

export const STAGE3_AT = 400;
const SIX_MONTHS_MS = 183 * 86400000;

/**
 * @param {object} args
 * @param {object|null} args.questions  data.questions from prediction_track_record (null if absent)
 * @param {string|null} args.lastResolvedAt  newest confirmedAt of the archived pilot
 * @param {string} args.eraCutFrom
 * @param {number} args.pilotCount
 * @param {Date} args.now
 */
export function stageWording({ questions = null, lastResolvedAt = null, eraCutFrom, pilotCount = 0, now = new Date() }) {
  const q = questions;
  const resolved = q?.counts?.resolved ?? 0;
  const voided = q?.counts?.void ?? 0;

  if (!q || !q.firstCommit) {
    const pilotDetail = lastResolvedAt
      ? `Scoring has been paused since our only run, on ${fmtDay(lastResolvedAt)}. That run scored ${pilotCount || 'the'} `
        + `trigger${pilotCount === 1 ? '' : 's'} under a method we’ve since retired, so it’s archived, not counted here. `
      : 'Nothing has been resolved yet. ';
    const tail = q && q.issued > 0
      ? `Since ${fmtDay(q.firstIssuedAt)} each forecast question carries its own probability and a named source; the first weekly sample has not been committed yet.`
      : `Forecasts since ${fmtDay(eraCutFrom)} are logged and waiting for the new method to start scoring them.`;
    return {
      stage: 0,
      label: 'Stage 0 — not yet running',
      headline: 'We don’t have a scored track record yet under the current method.',
      detail: pilotDetail + tail,
    };
  }

  const since = fmtDay(q.firstCommit.committedAt);
  if (resolved < ACCURACY_UNLOCK_AT) {
    return {
      stage: 1,
      label: 'Stage 1 — early',
      headline: `Since ${since} we lock a pre-selected sample each week.`,
      detail: `Probability, rule and deadline are fixed at publication. ${resolved} resolved, ${voided} voided so far — too few to judge `
        + `accuracy (that starts at ${ACCURACY_UNLOCK_AT}).`,
    };
  }

  const firstDrawStart = q.weeks?.find((w) => w.drawn)?.weekStart;
  const sixMonths = firstDrawStart && new Date(now).getTime() - Date.parse(`${firstDrawStart}T00:00:00Z`) >= SIX_MONTHS_MS;
  if (resolved >= STAGE3_AT && sixMonths) {
    return {
      stage: 3,
      label: 'Stage 3 — calibrated',
      headline: `${resolved} questions resolved since ${since}.`,
      detail: 'Enough history to check calibration band by band, not just the overall score.',
    };
  }
  return {
    stage: 2,
    label: 'Stage 2 — scored',
    headline: `${resolved} questions resolved since ${since}.`,
    detail: 'Each verdict was drafted by an agent that was not shown the probability, then confirmed by a person, with a cited source.',
  };
}
