'use strict';
// Drift notes (decision 0042): a stored country DRIFT# item becomes one drift note about the ISO3; the writer is injected.
const test = require('node:test');
const assert = require('node:assert/strict');
const { writeDriftNote } = require('../src/recordNotes');

const item = {
  countryName: 'Iran', asOf: '2026-07-30', since: '2026-07-29', changeScore: { from: 90, to: 95, delta: 5 }, changeDimensions: { economic: { from: 80, to: 90, delta: 10 } },
  priorHeadline: 'p', currentHeadline: 'c', currentRiskScore: 95, currentRiskLevel: 'severe', currentLead: 'conflict',
  triggerEvent: { topicId: 'x-1', threadId: 'thread-x', title: 'X', date: '2026-07-30' }, whyChanged: 'Because X.', noSingleDriver: false,
  directionFlag: undefined, generatedAt: '2026-07-31T05:30:02.114Z',
};
const fakeWriter = () => { const w = { calls: [], write: async (subtype, notes) => { w.calls.push([subtype, notes]); return { appended: notes.length, skipped: 0, days: [] }; } }; return w; };
const quiet = (fn) => async (...a) => { const l = console.log; const w = console.warn; const e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(...a); } finally { console.log = l; console.warn = w; console.error = e; } };

test('a country name becomes its ISO3 subject; the trigger story is the thread; the payload keeps the stored fields', quiet(async () => {
  const writer = fakeWriter();
  const note = await writeDriftNote({ country: 'Iran', item, model: 'deepseek-flash', runId: 'run-1', writer });
  assert.equal(writer.calls[0][0], 'drift');
  assert.deepEqual([note.subject, note.part, note.iso3, note.threadId, note.at, note.model], [{ kind: 'country', id: 'IRN' }, '', ['IRN'], 'thread-x', item.generatedAt, 'deepseek-flash']);
  assert.deepEqual(note.producer, { lambda: 'newsDriftCorrector', runId: 'run-1' });
  assert.equal(note.payload.countryName, 'Iran');
  assert.equal('generatedAt' in note.payload, false);
  assert.equal('directionFlag' in note.payload, false); // undefined fields are not stored
}));

test('a country with no ISO3 is skipped (logged); a failing writer never throws', quiet(async () => {
  const writer = fakeWriter();
  assert.equal(await writeDriftNote({ country: 'Atlantis', item, model: 'm', runId: 'r', writer }), null);
  assert.equal(writer.calls.length, 0);
  assert.equal(await writeDriftNote({ country: 'Iran', item, model: 'm', runId: 'r', writer: { write: async () => { throw new Error('s3 down'); } } }), null);
}));

test('a story DRIFT# item becomes a drift note about the story (kind story, thread = the story, no countries); a failing writer never throws', quiet(async () => {
  const { writeStoryDriftNote } = require('../src/recordNotes');
  const story = { threadId: 'thread-x', asOf: '2026-10-11', since: '2026-10-10', changeScore: { from: 70, to: 75, delta: 5 }, priorTitle: 'a', currentTitle: 'b', triggerEvent: undefined,
    whyChanged: 'Because X.', noSingleDriver: false, generatedAt: '2026-10-11T05:30:00.000Z' };
  const writer = fakeWriter();
  const note = await writeStoryDriftNote({ threadId: 'thread-x', item: story, model: 'deepseek-flash', runId: 'run-1', writer });
  assert.equal(writer.calls[0][0], 'drift');
  assert.deepEqual([note.subject, note.threadId, note.iso3, note.at, note.model], [{ kind: 'story', id: 'thread-x' }, 'thread-x', [], story.generatedAt, 'deepseek-flash']);
  assert.deepEqual(note.producer, { lambda: 'newsDriftCorrector', runId: 'run-1' });
  assert.equal('generatedAt' in note.payload, false);
  assert.equal('triggerEvent' in note.payload, false);
  assert.equal(await writeStoryDriftNote({ threadId: 'thread-x', item: story, model: 'm', runId: 'r', writer: { write: async () => { throw new Error('s3 down'); } } }), null);
}));
