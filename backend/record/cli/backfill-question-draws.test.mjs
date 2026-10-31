import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { planQuestionDraws } from './backfill-question-draws.mjs';

const require = createRequire(import.meta.url);
const F = require('../newsStoryRecord/src/facts.js');
const H = 'a'.repeat(64);
const commit = (wk, extra = {}) => ({ PK: `SEED#${wk}`, SK: 'COMMIT', weekId: wk, weekStart: '2026-10-19', weekEnd: '2026-10-25', commitHash: H, rule: 'v1', committedAt: '2026-10-15T10:30:00.000Z', ...extra });
const reveal = (wk) => ({ PK: `SEED#${wk}`, SK: 'REVEAL', weekId: wk, seedHex: 'b'.repeat(64), revealedAt: '2026-10-26T10:30:00.000Z' });
const draw = (wk, extra = {}) => ({ PK: `SAMPLE#${wk}`, SK: 'DRAW', weekId: wk, rule: 'v1', K: 22, eligible: 9, clusters: 3, pool: [{ q: 'q1', c: 't' }], picked: [{ qid: 'q1', h: 'hh', clusterKey: 't' }], drawnAt: '2026-10-26T10:30:00.000Z', ...extra });

test('planQuestionDraws: a commit line per COMMIT row and a draw line per DRAW row with the revealed seed; pool and secrets never leave', () => {
  const secret = { PK: 'SEED#2026-W43', SK: 'SECRET', seedHex: 'c'.repeat(64) };
  const plan = planQuestionDraws([commit('2026-W43'), reveal('2026-W43'), draw('2026-W43'), secret, commit('2026-W44', { committedAt: '2026-10-22T10:30:00.000Z' })]);
  assert.deepEqual(plan.lines.map((l) => [l.day, l.line.type, l.line.weekId]), [['2026-10-15', 'commit', '2026-W43'], ['2026-10-22', 'commit', '2026-W44'], ['2026-10-26', 'draw', '2026-W43']]);
  const d = plan.lines[2].line;
  assert.deepEqual([d.seedHex, d.picked, d.K, d.sourceKey], ['b'.repeat(64), [{ qid: 'q1', hash: 'hh', clusterKey: 't' }], 22, 'backfill:draws/draw|2026-W43']);
  assert.ok(!JSON.stringify(plan.lines).includes('c'.repeat(64)) && !('pool' in d));
});

test('planQuestionDraws: every line becomes a fact; an incomplete row is skipped and reported', () => {
  const plan = planQuestionDraws([commit('2026-W43'), draw('2026-W43'), commit('2026-W44', { commitHash: undefined }), draw('2026-W42', { picked: undefined })]);
  assert.deepEqual(plan.skipped.map((s) => s.weekId).sort(), ['2026-W42', '2026-W44']);
  assert.deepEqual(plan.lines.map((l) => F.inboxDrawFact(l.line, 'r').kind), ['question_commit', 'question_draw']);
  assert.equal(plan.lines[1].line.seedHex, null); // no REVEAL row: seed unknown, the draw is still recorded
});
