'use strict';

// Pure payment-decision helper for the Analysis Studio metering, split out of index.js so it
// can be unit-tested without DynamoDB. index.js requires this; ../test/lib.test.js imports the
// SAME function (no copy → no drift). The actual writes (allowance bump / atomic credit
// decrement) live in index.js — this only decides WHICH lane a run is paid from.

// Returns the funding decision for one run, given the user record, the current month key
// (YYYY-MM), and the member monthly allowance:
//   { mode:'allowance', usedThisMonth, nextCount }  — member within their free monthly allowance
//   { mode:'credit',    usedThisMonth }             — member over allowance OR any non-member;
//                                                      a credit will be spent (availability is
//                                                      enforced atomically at write time)
// Note: 'credit' does not guarantee funds — the conditional decrement may still fail → 402.
function decidePayment(user, monthKey, allowance) {
  const isMember = (user?.tier === 'member');
  const usedThisMonth = user?.analyzeMonth === monthKey ? (Number(user.analyzeCount) || 0) : 0;
  if (isMember && usedThisMonth < allowance) {
    return { mode: 'allowance', usedThisMonth, nextCount: usedThisMonth + 1 };
  }
  return { mode: 'credit', usedThisMonth };
}

module.exports = { decidePayment };
