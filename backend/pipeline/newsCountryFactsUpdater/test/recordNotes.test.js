'use strict';
// Country facts notes (decision 0053): a stored FACTS# item becomes one country_facts note about the ISO3 when NOTES_PREFIX is set; the writer is injected.
const test = require('node:test');
const assert = require('node:assert/strict');
const { writeFactsNote } = require('../src/recordNotes');

const item = {
  PK: 'FACTS#Japan', SK: 'COUNTRY_FACTS', countryName: 'Japan', ttl: 1,
  capital: { names: ['Tokyo'], source: 'wikidata', checkedAt: '2026-10-26T20:00:01Z' },
  population: { value: 123802000, year: 2024, time: '2024-10-01', source: 'wikidata', checkedAt: '2026-10-26T20:00:01Z' },
  lastUpdatedAt: '2026-10-26T20:00:01.500Z',
};
const fakeWriter = () => { const w = { calls: [], write: async (subtype, notes) => { w.calls.push([subtype, notes]); return { appended: notes.length, skipped: 0, days: [] }; } }; return w; };
const quiet = (fn) => async (...a) => { const l = console.log; const w = console.warn; const e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(...a); } finally { console.log = l; console.warn = w; console.error = e; } };

test('with a prefix, the item becomes a model-less country_facts note about the ISO3; at is lastUpdatedAt; keys and ttl are not stored', quiet(async () => {
  const writer = fakeWriter();
  const note = await writeFactsNote({ countryName: 'Japan', item, runId: 'run-1', prefix: 'record/shadow/', writer });
  assert.equal(writer.calls[0][0], 'country_facts');
  assert.deepEqual([note.subject, note.iso3, note.at, note.model, note.part], [{ kind: 'country', id: 'JPN' }, ['JPN'], item.lastUpdatedAt, null, '']);
  assert.deepEqual(note.producer, { lambda: 'newsCountryFactsUpdater', runId: 'run-1' });
  assert.deepEqual(Object.keys(note.payload).sort(), ['capital', 'countryName', 'population']);
}));

test('without a prefix nothing is written; an unknown country is skipped; a failing writer never throws', quiet(async () => {
  const writer = fakeWriter();
  assert.equal(await writeFactsNote({ countryName: 'Japan', item, runId: 'r', prefix: '', writer }), null);
  assert.equal(await writeFactsNote({ countryName: 'Atlantis', item, runId: 'r', prefix: 'record/', writer }), null);
  assert.equal(writer.calls.length, 0);
  assert.equal(await writeFactsNote({ countryName: 'Japan', item, runId: 'r', prefix: 'record/', writer: { write: async () => { throw new Error('s3 down'); } } }), null);
}));
