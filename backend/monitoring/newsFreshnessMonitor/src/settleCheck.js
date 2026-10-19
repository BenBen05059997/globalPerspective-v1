'use strict';

// Dead-man's alarm for the weekly prediction settle flow (Batch 4 phase C). Pure: no network, no
// SNS, no clock. The monitor feeds it the public `questions` block of `prediction_track_record`.
// Every condition needs something to have been committed first, so nothing can fire during the
// warm-up (before the first seed commitment exists) and an empty board is silent.

const OVERDUE_DAYS = 10;      // due + 3-day grace, then this many more days without a verdict
const STALE_BOARD_HOURS = 6;  // the aggregate is rebuilt every 30 minutes
const SEND_HOUR_UTC = 12;     // the monitor runs at :30 of every even hour; only the 12:30 run sends

function evaluateSettle(questions, nowIso) {
  if (!questions || !questions.settleHealth) return { alert: false, reasons: [], note: 'no question board yet' };
  const h = questions.settleHealth;
  const reasons = [];
  if (h.drawMissed) reasons.push({ code: 'draw_missed', text: `The weekly draw for ${h.expectedDrawWeek || 'an ended week'} was not written (it is due by Tuesday 12:00 UTC).` });
  if (h.commitMissing) reasons.push({ code: 'commit_missing', text: 'The seed commitment for next week is missing, so the pre-registered sample cannot be published before that week starts.' });
  if (h.tickStale) reasons.push({ code: 'tick_stale', text: `The daily settle tick has not run since ${h.lastTickAt || 'the first commitment'} (more than 3 days).` });
  if (h.dueUnsettled > 0 && h.oldestDueUnsettledDays > OVERDUE_DAYS) {
    reasons.push({ code: 'verdicts_overdue', text: `${h.dueUnsettled} sampled question${h.dueUnsettled === 1 ? ' is' : 's are'} past deadline + 3 days with no confirmed verdict; the oldest has waited ${h.oldestDueUnsettledDays} days.` });
  }
  if (questions.builtAt && Number.isFinite(Date.parse(questions.builtAt)) && Date.parse(nowIso) - Date.parse(questions.builtAt) > STALE_BOARD_HOURS * 3600 * 1000) {
    reasons.push({ code: 'board_stale', text: `The settling board was last built at ${questions.builtAt} (newsPredictionsSnapshot should rebuild it every 30 minutes).` });
  }
  return { alert: reasons.length > 0, reasons };
}

const shouldSendNow = (nowIso) => new Date(nowIso).getUTCHours() === SEND_HOUR_UTC;

function buildMessage(evaluation, questions, { siteUrl = 'https://globalperspective.net', nowIso } = {}) {
  const c = (questions && questions.counts) || {};
  const lines = [
    'The weekly forecast-settling flow needs attention. This message is sent at most once a day.',
    '',
    'What is wrong:',
    ...evaluation.reasons.map((r) => `- ${r.text}`),
    '',
    `Board: ${c.locked ?? 0} sampled, ${c.resolved ?? 0} resolved, ${c.void ?? 0} void, ${c.awaiting ?? 0} awaiting, ${c.pastDeadlineUnchecked ?? 0} past deadline and not checked.`,
    '',
    'What to do:',
    '- Confirm drafted verdicts:  node predictions/settle-review.js --list   then   node predictions/settle-review.js',
    '- If the draw, commitment or tick is missing: check the newsPredictionResolver logs and rule TriggerPredictionResolver (ENABLED?), then run {"action":"tick"} once.',
    '',
    `Public page: ${siteUrl}/track-record`,
    `Checked: ${nowIso || new Date().toISOString()}`,
  ];
  return { subject: '[GP] Prediction settling overdue', body: lines.join('\n') };
}

module.exports = { evaluateSettle, shouldSendNow, buildMessage, OVERDUE_DAYS, STALE_BOARD_HOURS, SEND_HOUR_UTC };
