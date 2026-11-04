import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { newestWeekNote, planHold, readWeekNotes, run } from './hold-weekly-brief.mjs';

const require = createRequire(import.meta.url);
const N = require('../../shared/src/notes.js');
const { fakeS3 } = require('../newsStoryRecord/test/fake-s3.js');
const { buildBriefViews } = require('../newsStoryRecord/src/briefViews.js');
const rows = JSON.parse(readFileSync(new URL('./fixtures/brief-rows.json', import.meta.url), 'utf8'));
const row = rows.weekly.find((r) => r.status === 'published' && r.weekOf === '2026-10-25');
const producer = { lambda: 'test', runId: 't' };
const first = N.weeklyBriefNote({ item: row, producer });
const NOW = new Date('2026-11-04T12:00:00.000Z');
const seed = () => {
  const f = fakeS3();
  f.put('record/notes/weekly_brief/manifest.json', { schemaVersion: 1, days: [first.date] });
  f.objs.set(`record/notes/weekly_brief/${first.date}.jsonl`, { body: `${JSON.stringify(first)}\n`, etag: '"s"' });
  return f;
};
const views = (notes) => buildBriefViews(notes, {});

test('planHold: a draft note has the same content, a later at and a new noteId; the newest note wins in the view builder and drops the week', () => {
  const { note, newest } = planHold({ noteLines: [first], weekOf: '2026-10-25', status: 'draft', now: NOW, producer });
  assert.equal(newest.noteId, first.noteId);
  assert.equal(note.payload.status, 'draft');
  assert.deepEqual({ ...note.payload, status: 'published' }, first.payload);
  assert.deepEqual([note.subject, note.iso3, note.model, note.cites], [first.subject, first.iso3, first.model, first.cites]);
  assert.equal(note.at, NOW.toISOString());
  assert.notEqual(note.noteId, first.noteId);
  for (const order of [[first, note], [note, first]]) {
    const v = views(order);
    assert.equal(v.weekly.has('2026-10-25'), false);
    assert.equal(v.index.weekly.some((w) => w.weekOf === '2026-10-25'), false);
    assert.equal(v.held.get('2026-10-25').brief, null);
  }
});

test('planHold: publishing again appends a still later published note that brings the week back', () => {
  const { note: draft } = planHold({ noteLines: [first], weekOf: '2026-10-25', status: 'draft', now: NOW, producer });
  const { note: back } = planHold({ noteLines: [first, draft], weekOf: '2026-10-25', status: 'published', now: new Date('2026-11-05T00:00:00.000Z'), producer });
  assert.equal(back.payload.status, 'published');
  assert.ok(back.at > draft.at);
  assert.equal(views([back, first, draft]).weekly.has('2026-10-25'), true);
});

test('planHold: a clock behind the newest note still lands 1 ms after it; same status is a no-op; no note or a bad week throws', () => {
  const { note } = planHold({ noteLines: [first], weekOf: '2026-10-25', status: 'draft', now: new Date('2020-01-01T00:00:00Z'), producer });
  assert.equal(Date.parse(note.at), Date.parse(first.at) + 1);
  assert.equal(planHold({ noteLines: [first], weekOf: '2026-10-25', status: 'published', now: NOW, producer }).noop, true);
  assert.throws(() => planHold({ noteLines: [first], weekOf: '2026-10-18', status: 'draft', producer }), /no weekly_brief note/);
  assert.throws(() => planHold({ noteLines: [], weekOf: 'soon', status: 'draft', producer }), /weekOf/);
  assert.equal(newestWeekNote([], '2026-10-25'), null);
});

test('run: a dry run reads, prints the note and writes nothing (not even with --row)', async () => {
  const f = seed();
  const calls = [];
  const report = await run({ weekOf: '2026-10-25', status: 'draft', write: false, row: true, prefix: 'record/', s3json: f.s3json, setRowStatus: async (...a) => calls.push(a), now: NOW, producer });
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.note.payload.status, 'draft');
  assert.deepEqual([report.noteWritten, report.row.written], [false, false]);
  assert.deepEqual([f.puts.length, calls.length], [0, 0]);
});

test('run --write appends the note under the right day file and manifest; --row sets the row; a re-run is a no-op', async () => {
  const f = seed();
  const calls = [];
  const args = { weekOf: '2026-10-25', status: 'draft', write: true, row: true, prefix: 'record/', s3json: f.s3json, setRowStatus: async (...a) => calls.push(a), now: NOW, producer };
  const report = await run(args);
  assert.equal(report.noteWritten, true);
  assert.deepEqual(calls, [['2026-10-25', 'draft']]);
  assert.deepEqual(f.json('record/notes/weekly_brief/manifest.json').days, [first.date, '2026-11-04']);
  const stored = await readWeekNotes(f.s3json, 'record/', '2026-10-25');
  assert.deepEqual(stored.map((n) => n.payload.status), ['published', 'draft']);
  assert.equal(views(stored).weekly.has('2026-10-25'), false);
  const again = await run(args);
  assert.equal(again.noteWritten, false);
  assert.equal(again.reason.includes('already draft'), true);
  assert.equal((await readWeekNotes(f.s3json, 'record/', '2026-10-25')).length, 2);
});
