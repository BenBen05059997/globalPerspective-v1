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
  assert.deepEqual(dry.wouldDraft.map((x) => x.qid), ['due']);
  assert.equal([...store.rows.values()].filter((r) => r.SK.startsWith('DRAFT#')).length, 0);
  const out = await run({ action: 'draft' }, deps);
  assert.deepEqual(out.drafted, [{ qid: 'due', verdict: 'not_yet' }]);
  assert.equal([...store.rows.values()].filter((r) => r.SK.startsWith('VERDICT')).length, 1); // only the pre-existing one
  // not redrafted the next day
  const again = await run({ action: 'draft', dryRun: true }, { ...deps, now: () => '2026-11-21T10:30:00.000Z' });
  assert.equal(again.wouldDraft.length, 0);
});

test('replay writes nothing and returns usage', async () => {
  const store = fakeStore();
  const out = await run({ action: 'replay', items: [Q] }, { store, now: () => NOW, search: async () => RESULTS, llm: async () => ({ verdict: 'not_yet' }), usage: () => ({ llmCalls: 1 }) });
  assert.equal(out.results.length, 1);
  assert.equal(store.rows.size, 0);
  assert.deepEqual(out.usage, { llmCalls: 1 });
});
