'use strict';
// Decision 0043: the weekly question draws in the record (question_commit, question_draw) and the sample state on the story views.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/facts');
const R = require('../src/_shared/record');
const Q = require('../src/_shared/questionState');
const V = require('../src/views');
const X = require('./views-fixture');
const {fakeS3} = require('./fake-s3');
const {makeHandler} = require('../src/index');

const commitLine = (o = {}) => ({schemaVersion: 1, type: 'commit', weekId: '2026-W43', weekStart: '2026-10-19', weekEnd: '2026-10-25', commitHash: 'a'.repeat(64), rule: 'v1', committedAt: '2026-10-15T10:30:00.000Z', sourceKey: 'inbox:draws/2026-10-15#1', ...o});
const drawLine = (o = {}) => ({schemaVersion: 1, type: 'draw', weekId: '2026-W43', rule: 'v1', K: 22, eligible: 5, clusters: 2, seedHex: 'b'.repeat(64), picked: [{qid: 'q1', hash: 'h', clusterKey: 'thread-1'}], drawnAt: '2026-10-26T10:30:00.000Z', sourceKey: 'inbox:draws/2026-10-26#1', ...o});

// ---- facts ----
test('commit and draw lines become week facts (threadId null) with eventId sha1(kind + weekId); another line number or run is the same fact', () => {
  const c = F.inboxDrawFact(commitLine(), 'r1');
  assert.deepEqual([c.kind, c.eventId, c.threadId, c.at, c.date, c.precision, c.iso3, c.actorIds, c.sourceIds], ['question_commit', R.sha1('question_commit2026-W43'), null, '2026-10-15T10:30:00.000Z', '2026-10-15', 'exact', [], [], []]);
  assert.deepEqual(c.payload, {weekId: '2026-W43', weekStart: '2026-10-19', weekEnd: '2026-10-25', rule: 'v1', commitHash: 'a'.repeat(64)});
  assert.equal(F.inboxDrawFact(commitLine({sourceKey: 'inbox:draws/2026-10-15#7'}), 'r2').eventId, c.eventId);
  const d = F.inboxDrawFact(drawLine(), 'r1');
  assert.deepEqual([d.kind, d.eventId, d.threadId, d.at], ['question_draw', R.sha1('question_draw2026-W43'), null, '2026-10-26T10:30:00.000Z']);
  assert.deepEqual(d.payload, {weekId: '2026-W43', rule: 'v1', K: 22, eligible: 5, clusters: 2, seedHex: 'b'.repeat(64), picked: [{qid: 'q1', hash: 'h', clusterKey: 'thread-1'}]});
});

test('a malformed draws line throws (bad week, unknown type, short hash, no picks list, bad time)', () => {
  for (const bad of [commitLine({weekId: 'W44'}), commitLine({type: 'reveal'}), commitLine({commitHash: 'abc'}), commitLine({committedAt: 'soon'}), commitLine({rule: ''}), drawLine({picked: null}), drawLine({picked: [{hash: 'x'}]}), drawLine({drawnAt: undefined}), null]) {
    assert.throws(() => F.inboxDrawFact(bad, 'r'), /facts:/, JSON.stringify(bad));
  }
});

// ---- handler ----
const P = 'record/shadow/';
const putLines = (f, key, lines) => f.objs.set(key, {body: lines.map((l) => `${JSON.stringify(l)}\n`).join(''), etag: `"l${key}"`});
const emptyDay = {async load(date) { return {date, dayRow: {date, source: 'archive', entries: []}, entries: [], births: {}, snapshots: []}; }};
const make = (f) => makeHandler({store: emptyDay, s3json: f.s3json, manifest: f.manifest, now: () => '2026-10-26T12:00:00.000Z'});
// a day with no entries is thin, which fails the Run; the draws are still written (tolerated here by catching the thin failure)
const runDay = (f, ev = {}) => make(f)({date: '2026-10-26', strict: false, ...ev}).catch(() => null);

