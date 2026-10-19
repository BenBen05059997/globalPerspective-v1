'use strict';
const test = require('node:test');
const assert = require('node:assert');
const dc = require('../src/directionCheck');
const notes = require('./fixtures/realNotes.json');

const get = (country, asOf) => notes.find((n) => n.country === country && n.asOf === asOf);
const ctx = (n) => ({
  axisMovesArr: Object.entries(n.changeDimensions || {}).map(([axis, v]) => ({ axis, from: v.from, to: v.to, delta: v.delta })),
  changeDimensions: n.changeDimensions || undefined,
});
const verdict = (country, asOf) => { const n = get(country, asOf); return dc.checkDrift({ whyChanged: n.whyChanged }, ctx(n)); };

// Real stored notes (SummarizeAndPredict DRIFTLOG#, 2026-09-30). Contradictions must flag ...
test('Iran 2026-08-19 (the operator example): "shifts the humanitarian score down as trade disruption worsens civilian conditions" flags', () => {
  const v = verdict('Iran', '2026-08-19');
  assert.equal(v.ok, false);
  assert.match(v.problems.map((p) => p.clause).join(' '), /humanitarian score down as trade disruption worsens/);
});
test('Iran 2026-07-29: "disrupted economic stability, lowering the economic score" flags', () => {
  assert.equal(verdict('Iran', '2026-07-29').ok, false);
});
test('Iran 2026-07-30: "the humanitarian score down due to increased casualties and instability" flags, the economic-up clause does not', () => {
  const v = verdict('Iran', '2026-07-30');
  assert.equal(v.ok, false);
  assert.ok(v.problems.every((p) => /humanitarian/.test(p.clause)));
});
test('Russia 2026-08-21: "escalates the humanitarian toll, reducing the humanitarian score" flags', () => {
  assert.equal(verdict('Russia', '2026-08-21').ok, false);
});
test('China 2026-08-12: "disrupted logistics ... lowers the economic score" flags', () => {
  assert.equal(verdict('China', '2026-08-12').ok, false);
});
// ... consistent notes and the old false positives must pass.
test('consistent notes pass: Iran 07-28 (de-escalation lowers risk), Iran 08-06 (escalation raises it)', () => {
  assert.equal(verdict('Iran', '2026-07-28').ok, true);
  assert.equal(verdict('Iran', '2026-08-06').ok, true);
});
test('Iran 2026-08-02 "reducing immediate political escalation risk and lowering the political score" passes (reducing an escalation risk is an improvement)', () => {
  assert.equal(verdict('Iran', '2026-08-02').ok, true);
});
test('old false positives pass: Germany 08-04 (Rhine "falling to a record low ... economic score up"), China 08-13', () => {
  assert.equal(verdict('Germany', '2026-08-04').ok, true);
  assert.equal(verdict('China', '2026-08-13').ok, true);
});

test('axisEffects: worsens vs a falling axis (and improves vs a rising one) is a mismatch; unclear and matches pass', () => {
  const moves = [{ axis: 'humanitarian', from: 90, to: 70, delta: -20 }, { axis: 'economic', from: 80, to: 90, delta: 10 }];
  assert.deepEqual(dc.checkAxisEffects({ humanitarian: 'worsens', economic: 'worsens' }, moves), [{ axis: 'humanitarian', said: 'worsens', actual: 'fell' }]);
  assert.deepEqual(dc.checkAxisEffects({ humanitarian: 'improves', economic: 'improves' }, moves), [{ axis: 'economic', said: 'improves', actual: 'rose' }]);
  assert.deepEqual(dc.checkAxisEffects({ humanitarian: 'unclear', economic: 'worsens' }, moves), []);
  assert.deepEqual(dc.checkAxisEffects(undefined, moves), []);
});

test('a clause naming two axes with different directions is judged per axis (no false axis claim)', () => {
  const dims = { conflict: { from: 60, to: 40, delta: -20 }, political: { from: 50, to: 70, delta: 20 } };
  const r = dc.checkAxisClaims('The talks reduce immediate conflict risk and raise political risk as parties posture', dims);
  assert.deepEqual(r, []);
  const bad = dc.checkAxisClaims('The strike raises conflict risk', dims);
  assert.equal(bad.length, 1); assert.equal(bad[0].axis, 'conflict');
});

test('describeProblems + numbersOnlyText are built from the numbers only', () => {
  const drift = { prior: { riskScore: 80 }, current: { riskScore: 70 }, moved: { axisMoves: [{ axis: 'humanitarian', from: 90, to: 70, delta: -20 }] } };
  assert.equal(dc.numbersOnlyText(drift), 'Humanitarian risk fell 20 points (90 to 70). No listed event explains a move in this direction.');
  assert.match(dc.numbersOnlyText({ prior: { riskScore: 60 }, current: { riskScore: 75 }, moved: { axisMoves: [] } }), /Overall risk score rose 15 points \(60 to 75\)/);
  assert.match(dc.describeProblems([{ kind: 'axisEffect', axis: 'economic', said: 'improves', actual: 'rose' }]), /improves the economic axis, but its score rose/);
});
