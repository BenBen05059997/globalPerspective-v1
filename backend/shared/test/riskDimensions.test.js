'use strict';
// riskDimensions.js is also read by the severity grading tools in quality/ (AXES, tierFromScore): pin what they rely on.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/riskDimensions');

test('AXES: the four axes in the order the gold set and the grader list them', () => {
  assert.deepEqual(R.AXES, ['conflict', 'political', 'economic', 'humanitarian']);
});
test('tierFromScore: 25 / 50 / 75 edges, null for a missing score', () => {
  const cases = [[null, null], [undefined, null], [0, 'low'], [24.9, 'low'], [25, 'moderate'], [49, 'moderate'], [50, 'elevated'], [74, 'elevated'], [75, 'high'], [100, 'high']];
  for (const [score, tier] of cases) assert.equal(R.tierFromScore(score), tier, String(score));
});
test('deriveRisk: the worst axis leads, an unscored vector is all null', () => {
  const d = R.normalizeDimensions({ conflict: 40, political: { score: 80, why: 'x' }, economic: null });
  assert.deepEqual(R.deriveRisk(d), { riskScore: 80, riskLevel: 'high', lead: 'political' });
  assert.deepEqual(R.deriveRisk(R.normalizeDimensions({})), { riskScore: null, riskLevel: null, lead: null });
});
