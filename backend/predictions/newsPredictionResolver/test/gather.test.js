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

test('bundle: facts days are read once for many questions, from the first window day to today (assignments and merges come later)', async () => {
  const keys = [];
  const facts = { async getLines(key) { keys.push(key); return { lines: [] }; } };
  await gather.loadEntries(facts, [Q, { ...Q, qid: 'q2' }], TODAY);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('record/facts/2026-10-21.jsonl') && keys.includes('record/facts/2026-11-05.jsonl'));
  assert.ok(!keys.includes('record/facts/2026-10-20.jsonl') && keys.includes('record/facts/2026-11-06.jsonl') && keys.includes('record/facts/2026-11-10.jsonl'));
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

// ---- COVERAGE GUARD: a `no` needs a healthy Run on every day from the draw+1 to the due day ----
const { okRun } = require('./helpers');
const { draftQuestion } = require('../src/draft');
const CQ = { ...Q, issuedAt: '2026-10-30T05:00:00.000Z', deadline: '2026-11-02', storyTitle: 's', question: 'x' }; // coverage days 10-31, 11-01, 11-02
const NOW_NO = '2026-11-10T10:30:00.000Z';
const covBundle = async (runs, q = CQ) => {
  const loaded = await gather.loadEntries(fakeFacts({}, runs), [q], TODAY);
  return gather.buildBundle(q, loaded, TODAY);
};
const noOf = async (runs) => draftQuestion({ ...CQ, bundle: await covBundle(runs) }, { now: () => NOW_NO, llm: async () => { throw new Error('no model'); } });

test('coverage: every day ok or partial with archiveDay present allows the no', async () => {
  const b = await covBundle({ '2026-10-31': okRun(), '2026-11-01': okRun({ status: 'partial' }), '2026-11-02': okRun() });
  assert.deepEqual(b.coverageGaps, []);
  const d = await noOf({ '2026-10-31': okRun(), '2026-11-01': okRun({ status: 'partial' }), '2026-11-02': okRun() });
  assert.deepEqual([d.verdict, d.reason, d.model], ['no', 'not_reported_by_due', 'rule:no_entries_after_draw']);
});

test('coverage: one missing day, a thin day, a missing archive, a failed run and an unreadable run are each a gap', async () => {
  const good = { '2026-10-31': okRun(), '2026-11-01': okRun(), '2026-11-02': okRun() };
  const cases = [
    ['no run', { ...good, '2026-11-01': null }],
    ['thin', { ...good, '2026-11-01': okRun({ inputs: { archiveDay: { thin: 13 } } }) }],
    ['archive missing', { ...good, '2026-11-02': okRun({ inputs: { archiveDay: 'missing' } }) }],
    ['failed', { ...good, '2026-10-31': okRun({ status: 'failed' }) }],
    ['started', { ...good, '2026-10-31': okRun({ status: 'started' }) }],
    ['unreadable', { ...good, '2026-11-01': new Error('AccessDenied') }],
  ];
  for (const [name, runs] of cases) {
    const b = await covBundle(runs);
    assert.equal(b.coverageGaps.length, 1, name);
    const d = await noOf(runs);
    assert.deepEqual([d.verdict, d.reason], ['not_yet', 'coverage_gap'], name);
    assert.equal(d.gapDays.length, 1, name);
  }
  const unreadable = await covBundle({ ...good, '2026-11-01': new Error('AccessDenied') });
  assert.match(unreadable.coverageGaps[0].why, /unreadable/);
});

test('coverage: a model no on entries is blocked by a gap; a yes is unaffected', async () => {
  const entries = [{ eventId: 'e1', title: 'Parliament ratifies the treaty today', summary: 'Lawmakers voted 200-10 on Tuesday.', date: '2026-11-01', url: null }];
  const gap = { ...CQ, bundle: { entries, complete: true, coverageGaps: [{ day: '2026-11-01', why: 'no run' }] } };
  const no = await draftQuestion(gap, { now: () => NOW_NO, llm: async () => ({ verdict: 'no', why: 'w' }) });
  assert.deepEqual([no.verdict, no.reason], ['not_yet', 'coverage_gap']);
  const yes = await draftQuestion(gap, { now: () => NOW_NO, llm: async () => ({ verdict: 'yes', quote: 'Lawmakers voted 200-10 on Tuesday.', event_id: 'e1' }) });
  assert.equal(yes.verdict, 'yes');
});

test('coverage: runs are read once per day for many questions, and never for days after today', async () => {
  const keys = [];
  const facts = { async getLines() { return { lines: [] }; }, async getJson(k) { keys.push(k); return okRun(); } };
  await gather.loadEntries(facts, [CQ, { ...CQ, qid: 'q2' }, { ...CQ, qid: 'late', deadline: '2026-12-31' }], TODAY);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((k) => k.slice(-15, -5) <= TODAY));
});

