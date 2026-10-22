'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../src/lib');
const { buildPrompt, draftQuestion } = require('../src/draft');
const { run } = require('../src/index');
const { fakeStore } = require('./helpers');

const Q = { qid: 'x', question: 'Country A ratifies the trade treaty', deadline: '2026-11-10', issuedAt: '2026-10-01T05:00:00Z', storyTitle: 'Trade talks', resolutionSource: 'Official Gazette of Country A' };
const RESULTS = [{ title: 'Country A ratifies the trade treaty in parliament vote', snippet: 'Lawmakers voted 200-10 on Tuesday.', url: 'https://ex.com/a', source: 'ex.com', age: '2 days ago' }];
const NOW = '2026-11-20T10:30:00.000Z';

test('p never appears in a prompt, even if the object carries it', () => {
  const p = buildPrompt({ ...Q, p: 73, probability: 0.61, scenarioProbability: 0.4 }, RESULTS, '2026-11-20');
  assert.ok(!/\b73\b/.test(p) && !/0\.61/.test(p) && !/probab/i.test(p.replace(/never guess/gi, '')) );
});

test('quote must occur in the cited result; otherwise yes becomes needs_human', () => {
  const ok = lib.validateDraft({ verdict: 'yes', quote: 'Lawmakers voted 200-10 on Tuesday.', url: 'https://ex.com/a' }, RESULTS, NOW, Q.deadline);
  assert.equal(ok.verdict, 'yes');
  const bad = lib.validateDraft({ verdict: 'yes', quote: 'The treaty was signed by the president', url: 'https://ex.com/a' }, RESULTS, NOW, Q.deadline);
  assert.equal(bad.verdict, 'needs_human');
  const wrongUrl = lib.validateDraft({ verdict: 'yes', quote: 'Lawmakers voted 200-10 on Tuesday.', url: 'https://other.com' }, RESULTS, NOW, Q.deadline);
  assert.equal(wrongUrl.verdict, 'needs_human');
});

test('NO before deadline + 3 days becomes not_yet; after it, no', () => {
  assert.equal(lib.validateDraft({ verdict: 'no' }, [], '2026-11-12', Q.deadline).verdict, 'not_yet');
  assert.equal(lib.validateDraft({ verdict: 'no' }, [], '2026-11-13', Q.deadline).verdict, 'no');
});

test('void needs a valid reason', () => {
  assert.equal(lib.validateDraft({ verdict: 'void', void_reason: 'event_moot' }, [], NOW, Q.deadline).verdict, 'void');
  assert.equal(lib.validateDraft({ verdict: 'void', void_reason: 'whatever' }, [], NOW, Q.deadline).verdict, 'needs_human');
});

test('yes needs two agreeing passes', async () => {
  let call = 0;
  const yes = { verdict: 'yes', quote: 'Lawmakers voted 200-10 on Tuesday.', url: 'https://ex.com/a' };
  const both = await draftQuestion(Q, { now: () => NOW, search: async () => RESULTS, llm: async () => yes });
  assert.equal(both.verdict, 'yes');
  const disagree = await draftQuestion(Q, { now: () => NOW, search: async () => RESULTS, llm: async () => (call++ === 0 ? yes : { verdict: 'not_yet' }) });
  assert.equal(disagree.verdict, 'needs_human');
});

test('an LLM failure becomes needs_human, never a verdict', async () => {
  const d = await draftQuestion(Q, { now: () => NOW, search: async () => RESULTS, llm: async () => { throw new Error('402'); } });
  assert.equal(d.verdict, 'needs_human');
});

