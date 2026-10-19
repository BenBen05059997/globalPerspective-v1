'use strict';

// Local logic test for the Analysis Studio metering decision — run with `node --test`.
// Proves the allowance-then-credit lane selection (the atomic credit decrement + the 402 are
// exercised against real DynamoDB in the sandbox round-trip, not here).

const test = require('node:test');
const assert = require('node:assert/strict');
const { decidePayment } = require('../src/lib');

const MONTH = '2026-06';
const ALLOWANCE = 10;

test('member within monthly allowance ⇒ free allowance run, count increments', () => {
  const d = decidePayment({ tier: 'member', analyzeMonth: MONTH, analyzeCount: 3 }, MONTH, ALLOWANCE);
  assert.equal(d.mode, 'allowance');
  assert.equal(d.usedThisMonth, 3);
  assert.equal(d.nextCount, 4);
});

test('member who has used the whole allowance ⇒ spend a credit', () => {
  const d = decidePayment({ tier: 'member', analyzeMonth: MONTH, analyzeCount: ALLOWANCE }, MONTH, ALLOWANCE);
  assert.equal(d.mode, 'credit');
});

test('allowance resets when the stored month is stale (new calendar month)', () => {
  const d = decidePayment({ tier: 'member', analyzeMonth: '2026-05', analyzeCount: ALLOWANCE }, MONTH, ALLOWANCE);
  assert.equal(d.mode, 'allowance'); // last month's count does not carry over
  assert.equal(d.usedThisMonth, 0);
  assert.equal(d.nextCount, 1);
});

test('non-member (any signed-in user) ⇒ always the credit lane, allowance ignored', () => {
  assert.equal(decidePayment({ tier: 'free', analyzeMonth: MONTH, analyzeCount: 0 }, MONTH, ALLOWANCE).mode, 'credit');
  assert.equal(decidePayment({}, MONTH, ALLOWANCE).mode, 'credit');               // brand-new user record
  assert.equal(decidePayment({ tier: undefined }, MONTH, ALLOWANCE).mode, 'credit');
});

test('allowance of 0 ⇒ even a member goes straight to credits', () => {
  assert.equal(decidePayment({ tier: 'member', analyzeMonth: MONTH, analyzeCount: 0 }, MONTH, 0).mode, 'credit');
});
