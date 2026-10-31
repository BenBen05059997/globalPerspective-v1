'use strict';
// Story analysis notes (decision 0042): the stored THREAD_ANALYSIS item becomes one story_analysis note; the writer is injected.
const test = require('node:test');
const assert = require('node:assert/strict');
const { writeStoryNote } = require('../src/recordNotes');
const { entryIdentity } = require('../src/_shared/record');

const entries = [
  { topicId: 'a-1', date: '2026-10-29', title: 'A', sources: [{ url: 'https://www.reuters.com/a' }] },
  { topicId: 'b-1', date: '2026-10-30', title: 'B', sources: [{ url: 'https://www.bbc.com/b' }] },
];
const item = {
  PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', threadId: 't1', threadTitle: 'T', entryShortTitles: [], storyArc: 'S', trajectory: null, rootCauseChain: null,
  watchQuestions: [], inflectionTopicId: null, riskScore: 60, dimensions: {}, lead: 'conflict', sentiment: -0.4, keyActors: [], entryCount: 2,
  entryTopicIds: ['a-1', 'b-1'], iso3: ['UKR'], generatedAt: '2026-10-30T04:41:12.318Z', model: 'deepseek-flash', latencyMs: 9, ttl: 1,
};
const fakeWriter = () => { const w = { calls: [], write: async (subtype, notes) => { w.calls.push([subtype, notes]); return { appended: notes.length, skipped: 0, days: [] }; } }; return w; };

test('the stored analysis is written as one story_analysis note: subject the thread, cites the entry eventIds, payload without storage keys', async () => {
  const writer = fakeWriter();
  const note = await writeStoryNote({ item, entries, runId: 'run-1', writer });
  assert.equal(writer.calls.length, 1);
  assert.equal(writer.calls[0][0], 'story_analysis');
  assert.deepEqual(writer.calls[0][1], [note]);
  assert.deepEqual([note.subject, note.part, note.threadId, note.iso3, note.at, note.model], [{ kind: 'story', id: 't1' }, '', 't1', ['UKR'], '2026-10-30T04:41:12.318Z', 'deepseek-flash']);
  assert.deepEqual(note.cites, entries.map((e) => entryIdentity(e).eventId));
  assert.deepEqual(note.producer, { lambda: 'newsThreadAnalysis', runId: 'run-1' });
  for (const k of ['PK', 'SK', 'ttl', 'threadId', 'iso3', 'generatedAt', 'model']) assert.equal(k in note.payload, false, k);
  assert.equal(note.payload.storyArc, 'S');
});

test('a failing writer never throws: the run goes on and the failure is logged as [notes]', async () => {
  const errors = [];
  const orig = console.error; console.error = (m) => errors.push(m);
  try {
    assert.equal(await writeStoryNote({ item, entries, runId: 'r', writer: { write: async () => { throw new Error('s3 down'); } } }), null);
    assert.equal(await writeStoryNote({ item: { ...item, generatedAt: 'not a date' }, entries, runId: 'r', writer: fakeWriter() }), null);
  } finally { console.error = orig; }
  assert.equal(errors.length, 2);
  assert.match(errors[0], /^\[notes\] story_analysis note not written: s3 down/);
});
