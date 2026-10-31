'use strict';
// Country notes (decision 0042): a stored COUNTRY_INTELLIGENCE item becomes one country note about the ISO3; the writer is injected.
const test = require('node:test');
const assert = require('node:assert/strict');
const { writeCountryNote } = require('../src/recordNotes');

const item = {
  countryName: 'Japan', headline: 'H', bluf: 'B', keyDevelopments: [{ date: '2026-10-25', text: 't' }], whyItMatters: 'W', situationSummary: null,
  backgroundTimeline: [], crossThreadInsight: 'C', trajectory: 'escalating', trajectoryDetail: 'D', riskSignals: ['s'], riskLevel: 'elevated', riskScore: 72,
  dimensions: { conflict: { score: 72, why: 'w' } }, lead: 'conflict', keyActors: [], dominantCategory: 'military', categories: { military: 9 }, totalArticles: 28,
  activeArcCount: 6, threadIds: ['thread-a'], dateRange: { from: '2026-10-01', to: '2026-10-25' }, dayCount: 12, generatedAt: '2026-10-26T05:15:44.865Z',
  model: 'deepseek-v4-pro', latencyMs: 22243, ttl: 1800767744,
};
const fakeWriter = () => { const w = { calls: [], write: async (subtype, notes) => { w.calls.push([subtype, notes]); return { appended: notes.length, skipped: 0, days: [] }; } }; return w; };
const quiet = (fn) => async (...a) => { const l = console.log; const w = console.warn; const e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(...a); } finally { console.log = l; console.warn = w; console.error = e; } };

test('a country name becomes its ISO3 subject; the payload keeps the stored fields; model and time are the envelope', quiet(async () => {
  const writer = fakeWriter();
  const note = await writeCountryNote({ countryName: 'Japan', item, runId: 'run-1', writer });
  assert.equal(writer.calls.length, 1);
  assert.equal(writer.calls[0][0], 'country');
  assert.deepEqual([note.subject, note.part, note.iso3, note.threadId, note.at, note.model, note.cites], [{ kind: 'country', id: 'JPN' }, '', ['JPN'], null, item.generatedAt, 'deepseek-v4-pro', []]);
  assert.deepEqual(note.producer, { lambda: 'newsCountryIntelligence', runId: 'run-1' });
  assert.equal(note.payload.countryName, 'Japan');
  assert.equal(note.payload.situationSummary, null);
  for (const k of ['ttl', 'generatedAt', 'model', 'PK', 'SK']) assert.equal(k in note.payload, false, k);
}));

test('a country with no ISO3 is skipped (logged); a failing writer never throws', quiet(async () => {
  const writer = fakeWriter();
  assert.equal(await writeCountryNote({ countryName: 'Atlantis', item, runId: 'r', writer }), null);
  assert.equal(writer.calls.length, 0);
  assert.equal(await writeCountryNote({ countryName: 'Japan', item, runId: 'r', writer: { write: async () => { throw new Error('s3 down'); } } }), null);
  assert.equal(await writeCountryNote({ countryName: 'Japan', item: { ...item, generatedAt: 'not a date' }, runId: 'r', writer }), null); // a bad item is logged, not thrown
}));
