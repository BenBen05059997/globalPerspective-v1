'use strict';
// The nightly path end to end (WATCH -> GATHER -> JUDGE -> RECORD) with injected store, facts and model.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/index');
const { fakeStore, predRow, fakeFacts, entryFact, fakeS3 } = require('./helpers');

const TODAY = '2026-11-10';
const NOW = `${TODAY}T10:30:00.000Z`;
// story tA: issued 10-20, one question due 11-29 (a week and more away from today, so `no` is not yet allowed)
const PRED = predRow('a', '2026-10-20', 1, { lead: 40, thread: 'tA' });
const QID = 'a-2026-10-20-0';
const ENTRY = entryFact('tA', '2026-11-09', { eventId: 'ev-r', payload: { title: 'Council approves the plan', summary: 'The council voted 9-2 to approve the plan on Monday.' } });
const YES = { verdict: 'yes', quote: 'The council voted 9-2 to approve the plan', event_id: 'ev-r', why: 'reported' };
const rows = (store, prefix) => [...store.rows.values()].filter((r) => r.SK.startsWith(prefix));
const deps = (store, llm, extra = {}) => ({ store, facts: fakeFacts({ '2026-11-09': [ENTRY], [TODAY]: [entryFact('tA', TODAY)] }), now: () => NOW, llm, draftModel: 'deepseek-test', ...extra });

test('moved story, two agreeing yes passes: a VERDICT row for an unsampled question with the facts-writer fields', async () => {
  const store = fakeStore([PRED]);
  const out = await run({ action: 'tick' }, deps(store, async () => YES));
  assert.deepEqual(out.settled, [{ qid: QID, verdict: 'yes' }]);
  const [v] = rows(store, 'VERDICT');
  assert.equal(v.PK, `Q#${QID}`);
  assert.equal(v.SK, 'VERDICT');
  assert.equal(v.verdict, 'yes');
  assert.equal(v.sampled, false);
  assert.equal(v.decidedAt, NOW);
  assert.equal(v.decidedBy, 'deepseek-test');
  assert.equal(v.confirmedBy, 'resolver');
  assert.equal(v.reason, 'reported');
  assert.deepEqual(v.evidence, { eventId: 'ev-r', quote: YES.quote, date: '2026-11-09' });
  assert.ok(v.draftSk.startsWith('DRAFT#'));
  assert.ok(!('p' in v) && !('probability' in v));
});

test('a sampled question gets the same row with sampled:true', async () => {
  const store = fakeStore([PRED]);
  await store.putOnce({ PK: `Q#${QID}`, SK: 'SAMPLED', qid: QID, question: 'Event 0 of a happens', deadline: '2026-11-29', issuedAt: '2026-10-20T05:00:00Z', storyTitle: 'Story a', threadId: 'tA' });
  await run({ action: 'tick' }, deps(store, async () => YES));
  assert.equal(rows(store, 'VERDICT')[0].sampled, true);
});

test('the judge is blind to p: no prompt carries it', async () => {
  const store = fakeStore([PRED]);
  const prompts = [];
  await run({ action: 'tick' }, deps(store, async (prompt) => { prompts.push(prompt); return { verdict: 'not_yet' }; }));
  assert.equal(prompts.length, 1);
  assert.ok(!/\b55\b/.test(prompts[0]) && !/probab/i.test(prompts[0].replace(/never guess/gi, '')));
});

test('quote not verbatim in a cited entry: no verdict, draft is needs_human', async () => {
  const store = fakeStore([PRED]);
  await run({ action: 'tick' }, deps(store, async () => ({ ...YES, quote: 'The council rejected the plan outright' })));
  assert.equal(rows(store, 'VERDICT').length, 0);
  assert.equal(rows(store, 'DRAFT#')[0].verdict, 'needs_human');
});

test('a quote from today\'s entry summary is accepted and cited by eventId', async () => {
  const store = fakeStore([PRED]);
  const facts = fakeFacts({ [TODAY]: [entryFact('tA', TODAY, { eventId: 'ev-today', payload: { title: 'Plan news', summary: 'Ministers signed the agreement in the capital today.' } })] });
  const llm = async () => ({ verdict: 'yes', quote: 'Ministers signed the agreement in the capital', event_id: 'ev-today' });
  const out = await run({ action: 'tick' }, deps(store, llm, { facts }));
  assert.equal(out.settled.length, 1);
  assert.equal(rows(store, 'VERDICT')[0].evidence.eventId, 'ev-today');
});