test('draws inbox lines become facts on the day of commit / draw; a re-run appends nothing; the inbox reaches back 7 days', async () => {
  const f = fakeS3();
  putLines(f, `${P}inbox/draws/2026-10-15.jsonl`, [commitLine()]); // 11 days back: outside the window
  putLines(f, `${P}inbox/draws/2026-10-22.jsonl`, [commitLine({weekId: '2026-W44', weekStart: '2026-10-26', weekEnd: '2026-11-01', committedAt: '2026-10-22T10:30:00.000Z'})]);
  putLines(f, `${P}inbox/draws/2026-10-26.jsonl`, [drawLine()]);
  await runDay(f);
  const all = ['2026-10-15', '2026-10-22', '2026-10-26'].flatMap((d) => f.lines(`${P}facts/${d}.jsonl`));
  assert.deepEqual(all.filter((x) => x.kind === 'question_commit').map((x) => [x.date, x.payload.weekId]), [['2026-10-22', '2026-W44']]);
  assert.deepEqual(all.filter((x) => x.kind === 'question_draw').map((x) => [x.date, x.threadId, x.payload.picked.length]), [['2026-10-26', null, 1]]);
  await runDay(f);
  assert.equal(f.lines(`${P}facts/2026-10-26.jsonl`).filter((x) => x.kind === 'question_draw').length, 1);
  assert.equal(f.lines(`${P}facts/2026-10-22.jsonl`).filter((x) => x.kind === 'question_commit').length, 1);
  await runDay(f, {inboxFrom: '2026-10-01'}); // a backfill reads the old day too
  assert.equal(f.lines(`${P}facts/2026-10-15.jsonl`).filter((x) => x.kind === 'question_commit').length, 1);
});

test('a bad draws line is a draw failure on the Run and the good line is kept', async () => {
  const f = fakeS3();
  putLines(f, `${P}inbox/draws/2026-10-26.jsonl`, [commitLine({commitHash: 'x'}), drawLine()]);
  await runDay(f);
  const run = f.json(`${P}runs/2026-10-26.json`);
  assert.deepEqual(run.failures.filter((x) => x.stage === 'draw').map((x) => x.ref), ['2026-10-26#0']);
  assert.equal(run.counts.question_draw, 1);
});

// ---- views ----
const day = '2026-10-20';
const issue = (fork, branches, o = {}) => [
  X.entry('t', `${day}T04:00:00.000Z`, 'x'),
  X.forecast('t', `${day}T05:00:00.000Z`, fork, branches),
  ...(o.facts || []),
];
const branchesOf = (facts, today = '2026-10-31') => V.buildViews(facts, {today, builtAt: `${today}T05:00:00.000Z`, runId: 'r', factsManifestDays: 1}).stories.get('t').forks[0].branches;
const week = Q.isoWeekOfDay(day);
const commit = () => F.inboxDrawFact(commitLine({weekId: week, committedAt: '2026-10-10T10:30:00.000Z'}), 'r');
const draw = (qids) => F.inboxDrawFact(drawLine({weekId: week, picked: qids.map((q) => ({qid: q, hash: 'h', clusterKey: 't'})), drawnAt: '2026-10-26T10:30:00.000Z'}), 'r');

test('view branches carry the sample state: sampled / not_sampled / awaiting_draw / warm_up / not_eligible', () => {
  const bs = [X.branch('s', '2026-11-10'), X.branch('n', '2026-11-12'), X.branch('short', '2026-10-22'), X.branch('long', '2027-03-01')];
  const states = (facts, today) => Object.fromEntries(branchesOf(facts, today).map((b) => [b.branchId, [b.scoring, b.state]]));
  const base = issue('PRED#T/2026-10-20', bs);
  assert.deepEqual(states([...base, commit(), draw(['q-s'])]), {s: ['sampled', 'awaiting'], n: ['not_sampled', null], short: ['not_eligible', null], long: ['not_eligible', null]});
  assert.deepEqual(states([...base, commit(), draw(['q-s'])], '2026-11-15'), {s: ['sampled', 'past_deadline_unchecked'], n: ['not_sampled', null], short: ['not_eligible', null], long: ['not_eligible', null]});
  assert.deepEqual(states([...base, commit()]).n, ['awaiting_draw', null]);
  assert.deepEqual(states(base).n, ['warm_up', null]);
  assert.deepEqual(states(base).short, ['not_eligible', null]);
});

