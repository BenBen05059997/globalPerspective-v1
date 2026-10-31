'use strict';

// The forecasts inbox (decision 0052): record/inbox/forecasts/YYYY-MM-DD.jsonl. The agent (NewsProjectInvokeAgentLambda) appends one line for each
// forecast it logs, in place of the PredictionLog `PRED#<topicId>` / `<day>` row the record reads today, so the record needs no `PRED#` row.
// This file is the one place that knows the line format and the replay rule; the agent writes with it and newsStoryRecord reads with it.
// Pure, no deps, no clock.
//
// Two kinds of line (day = the row's SK, the UTC day the forecast was drawn):
//   drawn   `{type:'drawn', inboxId, day, row}`: `row` is the PRED# item exactly as the agent put it (put-once: the first forecast of a topic and day
//           stands, a later one writes no line). Its threadId is the one the forecaster assigned.
//   thread  `{type:'thread', inboxId, day, PK, SK, threadId, was, at}`: the reconcile after the archive write (the archive entry's threadId is final,
//           so the row follows it). The agent's DynamoDB update is `SET threadId = :t, drawnThreadId = if_not_exists(drawnThreadId, :old)`.
// Replay rule (last wins): per row key (PK|SK), the first `drawn` line is the row; each `thread` line after it, in file order, sets threadId to its
// value and drawnThreadId to `was` unless the row already has one. A `thread` line with no `drawn` line is an orphan (counted, not applied).
// Replaying a day's lines therefore gives exactly the rows the PredictionLog holds for that day.

const DRAWN = 'drawn';
const THREAD = 'thread';

const keyOf = (pk, sk) => `${pk}|${sk}`;
// what DynamoDB stored and what JSON keeps: undefined and functions dropped
const plain = (o) => JSON.parse(JSON.stringify(o));

/** The inbox line of a logged forecast: `row` is the item as put. */
function drawnLine(row) {
  if (!row || typeof row.PK !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.SK))) throw new Error('forecastsInbox: a forecast row needs PK and a day SK');
  return { type: DRAWN, inboxId: `${keyOf(row.PK, row.SK)}|${DRAWN}`, day: row.SK, row: plain(row) };
}

/** The inbox line of a reconcile: the row `PK`/`SK` (as read, with `was` = its threadId then, 'none' when it had none) now has `threadId`; `at` = ISO time of the update. */
function threadLine({ PK, SK, threadId, was, at }) {
  if (!PK || !SK || !threadId || !at) throw new Error('forecastsInbox: a thread line needs PK, SK, threadId and at');
  return { type: THREAD, inboxId: `${keyOf(PK, SK)}|${THREAD}|${at}`, day: SK, PK, SK, threadId: String(threadId), was: was || 'none', at };
}

/** The rows of the given lines (any days, file order): { rows: [row, ...] in the order their drawn lines came, orphans: n }. */
function replay(lines) {
  const rows = new Map();
  let orphans = 0;
  for (const l of lines || []) {
    if (!l || typeof l !== 'object') continue;
    if (l.type === DRAWN && l.row) {
      const k = keyOf(l.row.PK, l.row.SK);
      if (!rows.has(k)) rows.set(k, plain(l.row));
    } else if (l.type === THREAD) {
      const row = rows.get(keyOf(l.PK, l.SK));
      if (!row) { orphans += 1; continue; }
      row.threadId = l.threadId;
      if (row.drawnThreadId === undefined) row.drawnThreadId = l.was;
    }
  }
  return { rows: [...rows.values()], orphans };
}

module.exports = { DRAWN, THREAD, drawnLine, threadLine, replay };
