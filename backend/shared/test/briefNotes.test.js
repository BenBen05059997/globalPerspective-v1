'use strict';
// Brief notes (decision 0048): the stored row becomes one daily_brief / weekly_brief note; NOTES_PREFIX unset writes nothing;
// a failing writer never throws. Rows are live-shaped (backend/record/cli/fixtures/brief-rows.json).
const test = require('node:test');
const assert = require('node:assert/strict');
const rows = require('../../record/cli/fixtures/brief-rows.json');
const { writeBriefNote } = require('../src/briefNotes');
const { briefWithIso3, weeklyWithIso3, briefCountries } = require('../src/briefs');

const fakeWriter = () => { const w = { calls: [], write: async (subtype, notes) => { w.calls.push([subtype, notes]); return { appended: notes.length, skipped: 0, days: [] }; } }; return w; };

test('the stored daily row is written as one daily_brief note under the prefix; payload is the row without storage keys', async () => {
  const writer = fakeWriter();
  const item = rows.daily[0];
  const note = await writeBriefNote({ subtype: 'daily_brief', item, lambda: 'newsPostDevTo', runId: item.generatedAt, prefix: 'record/shadow/', writer });
  assert.equal(writer.calls.length, 1);
  assert.equal(writer.calls[0][0], 'daily_brief');
  assert.deepEqual(writer.calls[0][1], [note]);
  assert.deepEqual([note.subject, note.part, note.at, note.model, note.producer], [{ kind: 'brief', id: 'daily:2026-10-30' }, '', '2026-10-30T14:01:22.979Z', 'deepseek-v4-pro', { lambda: 'newsPostDevTo', runId: item.generatedAt }]);
  assert.equal(note.payload.headline, item.headline);
  for (const k of ['PK', 'SK', 'ttl', 'generatedAt', 'model']) assert.equal(k in note.payload, false, k);
});

test('the stored weekly row is written as one weekly_brief note about its weekOf', async () => {
  const writer = fakeWriter();
  const note = await writeBriefNote({ subtype: 'weekly_brief', item: rows.weekly[0], lambda: 'newsWeeklyBrief', runId: 'r', prefix: 'record/', writer });
  assert.equal(writer.calls[0][0], 'weekly_brief');
  assert.deepEqual([note.subject.id, note.payload.status, note.date], ['weekly:2026-10-25', 'published', '2026-10-25']);
  assert.deepEqual(note.iso3, briefCountries(weeklyWithIso3(rows.weekly[0])));
});

test('NOTES_PREFIX unset: no note, the writer is never touched', async () => {
  const saved = process.env.NOTES_PREFIX;
  delete process.env.NOTES_PREFIX;
  try {
    const writer = fakeWriter();
    assert.equal(await writeBriefNote({ subtype: 'daily_brief', item: rows.daily[0], lambda: 'l', runId: 'r', writer }), null);
    assert.equal(writer.calls.length, 0);
    process.env.NOTES_PREFIX = 'record/shadow/';
    assert.ok(await writeBriefNote({ subtype: 'daily_brief', item: rows.daily[0], lambda: 'l', runId: 'r', writer }));
  } finally { if (saved === undefined) delete process.env.NOTES_PREFIX; else process.env.NOTES_PREFIX = saved; }
});

test('a failing writer or an unusable row never throws: the run goes on and the failure is logged as [notes]', async () => {
  const errors = [];
  const orig = console.error; console.error = (m) => errors.push(m);
  try {
    const args = { subtype: 'daily_brief', lambda: 'l', runId: 'r', prefix: 'record/shadow/' };
    assert.equal(await writeBriefNote({ ...args, item: rows.daily[0], writer: { write: async () => { throw new Error('s3 down'); } } }), null);
    assert.equal(await writeBriefNote({ ...args, item: { ...rows.daily[0], generatedAt: 'not a date' }, writer: fakeWriter() }), null);
    assert.equal(await writeBriefNote({ ...args, item: null, writer: fakeWriter() }), null); // nothing to write is not an error
  } finally { console.error = orig; }
  assert.equal(errors.length, 2);
  assert.match(errors[0], /^\[notes\] daily_brief note not written: s3 down/);
});

test('briefWithIso3 and weeklyWithIso3 fill iso3 from names where the stored row has none; a stored iso3 is kept', () => {
  const old = briefWithIso3(rows.daily[2]);
  assert.ok(old.topStories.every((s) => Array.isArray(s.iso3)));
  assert.ok(old.topStories.some((s) => s.iso3.length > 0));
  const kept = briefWithIso3({ topStories: [{ regions: ['France'], iso3: ['DEU'] }], countryToWatch: { countryName: 'Japan' } });
  assert.deepEqual([kept.topStories[0].iso3, kept.countryToWatch.iso3], [['DEU'], ['JPN']]);
  assert.deepEqual(weeklyWithIso3({ signals: [{ region: 'Yemen · Saudi Arabia' }] }).signals[0].iso3, ['YEM', 'SAU']);
  assert.equal(weeklyWithIso3({ signals: 'x' }).signals, 'x');
});
