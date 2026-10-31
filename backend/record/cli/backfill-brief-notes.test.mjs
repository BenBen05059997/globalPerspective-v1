import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { planBriefNotes } from './backfill-brief-notes.mjs';

const require = createRequire(import.meta.url);
const N = require('../../shared/src/notes.js');
const { fakeS3 } = require('../newsStoryRecord/test/fake-s3.js');
// live DAILY_BRIEF# / WEEKLY_BRIEF# rows (read 2026-10-31, cut down), with their storage keys as the table keeps them
const rows = JSON.parse(readFileSync(new URL('./fixtures/brief-rows.json', import.meta.url), 'utf8'));
const daily = rows.daily.map((r) => ({ PK: `DAILY_BRIEF#${r.dateKey}`, SK: 'DAILY_BRIEF', ttl: 1, ...r }));
const weekly = rows.weekly.map((r) => ({ PK: `WEEKLY_BRIEF#${r.weekOf}`, SK: 'WEEKLY_BRIEF', ttl: 1, ...r }));
const producer = { lambda: 'record/cli/backfill-brief-notes', runId: 'test' };

test('planBriefNotes: one note per stored row, drafts included (the views serve published ones only), storage keys left out', () => {
  const plan = planBriefNotes({ daily, weekly, producer });
  assert.deepEqual(plan.counts, { daily: 4, weekly: 4, weeklyPublished: 3 });
  assert.deepEqual(plan.skipped, []);
  assert.deepEqual(plan.daily.map((n) => n.subject.id), daily.map((r) => `daily:${r.dateKey}`));
  assert.deepEqual(plan.weekly.map((n) => n.subject.id), weekly.map((r) => `weekly:${r.weekOf}`));
  for (const n of [...plan.daily, ...plan.weekly]) {
    assert.equal(n.producer.lambda, 'record/cli/backfill-brief-notes');
    for (const k of ['PK', 'SK', 'ttl']) assert.equal(k in n.payload, false, k);
  }
  assert.deepEqual(plan.daily.map((n) => n.model), daily.map((r) => r.model)); // the row's own model, never null
});

test('planBriefNotes: a row the builder refuses is reported, not written; a row with no content is reported too', () => {
  const plan = planBriefNotes({ producer, daily: [{ ...daily[0], generatedAt: 'nope' }, { PK: 'DAILY_BRIEF#2026-01-01', SK: 'DAILY_BRIEF', dateKey: '2026-01-01' }, daily[1]], weekly: [{ ...weekly[0], model: undefined }] });
  assert.deepEqual(plan.counts, { daily: 1, weekly: 0, weeklyPublished: 0 });
  assert.deepEqual(plan.skipped.map((s) => s.reason), ['notes: daily_brief needs a valid at', 'no_content', 'notes: model is required (null only on an archive, history or web-history copy)']);
});

test('a re-run appends nothing, and the note a writer made for the same row has the same noteId (it is skipped, not doubled)', async () => {
  const f = fakeS3();
  const writer = N.makeNoteWriter({ s3json: f.s3json, prefix: 'record/shadow/' });
  const plan = planBriefNotes({ daily, weekly, producer });
  const first = await writer.write('daily_brief', plan.daily);
  assert.equal(first.appended, 4);
  await writer.write('weekly_brief', plan.weekly);
  const again = planBriefNotes({ daily, weekly, producer: { ...producer, runId: 'second' } });
  assert.deepEqual([(await writer.write('daily_brief', again.daily)).appended, (await writer.write('weekly_brief', again.weekly)).appended], [0, 0]);
  // newsPostDevTo writes the same row through the same builder
  const fromWriter = N.dailyBriefNote({ item: daily[0], producer: { lambda: 'newsPostDevTo', runId: 'x' } });
  assert.equal(fromWriter.noteId, plan.daily[0].noteId);
  assert.equal((await writer.write('daily_brief', [fromWriter])).appended, 0);
  assert.deepEqual(f.json('record/shadow/notes/daily_brief/manifest.json').days, ['2026-04-09', '2026-06-10', '2026-10-25', '2026-10-30']);
  assert.equal(f.lines('record/shadow/notes/weekly_brief/2026-10-25.jsonl').length, 1);
});
