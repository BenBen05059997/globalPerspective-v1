// trackRecordView — one pure view-model for /track-record and /track-record/text, so both pages
// show the same facts with the same wording. Input: the track-record data of `useTrackRecord`
// (legacy pilot fields + `questions`). Nothing here fetches; `now` is passed in.
import { splitPilot } from '@/features/track-record/lib/pilotExclusion.js';
import { stageWording } from '@/features/track-record/lib/stageWording.js';
import { accuracyProgress } from '@/features/track-record/lib/accuracyLock.js';
import { estimateAccuracyWindow } from '@/features/track-record/lib/accuracyEstimate.js';
import { statusNotes, accuracyNotReady, calibrationNotReady, boardStatus, drawShort, pilotNote } from '@/features/track-record/lib/notReadyCopy.js';

// "better than" only when the 95% interval excludes 0 (the ruling); never a word like strong / weak.
export function skillWords(scoring) {
  if (!scoring || scoring.skill == null) return null;
  if (!scoring.ci) return 'interval not available yet';
  if (scoring.ci.lo > 0) return 'better than a base-rate guess';
  if (scoring.ci.hi < 0) return 'worse than a base-rate guess';
  return 'not distinguishable from a base-rate guess';
}

export function buildTrackRecordView(data, now = new Date()) {
  const recent = data?.recent || [];
  const { pilot } = splitPilot(recent);
  const pilotCount = Math.max(pilot.length, data?.resolvedTriggers ?? 0);
  const lastResolvedAt = recent.reduce((max, r) => (r.confirmedAt && (!max || r.confirmedAt > max) ? r.confirmedAt : max), null);
  const q = data?.questions || null;
  const K = q?.method?.K ?? 22;

  const stage = stageWording({ questions: q, lastResolvedAt, eraCutFrom: data?.eraCutFrom, pilotCount, now });
  const resolved = q?.counts?.resolved ?? 0;
  const lock = accuracyProgress(resolved);
  const est150 = q ? estimateAccuracyWindow({ sampled: q.sampled, weeks: q.weeks, target: 150, now, plannedK: K }) : null;
  const est400 = q ? estimateAccuracyWindow({ sampled: q.sampled, weeks: q.weeks, target: 400, now, plannedK: K }) : null;

  const method = { K, leadDays: q?.method?.leadDays ?? [7, 90], graceDays: q?.method?.graceDays ?? 3 };
  const counts = q?.counts || { locked: 0, resolved: 0, yes: 0, no: 0, void: 0, awaiting: 0, pastDeadlineUnchecked: 0 };

  return {
    q, stage, method, lock, pilotCount, lastResolvedAt, pilot,
    notes: statusNotes(q, now),
    accuracyText: lock.locked ? accuracyNotReady(q, est150) : null,
    scoring: !lock.locked ? q?.scoring || null : null,
    skillWords: !lock.locked ? skillWords(q?.scoring) : null,
    calibrationText: stage.stage < 3 ? calibrationNotReady(q, est400, now) : null,
    boardItems: q?.sampled || [],
    boardText: boardStatus(q, now),
    drawNotes: (q?.weeks || []).map((w) => drawShort(w, K)).filter(Boolean),
    pilotLine: pilotNote(lastResolvedAt, pilotCount),
    counts,
    // The same split on both pages: tiles on the page, list items on the text version.
    countRows: [
      [counts.locked, 'Questions locked in samples'],
      [counts.resolved, `Resolved (${counts.yes} happened, ${counts.no} not reported)`],
      [counts.void, 'Could not be checked (void)'],
      ...(typeof counts.voidRecordGap === 'number' ? [[counts.voidRecordGap, 'Void — gap in our record']] : []),
      [counts.awaiting, 'Open, deadline still ahead'],
      [counts.pastDeadlineUnchecked, 'Awaiting check, deadline passed'],
      [pilotCount, 'July pilot (archived; method flawed)'],
    ],
  };
}
