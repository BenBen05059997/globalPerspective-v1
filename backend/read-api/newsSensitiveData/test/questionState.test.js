'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isoWeekOfDay, questionSampleState, questionOutcomeState, latestVerdictRow } = require('../src/lib');

test('isoWeekOfDay matches the settle Lambda rule', () => {
  assert.equal(isoWeekOfDay('2026-10-05'), '2026-W41');
  assert.equal(isoWeekOfDay('2026-10-11'), '2026-W41');
  assert.equal(isoWeekOfDay('2026-12-31'), '2026-W53');
  assert.equal(isoWeekOfDay('2027-01-04'), '2027-W01');
});

test('sample state: sampled wins; lead outside 7-84 is not eligible; then warm-up / awaiting draw / not sampled', () => {
  const base = { issueDay: '2026-10-06', deadline: '2026-11-06', sampled: false, commitExists: true, drawExists: true };
  assert.equal(questionSampleState({ ...base, sampled: true }), 'sampled');
  assert.equal(questionSampleState({ ...base, deadline: '2026-10-10' }), 'not_eligible');   // 4 days
  assert.equal(questionSampleState({ ...base, deadline: '2027-03-01' }), 'not_eligible');   // > 84 days
  assert.equal(questionSampleState({ ...base, commitExists: false, drawExists: false }), 'warm_up');
  assert.equal(questionSampleState({ ...base, drawExists: false }), 'awaiting_draw');
  assert.equal(questionSampleState(base), 'not_sampled');
});

test('outcome state: only sampled questions have one; past deadline is never "awaiting" and never a miss', () => {
  const today = '2026-11-20';
  assert.equal(questionOutcomeState({ sampled: false, verdictRows: [], deadline: '2026-11-01', today }), null);
  assert.equal(questionOutcomeState({ sampled: true, verdictRows: [], deadline: '2026-12-01', today }), 'awaiting');
  assert.equal(questionOutcomeState({ sampled: true, verdictRows: [], deadline: '2026-11-01', today }), 'past_deadline_unchecked');
  assert.equal(questionOutcomeState({ sampled: true, verdictRows: [{ SK: 'VERDICT', verdict: 'yes' }], deadline: '2026-11-01', today }), 'yes');
  assert.equal(questionOutcomeState({ sampled: true, verdictRows: [{ SK: 'VERDICT', verdict: 'void' }], deadline: '2026-11-01', today }), 'void');
});

test('a correction (VERDICT#2) wins over the first verdict', () => {
  const rows = [{ SK: 'VERDICT', verdict: 'yes' }, { SK: 'VERDICT#2', verdict: 'no' }];
  assert.equal(latestVerdictRow(rows).verdict, 'no');
  assert.equal(questionOutcomeState({ sampled: true, verdictRows: rows, deadline: '2026-11-01', today: '2026-11-20' }), 'no');
});