test('draft pass: only sampled questions past their deadline, no verdict yet; DRAFT rows are written, never VERDICT', async () => {
  const store = fakeStore();
  await store.putOnce({ PK: 'Q#due', SK: 'SAMPLED', qid: 'due', ...Q, deadline: '2026-11-10' });
  await store.putOnce({ PK: 'Q#future', SK: 'SAMPLED', qid: 'future', ...Q, deadline: '2026-12-31' });
  await store.putOnce({ PK: 'Q#done', SK: 'SAMPLED', qid: 'done', ...Q });
  await store.putOnce({ PK: 'Q#done', SK: 'VERDICT', verdict: 'yes' });
  const deps = { store, now: () => NOW, search: async () => RESULTS, llm: async () => ({ verdict: 'not_yet', why: 'unclear' }), draftModel: 'm' };
  const dry = await run({ action: 'draft', dryRun: true }, deps);
  assert.deepEqual(dry.wouldCheck.map((x) => x.qid), ['due']);
  assert.equal([...store.rows.values()].filter((r) => r.SK.startsWith('DRAFT#')).length, 0);
  const out = await run({ action: 'draft' }, deps);
  assert.deepEqual(out.drafted, [{ qid: 'due', verdict: 'not_yet' }]);
  assert.equal([...store.rows.values()].filter((r) => r.SK.startsWith('VERDICT')).length, 1); // only the pre-existing one
  // not redrafted the next day
  const again = await run({ action: 'draft', dryRun: true }, { ...deps, now: () => '2026-11-21T10:30:00.000Z' });
  assert.equal(again.wouldCheck.length, 0);
});

test('replay writes nothing and returns usage', async () => {
  const store = fakeStore();
  const out = await run({ action: 'replay', items: [Q] }, { store, now: () => NOW, search: async () => RESULTS, llm: async () => ({ verdict: 'not_yet' }), usage: () => ({ llmCalls: 1 }) });
  assert.equal(out.results.length, 1);
  assert.equal(store.rows.size, 0);
  assert.deepEqual(out.usage, { llmCalls: 1 });
});

// ---- auto verdicts (decision 0034) ----
const YES = { verdict: 'yes', quote: 'Lawmakers voted 200-10 on Tuesday.', url: 'https://ex.com/a', why: 'w' };
const verdictRows = (store, qid) => [...store.rows.values()].filter((r) => r.PK === `Q#${qid}` && r.SK.startsWith('VERDICT')).sort((a, b) => a.SK.localeCompare(b.SK));
async function sampledStore(deadline = '2026-11-10') {
  const store = fakeStore();
  await store.putOnce({ PK: 'Q#due', SK: 'SAMPLED', qid: 'due', ...Q, deadline });
  return store;
}

test('draft pass writes the verdict at once: confirmedBy resolver, draftSk, evidence', async () => {
  const store = await sampledStore();
  const out = await run({ action: 'draft' }, { store, now: () => NOW, search: async () => RESULTS, llm: async () => YES, draftModel: 'm' });
  assert.deepEqual(out.settled, [{ qid: 'due', verdict: 'yes' }]);
  const [v] = verdictRows(store, 'due');
  const draft = [...store.rows.values()].find((r) => r.SK.startsWith('DRAFT#'));
  assert.equal(v.SK, 'VERDICT');
  assert.equal(v.verdict, 'yes');
  assert.equal(v.confirmedBy, 'resolver');
  assert.equal(v.draftSk, draft.SK);
  assert.deepEqual(v.evidence, { quote: 'Lawmakers voted 200-10 on Tuesday.', url: 'https://ex.com/a', title: 'Country A ratifies the trade treaty in parliament vote', date: null });
  assert.equal(v.p, undefined);
  // settled questions are not drafted again
  assert.equal((await run({ action: 'draft', dryRun: true }, { store, now: () => '2026-11-30T10:30:00.000Z' })).wouldCheck.length, 0);
});

