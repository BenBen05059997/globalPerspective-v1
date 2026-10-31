import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBackfillLinks, citedDays } from './backfill-link-notes.mjs';

const edge = (from, to) => ({ from, to, mechanism: 'm', lagDays: 1, confidence: 'weak', cited: [{ topicId: 'A-1', date: '2026-10-02', title: 'A' }] });
const web = (country, generatedAt, edges, extra = {}) => ({ countryName: country, generatedAt, edges, ...extra });
const entries = [{ topicId: 'A-1', date: '2026-10-02', title: 'A', sources: [{ url: 'https://www.reuters.com/a' }] }];

test('planBackfillLinks: current webs keep their model, history-only webs are web-history copies, a history web already current is not planned twice', () => {
  const now = web('Japan', '2026-10-30T05:02:00.000Z', [edge('t1', 't2')], { model: 'deepseek-v4-pro' });
  const plan = planBackfillLinks({
    current: [now], entries, runId: 'r',
    history: [
      { date: '2026-10-30', webs: [now, web('Japan', '2026-10-29T05:02:00.000Z', [edge('t1', 't2'), edge('t2', 't3')])] },
      { date: '2026-10-29', webs: [web('Japan', '2026-10-29T05:02:00.000Z', [edge('t1', 't2'), edge('t2', 't3')])] }, // the same web on the next file: once
    ],
  });
  assert.deepEqual(plan.counts, { current: 1, history: 2, historyWebs: 1 });
  assert.equal(plan.notes.length, 3);
  const [cur, ...old] = plan.notes;
  assert.deepEqual([cur.model, cur.payload.source, cur.cites.length], ['deepseek-v4-pro', undefined, 1]);
  assert.ok(old.every((n) => n.model === null && n.payload.source === 'web-history' && n.producer.lambda === 'record/cli/backfill-link-notes'));
});

test('planBackfillLinks: a re-plan gives the same noteIds; unknown countries are reported; citedDays lists the archive days to read', () => {
  const rows = [web('Japan', '2026-10-30T05:02:00.000Z', [edge('t1', 't2')], { model: 'm' }), web('Atlantis', '2026-10-30T05:02:00.000Z', [edge('t1', 't2')], { model: 'm' })];
  const a = planBackfillLinks({ current: rows, entries, runId: 'r1' });
  const b = planBackfillLinks({ current: rows, entries, runId: 'r2' });
  assert.deepEqual(a.notes.map((n) => n.noteId), b.notes.map((n) => n.noteId));
  assert.deepEqual(a.skipped.map((s) => s.reason), ['no_iso3']);
  assert.deepEqual(citedDays(rows), ['2026-10-02']);
});

test('planBackfillLinks: every web, with or without an edge, current or history, is one web note; a history-only web is a copy with model null', () => {
  const now = web('Japan', '2026-10-30T05:02:00.000Z', [edge('t1', 't2')], { model: 'deepseek-v4-pro', nodes: [{ threadId: 't1' }, { threadId: 't2' }], backbone: [{ from: 't1', to: 't2', sharedActors: ['G7'], weight: 1 }] });
  const empty = web('India', '2026-10-29T05:02:00.000Z', [], { model: 'deepseek-v4-pro', nodes: [{ threadId: 't5' }] });
  const old = web('Japan', '2026-10-29T05:02:00.000Z', [edge('t1', 't2')], { nodes: [{ threadId: 't1' }] });
  const plan = planBackfillLinks({ current: [now, empty], entries, runId: 'r', history: [{ date: '2026-10-29', webs: [now, empty, old] }, { date: '2026-10-30', webs: [old] }] });
  assert.deepEqual(plan.webNotes.map((n) => [n.subject.id, n.at.slice(0, 10), n.model, n.payload.source]), [['JPN', '2026-10-30', 'deepseek-v4-pro', undefined], ['IND', '2026-10-29', 'deepseek-v4-pro', undefined], ['JPN', '2026-10-29', null, 'web-history']]);
  assert.deepEqual(plan.webNotes[0].payload.backbone, [{ from: 't1', to: 't2', sharedActors: ['G7'], weight: 1 }]);
  assert.equal(plan.notes.length, 2); // India has no edge: a web note, no link note
});
