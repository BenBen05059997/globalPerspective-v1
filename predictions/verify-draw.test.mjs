// node --test predictions/verify-draw.test.mjs — the two cases a live run hit (2026-10-19).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { verify, parseItem } from './verify-draw.mjs';

const lib = createRequire(import.meta.url)('../backend/predictions/newsPredictionResolver/src/lib.js');
const seed = '34'.repeat(32);
const pool = Array.from({ length: 50 }, (_, i) => ({ q: `q${i}`, c: `c${i % 20}` }));
const picked = lib.draw(seed, pool.map((x) => ({ qid: x.q, clusterKey: x.c })), 10).picked;
const commit = { weekId: '2026-W41', weekStart: '2026-10-05', commitHash: lib.commitOf(seed), committedAt: '2026-10-01T10:30:00Z' };

test('picks read back from DynamoDB with their keys in another order still verify', () => {
  const reordered = picked.map(({ qid, h, clusterKey }) => ({ h, clusterKey, qid }));
  assert.equal(verify({ commit, reveal: { seedHex: seed }, draw: { K: 10, pool, picked: reordered } }).ok, true);
});

test('a week with only the commitment says "not revealed yet" instead of crashing', () => {
  assert.equal(parseItem(''), null); // get-item prints nothing for a missing row
  const r = verify({ commit, reveal: parseItem(''), draw: parseItem('') });
  assert.equal(r.ok, false);
  assert.equal(r.notRevealed, true);
  assert.match(r.problems[0], /not revealed yet/);
});
