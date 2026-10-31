'use strict';
// Link notes (decision 0042): each edge of the country webs written in a run becomes one link note; the writer is injected.
const test = require('node:test');
const assert = require('node:assert/strict');
const { writeLinkNotes, planLinkNotes, planWebNotes } = require('../src/recordNotes');
const { entryIdentity, pairKey } = require('../src/_shared/record');

const entries = [
  { topicId: 'A-1', date: '2026-10-02', title: 'A', sources: [{ url: 'https://www.reuters.com/a' }] },
  { topicId: 'B-1', date: '2026-10-03', title: 'B', sources: [{ url: 'https://www.bbc.com/b' }] },
];
const edge = (from, to, extra = {}) => ({ from, to, mechanism: 'm', lagDays: 1, confidence: 'medium', class: 'causal', relation: 'inferred_influence',
  cited: [{ topicId: 'A-1', date: '2026-10-02', title: 'A' }, { topicId: 'B-1', date: '2026-10-03', title: 'B' }], citedEntries: ['A-1', 'B-1'], ...extra });
const rows = [
  { countryName: 'Japan', generatedAt: '2026-10-30T05:02:09.564Z', nodes: [], backbone: [{ from: 'x', to: 'y' }], edges: [edge('t1', 't2'), edge('t3', 't1')] },
  { countryName: 'South Korea', generatedAt: '2026-10-30T05:03:00.000Z', edges: [edge('t2', 't1')] },
];
const fakeWriter = () => { const w = { calls: [], write: async (subtype, notes) => { w.calls.push([subtype, notes]); return { appended: notes.length, skipped: 0, days: [] }; } }; return w; };
const quiet = (fn) => async (...a) => { const l = console.log; const w = console.warn; const e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(...a); } finally { console.log = l; console.warn = w; console.error = e; } };

test('one link note per edge: subject pairKey, part = the web country, both thread ids in the payload, cites = the cited entries eventIds', quiet(async () => {
  const writer = fakeWriter();
  const notes = await writeLinkNotes({ rows, entries, model: 'deepseek-v4-pro', runId: 'run-1', writer });
  assert.deepEqual(writer.calls.map((c) => c[0]), ['web', 'link']); // the webs first
  assert.equal(notes.length, 3); // the returned notes are the links; the backbone rides on the web note
  const [a, b, c] = notes;
  assert.deepEqual([a.subject, a.part, a.iso3, a.threadId, a.at, a.model], [{ kind: 'pair', id: pairKey('t1', 't2') }, 'JPN', ['JPN'], null, rows[0].generatedAt, 'deepseek-v4-pro']);
  assert.deepEqual([a.payload.from, a.payload.to, a.payload.country], ['t1', 't2', 'Japan']);
  assert.deepEqual(a.cites, entries.map((e) => entryIdentity({ sources: e.sources, date: e.date, title: e.title }).eventId));
  assert.deepEqual(a.producer, { lambda: 'newsSystemsAnalysis', runId: 'run-1' });
  // the same pair read in two countries' webs: two notes (part differs), neither replaces the other
  assert.equal(a.subject.id, c.subject.id);
  assert.deepEqual([a.part, c.part], ['JPN', 'KOR']);
  assert.notEqual(a.noteId, c.noteId);
  assert.equal(b.payload.from, 't3');
}));

test('one web note per web, a web with no edge too: country, node ids, the deterministic backbone; the link notes are unchanged', quiet(async () => {
  const writer = fakeWriter();
  const webRows = [{ ...rows[0], nodes: [{ threadId: 't1' }, { threadId: 't2' }, { threadId: 't9' }], backbone: [{ from: 't1', to: 't2', sharedActors: ['G7'], weight: 1 }] },
    { countryName: 'India', generatedAt: '2026-10-29T05:02:11.316Z', nodes: [{ threadId: 't5' }], edges: [], backbone: [] }];
  await writeLinkNotes({ rows: webRows, entries, model: 'deepseek-v4-pro', runId: 'run-1', writer });
  const webs = writer.calls[0][1];
  assert.deepEqual(webs.map((n) => [n.subtype, n.subject, n.part, n.at, n.model]), [['web', { kind: 'country', id: 'JPN' }, '', webRows[0].generatedAt, 'deepseek-v4-pro'], ['web', { kind: 'country', id: 'IND' }, '', webRows[1].generatedAt, 'deepseek-v4-pro']]);
  assert.deepEqual(webs[0].payload, { country: 'Japan', nodes: ['t1', 't2', 't9'], backbone: [{ from: 't1', to: 't2', sharedActors: ['G7'], weight: 1 }] });
  assert.deepEqual(webs[1].payload.nodes, ['t5']);
  assert.equal(writer.calls[1][1].length, 2); // India has no edge, so no link note
  assert.deepEqual(planWebNotes({ rows: [{ countryName: 'Europe', generatedAt: '2026-10-30T05:00:00Z' }], model: 'm', runId: 'r' }).skipped, [{ country: 'Europe', reason: 'no_iso3' }]);
  // a web write that fails still never throws, and the link notes are not attempted after it
  assert.deepEqual(await writeLinkNotes({ rows: webRows, entries, model: 'm', runId: 'r', writer: { write: async () => { throw new Error('s3 down'); } } }), []);
}));

test('a web holding both directions of a pair keeps the stronger one (a note is keyed by pair); the other is reported', quiet(async () => {
  const plan = planLinkNotes({ rows: [{ countryName: 'Japan', generatedAt: '2026-10-30T05:00:00Z', edges: [edge('t1', 't2', { confidence: 'weak' }), edge('t2', 't1', { confidence: 'strong' }), edge('t3', 't4')] }], entries, model: 'm', runId: 'r' });
  assert.deepEqual(plan.notes.map((n) => [n.payload.from, n.payload.confidence]), [['t2', 'strong'], ['t3', 'medium']]);
  assert.deepEqual(plan.skipped, [{ country: 'Japan', from: 't1', to: 't2', reason: 'pair_both_ways' }]);
}));

test('a country with no ISO3 or an edge that is a self-loop is skipped and reported; a failing writer never throws', quiet(async () => {
  const plan = planLinkNotes({ rows: [{ countryName: 'Atlantis', generatedAt: '2026-10-30T05:00:00Z', edges: [edge('t1', 't2')] },
    { countryName: 'Japan', generatedAt: '2026-10-30T05:00:00Z', edges: [edge('t1', 't1'), edge('t1', 't2')] }], entries, model: 'm', runId: 'r' });
  assert.equal(plan.notes.length, 1);
  assert.deepEqual(plan.skipped.map((s) => s.reason), ['no_iso3', 'no_pair']);
  assert.deepEqual(await writeLinkNotes({ rows, entries, model: 'm', runId: 'r', writer: { write: async () => { throw new Error('s3 down'); } } }), []);
  const writer = fakeWriter();
  assert.deepEqual(await writeLinkNotes({ rows: [], entries, model: 'm', runId: 'r', writer }), []);
  assert.equal(writer.calls.length, 0); // nothing to write, no S3 call
}));