test('coverage: the real s3json reader (plain object, null on 404) yields no gap for a healthy day and "no run" for a missing one', async () => {
  const { fakeS3 } = require('./helpers');
  const s3 = fakeS3();
  s3.objects.set('record/runs/2026-10-31.json', JSON.stringify(okRun()));
  s3.objects.set('record/runs/2026-11-02.json', JSON.stringify(okRun()));
  const loaded = await gather.loadEntries(s3.s3json, [CQ], TODAY);
  const b = gather.buildBundle(CQ, loaded, TODAY);
  assert.deepEqual(b.coverageGaps, [{ day: '2026-11-01', why: 'no run' }]);
});

// ---- ASSIGNED ARTICLES, REASSIGNED ENTRIES, MERGES (lane AK) ----
const { buildPrompt } = require('../src/draft');
const art = (id, date, extra = {}) => ({ kind: 'article', eventId: id, threadId: null, date, at: `${date}T00:00:00.000Z`, payload: { title: `Headline ${id} announces the ceasefire`, snippet: null, url: `https://ex.com/${id}`, recoveredAt: '2026-10-20T00:00:00Z', recoveredFrom: 'gkg' }, ...extra });
const asg = (entryId, threadId, at, by = 'operator') => ({ kind: 'assignment', eventId: `as-${entryId}-${threadId}-${by}-${at}`, threadId, at, payload: { entryId, threadId, by } });

test('assigned recovered article reaches the bundle; an unassigned one does not', async () => {
  const b = await bundle({ '2026-10-25': [art('a1', '2026-10-25'), art('a2', '2026-10-25')], '2026-11-08': [asg('a1', 'tA', '2026-11-08T09:00:00.000Z')] });
  assert.deepEqual(b.entries.map((x) => x.eventId), ['a1']); // the assignment sits on a later day than the article
  assert.deepEqual([b.entries[0].kind, b.entries[0].recovered, b.entries[0].summary, b.entries[0].url], ['article', true, '', 'https://ex.com/a1']);
});

test('assignment to another thread, or an article outside the window, adds nothing', async () => {
  const b = await bundle({ '2026-10-25': [art('a1', '2026-10-25')], '2026-10-19': [art('a3', '2026-10-19')], '2026-11-08': [asg('a1', 'tB', '2026-11-08T09:00:00.000Z'), asg('a3', 'tA', '2026-11-08T09:00:00.000Z')] });
  assert.deepEqual(b.entries, []);
});

test('a reassigned entry moves to its new thread and leaves the old one', async () => {
  const mv = e('tA', '2026-10-25');
  const files = { '2026-10-25': [mv], '2026-11-01': [asg(mv.eventId, 'tB', '2026-11-01T00:00:00.000Z')] };
  assert.equal((await bundle(files)).entries.length, 0);
  assert.equal((await bundle(files, { ...Q, threadId: 'tB' })).entries.length, 1);
});

