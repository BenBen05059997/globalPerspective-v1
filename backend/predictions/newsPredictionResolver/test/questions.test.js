'use strict';
// QUESTIONS_SOURCE (decision 0052): the resolver finds its questions in the record's forecast facts instead of the PRED# rows, with the same rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../src/lib');
const { run } = require('../src/index');
const Q = require('../src/questions');
const { fakeStore, predRow, fakeFacts } = require('./helpers');

// The forecast fact newsStoryRecord writes for a PRED# row (the fields the rules read; payload as facts.js forecastFact makes it).
function factOf(row) {
  const forkId = `${row.PK}/${row.SK}`;
  const branches = row.scenarios.flatMap((s, si) => s.triggers.map((t) => ({
    branchId: `${forkId}/${t.id}`, text: s.label, p: t.p, trigger: t.text, resolutionSource: t.resolutionSource || '', due: t.deadline, question: t.question, qid: t.qid, scenarioP: s.probability * 100, si,
  })));
  return { kind: 'forecast_drawn', at: row.generatedAt, date: row.generatedAt.slice(0, 10), precision: 'exact', threadId: row.threadId, payload: { forkId, topicId: row.topicId, branches } };
}
const okRuns = (days) => Object.fromEntries(days.map((d) => [d, { status: 'ok', inputs: { archiveDay: 'present' } }]));

// four stories issued in W41 (2026-10-05..11), one with a lead too short, one issued outside the week; two stories share a thread
const PREDS = [
  predRow('a', '2026-10-05', 2, { lead: 30, thread: 'tA' }),
  predRow('b', '2026-10-07', 1, { lead: 40, thread: 'tA' }),
  predRow('c', '2026-10-09', 1, { lead: 3, thread: 'tC' }), // lead under 7: not eligible
  predRow('d', '2026-10-11', 3, { lead: 60, thread: 'tD' }),
  predRow('e', '2026-10-12', 1, { lead: 30, thread: 'tE' }), // next week
].map((r) => ({ ...r, topicId: `${r.title}-1` })); // the PRED# key is `<title>-<n>`: the record derives the title from it
const facts = () => {
  const files = {};
  for (const r of PREDS) (files[r.SK] ||= []).push(factOf(r));
  return fakeFacts(files);
};
const week = { weekId: '2026-W41', weekStart: '2026-10-05', weekEnd: '2026-10-11' };
const strip = (l) => JSON.stringify([...l].sort((x, y) => (x.qid < y.qid ? -1 : 1)));
const noWarn = () => ({ warnings: [], logs: [], log(m) { this.logs.push(m); }, warn(m) { this.warnings.push(m); } });

test('record source: the eligible questions of a week equal the PRED# rows\' (same fields, same lead rule), and the open questions equal too', async () => {
  const store = fakeStore(PREDS);
  const f = facts();
  const record = Q.recordSource(f, { today: '2026-10-20' });
  const log = Q.logSource(store);
  const [a, b] = [await log.eligible(week), await record.eligible(week)];
  assert.equal(a.length, 6, 'a:2 + b:1 + d:3; c has a 3-day lead');
  assert.equal(strip(b), strip(a));
  assert.equal(strip(await record.all()), strip(await log.all()));
  assert.equal(Q.compareQuestions(a, b).differing, 0);
});

test('a forecast drawn just after midnight carries the next day\'s date but its row day stays in the week', async () => {
  const late = predRow('z', '2026-10-11', 1, { lead: 30, thread: 'tZ' });
  late.generatedAt = '2026-10-12T00:00:05.000Z';
  const files = { '2026-10-12': [factOf(late)] };
  const record = Q.recordSource(fakeFacts(files), { today: '2026-10-20' });
  assert.deepEqual((await record.eligible(week)).map((q) => q.qid), ['z-2026-10-11-0']);
});

