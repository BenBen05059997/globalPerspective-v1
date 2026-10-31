'use strict';
// The weekly pool and draw rules shared by the resolver and the record's track-record view (decisions 0038, 0045, 0052).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/questionPool');

const SEED = 'cd'.repeat(32);
const WEEK = '2026-W41'; // 2026-10-05 .. 2026-10-11
// a PRED# row with one question per entry of `leads` (days from the issue day to the deadline)
const row = (topic, sk, leads, thread = `thread-${topic}`) => ({
  PK: `PRED#${topic}`, SK: sk, topicId: topic, title: topic, generatedAt: `${sk}T05:00:00.000Z`, threadId: thread,
  scenarios: [{ triggers: leads.map((l, i) => ({ id: `0-${i}`, text: `t${i}`, deadline: P.addDays(sk, l), question: true, qid: `${topic}-${sk}-${i}`, resolutionSource: 'src' })) }],
});
const rows = [row('a', '2026-10-05', [7, 30, 84]), row('b', '2026-10-06', [6, 90]), row('c', '2026-10-07', [85, 91]), row('d', '2026-10-12', [30])];

test('eligibility: issued in the week, lead 7..90 (84 under the old window), one entry per qid', () => {
  assert.deepEqual(P.eligibleQuestions(rows, WEEK).map((q) => q.qid), ['a-2026-10-05-0', 'a-2026-10-05-1', 'a-2026-10-05-2', 'b-2026-10-06-1', 'c-2026-10-07-0']);
  assert.deepEqual(P.eligibleQuestions(rows, WEEK, { leadMax: P.LEGACY_LEAD_MAX }).map((q) => q.qid), ['a-2026-10-05-0', 'a-2026-10-05-1', 'a-2026-10-05-2']);
  assert.equal(P.eligibleQuestions([...rows, rows[0]], WEEK).length, 5, 'a repeated row adds nothing');
});

test('poolOfDraw rebuilds the pool a draw used, under the window that reproduces it, and refuses one that does not', () => {
  const draws = {};
  for (const leadMax of [P.LEAD_MAX, P.LEGACY_LEAD_MAX]) {
    const pool = P.eligibleQuestions(rows, WEEK, { leadMax });
    const res = P.draw(SEED, pool.map((q) => ({ qid: q.qid, clusterKey: q.clusterKey })), 22);
    draws[leadMax] = { eligible: res.eligible, seedHex: SEED, K: 22, picked: res.picked.map((p) => ({ qid: p.qid, hash: p.h, clusterKey: p.clusterKey })) };
  }
  const now = P.poolOfDraw(rows, WEEK, draws[90]);
  assert.deepEqual([now.leadMax, now.pool.length], [90, 5]);
  const old = P.poolOfDraw(rows, WEEK, draws[84]);
  assert.deepEqual([old.leadMax, old.pool.length], [84, 3]);
  assert.equal(P.poolOfDraw(rows.slice(1), WEEK, draws[90]), null, 'a forecast missing from the rows: the draw cannot be reproduced');
  assert.equal(P.poolOfDraw(rows, WEEK, { ...draws[90], seedHex: 'ee'.repeat(32) }), null, 'the wrong seed');
  const moved = { ...draws[90], picked: draws[90].picked.map((p, i) => (i === 0 ? { ...p, clusterKey: 'thread-else' } : p)) };
  assert.equal(P.poolOfDraw(rows, WEEK, moved), null, 'a pick under another story key does not verify in the browser');
  assert.equal(P.poolOfDraw(rows, WEEK, moved, { exactClusters: false }).pool.length, 5, 'unless only the key is compared away');
});

test('rowOfFact: a forecast fact stands in for its PRED# row (title from the topic id, question triggers only)', () => {
  const forkId = 'PRED#Some story-3/2026-10-05';
  const fact = {
    kind: 'forecast_drawn', at: '2026-10-05T05:00:00.000Z', precision: 'exact', threadId: 'thread-x',
    payload: { forkId, topicId: 'Some story-3', branches: [{ branchId: `${forkId}/0-0`, trigger: 'T', due: '2026-11-05', question: true, qid: 'q1', resolutionSource: '' }, { branchId: `${forkId}/1-0`, trigger: 'old', due: '2026-11-05' }] },
  };
  const r = P.rowOfFact(fact);
  assert.deepEqual([r.PK, r.SK, r.title, r.threadId, r.generatedAt], ['PRED#Some story-3', '2026-10-05', 'Some story', 'thread-x', fact.at]);
  assert.deepEqual(r.scenarios[0].triggers, [{ id: '0-0', text: 'T', deadline: '2026-11-05', question: true, qid: 'q1', resolutionSource: null }]);
  assert.equal(P.rowOfFact({ ...fact, payload: { ...fact.payload, branches: [fact.payload.branches[1]] } }), null);
  assert.equal(P.rowOfFact({ kind: 'entry' }), null);
});
