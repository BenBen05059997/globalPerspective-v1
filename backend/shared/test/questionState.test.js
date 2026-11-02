'use strict';
// questionState.js: where a forecast question stands in the weekly sample (sampleState) and in its outcome (outcomeState), and the ISO week
// of a day. The record views call these; newsStoryRecord/test/questionState.test.js pins them to the read API's copy.
const test = require('node:test');
const assert = require('node:assert/strict');
const { LEAD_MIN, LEAD_MAX, isoWeekOfDay, sampleState, outcomeState } = require('../src/questionState');
const pool = require('../src/questionPool');

test('the lead window is the one questionPool defines (7 to 90 days)', () => {
  assert.equal(LEAD_MIN, pool.LEAD_MIN);
  assert.equal(LEAD_MAX, pool.LEAD_MAX);
  assert.deepEqual([LEAD_MIN, LEAD_MAX], [7, 90]);
});

test('isoWeekOfDay: the documented example and the Monday/Sunday edges of a week', () => {
  assert.equal(isoWeekOfDay('2026-10-05'), '2026-W41');
  assert.equal(isoWeekOfDay('2026-10-11'), '2026-W41'); // Sunday closes the week
  assert.equal(isoWeekOfDay('2026-10-12'), '2026-W42');
  assert.equal(isoWeekOfDay('2026-10-05T23:59:59Z'), '2026-W41'); // a timestamp is read as its day
});

test('isoWeekOfDay: year boundaries follow ISO 8601 (a week belongs to the year of its Thursday), week ids are two digits', () => {
  assert.equal(isoWeekOfDay('2026-01-01'), '2026-W01'); // Thursday
  assert.equal(isoWeekOfDay('2025-12-29'), '2026-W01'); // Monday of that week, still December
  assert.equal(isoWeekOfDay('2024-12-30'), '2025-W01');
  assert.equal(isoWeekOfDay('2027-01-01'), '2026-W53'); // Friday, a 53-week year
  assert.equal(isoWeekOfDay('2026-12-31'), '2026-W53');
  assert.match(isoWeekOfDay('2026-01-05'), /^\d{4}-W02$/);
});

test('isoWeekOfDay is the inverse of questionPool.weekStart/weekEnd for every day of a year', () => {
  for (let i = 0; i < 366; i += 1) {
    const d = pool.addDays('2026-01-01', i);
    const w = isoWeekOfDay(d);
    assert.ok(d >= pool.weekStart(w) && d <= pool.weekEnd(w), `${d} -> ${w}`);
  }
});

const base = { issueDay: '2026-10-05', deadline: '2026-10-20', sampled: false, commitExists: true, drawExists: true };

test('sampleState: a sampled question is sampled whatever else is true, even with an out-of-window lead', () => {
  assert.equal(sampleState({ ...base, sampled: true }), 'sampled');
  assert.equal(sampleState({ ...base, sampled: true, deadline: '2026-10-06', commitExists: false, drawExists: false }), 'sampled');
});

test('sampleState: the lead must be 7 to 90 days inclusive, else not_eligible', () => {
  const at = (deadline) => sampleState({ ...base, deadline });
  assert.equal(at('2026-10-11'), 'not_eligible'); // 6 days
  assert.equal(at('2026-10-12'), 'not_sampled'); // 7 days
  assert.equal(at('2027-01-03'), 'not_sampled'); // 90 days
  assert.equal(at('2027-01-04'), 'not_eligible'); // 91 days
  assert.equal(at('2026-10-05'), 'not_eligible'); // due the day it was issued
  assert.equal(at('2026-09-30'), 'not_eligible'); // deadline before the issue day
});

test('sampleState: an eligible question waits for the week\'s commit (warm_up), then for its draw (awaiting_draw), else was not drawn', () => {
  assert.equal(sampleState({ ...base, commitExists: false, drawExists: false }), 'warm_up');
  assert.equal(sampleState({ ...base, commitExists: false, drawExists: true }), 'warm_up'); // no commit wins over a draw
  assert.equal(sampleState({ ...base, commitExists: true, drawExists: false }), 'awaiting_draw');
  assert.equal(sampleState({ ...base, commitExists: true, drawExists: true }), 'not_sampled');
});

test('sampleState: an ineligible lead is reported before warm-up, so an out-of-window question never says it is waiting', () => {
  assert.equal(sampleState({ ...base, deadline: '2026-10-08', commitExists: false, drawExists: false }), 'not_eligible');
});

test('sampleState: issue and deadline given as timestamps use their days', () => {
  assert.equal(sampleState({ ...base, issueDay: '2026-10-05T22:00:00Z', deadline: '2026-10-12T01:00:00Z' }), 'not_sampled');
});

test('outcomeState: null for a question that was not sampled, whatever else it carries', () => {
  assert.equal(outcomeState({ sampled: false, result: 'yes', deadline: '2026-10-01', today: '2026-10-30' }), null);
  assert.equal(outcomeState({ sampled: undefined, result: null, deadline: '2026-10-01', today: '2026-10-30' }), null);
});

test('outcomeState: a decided question is yes, no or void; any other result text is void', () => {
  const o = (result) => outcomeState({ sampled: true, result, deadline: '2026-10-20', today: '2026-10-10' });
  assert.equal(o('yes'), 'yes');
  assert.equal(o('no'), 'no');
  assert.equal(o('void'), 'void');
  assert.equal(o('unresolvable'), 'void');
  assert.equal(outcomeState({ sampled: true, result: 'yes', deadline: '2026-10-20', today: '2026-12-01' }), 'yes'); // a verdict beats the calendar
});

test('outcomeState: undecided is awaiting until the deadline day has passed, then past_deadline_unchecked; the deadline day itself is still awaiting', () => {
  const o = (deadline, today, result = null) => outcomeState({ sampled: true, result, deadline, today });
  assert.equal(o('2026-10-20', '2026-10-19'), 'awaiting');
  assert.equal(o('2026-10-20', '2026-10-20'), 'awaiting');
  assert.equal(o('2026-10-20', '2026-10-21'), 'past_deadline_unchecked');
  assert.equal(o('2026-10-20T23:00:00Z', '2026-10-20T01:00:00Z'), 'awaiting'); // only the day is compared
  assert.equal(o('2026-10-20', '2026-10-21T00:00:01Z'), 'past_deadline_unchecked');
  assert.equal(o('2026-10-20', '2026-10-21', ''), 'past_deadline_unchecked'); // an empty result is not a verdict
});
