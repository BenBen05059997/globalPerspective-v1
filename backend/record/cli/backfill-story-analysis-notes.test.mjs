import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { planStoryAnalysisNotes } from './backfill-story-analysis-notes.mjs';

const require = createRequire(import.meta.url);
const R = require('../../shared/src/record.js');
const producer = { lambda: 'record/cli/backfill-story-analysis-notes', runId: 'test' };
const item = (threadId, extra = {}) => ({ PK: `THREAD#${threadId}`, SK: 'THREAD_ANALYSIS', threadId, ttl: 1, iso3: ['UKR'], generatedAt: '2026-10-30T04:41:12.318Z', model: 'deepseek-flash',
  threadTitle: 'T', storyArc: 'S', entryShortTitles: [], trajectory: null, rootCauseChain: null, watchQuestions: [], inflectionTopicId: null, riskScore: null, dimensions: {},
  lead: null, sentiment: null, keyActors: [], entryCount: 2, entryTopicIds: ['a-1'], latencyMs: 5, ...extra });
const e = (topicId, threadId, url) => ({ topicId, threadId, title: topicId, sources: [{ url }] });

test('planStoryAnalysisNotes: one note per analysed story, cites from the thread archive entries; unknown threads reported, not written', () => {
  const rows = [{ date: '2026-10-29', entries: [e('a-1', 't1', 'https://example.org/a'), e('b-1', 't1', 'https://example.org/b'), e('z-1', 'other', 'https://example.org/z')] }];
  const plan = planStoryAnalysisNotes({ items: [item('t1'), item('gone'), { PK: 'THREAD#t1', SK: 'THREAD_HISTORY#2026-10-30', threadId: 't1' }], rows, storyIds: new Set(['t1']), producer });
  assert.deepEqual([plan.notes.length, plan.unmatched, plan.failed], [1, [{ threadId: 'gone', generatedAt: '2026-10-30T04:41:12.318Z' }], []]);
  const [n] = plan.notes;
  assert.deepEqual([n.subtype, n.subject, n.model, n.at], ['story_analysis', { kind: 'story', id: 't1' }, 'deepseek-flash', '2026-10-30T04:41:12.318Z']);
  assert.deepEqual(n.cites, [R.entryIdentity({ sources: [{ url: 'https://example.org/a' }], date: '2026-10-29', title: 'a-1' }).eventId]);
});

test('planStoryAnalysisNotes: no archive entries still gives a note (empty cites); a bad item is reported as failed; same input -> same noteIds', () => {
  const plan = planStoryAnalysisNotes({ items: [item('t1'), item('t2', { model: undefined })], rows: [], storyIds: new Set(['t1', 't2']), producer });
  assert.deepEqual([plan.notes.map((n) => n.cites), plan.failed.map((f) => f.threadId)], [[[]], ['t2']]);
  const again = planStoryAnalysisNotes({ items: [item('t1')], rows: [], storyIds: new Set(['t1']), producer: { ...producer, runId: 'other' } });
  assert.equal(again.notes[0].noteId, plan.notes[0].noteId);
});
