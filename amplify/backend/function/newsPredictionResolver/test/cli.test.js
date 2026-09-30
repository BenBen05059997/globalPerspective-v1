'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const lib = require('../src/lib');
const cli = require('../../../../../predictions/settle-review.js');

const root = path.join(__dirname, '../../../../../predictions');

test('settle-review: due = sampled, past deadline, no verdict; oldest first; newest draft attached', () => {
  const rows = [
    { PK: 'Q#a', SK: 'SAMPLED', deadline: '2026-11-10', question: 'A' },
    { PK: 'Q#a', SK: 'DRAFT#2026-11-11T10:00:00Z', verdict: 'not_yet' },
    { PK: 'Q#a', SK: 'DRAFT#2026-11-18T10:00:00Z', verdict: 'yes', quote: 'q', url: 'https://x' },
    { PK: 'Q#b', SK: 'SAMPLED', deadline: '2026-11-05', question: 'B' },
    { PK: 'Q#c', SK: 'SAMPLED', deadline: '2026-11-01' },
    { PK: 'Q#c', SK: 'VERDICT', verdict: 'no' },
    { PK: 'Q#d', SK: 'SAMPLED', deadline: '2026-12-31' },
  ];
  const due = cli.dueForReview(cli.group(rows), '2026-11-20');
  assert.deepEqual(due.map((g) => g.qid), ['b', 'a']);
  assert.equal(due[1].latestDraft.verdict, 'yes');
});

test('settle-review never touches probability: the module has no read of p, and the rows it builds carry none', () => {
  const src = fs.readFileSync(path.join(root, 'settle-review.js'), 'utf8');
  assert.ok(!/scenarios|probabilit|\.p\b/.test(src.replace(/no probability|carry no probability|cannot show `p`/g, '')));
  const row = cli.verdictRow({ qid: 'a', latestDraft: { SK: 'DRAFT#x', url: 'https://x', quote: 'qq' } }, 'yes', {}, '2026-11-20T00:00:00Z');
  assert.equal(row.PK, 'Q#a'); assert.equal(row.SK, 'VERDICT'); assert.equal(row.decidedBy, 'operator');
  assert.deepEqual(row.evidence, { url: 'https://x', quote: 'qq' });
  assert.equal(cli.verdictRow({ qid: 'a' }, 'void', { voidReason: 'event_moot' }, 'n').voidReason, 'event_moot');
});

test('settle-review: NO needs deadline + 3 days, same rule as the Lambda', () => {
  for (const [dl, today] of [['2026-11-10', '2026-11-12'], ['2026-11-10', '2026-11-13']]) {
    assert.equal(cli.canConcludeNo(dl, today), lib.canConcludeNo(dl, today));
  }
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
