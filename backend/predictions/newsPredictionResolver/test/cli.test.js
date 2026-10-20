'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const lib = require('../src/lib');
const cli = require('../../../../predictions/settle-correct.js');

const root = path.join(__dirname, '../../../../predictions');

test('settle-correct: due = sampled, past deadline, no verdict; settled = latest verdict this week', () => {
  const rows = [
    { PK: 'Q#a', SK: 'SAMPLED', deadline: '2026-11-10', question: 'A' },
    { PK: 'Q#a', SK: 'DRAFT#2026-11-11T10:00:00Z', verdict: 'not_yet' },
    { PK: 'Q#b', SK: 'SAMPLED', deadline: '2026-11-05', question: 'B' },
    { PK: 'Q#c', SK: 'SAMPLED', deadline: '2026-11-01', question: 'C' },
    { PK: 'Q#c', SK: 'VERDICT', verdict: 'no', decidedAt: '2026-11-18T10:00:00Z', confirmedBy: 'resolver' },
    { PK: 'Q#c', SK: 'VERDICT#2', verdict: 'yes', decidedAt: '2026-11-19T10:00:00Z', confirmedBy: 'operator', reason: 'r' },
    { PK: 'Q#c', SK: 'VERDICT#10', verdict: 'void', decidedAt: '2026-11-19T11:00:00Z', confirmedBy: 'operator', reason: 'r' },
    { PK: 'Q#d', SK: 'SAMPLED', deadline: '2026-12-31' },
    { PK: 'Q#e', SK: 'SAMPLED', deadline: '2026-10-01' },
    { PK: 'Q#e', SK: 'VERDICT', verdict: 'yes', decidedAt: '2026-10-05T10:00:00Z' },
  ];
  const l = cli.listing(cli.group(rows), '2026-11-20');
  assert.deepEqual(l.due.map((g) => g.qid), ['b', 'a']);
  assert.deepEqual(l.settled.map((x) => x.g.qid), ['c']);
  assert.equal(l.settled[0].v.SK, 'VERDICT#10'); // highest n wins, numerically
});

test('settle-correct builds the Lambda payload and rejects bad input', () => {
  assert.deepEqual(cli.correctionPayload(['--correct', 'q1', 'no', 'source was wrong']), { action: 'correct', qid: 'q1', verdict: 'no', reason: 'source was wrong' });
  assert.deepEqual(cli.correctionPayload(['--correct', 'q1', 'yes', 'why', '--url', 'https://x', '--quote', 'qq']).evidence, { url: 'https://x', quote: 'qq' });
  assert.throws(() => cli.correctionPayload(['--correct', 'q1', 'maybe', 'why']));
  assert.throws(() => cli.correctionPayload(['--correct', 'q1', 'yes']));
});

test('settle-correct never touches probability', () => {
  const src = fs.readFileSync(path.join(root, 'settle-correct.js'), 'utf8');
  assert.ok(!/scenarios|probabilit|\.p\b/.test(src.replace(/no probability|\(no probability\)/g, '')));
});

test('verify-draw: a good draw verifies; a tampered pick, seed or late commitment does not', async () => {
  const { verify } = await import(path.join(root, 'verify-draw.mjs'));
  const seed = 'ef'.repeat(32);
  const pool = Array.from({ length: 200 }, (_, i) => ({ q: `q${i}`, c: `c${i % 40}` }));
  const d = lib.draw(seed, pool.map((x) => ({ qid: x.q, clusterKey: x.c })), 22);
  const input = {
    commit: { weekId: '2026-W41', weekStart: '2026-10-05', commitHash: lib.commitOf(seed), committedAt: '2026-10-01T10:30:00Z' },
    reveal: { seedHex: seed },
    draw: { K: 22, pool, picked: d.picked },
  };
  assert.equal(verify(input).ok, true);
  assert.equal(verify({ ...input, reveal: { seedHex: 'aa'.repeat(32) } }).ok, false);
  const swapped = [...d.picked]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.equal(verify({ ...input, draw: { ...input.draw, picked: swapped } }).ok, false);
  assert.equal(verify({ ...input, commit: { ...input.commit, committedAt: '2026-10-05T01:00:00Z' } }).ok, false);
  assert.equal(verify({ commit: input.commit }).ok, false);
});

test('verify-draw reads the public aggregate week shape', async () => {
  const { verify, fromPublicWeek } = await import(path.join(root, 'verify-draw.mjs'));
  const seed = '12'.repeat(32);
  const pool = Array.from({ length: 60 }, (_, i) => ({ q: `q${i}`, c: `c${i % 30}` }));
  const d = lib.draw(seed, pool.map((x) => ({ qid: x.q, clusterKey: x.c })), 22);
  const week = { weekId: '2026-W41', weekStart: '2026-10-05', commit: { hash: lib.commitOf(seed), committedAt: '2026-10-01T10:30:00Z' }, reveal: { seedHex: seed }, draw: { K: 22, pool, picked: d.picked } };
  assert.equal(verify(fromPublicWeek(week)).ok, true);
  assert.equal(verify(fromPublicWeek({ ...week, draw: null })).ok, false);
  assert.equal(verify(fromPublicWeek(undefined)).ok, false);
});