test('the judge is shown only entries dated after the draw, of its own thread', async () => {
  const store = fakeStore([PRED]); // issued 2026-10-20
  const facts = fakeFacts({
    '2026-10-20': [entryFact('tA', '2026-10-20', { payload: { title: 'ON DRAW DAY', summary: 'x' } })],
    '2026-10-19': [entryFact('tA', '2026-10-19', { payload: { title: 'BEFORE THE DRAW', summary: 'x' } })],
    '2026-11-05': [entryFact('tA', '2026-11-05', { payload: { title: 'OWN LATER ENTRY', summary: 'x' } }), entryFact('tB', '2026-11-05', { payload: { title: 'OTHER THREAD', summary: 'x' } })],
    [TODAY]: [entryFact('tA', TODAY)],
  });
  const prompts = [];
  await run({ action: 'tick' }, deps(store, async (p) => { prompts.push(p); return { verdict: 'not_yet' }; }, { facts }));
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /OWN LATER ENTRY/);
  assert.doesNotMatch(prompts[0], /ON DRAW DAY|BEFORE THE DRAW|OTHER THREAD/);
});

test('no before due + 3 days: not_yet, the question stays open', async () => {
  const store = fakeStore([PRED]);
  const out = await run({ action: 'tick' }, deps(store, async () => ({ verdict: 'no', why: 'nothing reported' })));
  assert.equal(out.settled.length, 0);
  assert.equal(rows(store, 'VERDICT').length, 0);
  assert.equal(rows(store, 'DRAFT#')[0].verdict, 'not_yet');
});

test('no after due + 3 days (age rule, story not moved): a no verdict without a quote', async () => {
  const old = predRow('o', '2026-09-20', 1, { lead: 30, thread: 'tO' }); // due 10-20
  const store = fakeStore([old]);
  const out = await run({ action: 'tick' }, deps(store, async () => ({ verdict: 'no', why: 'nothing reported' }), { facts: fakeFacts({ '2026-10-01': [entryFact('tO', '2026-10-01')] }) }));
  assert.deepEqual(out.settled, [{ qid: 'o-2026-09-20-0', verdict: 'no' }]);
  assert.equal(rows(store, 'VERDICT')[0].evidence.quote, null);
});

test('void with a bad reason is needs_human; a good reason is a void verdict', async () => {
  const bad = fakeStore([PRED]);
  await run({ action: 'tick' }, deps(bad, async () => ({ verdict: 'void', void_reason: 'felt_like_it' })));
  assert.equal(rows(bad, 'VERDICT').length, 0);
  assert.equal(rows(bad, 'DRAFT#')[0].verdict, 'needs_human');
  const good = fakeStore([PRED]);
  await run({ action: 'tick' }, deps(good, async () => ({ verdict: 'void', void_reason: 'event_moot' })));
  const [v] = rows(good, 'VERDICT');
  assert.equal(v.voidReason, 'event_moot');
  assert.equal(v.evidence, null);
});

test('a story that moves every night cannot void a question: pre-due and in-grace unclear drafts do not count', async () => {
  const store = fakeStore([PRED]);
  for (const d of ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']) {
    const at = `${d}T10:30:00.000Z`;
    const facts = fakeFacts({ [d]: [entryFact('tA', d)] });
    await run({ action: 'tick' }, deps(store, async () => ({ verdict: 'not_yet' }), { now: () => at, facts }));
  }
  assert.equal(rows(store, 'DRAFT#').length, 4);
  assert.equal(rows(store, 'VERDICT').length, 0);
});

test('dry run: lists candidates, calls no model, writes nothing', async () => {
  const store = fakeStore([PRED]);
  const boom = async () => { throw new Error('must not be called'); };
  const out = await run({ action: 'tick', dryRun: true }, deps(store, boom));
  assert.deepEqual(out.wouldCheck.map((c) => c.qid), [QID]);
  assert.equal(store.rows.size, 0);
});

test('an unreadable facts file is reported and the questions it would cover are not judged', async () => {
  const old = predRow('o', '2026-09-20', 1, { lead: 30, thread: 'tO' });
  const store = fakeStore([old, PRED]);
  const facts = { async getLines() { throw new Error('AccessDenied'); } };
  const out = await run({ action: 'tick' }, deps(store, async () => ({ verdict: 'not_yet' }), { facts }));
  assert.match(out.errors[0], /facts unreadable/);
  assert.deepEqual(out.drafted, []); // a bundle with a missing day is never judged
});

