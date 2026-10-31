'use strict';

// Where a forecast question stands in the weekly sample and in its outcome (decision 0043). The one implementation the record
// views use; pure, no I/O. Ported rule for rule from the read API's prediction_snapshot (read-api/newsSensitiveData/src/lib.js
// questionSampleState / questionOutcomeState / isoWeekOfDay); that copy stays until the read API is retired, and
// newsStoryRecord/test/questionState.test.js pins the two to the same answers.
const ms = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);

// the eligibility window of the snapshot, in days from the issue day to the deadline
const LEAD_MIN = 7;
const LEAD_MAX = 90;

/** ISO week id of a YYYY-MM-DD day, e.g. 2026-10-05 -> "2026-W41" (same rule as the resolver's lib.weekOf). */
function isoWeekOfDay(d) {
  const t = new Date(ms(d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - y0) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}

/** sampled | not_eligible | warm_up | awaiting_draw | not_sampled. `commitExists` / `drawExists`: the issue week's commit and draw are on record. */
function sampleState({issueDay, deadline, sampled, commitExists, drawExists}) {
  if (sampled) return 'sampled';
  const lead = daysBetween(issueDay, deadline);
  if (lead < LEAD_MIN || lead > LEAD_MAX) return 'not_eligible';
  if (!commitExists) return 'warm_up';
  if (!drawExists) return 'awaiting_draw';
  return 'not_sampled';
}

/** yes | no | void once decided (`result` = the latest verdict's result, or null); else awaiting | past_deadline_unchecked. null for a question that was not sampled. */
function outcomeState({sampled, result, deadline, today}) {
  if (!sampled) return null;
  if (result) return result === 'yes' ? 'yes' : result === 'no' ? 'no' : 'void';
  return String(deadline).slice(0, 10) < String(today).slice(0, 10) ? 'past_deadline_unchecked' : 'awaiting';
}

module.exports = {LEAD_MIN, LEAD_MAX, isoWeekOfDay, sampleState, outcomeState};
