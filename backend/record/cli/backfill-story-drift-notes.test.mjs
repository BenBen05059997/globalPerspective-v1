import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planStoryDriftNotes } from './backfill-story-drift-notes.mjs';

const producer = { lambda: 'record/cli/backfill-story-drift-notes', runId: 'test' };
const row = (threadId, asOf, extra = {}) => ({ PK: `THREAD#${threadId}`, SK: `DRIFT#${asOf}`, threadId, asOf, since: '2026-10-01', changeScore: { from: 40, to: 50, delta: 10 },
  priorTitle: 'a', currentTitle: 'b', whyChanged: 'x', noSingleDriver: true, ttl: 1, generatedAt: `${asOf}T05:30:00.000Z`, ...extra });

test('planStoryDriftNotes: one archive-copy story drift note per THREAD# DRIFT# item (model null, from archive); stories outside the record are reported', () => {
  const plan = planStoryDriftNotes({ items: [row('thread-a', '2026-10-10'), row('thread-gone', '2026-10-10'), { ...row('thread-a', '2026-10-10'), SK: 'DRIFTLOG#2026-10-10' }, { ...row('thread-a', '2026-10-10'), PK: 'COUNTRY#Iran' }], storyIds: new Set(['thread-a']), producer });
  assert.deepEqual([plan.notes.length, plan.unmatched, plan.failed], [1, [{ threadId: 'thread-gone', asOf: '2026-10-10' }], []]);
  const [n] = plan.notes;
  assert.deepEqual([n.subtype, n.subject, n.threadId, n.iso3, n.model, n.payload.from, n.at], ['drift', { kind: 'story', id: 'thread-a' }, 'thread-a', [], null, 'archive', '2026-10-10T05:30:00.000Z']);
  assert.equal('generatedAt' in n.payload || 'PK' in n.payload || 'ttl' in n.payload, false);
});

test('planStoryDriftNotes: a re-plan gives the same noteId; a malformed item is failed, not thrown', () => {
  const ids = new Set(['thread-a']);
  const a = planStoryDriftNotes({ items: [row('thread-a', '2026-10-11')], storyIds: ids, producer }).notes[0];
  const b = planStoryDriftNotes({ items: [row('thread-a', '2026-10-11')], storyIds: ids, producer: { ...producer, runId: 'other' } }).notes[0];
  assert.equal(a.noteId, b.noteId);
  const bad = planStoryDriftNotes({ items: [row('thread-a', '2026-10-11', { generatedAt: 'nope' })], storyIds: ids, producer });
  assert.deepEqual([bad.notes.length, bad.failed.length], [0, 1]);
});
