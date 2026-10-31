'use strict';

// Dead-man's alarm for the weekly prediction settle flow (Batch 4 phase C). Pure: no network, no
// SNS, no clock. The monitor feeds it the `questions` block of `prediction_track_record` (SETTLE_SOURCE=action), or the record's track-record view,
// manifest and the resolver's heartbeat put together by settleFromRecord (SETTLE_SOURCE=record, decision 0052).
// Every condition needs something to have been committed first, so nothing can fire during the
// warm-up (before the first seed commitment exists) and an empty board is silent.

const { forecastHref, absoluteUrl } = require('./_shared/links');

const OVERDUE_DAYS = 10;     // due + 3-day grace, then this many more days without a verdict
const STALE_BOARD_HOURS = 6;  // the aggregate is rebuilt every 30 minutes
const STALE_VIEWS_HOURS = 9;  // the record's views are rebuilt after every ingest and nightly: at most 8 hours apart (the pages' rule, viewsFresh.js)
const TICK_STALE_DAYS = 3;
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
  const staleHours = questions.staleAfterHours || STALE_BOARD_HOURS;
  if (questions.builtAt && Number.isFinite(Date.parse(questions.builtAt)) && Date.parse(nowIso) - Date.parse(questions.builtAt) > staleHours * 3600 * 1000) {
    reasons.push({ code: 'board_stale', text: `The settling board was last built at ${questions.builtAt} (${questions.builder || 'newsPredictionsSnapshot'} should rebuild it at least every ${staleHours} hours).` });
  }
  return { alert: reasons.length > 0, reasons };
}

/**
 * The `questions` block evaluateSettle reads, from the record (decision 0052): `view` = record/views/track-record.json, `manifest` = record/views/manifest.json,
 * `heartbeat` = record/views/health/settle-tick.json (the resolver's, `{at}`) or null. The view carries the facts' half of settleHealth; the daily tick is the
 * heartbeat's: stale when the last tick (else the first commitment) is over TICK_STALE_DAYS old, the board's rule. Null when the view has no question block.
 */
function settleFromRecord({ view, manifest, heartbeat }, nowIso) {
  const q = view && view.questions;
  if (!q || !q.settleHealth) return null;
  const lastTickAt = (heartbeat && heartbeat.at) || null;
  const first = q.firstCommit && Date.parse(q.firstCommit.committedAt);
  const since = lastTickAt ? Date.parse(lastTickAt) : first;
  const tickStale = Boolean(q.firstCommit) && Number.isFinite(since) && Date.parse(nowIso) > since + TICK_STALE_DAYS * 86400000;
  return {
    builtAt: (manifest && manifest.builtAt) || null, staleAfterHours: STALE_VIEWS_HOURS, builder: 'newsStoryRecord',
    counts: q.counts, settleHealth: { ...q.settleHealth, tickStale, lastTickAt },
  };
}

const shouldSendNow = (nowIso) => new Date(nowIso).getUTCHours() === SEND_HOUR_UTC;

function buildMessage(evaluation, questions, { siteUrl, nowIso } = {}) {
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
    '- See what is due or settled:  node predictions/settle-correct.js --list  (the resolver writes verdicts itself; dispute one with --correct <qid> <yes|no|void> "<reason>")',
    '- If the draw, commitment or tick is missing: check the newsPredictionResolver logs and rule TriggerPredictionResolver (ENABLED?), then run {"action":"tick"} once.',
    '',
    `Public page: ${absoluteUrl(forecastHref(), siteUrl)}`,
    `Checked: ${nowIso || new Date().toISOString()}`,
  ];
  return { subject: '[GP] Prediction settling overdue', body: lines.join('\n') };
}

module.exports = { evaluateSettle, settleFromRecord, shouldSendNow, buildMessage, OVERDUE_DAYS, STALE_BOARD_HOURS, STALE_VIEWS_HOURS, TICK_STALE_DAYS, SEND_HOUR_UTC };
