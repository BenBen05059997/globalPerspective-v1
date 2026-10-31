import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { planArchiveNotes } from './backfill-entry-notes.mjs';

const require = createRequire(import.meta.url);
const R = require('../../shared/src/record.js');
const producer = { lambda: 'record/cli/backfill-entry-notes', runId: 'test' };
const entry = { topicId: 'T-1', title: 'A story', threadId: 'thread-a', iso3: ['FRA'], sources: [{ url: 'https://example.org/a' }], archivedAt: '2026-10-10T12:00:00Z', ai: { summary: 'text', prediction: null, trace_cause: '{"a"' } };
const known = new Set([R.entryIdentity({ sources: entry.sources, date: '2026-10-10', title: entry.title }).eventId]);

test('planArchiveNotes: archive copies for entries that are facts; others reported, not written', () => {
  const plan = planArchiveNotes({ rows: [{ date: '2026-10-10', entries: [entry, { ...entry, topicId: 'T-2', sources: [{ url: 'https://example.org/unknown' }] }] }], knownEventIds: known, producer });
  assert.deepEqual([plan.entries, plan.notes.map((n) => n.part), plan.unmatched.length], [2, ['summary', 'cause'], 2]);
  assert.ok(plan.notes.every((n) => n.payload.from === 'archive' && n.model === null));
});
