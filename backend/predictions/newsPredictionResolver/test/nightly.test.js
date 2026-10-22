'use strict';
// The nightly path end to end (WATCH -> GATHER -> JUDGE -> RECORD) with injected store, facts, search and model.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/index');
const { fakeStore, predRow, fakeFacts, entryFact } = require('./helpers');

const TODAY = '2026-11-10';
const NOW = `${TODAY}T10:30:00.000Z`;
// story tA: issued 10-20, one question due 11-29 (a week and more away from today, so `no` is not yet allowed)
const PRED = predRow('a', '2026-10-20', 1, { lead: 40, thread: 'tA' });
const QID = 'a-2026-10-20-0';
const RESULT = { title: 'Council approves the plan', snippet: 'The council voted 9-2 to approve the plan on Monday.', url: 'https://ex.com/r', source: 'ex.com', date: '2026-11-09' };
const YES = { verdict: 'yes', quote: 'The council voted 9-2 to approve the plan', url: 'https://ex.com/r', why: 'reported' };
const rows = (store, prefix) => [...store.rows.values()].filter((r) => r.SK.startsWith(prefix));
const deps = (store, llm, extra = {}) => ({ store, facts: fakeFacts({ [TODAY]: [entryFact('tA', TODAY)] }), now: () => NOW, search: async () => [RESULT], llm, draftModel: 'deepseek-test', ...extra });

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
  assert.deepEqual(v.evidence, { quote: YES.quote, url: RESULT.url, title: RESULT.title, date: '2026-11-09' });
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

test('quote not verbatim in a shown result: no verdict, draft is needs_human', async () => {
  const store = fakeStore([PRED]);
  await run({ action: 'tick' }, deps(store, async () => ({ ...YES, quote: 'The council rejected the plan outright' })));
  assert.equal(rows(store, 'VERDICT').length, 0);
  assert.equal(rows(store, 'DRAFT#')[0].verdict, 'needs_human');
});

test('the new entry fact is evidence: a quote from its summary is accepted', async () => {
  const store = fakeStore([PRED]);
  const facts = fakeFacts({ [TODAY]: [entryFact('tA', TODAY, { payload: { title: 'Plan news', summary: 'Ministers signed the agreement in the capital today.' }, sources: [{ outlet: 'ex.com', url: 'https://ex.com/entry', title: 'Plan news' }] })] });
  const llm = async () => ({ verdict: 'yes', quote: 'Ministers signed the agreement in the capital', url: 'https://ex.com/entry' });
  const out = await run({ action: 'tick' }, deps(store, llm, { facts, search: async () => [] }));
  assert.equal(out.settled.length, 1);
  assert.equal(rows(store, 'VERDICT')[0].evidence.url, 'https://ex.com/entry');
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
  const out = await run({ action: 'tick' }, deps(store, async () => ({ verdict: 'no', why: 'nothing reported' }), { facts: fakeFacts({}) }));
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

test('dry run: lists candidates, calls no model and no search, writes nothing', async () => {
  const store = fakeStore([PRED]);
  const boom = async () => { throw new Error('must not be called'); };
  const out = await run({ action: 'tick', dryRun: true }, deps(store, boom, { search: boom }));
  assert.deepEqual(out.wouldCheck.map((c) => c.qid), [QID]);
  assert.equal(store.rows.size, 0);
});

test('an unreadable facts file is reported and the age rule still runs', async () => {
  const old = predRow('o', '2026-09-20', 1, { lead: 30, thread: 'tO' });
  const store = fakeStore([old, PRED]);
  const facts = { async getLines() { throw new Error('AccessDenied'); } };
  const out = await run({ action: 'tick' }, deps(store, async () => ({ verdict: 'not_yet' }), { facts }));
  assert.match(out.errors[0], /facts unreadable/);
  assert.deepEqual(out.drafted.map((d) => d.qid), ['o-2026-09-20-0']); // only the old one; the moved story could not be seen
});

test('tonight again: a question settled or already checked today is not checked twice', async () => {
  const store = fakeStore([PRED]);
  await run({ action: 'tick' }, deps(store, async () => ({ verdict: 'not_yet' })));
  const again = await run({ action: 'tick', dryRun: true }, deps(store, async () => ({ verdict: 'not_yet' })));
  assert.deepEqual(again.wouldCheck, []);
});
