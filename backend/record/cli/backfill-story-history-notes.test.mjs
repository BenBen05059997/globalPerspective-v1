import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planStoryHistoryNotes } from './backfill-story-history-notes.mjs';

const producer = { lambda: 'record/cli/backfill-story-history-notes', runId: 'test' };
const row = (threadId, date, extra = {}) => ({ PK: `THREAD#${threadId}`, SK: `THREAD_HISTORY#${date}`, threadId, dateKey: date, threadTitle: 'T', trajectory: 'stable', riskScore: 40,
  dimensions: { conflict: { score: 40, why: 'w' } }, lead: 'conflict', entryCount: 3, generatedAt: `${date}T04:41:00.000Z`, ttl: 1, ...extra });

test('planStoryHistoryNotes: one history copy per THREAD_HISTORY# row (from history, model null, at = generatedAt); other rows are ignored', () => {
  const plan = planStoryHistoryNotes({ items: [row('a', '2026-10-10'), row('a', '2026-10-11'), { PK: 'THREAD#a', SK: 'THREAD_ANALYSIS', threadId: 'a' }, row('b', '2026-10-11', { generatedAt: undefined })], producer });
  assert.deepEqual(plan.notes.map((n) => [n.subtype, n.subject, n.date, n.model, n.payload.from, n.payload.dateKey]), [
    ['story_history', { kind: 'story', id: 'a' }, '2026-10-10', null, 'history', '2026-10-10'], ['story_history', { kind: 'story', id: 'a' }, '2026-10-11', null, 'history', '2026-10-11']]);
  assert.deepEqual(plan.skipped, [{ threadId: 'b', sk: 'THREAD_HISTORY#2026-10-11' }]);
  assert.equal('ttl' in plan.notes[0].payload || 'generatedAt' in plan.notes[0].payload || 'threadId' in plan.notes[0].payload, false);
});

test('planStoryHistoryNotes: a re-plan gives the same noteId; a row without dateKey takes it from the sort key', () => {
  const r = row('a', '2026-10-10', { dateKey: undefined });
  const a = planStoryHistoryNotes({ items: [r], producer }).notes[0];
  const b = planStoryHistoryNotes({ items: [r], producer: { ...producer, runId: 'other' } }).notes[0];
  assert.deepEqual([a.noteId === b.noteId, a.payload.dateKey], [true, '2026-10-10']);
});