test('a sampled question with a verdict shows the verdict result as its state; the latest revision wins; an unsampled one has no state', () => {
  const bs = [X.branch('s', '2026-11-10'), X.branch('n', '2026-11-12')];
  const facts = [...issue('PRED#T/2026-10-20', bs), commit(), draw(['q-s']),
    X.verdict('t', '2026-11-11T00:00:00.000Z', 's', 'yes', 1), X.verdict('t', '2026-11-12T00:00:00.000Z', 's', 'void', 2), X.verdict('t', '2026-11-13T00:00:00.000Z', 'n', 'no', 1)];
  assert.deepEqual(branchesOf(facts).map((b) => [b.branchId, b.scoring, b.state, b.verdict && b.verdict.result]), [['s', 'sampled', 'void', 'void'], ['n', 'not_sampled', null, 'no']]);
});

test('a legacy branch (no question id) has scoring and state null', () => {
  const facts = issue('PRED#T/2026-10-20', [X.branch('old', '2026-11-10', {question: false, qid: null})]);
  assert.deepEqual(branchesOf(facts).map((b) => [b.legacy, b.scoring, b.state]), [[true, null, null]]);
});

test('week boundary: an issue day belongs to its ISO week (Sunday, Monday) and a draw of another week does not count', () => {
  const fork = 'PRED#T/2026-10-25'; // Sunday of 2026-W43
  const facts = [X.entry('t', '2026-10-25T04:00:00.000Z', 'x'), X.forecast('t', '2026-10-25T05:00:00.000Z', fork, [X.branch('b', '2026-11-20')]),
    F.inboxDrawFact(commitLine({weekId: '2026-W43'}), 'r'), F.inboxDrawFact(drawLine({weekId: '2026-W44', picked: []}), 'r')];
  assert.deepEqual(branchesOf(facts).map((b) => b.scoring), ['awaiting_draw']);
});

// ---- the shared module against the read API's copy ----
test('questionState gives the same answers as the read API prediction_snapshot functions on a grid of cases', () => {
  const L = require('../../../read-api/newsSensitiveData/src/lib');
  const issues = ['2026-10-05', '2026-10-11', '2026-10-12', '2026-12-31', '2027-01-01'];
  let n = 0;
  for (const issueDay of issues) {
    assert.equal(Q.isoWeekOfDay(issueDay), L.isoWeekOfDay(issueDay));
    for (const lead of [0, 6, 7, 8, 30, 83, 84, 85, 90, 91]) {
      const deadline = new Date(Date.parse(`${issueDay}T00:00:00Z`) + lead * 86400000).toISOString().slice(0, 10);
      for (const sampled of [true, false]) for (const commitExists of [true, false]) for (const drawExists of [true, false]) {
        assert.equal(Q.sampleState({issueDay, deadline, sampled, commitExists, drawExists}), L.questionSampleState({issueDay, deadline, sampled, commitExists, drawExists}));
        n += 1;
      }
      for (const today of [issueDay, deadline, '2030-01-01']) for (const sampled of [true, false]) {
        for (const rows of [[], [{SK: 'VERDICT', verdict: 'yes'}], [{SK: 'VERDICT', verdict: 'yes'}, {SK: 'VERDICT#2', verdict: 'no'}], [{SK: 'VERDICT', verdict: 'no'}, {SK: 'VERDICT#2', verdict: 'void'}]]) {
          const latest = L.latestVerdictRow(rows);
          assert.equal(Q.outcomeState({sampled, result: latest ? latest.verdict : null, deadline, today}), L.questionOutcomeState({sampled, verdictRows: rows, deadline, today}));
          n += 1;
        }
      }
    }
  }
  assert.ok(n > 1000);
});
