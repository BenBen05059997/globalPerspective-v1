import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { check } from './check-eligible.mjs';

const require = createRequire(import.meta.url);
const P = require('../../shared/src/questionPool.js');

const row = (topic, sk, leads) => ({
  PK: `PRED#Story ${topic}-1`, SK: sk, topicId: `Story ${topic}-1`, title: `Story ${topic}`, generatedAt: `${sk}T05:00:00.000Z`, threadId: `thread-${topic}`, questionSchema: 1,
  scenarios: [{ triggers: leads.map((l, i) => ({ id: `0-${i}`, text: `t${i}`, deadline: P.addDays(sk, l), question: true, qid: `${topic}-${sk}-${i}` })) }],
});
const factOf = (r) => {
  const forkId = `${r.PK}/${r.SK}`;
  return { kind: 'forecast_drawn', at: r.generatedAt, precision: 'exact', threadId: r.threadId, payload: { forkId, topicId: r.topicId, branches: r.scenarios[0].triggers.map((t) => ({ branchId: `${forkId}/${t.id}`, trigger: t.text, due: t.deadline, question: true, qid: t.qid, resolutionSource: '' })) } };
};
const rows = [row('a', '2026-10-05', [10, 30]), row('b', '2026-10-06', [20]), row('c', '2026-10-08', [40, 50])];
const seedHex = 'ab'.repeat(32);
const pool = P.eligibleQuestions(rows, '2026-W41');
const res = P.draw(seedHex, pool.map((q) => ({ qid: q.qid, clusterKey: q.clusterKey })), 22);
const drawFact = { kind: 'question_draw', payload: { weekId: '2026-W41', K: 22, eligible: res.eligible, seedHex, picked: res.picked.map((p) => ({ qid: p.qid, hash: p.h, clusterKey: p.clusterKey })) } };
const commit = { kind: 'question_commit', payload: { weekId: '2026-W41' } };
const drawRow = { K: 22, eligible: res.eligible, pool: pool.map((q) => ({ q: q.qid, c: q.clusterKey })) };
const days = new Map(['05', '06', '07', '08', '09', '10', '11'].map((d) => [`2026-10-${d}`, 'ok']));

test('check: equal sets and a draw the record reproduces are identical', () => {
  const out = check({ rows, facts: [...rows.map(factOf), commit, drawFact], runs: days, draws: new Map([['2026-W41', drawRow]]), today: '2026-10-20' });
  assert.equal(out.identical, true);
  assert.deepEqual([out.watch.log, out.watch.record, out.weeks[0].log, out.weeks[0].record, out.drawn[0].poolEqual], [5, 5, 5, 5, true]);
  assert.equal(out.weeks[0].runGuard, 'ok');
});

test('check: a forecast missing from the facts, an incomplete day and a pool that is not the stored one are all named; today is not compared', () => {
  const facts = [...rows.slice(0, 2).map(factOf), commit, drawFact];
  const out = check({ rows: [...rows, row('t', '2026-10-20', [30])], facts, runs: new Map([...days].slice(0, 5)), draws: new Map([['2026-W41', drawRow]]), today: '2026-10-20' });
  assert.equal(out.identical, false);
  assert.deepEqual(out.watch.differences.map((d) => [d.qid, d.only]), [['c-2026-10-08-0', 'log'], ['c-2026-10-08-1', 'log']]);
  assert.deepEqual(out.weeks[0].runGuard, { incomplete: ['2026-10-10', '2026-10-11'] });
  assert.equal(out.drawn[0].picksReproduced, false);
});