test('record source: a week whose facts day has no complete Run is not drawn (the draw waits), and compare names the difference', async () => {
  const runs = okRuns(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']); // 10-11 missing
  const f = fakeFacts({ '2026-10-05': [factOf(PREDS[0])] }, runs);
  await assert.rejects(Q.recordSource(f).eligible(week), /record facts for 2026-10-11 are not complete.*draw waits/);
  // the tick reports it and still runs the rest of the night
  const store = fakeStore(PREDS);
  await run({ action: 'tick' }, { store, now: () => '2026-10-01T10:30:00.000Z', llm: async () => ({}), draftModel: 'm' });
  const out = await run({ action: 'tick' }, { store, questions: Q.recordSource(f), now: () => '2026-10-13T10:30:00.000Z', llm: async () => ({}), draftModel: 'm' });
  assert.deepEqual(out.drawn, []);
  assert.match(out.errors[0], /2026-W41: draw postponed/);
});

test('the draw is the same whichever source finds the questions', async () => {
  const draws = {};
  for (const mode of ['log', 'record']) {
    const store = fakeStore(PREDS);
    const questions = mode === 'log' ? Q.logSource(store) : Q.recordSource(facts());
    await run({ action: 'tick' }, { store, questions, now: () => '2026-10-01T10:30:00.000Z', llm: async () => ({}), draftModel: 'm' }); // commits W41, W42
    const out = await run({ action: 'tick' }, { store, questions, now: () => '2026-10-13T10:30:00.000Z', llm: async () => ({}), draftModel: 'm' });
    const draw = await store.get('SAMPLE#2026-W41', 'DRAW');
    draws[mode] = { summary: out.drawn, pool: draw.pool, picked: draw.picked.map((p) => p.qid) };
  }
  assert.deepEqual(draws.log.summary, draws.record.summary);
  assert.equal(draws.log.summary[0].eligible, 6);
  assert.deepEqual(draws.log.pool, draws.record.pool);
  assert.deepEqual(draws.log.picked.length, 2, 'two stories (tA, tD) among the eligible');
});

test('compare mode serves the log and logs [questions-compare]: clean when equal, the qid when not', async () => {
  const store = fakeStore(PREDS);
  const log = noWarn();
  const clean = Q.makeQuestions('compare', { store, facts: facts(), today: '2026-10-20', log });
  assert.equal((await clean.eligible(week)).length, 6);
  assert.equal((await clean.all()).length, 8);
  assert.equal(log.warnings.length, 0);
  assert.match(log.logs[0], /^\[questions-compare\] .*"what":"eligible 2026-W41".*"differing":0/);
  // the record lacks story d's forecast
  const files = {};
  for (const r of PREDS.filter((x) => x.title !== 'Story d')) (files[r.SK] ||= []).push(factOf(r));
  const log2 = noWarn();
  const bad = Q.makeQuestions('compare', { store, facts: fakeFacts(files), today: '2026-10-20', log: log2 });
  assert.equal((await bad.eligible(week)).length, 6, 'the log\'s answer is used');
  assert.equal(log2.warnings.length, 1);
  const body = JSON.parse(log2.warnings[0].replace('[questions-compare] ', ''));
  assert.deepEqual([body.log, body.record, body.differing], [6, 3, 3]);
  assert.ok(body.differences.every((d) => d.only === 'log'));
});

test('modes: log is the default, record and compare need the bucket, anything else is refused', () => {
  assert.equal(Q.makeQuestions(undefined, { store: fakeStore() }).mode, 'log');
  assert.throws(() => Q.makeQuestions('record', { store: fakeStore() }), /needs the record bucket/);
  assert.throws(() => Q.makeQuestions('nope', { store: fakeStore() }), /must be one of/);
  assert.equal(lib.eligibleQuestions(PREDS, '2026-W41').length, 6);
});

test('the tick writes its heartbeat to SETTLE_HEARTBEAT_KEY when set (never on a dry run, never failing the tick)', async () => {
  const written = [];
  const inbox = { putLatest: async (key, obj) => { written.push([key, obj]); }, getLines: async () => ({ lines: [] }), appendLines: async () => ({}) };
  const base = { store: fakeStore(), inbox, now: () => '2026-10-01T10:30:00.000Z', llm: async () => ({}), draftModel: 'm' };
  await run({ action: 'tick' }, base);
  assert.deepEqual(written, [], 'unset: nothing');
  await run({ action: 'tick', dryRun: true }, { ...base, heartbeatKey: 'record/views/health/settle-tick.json' });
  assert.deepEqual(written, []);
  await run({ action: 'tick' }, { ...base, store: fakeStore(), heartbeatKey: 'record/views/health/settle-tick.json' });
  assert.deepEqual(written.map(([k, o]) => [k, o.at, o.committed, o.errors]), [['record/views/health/settle-tick.json', '2026-10-01T10:30:00.000Z', 2, 0]]);
  const out = await run({ action: 'tick' }, { ...base, store: fakeStore(), inbox: { ...inbox, putLatest: async () => { throw new Error('AccessDenied'); } }, heartbeatKey: 'k' });
  assert.deepEqual(out.errors, []);
});