test('tie rule: latest at wins; at a tie operator beats review beats ingest', async () => {
  const x = art('a1', '2026-10-25');
  const t = '2026-11-01T00:00:00.000Z';
  const has = async (...as) => (await bundle({ '2026-10-25': [x], '2026-11-01': as })).entries.length === 1;
  assert.equal(await has(asg('a1', 'tA', t, 'review'), asg('a1', 'tB', t, 'operator')), false);
  assert.equal(await has(asg('a1', 'tB', t, 'operator'), asg('a1', 'tA', t, 'ingest')), false);
  assert.equal(await has(asg('a1', 'tB', t, 'review'), asg('a1', 'tA', t, 'operator')), true);
  assert.equal(await has(asg('a1', 'tB', '2026-11-01T00:00:00.000Z'), asg('a1', 'tA', '2026-11-02T00:00:00.000Z', 'ingest')), true);
});

test('a story merged away: a question on it gathers the survivor, and the survivor gathers it', async () => {
  const merge = { kind: 'story_merged', eventId: 'm1', at: '2026-11-01T00:00:00.000Z', threadId: 'tS', payload: { from: 'tA', into: 'tS' } };
  const files = { '2026-10-25': [e('tS', '2026-10-25', 'SURVIVOR'), e('tA', '2026-10-26', 'FROM')], '2026-11-01': [merge] };
  assert.deepEqual((await bundle(files)).entries.map((x) => x.title), ['SURVIVOR', 'FROM']);
  assert.equal((await bundle(files, { ...Q, threadId: 'tS' })).entries.length, 2);
  const loaded = await gather.loadEntries(fakeFacts(files), [Q], TODAY);
  assert.ok(gather.movedThreads(loaded, '2026-10-26').has('tA')); // the survivor moved, so the merged-away story counts as moved
  const cancelled = { ...files, '2026-11-02': [{ kind: 'story_split', eventId: 's1', at: '2026-11-02T00:00:00.000Z', payload: { from: 'tA', into: 'tS' } }] };
  assert.deepEqual((await bundle(cancelled)).entries.map((x) => x.title), ['FROM']);
});

test('assignments are read from days after the window, up to today', async () => {
  const keys = [];
  const facts = { async getLines(key) { keys.push(key); return { lines: [] }; } };
  await gather.loadEntries(facts, [Q], TODAY);
  assert.ok(keys.includes('record/facts/2026-11-10.jsonl') && keys.includes('record/facts/2026-11-08.jsonl'));
});

test('prompt labels a recovered item as headline only; a verified quote of the title still counts', async () => {
  const b = await bundle({ '2026-10-25': [art('a1', '2026-10-25')], '2026-11-08': [asg('a1', 'tA', '2026-11-08T09:00:00.000Z')] });
  const p = buildPrompt({ ...Q, question: 'x', storyTitle: 's' }, b.entries, TODAY);
  assert.match(p, /\[a1\] Headline a1 announces the ceasefire \(2026-10-25\) \[recovered headline, no text\]/);
  const lib = require('../src/lib');
  assert.equal(lib.quoteInEntry('announces the ceasefire', b.entries, 'a1'), true);
  assert.equal(lib.quoteInEntry('announces the truce today', b.entries, 'a1'), false);
});

test('coverage guard: a recovered day (no archive) still blocks a no, even with an assigned article in the bundle', async () => {
  const q = { ...CQ, question: 'x' };
  const files = { '2026-11-01': [art('a1', '2026-11-01')], '2026-11-08': [asg('a1', 'tA', '2026-11-08T09:00:00.000Z')] };
  const runs = { '2026-10-31': okRun(), '2026-11-01': okRun({ inputs: { archiveDay: 'absent' } }), '2026-11-02': okRun() };
  const loaded = await gather.loadEntries(fakeFacts(files, runs), [q], TODAY);
  const bnd = gather.buildBundle(q, loaded, TODAY);
  assert.deepEqual(bnd.coverageGaps.map((g) => g.day), ['2026-11-01']);
  const llm = async () => ({ verdict: 'no', why: 'headline does not report it' });
  const d = await draftQuestion({ ...q, bundle: bnd }, { now: () => NOW_NO, llm });
  assert.deepEqual([d.verdict, d.reason], ['not_yet', 'coverage_gap']);
});