test('void draft becomes a void verdict with its reason; a NO draft has no quote', async () => {
  const store = await sampledStore();
  await run({ action: 'draft' }, { store, now: () => NOW, search: async () => RESULTS, llm: async () => ({ verdict: 'void', void_reason: 'event_moot' }), draftModel: 'm' });
  const [v] = verdictRows(store, 'due');
  assert.equal(v.verdict, 'void'); assert.equal(v.voidReason, 'event_moot'); assert.equal(v.evidence, null);
  const s2 = await sampledStore();
  await run({ action: 'draft' }, { store: s2, now: () => NOW, search: async () => RESULTS, llm: async () => ({ verdict: 'no' }), draftModel: 'm' });
  assert.equal(verdictRows(s2, 'due')[0].verdict, 'no');
});

test('unclear drafts stay open, are re-drafted after 5 days, and the third makes a void', async () => {
  const store = await sampledStore();
  const unclear = async () => ({ verdict: 'not_yet', why: 'unclear' });
  const at = (iso) => ({ store, now: () => iso, search: async () => RESULTS, llm: unclear, draftModel: 'm' });
  await run({ action: 'draft' }, at('2026-11-20T10:30:00.000Z'));
  assert.equal(verdictRows(store, 'due').length, 0);
  // not re-drafted before the threshold, drafted again on day 5
  assert.equal((await run({ action: 'draft', dryRun: true }, at('2026-11-24T10:30:00.000Z'))).wouldCheck.length, 0);
  assert.equal((await run({ action: 'draft', dryRun: true }, at('2026-11-25T10:30:00.000Z'))).wouldCheck.length, 1);
  await run({ action: 'draft' }, at('2026-11-25T10:30:00.000Z'));
  assert.equal(verdictRows(store, 'due').length, 0); // two unclear drafts: still open
  const out = await run({ action: 'draft' }, at('2026-11-30T10:30:00.000Z'));
  assert.deepEqual(out.settled, [{ qid: 'due', verdict: 'void' }]);
  const [v] = verdictRows(store, 'due');
  assert.equal(v.voidReason, 'unclear after 3 drafts');
  assert.equal(v.confirmedBy, 'resolver');
  assert.equal([...store.rows.values()].filter((r) => r.SK.startsWith('DRAFT#')).length, 3);
});

test('LLM outages never count toward voiding a question', async () => {
  const store = await sampledStore();
  const failing = async () => { throw new Error('502 upstream'); };
  const at = (iso) => ({ store, now: () => iso, search: async () => RESULTS, llm: failing, draftModel: 'm' });
  await run({ action: 'draft' }, at('2026-11-20T10:30:00.000Z'));
  await run({ action: 'draft' }, at('2026-11-25T10:30:00.000Z'));
  const out = await run({ action: 'draft' }, at('2026-11-30T10:30:00.000Z'));
  assert.equal(out.settled.length, 0);
  assert.equal(verdictRows(store, 'due').length, 0);
  assert.equal([...store.rows.values()].filter((r) => r.SK.startsWith('DRAFT#') && /^llm error/.test(r.note)).length, 3);
});

test('tick settles a draft that is already waiting, without calling the LLM, and is idempotent', async () => {
  const store = await sampledStore();
  await store.putOnce({ PK: 'Q#due', SK: 'DRAFT#2026-11-16T10:30:00.000Z', qid: 'due', verdict: 'no', why: 'w' });
  const deps = { store, now: () => '2026-11-21T10:30:00.000Z', search: async () => { throw new Error('no search'); }, llm: async () => { throw new Error('no llm'); } };
  const dry = await run({ action: 'tick', dryRun: true }, deps);
  assert.deepEqual(dry.wouldSettle, [{ qid: 'due', verdict: 'no' }]);
  assert.equal(verdictRows(store, 'due').length, 0);
  const out = await run({ action: 'tick' }, deps);
  assert.deepEqual(out.settled, [{ qid: 'due', verdict: 'no' }]);
  assert.equal(verdictRows(store, 'due')[0].draftSk, 'DRAFT#2026-11-16T10:30:00.000Z');
  assert.equal((await run({ action: 'tick' }, deps)).settled.length, 0);
});

