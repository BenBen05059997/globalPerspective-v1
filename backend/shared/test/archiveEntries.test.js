'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { readArchiveEntries } = require('../src/archiveEntries');
const { keepDayZero, archiveRowKey } = require('../src/dayZero');

const NOW = Date.parse('2026-03-01T00:30:00Z');
const at = (iso) => ({ archivedAt: iso });

function fixedClock(t, ms = NOW) { t.mock.timers.enable({ apis: ['Date'], now: ms }); }

// The loop the four Lambdas carried before (newsCountryIntelligence's text), the reference for the equivalence test below.
async function oldRead(days, send) {
  const entries = [];
  const now = new Date();
  for (let i = 0; i <= days; i++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    const key = i === 0 ? 'today-archive' : archiveRowKey(date);
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    try {
      const { Item } = await send(key);
      if (Item && Array.isArray(Item.entries)) {
        for (const e of (i === 0 ? keepDayZero(Item.entries) : Item.entries)) {
          entries.push({ topicId: e.topicId, date: dateStr, sources: e.sources || [] });
        }
      }
    } catch (err) {
      console.warn(`Failed to read ${key}:`, err.message);
    }
  }
  return entries;
}

test('reads today-archive then archive#<day> back to `days`, with each entry stamped by its UTC day (month and leap-day rollover)', async (t) => {
  fixedClock(t);
  const keys = [];
  const rows = await readArchiveEntries({
    days: 2,
    getRow: async (key) => { keys.push(key); return { Item: { entries: [{ topicId: key, archivedAt: '2026-03-01T00:10:00Z' }] } }; },
    project: (e, date) => ({ id: e.topicId, date }),
  });
  assert.deepStrictEqual(keys, ['today-archive', 'archive#2026-02-28', 'archive#2026-02-27']);
  assert.deepStrictEqual(rows, [
    { id: 'today-archive', date: '2026-03-01' },
    { id: 'archive#2026-02-28', date: '2026-02-28' },
    { id: 'archive#2026-02-27', date: '2026-02-27' },
  ]);
});

test('day 0 keeps only entries archived today (dayZero rule); earlier days keep everything', async (t) => {
  fixedClock(t);
  const rows = await readArchiveEntries({
    days: 1,
    getRow: async (key) => ({ Item: { entries: [{ id: `${key}:new`, ...at('2026-03-01T00:05:00Z') }, { id: `${key}:stale`, ...at('2026-02-10T00:05:00Z') }] } }),
    project: (e) => e.id,
  });
  assert.deepStrictEqual(rows, ['today-archive:new', 'archive#2026-02-28:new', 'archive#2026-02-28:stale']);
});

test('a falsy projection skips the entry; a missing item, a non-array `entries` or an empty day add nothing', async (t) => {
  fixedClock(t);
  const answers = [{}, { Item: { entries: 'x' } }, { Item: { entries: [{ id: 1 }, { id: 2 }] } }];
  let n = 0;
  const rows = await readArchiveEntries({ days: 2, getRow: async () => answers[n++], project: (e) => (e.id === 1 ? null : e.id) });
  assert.deepStrictEqual(rows, [2]);
});

test('a failing read or projection is logged as "Failed to read <key>:" and the next day is still read', async (t) => {
  fixedClock(t);
  const warn = t.mock.method(console, 'warn', () => {});
  let n = 0;
  const rows = await readArchiveEntries({
    days: 2,
    getRow: async (key) => { if (n++ === 1) throw new Error('boom'); return { Item: { entries: [{ id: key, ...at('2026-03-01T00:05:00Z') }] } }; },
    project: (e) => e.id,
  });
  assert.deepStrictEqual(rows, ['today-archive', 'archive#2026-02-27']);
  assert.deepStrictEqual(warn.mock.calls.map((c) => c.arguments), [['Failed to read archive#2026-02-28:', 'boom']]);

  // a projection that throws on a bad entry: the entries of that day collected before it stay, the rest of that day is dropped
  warn.mock.resetCalls();
  const partial = await readArchiveEntries({
    days: 1,
    getRow: async () => ({ Item: { entries: [{ id: 'ok', ...at('2026-03-01T00:05:00Z') }, null, { id: 'never' }] } }),
    project: (e) => e.id,
  });
  assert.deepStrictEqual(partial, ['ok', 'ok']);
  assert.strictEqual(warn.mock.calls.length, 1);
});

test('onError replaces the log: a caller can fail the whole read (newsWeeklyBrief)', async (t) => {
  fixedClock(t);
  await assert.rejects(
    readArchiveEntries({ days: 1, getRow: async () => { throw new Error('nope'); }, project: (e) => e, onError: (key, err) => { throw new Error(`read ${key} failed: ${err.message}`); } }),
    { message: 'read today-archive failed: nope' },
  );
});

test('same rows and same log lines as the loop the Lambdas used to carry, for 40 days from several clocks', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const send = (key) => {
    if (key.endsWith('-05')) throw new Error('flaky');
    if (key.endsWith('-06')) return {};
    return { Item: { entries: [{ topicId: key, sources: key.endsWith('-07') ? undefined : [{ url: key }], archivedAt: '2026-03-01T00:10:00Z' }, null] } };
  };
  for (const now of ['2026-03-01T00:30:00Z', '2024-03-01T23:59:59Z', '2026-12-31T23:59:59Z', '2027-01-01T00:00:00Z', '2026-07-15T12:00:00Z']) {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) });
    for (const days of [0, 1, 40]) {
      warn.mock.resetCalls();
      const a = await oldRead(days, async (k) => send(k));
      const warnsOld = warn.mock.calls.map((c) => c.arguments);
      warn.mock.resetCalls();
      const b = await readArchiveEntries({ days, getRow: async (k) => send(k), project: (e, date) => ({ topicId: e.topicId, date, sources: e.sources || [] }) });
      assert.deepStrictEqual(b, a, `${now} ${days}`);
      assert.deepStrictEqual(warn.mock.calls.map((c) => c.arguments), warnsOld, `${now} ${days} log`);
    }
    t.mock.timers.reset();
  }
});
