'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../src/lib');
const { run } = require('../src/index');
const { fakeStore } = require('./helpers');

test('ISO weeks across the year boundary (2026 has 53 weeks)', () => {
  assert.equal(lib.weekOf('2026-10-05'), '2026-W41');
  assert.equal(lib.weekOf('2026-10-11'), '2026-W41');
  assert.equal(lib.weekOf('2026-10-12'), '2026-W42');
  assert.equal(lib.weekOf('2026-12-31'), '2026-W53');
  assert.equal(lib.weekOf('2027-01-03'), '2026-W53');
  assert.equal(lib.weekOf('2027-01-04'), '2027-W01');
  assert.equal(lib.weekStart('2026-W41'), '2026-10-05');
  assert.equal(lib.weekEnd('2026-W41'), '2026-10-11');
  assert.equal(lib.weekStart('2027-W01'), '2027-01-04');
  assert.equal(lib.addWeeks('2026-W53', 1), '2027-W01');
  assert.equal(lib.addWeeks('2026-W41', 2), '2026-W43');
});

test('verdict windows: NO only after deadline + 3 days', () => {
  assert.equal(lib.canConcludeNo('2026-11-10', '2026-11-12'), false);
  assert.equal(lib.canConcludeNo('2026-11-10', '2026-11-13'), true);
  assert.equal(lib.isDue('2026-11-10', '2026-11-10'), true);
  assert.equal(lib.isDue('2026-11-10', '2026-11-09'), false);
});

const clock = (iso) => () => iso;
const deps = (store, iso) => ({ store, now: clock(iso), search: async () => [], llm: async () => ({}), draftModel: 'm' });

test('bootstrap tick on a Thursday commits the next TWO weeks, never the current one', async () => {
  const store = fakeStore();
  const out = await run({ action: 'tick' }, deps(store, '2026-10-01T10:30:00.000Z'));
  assert.deepEqual(out.committed, ['2026-W41', '2026-W42']);
  const c = await store.get('SEED#2026-W41', 'COMMIT');
  const sec = await store.get('SEED#2026-W41', 'SECRET');
  assert.equal(c.commitHash, lib.commitOf(sec.seedHex));
  assert.equal(c.weekStart, '2026-10-05');
  assert.equal(await store.get('SEED#2026-W40', 'COMMIT'), null);
});

test('tick is idempotent: a second tick the same day writes no new commitments', async () => {
  const store = fakeStore();
  await run({ action: 'tick' }, deps(store, '2026-10-01T10:30:00.000Z'));
  const before = store.rows.size;
  const out = await run({ action: 'tick' }, deps(store, '2026-10-01T22:00:00.000Z'));
  assert.deepEqual(out.committed, []);
  // only the new heartbeat row differs
  assert.equal(store.rows.size, before + 1);
});

test('a missed Monday is repaired by Tuesday: the ended week is drawn, and the next commits exist', async () => {
  const store = fakeStore();
  await run({ action: 'tick' }, deps(store, '2026-10-01T10:30:00.000Z')); // commits W41, W42
  const out = await run({ action: 'tick' }, deps(store, '2026-10-13T10:30:00.000Z')); // Tuesday after W41
  assert.deepEqual(out.drawn.map((d) => d.weekId), ['2026-W41']);
  assert.deepEqual(out.committed, ['2026-W43', '2026-W44']);
  assert.ok(await store.get('SEED#2026-W41', 'REVEAL'));
});

test('dryRun writes nothing', async () => {
  const store = fakeStore();
  const out = await run({ action: 'tick', dryRun: true }, deps(store, '2026-10-01T10:30:00.000Z'));
  assert.deepEqual(out.wouldCommit, ['2026-W41', '2026-W42']);
  assert.equal(store.rows.size, 0);
});
