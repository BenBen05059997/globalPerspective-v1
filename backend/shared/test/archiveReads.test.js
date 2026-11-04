'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/archiveReads');
const I = require('../src/entriesInbox');
const { readArchiveEntries } = require('../src/archiveEntries');

const NOW = Date.parse('2026-11-04T12:00:00.000Z');
const quiet = () => { const l = { logs: [], warns: [], log: (m) => l.logs.push(m), warn: (m) => l.warns.push(m) }; return l; };
const src = (n) => Array.from({ length: n }, (_, i) => ({ source: `s${i}.com`, url: `https://s${i}.com/x` }));
const entry = (id, at, extra = {}) => ({ topicId: id, threadId: `th-${id}`, title: id, regions: ['France'], category: 'society', sources: src(10), archivedAt: at, generationId: 'g', ai: { summary: `sum ${id}` }, ...extra });

// A day file written by the shared writer: one batch per item.
const lines = (batches) => batches.flatMap(({ batch, entries }) => I.inboxLines(entries, { batch }));
const DAY = '2026-11-03';
const dayLines = lines([{ batch: `${DAY}T05:00:00.000Z`, entries: [entry('A', `${DAY}T05:00:00.000Z`), entry('B', `${DAY}T05:00:00.001Z`)] }]);
// the DynamoDB row the same writes leave
const ddbRowOf = (ls) => A.archiveOfLines(ls);
const todayLines = lines([{ batch: '2026-11-04T06:00:00.000Z', entries: [entry('C', '2026-11-04T06:00:00.000Z'), entry('D', '2026-11-04T06:00:00.001Z')] }]);

function reader(mode, { prefix = 'record/', ddb = {}, files = {}, log = quiet() } = {}) {
  const calls = { ddb: [], days: [] };
  const getRow = A.archiveRowReader({
    mode, prefix, log, now: () => NOW,
    ddbGetRow: async (key) => { calls.ddb.push(key); return { Item: ddb[key] || null }; },
    readDay: async (day) => { calls.days.push(day); return files[day] || []; },
  });
  return { getRow, calls, log };
}

test('readMode: unknown value or a missing prefix falls back to ddb with a warning', () => {
  const l = quiet();
  assert.equal(A.readMode('X', undefined, 'record/', l), 'ddb');
  assert.equal(A.readMode('X', ' Compare ', 'record/', l), 'compare');
  assert.equal(A.readMode('X', 'nope', 'record/', l), 'ddb');
  assert.equal(A.readMode('X', 'inbox', '', l), 'ddb');
  assert.equal(l.warns.length, 2);
});

test('ddb mode is the DynamoDB getRow itself; the inbox is never read', async () => {
  const r = reader('ddb', { ddb: { [`archive#${DAY}`]: { entries: [1] } }, files: { [DAY]: dayLines } });
  assert.deepEqual(await r.getRow(`archive#${DAY}`), { Item: { entries: [1] } });
  assert.deepEqual(r.calls.days, []);
});

test('unset prefix: inbox and compare read DynamoDB only', async () => {
  for (const mode of ['inbox', 'compare']) {
    const r = reader(mode, { prefix: '', ddb: { [`archive#${DAY}`]: { entries: [] } }, files: { [DAY]: dayLines } });
    await r.getRow(`archive#${DAY}`);
    assert.deepEqual(r.calls.days, []);
    assert.equal(r.calls.ddb.length, 1);
  }
});

test('inbox mode: archive#DAY is the replayed row, no DynamoDB call; a missing day file is a missing row', async () => {
  const r = reader('inbox', { files: { [DAY]: dayLines } });
  const { Item } = await r.getRow(`archive#${DAY}`);
  assert.deepEqual(Item, ddbRowOf(dayLines));
  assert.deepEqual((await r.getRow('archive#2026-10-20')), { Item: null });
  assert.deepEqual(r.calls.ddb, []);
});

test('inbox mode: today-archive is today\'s file replayed (10 sources), the read days are memoised', async () => {
  const r = reader('inbox', { files: { '2026-11-04': todayLines } });
  const { Item } = await r.getRow('today-archive');
  assert.deepEqual(Item.entries.map((e) => e.topicId), ['C', 'D']);
  assert.equal(Item.entries[0].sources.length, 10);
  await r.getRow('today-archive');
  assert.deepEqual(r.calls.days, ['2026-11-04']);
  assert.deepEqual((await reader('inbox').getRow('today-archive')), { Item: null });
});

test('inbox mode: a failed S3 read throws to the caller (readArchiveEntries onError)', async () => {
  const getRow = A.archiveRowReader({ mode: 'inbox', prefix: 'record/', log: quiet(), now: () => NOW, ddbGetRow: async () => ({}), readDay: async () => { throw new Error('AccessDenied'); } });
  const failed = [];
  const out = await readArchiveEntries({ days: 1, getRow, project: (e) => e, onError: (k, e) => failed.push(`${k}:${e.message}`) });
  assert.deepEqual(out, []);
  assert.equal(failed.length, 2);
  assert.match(failed[0], /AccessDenied/);
});

