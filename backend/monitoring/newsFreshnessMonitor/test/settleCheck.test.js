'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSettle, shouldSendNow, buildMessage } = require('../src/settleCheck');

const quiet = {
  builtAt: '2026-10-27T12:10:00Z', counts: { locked: 3, resolved: 1, void: 1, awaiting: 1, pastDeadlineUnchecked: 0 },
  settleHealth: { drawMissed: false, expectedDrawWeek: null, commitMissing: false, tickStale: false, lastTickAt: '2026-10-27T10:30:00Z', dueUnsettled: 0, oldestDueUnsettledDays: null },
};
const NOW = '2026-10-27T12:30:00Z';
const withH = (h, extra = {}) => ({ ...quiet, ...extra, settleHealth: { ...quiet.settleHealth, ...h } });

test('silent: no board, an empty board (warm-up: nothing committed), and a healthy board', () => {
  assert.equal(evaluateSettle(null, NOW).alert, false);
  assert.equal(evaluateSettle(undefined, NOW).alert, false);
  const warmUp = { builtAt: NOW, counts: { locked: 0 }, settleHealth: { drawMissed: false, commitMissing: false, tickStale: false, lastTickAt: null, dueUnsettled: 0, oldestDueUnsettledDays: null } };
  assert.equal(evaluateSettle(warmUp, NOW).alert, false);
  assert.equal(evaluateSettle(quiet, NOW).alert, false);
});

test('each condition alerts on its own', () => {
  assert.deepEqual(evaluateSettle(withH({ drawMissed: true, expectedDrawWeek: '2026-W41' }), NOW).reasons.map((r) => r.code), ['draw_missed']);
  assert.deepEqual(evaluateSettle(withH({ commitMissing: true }), NOW).reasons.map((r) => r.code), ['commit_missing']);
  assert.deepEqual(evaluateSettle(withH({ tickStale: true }), NOW).reasons.map((r) => r.code), ['tick_stale']);
  assert.deepEqual(evaluateSettle(withH({ dueUnsettled: 4, oldestDueUnsettledDays: 11 }), NOW).reasons.map((r) => r.code), ['verdicts_overdue']);
  assert.deepEqual(evaluateSettle(withH({}, { builtAt: '2026-10-27T05:00:00Z' }), NOW).reasons.map((r) => r.code), ['board_stale']);
});

test('overdue verdicts need more than 10 days; exactly 10 is still quiet', () => {
  assert.equal(evaluateSettle(withH({ dueUnsettled: 2, oldestDueUnsettledDays: 10 }), NOW).alert, false);
  assert.equal(evaluateSettle(withH({ dueUnsettled: 2, oldestDueUnsettledDays: 11 }), NOW).alert, true);
});

test('only the 12:30 UTC run sends (the monitor runs at :30 of every even hour)', () => {
  const sends = [];
  for (let h = 0; h < 24; h += 2) if (shouldSendNow(`2026-10-27T${String(h).padStart(2, '0')}:30:00Z`)) sends.push(h);
  assert.deepEqual(sends, [12]);
});

test('the message names what is wrong, the board counts and what to do; no secrets, no invented numbers', () => {
  const q = withH({ drawMissed: true, expectedDrawWeek: '2026-W41', dueUnsettled: 5, oldestDueUnsettledDays: 14 });
  const ev = evaluateSettle(q, NOW);
  const m = buildMessage(ev, q, { nowIso: NOW });
  assert.equal(m.subject, '[GP] Prediction settling overdue');
  assert.match(m.body, /weekly draw for 2026-W41 was not written/);
  assert.match(m.body, /5 sampled questions are past deadline \+ 3 days/);
  assert.match(m.body, /the oldest has waited 14 days/);
  assert.match(m.body, /3 sampled, 1 resolved, 1 void, 1 awaiting, 0 past deadline/);
  assert.match(m.body, /settle-review\.js/);
  assert.ok(m.subject.length <= 100);
});
