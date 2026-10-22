'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/index');
const watch = require('../src/watch');
const { fakeStore, predRow, fakeFacts, entryFact } = require('./helpers');

const TODAY = '2026-11-10';
const NOW = `${TODAY}T10:30:00.000Z`;

// one PRED row per story; each has one question due `lead` days after its issue day
const pred = (topic, thread, issue, lead) => predRow(topic, issue, 1, { lead, thread });
const watchOut = async (preds, files, store = fakeStore(preds), limit) =>
  run({ action: 'watch', limit }, { store, facts: fakeFacts(files), now: () => NOW });

test('a question on a thread that moved today is a candidate; an unmoved thread is not', async () => {
  const preds = [pred('a', 'tA', '2026-10-20', 40), pred('b', 'tB', '2026-10-20', 40)]; // both due 11-29, far in the future
  const out = await watchOut(preds, { [TODAY]: [entryFact('tA', TODAY)] });
  assert.deepEqual(out.wouldCheck.map((c) => c.qid), ['a-2026-10-20-0']);
  assert.equal(out.wouldCheck[0].reason, 'moved');
  assert.equal(out.watch.movedThreads, 1);
});

test('yesterday counts as moved, the day before does not; non-entry facts do not move a thread', async () => {
  const preds = [pred('a', 'tA', '2026-10-20', 40), pred('b', 'tB', '2026-10-20', 40), pred('c', 'tC', '2026-10-20', 40)];
  const out = await watchOut(preds, {
    '2026-11-09': [entryFact('tA', '2026-11-09'), { kind: 'forecast_drawn', threadId: 'tC', date: '2026-11-09' }],
    '2026-11-08': [entryFact('tB', '2026-11-08')],
  });
  assert.deepEqual(out.wouldCheck.map((c) => c.qid), ['a-2026-10-20-0']);
});

test('due + 3 days is a candidate without any movement; due + 2 is not', async () => {
  // issued 10-01: lead 40 -> due 11-10 ... use leads so deadlines are 11-07 (today-3) and 11-08 (today-2)
  const preds = [pred('old', 'tO', '2026-10-01', 37), pred('new', 'tN', '2026-10-01', 38)];
  assert.equal(preds[0].scenarios[0].triggers[0].deadline, '2026-11-07');
  const out = await watchOut(preds, {});
  assert.deepEqual(out.wouldCheck.map((c) => [c.qid, c.reason]), [['old-2026-10-01-0', 'grace']]);
});

test('a question that already has a verdict row is not a candidate, even if its thread moved', async () => {
  const preds = [pred('a', 'tA', '2026-10-20', 40)];
  const store = fakeStore(preds);
  await store.putOnce({ PK: 'Q#a-2026-10-20-0', SK: 'VERDICT', qid: 'a-2026-10-20-0', verdict: 'yes' });
  const out = await watchOut(preds, { [TODAY]: [entryFact('tA', TODAY)] }, store);
  assert.deepEqual(out.wouldCheck, []);
});

test('non-question triggers and rows without a qid or deadline are ignored', () => {
  const rows = [{ PK: 'PRED#x', SK: '2026-10-20', threadId: 't', scenarios: [{ triggers: [
    { id: '0', question: false, qid: 'q0', deadline: '2026-11-01', text: 'demoted' },
    { id: '1', question: true, deadline: '2026-11-01', text: 'no qid' },
    { id: '2', question: true, qid: 'q2', text: 'no deadline' },
    { id: '3', question: true, qid: 'q3', deadline: '2026-11-01', text: 'ok', p: 70 },
    { id: '4', question: true, qid: 'q3', deadline: '2026-11-01', text: 'dup' },
  ] }] }];
  const qs = watch.questionsFromPreds(rows);
  assert.deepEqual(qs.map((q) => q.qid), ['q3']);
  assert.ok(!('p' in qs[0]) && !('probability' in qs[0]));
});

test('cap: oldest due first, overflow counted', async () => {
  const preds = [];
  for (let i = 0; i < 5; i++) preds.push(pred(`s${i}`, `t${i}`, '2026-09-01', 30 + i * 2)); // all past due+3, due dates ascending with i
  const out = await watchOut(preds, {}, fakeStore(preds), 3);
  assert.deepEqual(out.wouldCheck.map((c) => c.qid), ['s0-2026-09-01-0', 's1-2026-09-01-0', 's2-2026-09-01-0']);
  assert.equal(out.watch.total, 5);
  assert.equal(out.watch.overflow, 2);
});

test('a question already checked today is skipped; a grace candidate waits 5 days between checks', () => {
  const q = { qid: 'x', deadline: '2026-11-01', threadId: 'tX' };
  const base = { questions: [q], moved: new Map(), today: TODAY, redraftAfterDays: 5 };
  const draft = (day) => ({ SK: `DRAFT#${day}T10:30:00.000Z`, verdict: 'not_yet' });
  const groups = (d) => new Map([['x', { sampled: null, drafts: [draft(d)], verdicts: [] }]]);
  assert.equal(watch.selectCandidates({ ...base, groups: groups('2026-11-07') }).candidates.length, 0);
  assert.equal(watch.selectCandidates({ ...base, groups: groups('2026-11-05') }).candidates.length, 1);
  const moved = new Map([['tX', [entryFact('tX', TODAY)]]]);
  assert.equal(watch.selectCandidates({ ...base, moved, groups: groups('2026-11-09') }).candidates.length, 1); // moved: new reporting, check again
  assert.equal(watch.selectCandidates({ ...base, moved, groups: groups(TODAY) }).candidates.length, 0); // but not twice a day
});

test('watch writes nothing', async () => {
  const preds = [pred('a', 'tA', '2026-10-20', 40)];
  const store = fakeStore(preds);
  await watchOut(preds, { [TODAY]: [entryFact('tA', TODAY)] }, store);
  assert.equal(store.rows.size, 0);
});

test('a moved story with no entry dated after the draw is skipped; past due + 3 it is still a candidate', async () => {
  const preds = [pred('a', 'tA', '2026-10-20', 40), pred('o', 'tO', '2026-10-01', 30)]; // a due 11-29; o due 10-31 (past grace)
  const files = { [TODAY]: [entryFact('tA', '2026-10-20'), entryFact('tO', '2026-10-01')] }; // both dated on/before their draw day
  const out = await watchOut(preds, files);
  assert.deepEqual(out.wouldCheck.map((c) => c.qid), ['o-2026-10-01-0']); // old enough to be judged by rule
  assert.equal(out.watch.movedThreads, 2);
  // the same story with an entry after the draw is a candidate
  const out2 = await watchOut(preds, { [TODAY]: [entryFact('tA', '2026-10-21')] });
  assert.ok(out2.wouldCheck.some((c) => c.qid === 'a-2026-10-20-0' && c.reason === 'moved'));
});

test('an entry of another thread does not make a story a candidate', async () => {
  const out = await watchOut([pred('a', 'tA', '2026-10-20', 40)], { [TODAY]: [entryFact('tB', TODAY)] });
  assert.deepEqual(out.wouldCheck, []);
});
