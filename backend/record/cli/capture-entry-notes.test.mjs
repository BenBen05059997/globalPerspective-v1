import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { planEntryNotes } from './capture-entry-notes.mjs';

const require = createRequire(import.meta.url);
const R = require('../../shared/src/record.js');
const producer = { lambda: 'record/cli/capture-entry-notes', runId: 'test' };
const topic = { id: 'T-1', title: 'A story', threadId: 'thread-a', iso3: ['FRA'], sources: [{ url: 'https://example.org/a' }] };
const item = (SK, content, topicId = 'T-1') => ({ SK, content, topicId, contentFormat: SK === 'SUMMARY' ? 'markdown' : 'json', generatedAt: '2026-10-30T20:25:00Z', model: 'deepseek-flash' });
const known = new Set([R.entryIdentity({ sources: topic.sources, date: '2026-10-30', title: topic.title }).eventId]);

test('planEntryNotes: a note per part of a known entry; unknown entries are held back, missing topics and empty items skipped', () => {
  const plan = planEntryNotes({ items: [item('SUMMARY', 'text'), item('TRACE_CAUSE', '{"a":1}'), item('SUMMARY', '', 'T-1'), item('SUMMARY', 'x', 'T-gone')],
    topics: [topic], archiveDate: '2026-10-30', knownEventIds: known, producer });
  assert.deepEqual(plan.notes.map((n) => n.part), ['summary', 'cause']);
  assert.deepEqual(plan.skipped.map((s) => s.reason), ['no_content', 'topic_not_in_latest']);
  const held = planEntryNotes({ items: [item('SUMMARY', 'text')], topics: [topic], archiveDate: '2026-10-30', knownEventIds: new Set(), producer });
  assert.deepEqual([held.notes.length, held.unmatched.length], [0, 1]);
});
