'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const gather = require('../src/gather');
const { fakeFacts, entryFact } = require('./helpers');

const TODAY = '2026-11-10';
const Q = { qid: 'q', threadId: 'tA', issuedAt: '2026-10-20T05:00:00.000Z', deadline: '2026-11-02' }; // window 10-21 .. 11-05
const e = (thread, date, title = `T ${date}`) => entryFact(thread, date, { payload: { title, summary: `S ${date}` } });
const bundle = async (files, q = Q, today = TODAY) => {
  const loaded = await gather.loadEntries(fakeFacts(files), [q], today);
  return gather.buildBundle(q, loaded, today);
};

test('bundle: own-thread entries dated after the draw and up to due + 3, oldest first', async () => {
  const b = await bundle({
    '2026-10-19': [e('tA', '2026-10-19')], '2026-10-20': [e('tA', '2026-10-20')], // on/before the draw: excluded
    '2026-10-25': [e('tA', '2026-10-25'), e('tB', '2026-10-25', 'OTHER THREAD')],
    '2026-10-22': [e('tA', '2026-10-22')],
    '2026-11-05': [e('tA', '2026-11-05')], '2026-11-06': [e('tA', '2026-11-06')], // due + 3 is the last day; 11-06 is past it
  });
  assert.deepEqual(b.entries.map((x) => x.date), ['2026-10-22', '2026-10-25', '2026-11-05']);
  assert.ok(b.entries.every((x) => x.title !== 'OTHER THREAD'));
  assert.equal(b.complete, true);
  assert.deepEqual(Object.keys(b.entries[0]).sort(), ['date', 'eventId', 'summary', 'title', 'url']);
});

test('bundle: carries the first source url; a duplicate eventId counts once', async () => {
  const a = entryFact('tA', '2026-10-25', { eventId: 'dup' });
  const b = await bundle({ '2026-10-25': [a, a], '2026-10-26': [{ ...a, date: '2026-10-26' }] });
  assert.equal(b.entries.length, 1);
  assert.equal(b.entries[0].url, 'https://ex.com/tA');
});

test('bundle: an unreadable day inside the window marks it failed and incomplete; a story without a thread is never complete', async () => {
  const facts = { async getLines(key) { if (key.endsWith('2026-10-30.jsonl')) throw new Error('AccessDenied'); return { lines: [] }; } };
  const loaded = await gather.loadEntries(facts, [Q], TODAY);
  const b = gather.buildBundle(Q, loaded, TODAY);
  assert.equal(b.failed, true);
  assert.equal(b.complete, false);
  assert.equal((await bundle({}, { ...Q, threadId: null })).complete, false);
});

test('bundle: facts days are read once for many questions, and only the days a window needs', async () => {
  const keys = [];
  const facts = { async getLines(key) { keys.push(key); return { lines: [] }; } };
  await gather.loadEntries(facts, [Q, { ...Q, qid: 'q2' }], TODAY);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('record/facts/2026-10-21.jsonl') && keys.includes('record/facts/2026-11-05.jsonl'));
  assert.ok(!keys.includes('record/facts/2026-10-20.jsonl') && !keys.includes('record/facts/2026-11-06.jsonl'));
});

test('no network module is imported anywhere in src (no search, fetch, http)', () => {
  const dir = path.join(__dirname, '../src');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert.ok(!files.includes('search.js'));
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(text, /require\(['"](https?|node:https?|node-fetch|axios|undici)['"]\)|\bfetch\(|BRAVE|brave/i, f);
  }
});
