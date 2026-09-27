// stageWording — the public status line, staged 0-3 per TRACK_RECORD_AND_STUDIO_RULING.md
// ("Public wording by stage"). Every number/date here comes from the caller's real data
// (postPilotResolved, lastResolvedAt, eraCutFrom) — this module never invents a count or a date.
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
import { ACCURACY_UNLOCK_AT } from '@/features/track-record/lib/accuracyLock.js';

const STAGE2_AT = 150; // same threshold as the accuracy lock (ruling: stage 2 begins at 150)
const STAGE3_AT = 400;

/**
 * @param {object} args
 * @param {number} args.postPilotResolved - resolved triggers AFTER excluding the July pilot
 * @param {string|null} args.lastResolvedAt - ISO timestamp of the most recent resolution (any era)
 * @param {string} args.eraCutFrom - 'YYYY-MM-DD' the current (still-unscored) method starts from
 * @param {number} args.pilotCount - size of the archived pilot (for the stage-0 detail line)
 */
export function stageWording({ postPilotResolved = 0, lastResolvedAt = null, eraCutFrom, pilotCount = 0 }) {
  const n = Math.max(0, Number(postPilotResolved) || 0);

  if (n === 0) {
    return {
      stage: 0,
      label: 'Stage 0 — not yet running',
      headline: 'We don’t have a scored track record yet under the current method.',
      detail: lastResolvedAt
        ? `Scoring has been paused since our only run, on ${fmtDay(lastResolvedAt)}. That run scored ${pilotCount || 'the'} `
          + `trigger${pilotCount === 1 ? '' : 's'} under a method we’ve since retired, so it’s archived, not counted here. `
          + `Forecasts since ${fmtDay(eraCutFrom)} are logged and waiting for the new method to start scoring them.`
        : `Forecasts since ${fmtDay(eraCutFrom)} are logged and waiting for the new method to start scoring them. `
          + `Nothing has been resolved yet.`,
    };
  }

  if (n < STAGE2_AT) {
    return {
      stage: 1,
      label: 'Stage 1 — early',
      headline: `Since ${fmtDay(eraCutFrom)} we lock a pre-selected sample each week.`,
      detail: `Probability, rule and deadline are fixed at publication. ${n} resolved so far — too few to judge `
        + `accuracy (that starts at ${ACCURACY_UNLOCK_AT}).`,
    };
  }

  if (n < STAGE3_AT) {
    return {
      stage: 2,
      label: 'Stage 2 — scored',
      headline: `${n} questions resolved since ${fmtDay(eraCutFrom)}.`,
      detail: 'Resolved by a human with cited sources, blind to the stated probability.',
    };
  }

  return {
    stage: 3,
    label: 'Stage 3 — calibrated',
    headline: `${n} questions resolved since ${fmtDay(eraCutFrom)}.`,
    detail: 'Enough history to check calibration bin by bin, not just the overall score.',
  };
}