test('a verdict that already exists is never overwritten by the settle pass (put-once rejection)', async () => {
  const store = await sampledStore();
  await store.putOnce({ PK: 'Q#due', SK: 'DRAFT#2026-11-16T10:30:00.000Z', qid: 'due', verdict: 'no' });
  const realGroups = store.listQuestionRows;
  // the verdict lands between the scan and the write
  store.listQuestionRows = async () => { const rows = await realGroups(); await store.putOnce({ PK: 'Q#due', SK: 'VERDICT', verdict: 'yes', confirmedBy: 'operator' }); return rows; };
  const out = await run({ action: 'tick' }, { store, now: () => '2026-11-21T10:30:00.000Z' });
  assert.deepEqual(out.settled, []);
  assert.equal(out.errors.length, 0);
  assert.equal(verdictRows(store, 'due')[0].verdict, 'yes');
});

test('correct appends VERDICT#2 after the auto verdict, then VERDICT#3, with reason and operator', async () => {
  const store = await sampledStore();
  const deps = { store, now: () => NOW };
  await store.putOnce({ PK: 'Q#due', SK: 'VERDICT', qid: 'due', verdict: 'yes', confirmedBy: 'resolver' });
  const a = await run({ action: 'correct', qid: 'due', verdict: 'no', reason: 'quote was about another treaty' }, deps);
  assert.deepEqual(a.corrected, { qid: 'due', sk: 'VERDICT#2', verdict: 'no' });
  const b = await run({ action: 'correct', qid: 'due', verdict: 'void', reason: 'criterion ambiguous' }, deps);
  assert.equal(b.corrected.sk, 'VERDICT#3');
  const rows = verdictRows(store, 'due');
  assert.deepEqual(rows.map((r) => r.SK), ['VERDICT', 'VERDICT#2', 'VERDICT#3']);
  assert.equal(rows[1].confirmedBy, 'operator'); assert.equal(rows[1].reason, 'quote was about another treaty'); assert.equal(rows[1].decidedAt, NOW);
  assert.equal(rows[2].voidReason, 'criterion ambiguous'); assert.equal(rows[2].evidence, null);
  assert.equal(rows[0].verdict, 'yes'); // the original is untouched
});

test('correct on a question with no verdict writes VERDICT#1; bad input and unknown qid write nothing', async () => {
  const store = await sampledStore();
  const deps = { store, now: () => NOW };
  const ok = await run({ action: 'correct', qid: 'due', verdict: 'yes', reason: 'found it', evidence: { url: 'https://ex.com/a', quote: 'qq' } }, deps);
  assert.equal(ok.corrected.sk, 'VERDICT#1');
  assert.deepEqual(verdictRows(store, 'due')[0].evidence, { url: 'https://ex.com/a', quote: 'qq' });
  for (const ev of [{ qid: 'due', verdict: 'maybe', reason: 'x' }, { qid: 'due', verdict: 'no', reason: ' ' }, { qid: 'nope', verdict: 'no', reason: 'x' }]) {
    const r = await run({ action: 'correct', ...ev }, deps);
    assert.equal(r.corrected, undefined); assert.equal(r.errors.length, 1);
  }
  assert.equal(verdictRows(store, 'due').length, 1);
});

test('correct handles a put-once rejection (a racing writer took the number)', async () => {
  const store = await sampledStore();
  const real = store.queryPK;
  store.queryPK = async (pk) => { const rows = await real(pk); await store.putOnce({ PK: pk, SK: 'VERDICT#1', verdict: 'no' }); return rows; };
  const r = await run({ action: 'correct', qid: 'due', verdict: 'yes', reason: 'x' }, { store, now: () => NOW });
  assert.equal(r.corrected, undefined);
  assert.match(r.errors[0], /written by someone else/);
  assert.equal(verdictRows(store, 'due')[0].verdict, 'no');
});