test('compare mode: equal rows log equal and answer DynamoDB', async () => {
  const ddb = { [`archive#${DAY}`]: structuredClone(ddbRowOf(dayLines)) };
  const r = reader('compare', { ddb, files: { [DAY]: dayLines } });
  assert.deepEqual(await r.getRow(`archive#${DAY}`), { Item: ddb[`archive#${DAY}`] });
  assert.deepEqual(r.log.logs, [`[archive-compare] archive#${DAY}: equal`]);
  assert.deepEqual(r.log.warns, []);
});

test('compare mode: a difference in ai, in sources, in order, or a missing entry is DIFFER, and DynamoDB is still answered', async () => {
  const base = ddbRowOf(dayLines);
  const cases = {
    ai: (row) => { row.entries[0].ai.summary = 'changed'; },
    sources: (row) => { row.entries[1].sources.pop(); },
    missing: (row) => { row.entries.pop(); },
    order: (row) => { row.entries.reverse(); },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const row = structuredClone(base);
    mutate(row);
    const r = reader('compare', { ddb: { [`archive#${DAY}`]: row }, files: { [DAY]: dayLines } });
    assert.deepEqual(await r.getRow(`archive#${DAY}`), { Item: row }, name);
    assert.equal(r.log.warns.length, 1, name);
    assert.match(r.log.warns[0], new RegExp(`\\[archive-compare\\] archive#${DAY}: DIFFER [1-9]`), name);
  }
});

test('compare mode: a day that is empty on both sides is equal', async () => {
  const r = reader('compare');
  await r.getRow('archive#2026-10-20');
  assert.deepEqual(r.log.logs, ['[archive-compare] archive#2026-10-20: equal']);
});

test('compare mode, today-archive: the inbox side is cut to 3 sources and to today\'s entries', async () => {
  const item = { entries: [entry('Y', '2026-11-03T23:00:00.000Z', { sources: src(3) }), ...A.archiveOfLines(todayLines).entries.map((e) => ({ ...e, sources: e.sources.slice(0, 3) }))] };
  const r = reader('compare', { ddb: { 'today-archive': item }, files: { '2026-11-04': todayLines } });
  assert.deepEqual(await r.getRow('today-archive'), { Item: item });
  assert.deepEqual(r.log.logs, ['[archive-compare] today-archive: equal']);
  // sources beyond 3 on the DynamoDB side would be a real difference
  const bad = structuredClone(item);
  bad.entries[1].sources = src(5);
  const r2 = reader('compare', { ddb: { 'today-archive': bad }, files: { '2026-11-04': todayLines } });
  await r2.getRow('today-archive');
  assert.match(r2.log.warns[0], /today-archive: DIFFER/);
});

test('compare mode: an inbox read error is logged and DynamoDB is answered', async () => {
  const log = quiet();
  const getRow = A.archiveRowReader({ mode: 'compare', prefix: 'record/', log, now: () => NOW, ddbGetRow: async () => ({ Item: { entries: [] } }), readDay: async () => { throw new Error('boom'); } });
  assert.deepEqual(await getRow(`archive#${DAY}`), { Item: { entries: [] } });
  assert.match(log.warns[0], /inbox read failed \(boom\)/);
});

test('other keys always go to DynamoDB', async () => {
  const r = reader('inbox');
  await r.getRow('latest');
  assert.deepEqual(r.calls.ddb, ['latest']);
});

test('inboxDayLines reads <prefix>inbox/<kind>/DAY.jsonl', async () => {
  let key;
  const out = await A.inboxDayLines({ getLines: async (k) => { key = k; return { lines: [1] }; } }, 'record/', 'entries', DAY);
  assert.equal(key, `record/inbox/entries/${DAY}.jsonl`);
  assert.deepEqual(out, [1]);
});

test('readArchiveEntries over the inbox reader gives what it gives over the DynamoDB rows', async () => {
  const files = {};
  const ddb = {};
  const d = new Date(); // readArchiveEntries uses the real clock: build the fixture on real days
  for (let i = 1; i <= 3; i++) {
    const day = new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10);
    files[day] = lines([{ batch: `${day}T05:00:00.000Z`, entries: [entry(`E${i}`, `${day}T05:00:00.000Z`)] }]);
    ddb[`archive#${day}`] = A.archiveOfLines(files[day]);
  }
  const run = (mode) => readArchiveEntries({
    days: 4,
    project: (e, date) => ({ id: e.topicId, date, n: e.sources.length, ai: e.ai }),
    getRow: A.archiveRowReader({ mode, prefix: 'record/', log: quiet(), ddbGetRow: async (k) => ({ Item: ddb[k] || null }), readDay: async (day) => files[day] || [] }),
  });
  const viaDdb = await run('ddb');
  assert.equal(viaDdb.length, 3);
  assert.deepEqual(await run('inbox'), viaDdb);
});