test('tonight again: a question settled or already checked today is not checked twice', async () => {
  const store = fakeStore([PRED]);
  await run({ action: 'tick' }, deps(store, async () => ({ verdict: 'not_yet' })));
  const again = await run({ action: 'tick', dryRun: true }, deps(store, async () => ({ verdict: 'not_yet' })));
  assert.deepEqual(again.wouldCheck, []);
});

// ---- record/inbox/verdicts (coordinator addition to N4) ----
test('a verdict produces one inbox line with ids, evidence and revision 1', async () => {
  const store = fakeStore([PRED]);
  const s3 = fakeS3();
  await run({ action: 'tick' }, deps(store, async () => YES, { inbox: s3.s3json }));
  assert.deepEqual([...s3.objects.keys()], [`record/inbox/verdicts/${TODAY}.jsonl`]);
  const [l] = s3.lines(`record/inbox/verdicts/${TODAY}.jsonl`);
  assert.deepEqual(l, {
    schemaVersion: 1, qid: QID, threadId: 'tA', forkId: `PRED#a/2026-10-20`, branchId: 'PRED#a/2026-10-20/0-0',
    result: 'yes', voidReason: null, decidedAt: NOW, decidedBy: 'deepseek-test',
    evidence: { eventId: 'ev-r', quote: YES.quote, date: '2026-11-09' }, reason: 'reported', revision: 1,
    sourceKey: `inbox:verdicts/${TODAY}#1`,
  });
});

test('a second verdict the same day is line 2; an unclear check writes no line', async () => {
  const other = predRow('b', '2026-10-20', 1, { lead: 40, thread: 'tB' });
  const store = fakeStore([PRED, other]);
  const s3 = fakeS3();
  const facts = fakeFacts({ [TODAY]: [entryFact('tA', TODAY), entryFact('tB', TODAY)] });
  let n = 0;
  await run({ action: 'tick' }, deps(store, async () => (n++ < 2 ? { verdict: 'not_yet' } : { verdict: 'not_yet' }), { inbox: s3.s3json, facts }));
  assert.equal(s3.objects.size, 0);
  const s4 = fakeS3();
  await run({ action: 'tick' }, deps(fakeStore([PRED, other]), async (p) => ({ verdict: 'yes', quote: 'New development for', event_id: /\[(ev[^\]]+)\]/.exec(p)[1] }), { inbox: s4.s3json, facts }));
  assert.deepEqual(s4.lines(`record/inbox/verdicts/${TODAY}.jsonl`).map((l) => l.sourceKey), [`inbox:verdicts/${TODAY}#1`, `inbox:verdicts/${TODAY}#2`]);
});

test('a correction appends a line with revision 2 and decidedBy operator', async () => {
  const store = fakeStore([PRED]);
  const s3 = fakeS3();
  await store.putOnce({ PK: `Q#${QID}`, SK: 'SAMPLED', qid: QID, pk: 'PRED#a', sk: '2026-10-20', triggerId: '0-0', threadId: 'tA', question: 'q', deadline: '2026-11-29' });
  await store.putOnce({ PK: `Q#${QID}`, SK: 'VERDICT', qid: QID, verdict: 'yes' });
  const out = await run({ action: 'correct', qid: QID, verdict: 'no', reason: 'wrong treaty' }, { store, inbox: s3.s3json, now: () => NOW });
  assert.equal(out.corrected.sk, 'VERDICT#2');
  const [l] = s3.lines(`record/inbox/verdicts/${TODAY}.jsonl`);
  assert.equal(l.revision, 2); assert.equal(l.decidedBy, 'operator'); assert.equal(l.result, 'no'); assert.equal(l.branchId, 'PRED#a/2026-10-20/0-0');
});

test('shadow run writes under record/shadow/inbox/verdicts/; dry run writes no line', async () => {
  const s3 = fakeS3();
  await run({ action: 'tick', shadow: true }, deps(fakeStore([PRED]), async () => YES, { inbox: s3.s3json }));
  assert.deepEqual([...s3.objects.keys()], [`record/shadow/inbox/verdicts/${TODAY}.jsonl`]);
  const dry = fakeS3();
  await run({ action: 'tick', dryRun: true }, deps(fakeStore([PRED]), async () => YES, { inbox: dry.s3json }));
  assert.equal(dry.objects.size, 0);
});

test('an inbox failure is reported; the Q# verdict row stays', async () => {
  const store = fakeStore([PRED]);
  const inbox = { async getLines() { throw new Error('AccessDenied'); } };
  const out = await run({ action: 'tick' }, deps(store, async () => YES, { inbox }));
  assert.equal(rows(store, 'VERDICT').length, 1);
  assert.match(out.errors[0], /inbox line not written/);
});
