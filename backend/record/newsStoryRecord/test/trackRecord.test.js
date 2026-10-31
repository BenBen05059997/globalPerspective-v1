'use strict';
// record/views/track-record.json (decision 0044): built from facts, the same questions the PredictionLog board gives.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const F = require('../src/facts');
const V = require('../src/views');
const X = require('./views-fixture');
const {buildTrackRecord} = require('../src/trackRecord');
const {buildQuestionBoard} = require('../../../predictions/newsPredictionsSnapshot/src/questionBoard');
const OldScoring = require('../../../predictions/newsPredictionsSnapshot/src/scoring');
const NewScoring = require('../src/_shared/questionScoring');
const Q = require('../src/_shared/questionState');

const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const validate = new Ajv({allErrors: true, strict: false}).compile(JSON.parse(readFileSync(resolve(__dirname, '../schema/views/track-record.schema.json'), 'utf8')));

// ---- one history, written twice: as PredictionLog rows (the old board) and as facts (the view) ----
const THREAD = {a: 'thread-a', b: 'thread-b', c: 'thread-c', d: 'thread-d'};
const issue = {a: '2026-10-06', b: '2026-10-06', c: '2026-10-07', d: '2026-10-14'};
const due = {a: '2026-10-20', b: '2026-10-20', c: '2026-11-30', d: '2026-11-20'};
const p = {a: 62, b: 40, c: 25, d: 70};
const title = (k) => `Story ${k}`;
const gen = (k) => `${issue[k]}T05:00:00.000Z`;

const rows = [];
const facts = [];
for (const k of ['a', 'b', 'c', 'd']) {
  rows.push({PK: `PRED#${title(k)}-1`, SK: issue[k], generatedAt: gen(k), questionSchema: 1, methodologyVersion: 1, threadId: THREAD[k], scenarios: [{label: 'Likely', probability: 0.5, triggers: [
    {id: '0-0', qid: `q-${k}`, text: `Will ${k} happen`, deadline: due[k], question: true, p: p[k], resolutionSource: `Source ${k}`}]}]});
  const fc = X.forecast(THREAD[k], gen(k), `PRED#${title(k)}-1/${issue[k]}`, [X.branch(`${k}-0`, due[k], {qid: `q-${k}`, text: 'Likely', trigger: `Will ${k} happen`, p: p[k], resolutionSource: `Source ${k}`})]);
  fc.payload.topicId = `${title(k)}-1`;
  facts.push(fc);
}
rows.push({PK: 'PRED#Old-1', SK: '2026-10-01', generatedAt: '2026-10-01T05:00:00.000Z', questionSchema: 1, methodologyVersion: 1, scenarios: [{triggers: [{qid: 'q-old', question: true, text: 'warm', deadline: '2026-12-01', p: 50}]}]});
facts.push(Object.assign(X.forecast('thread-old', '2026-10-01T05:00:00.000Z', 'PRED#Old-1/2026-10-01', [X.branch('old-0', '2026-12-01', {qid: 'q-old', p: 50})]), {}));
facts[facts.length - 1].payload.topicId = 'Old-1';

const commitLines = [['2026-W41', '2026-10-05', '2026-10-01T10:30:00.000Z'], ['2026-W42', '2026-10-12', '2026-10-01T10:30:00.000Z'], ['2026-W43', '2026-10-19', '2026-10-12T10:30:00.000Z'], ['2026-W44', '2026-10-26', '2026-10-19T10:30:00.000Z'], ['2026-W45', '2026-11-02', '2026-10-26T10:30:00.000Z']];
for (const [w, start, at] of commitLines) {
  const hash = w.replace(/\D/g, '').padEnd(64, 'a');
  rows.push({PK: `SEED#${w}`, SK: 'COMMIT', weekId: w, weekStart: start, weekEnd: start, commitHash: hash, committedAt: at});
  facts.push(F.inboxDrawFact({type: 'commit', weekId: w, weekStart: start, weekEnd: start, commitHash: hash, rule: 'v1', committedAt: at}, 'r'));
}
const draws = [
  {weekId: '2026-W41', at: '2026-10-12T10:30:24.000Z', eligible: 9, clusters: 5, picked: [{qid: 'q-a', clusterKey: THREAD.a, hash: 'h1'}, {qid: 'q-b', clusterKey: THREAD.b, hash: 'h2'}, {qid: 'q-c', clusterKey: THREAD.c, hash: 'h3'}]},
  {weekId: '2026-W42', at: '2026-10-19T10:30:24.000Z', eligible: 1, clusters: 1, picked: [{qid: 'q-d', clusterKey: THREAD.d, hash: 'h4'}]},
];
for (const d of draws) {
  rows.push({PK: `SEED#${d.weekId}`, SK: 'REVEAL', weekId: d.weekId, seedHex: 'ab', revealedAt: d.at});
  rows.push({PK: `SAMPLE#${d.weekId}`, SK: 'DRAW', weekId: d.weekId, K: 22, eligible: d.eligible, clusters: d.clusters, pool: [{q: 'x', c: 'y'}], picked: d.picked.map((x) => ({qid: x.qid, h: x.hash, clusterKey: x.clusterKey}))});
  facts.push(F.inboxDrawFact({type: 'draw', weekId: d.weekId, rule: 'v1', K: 22, eligible: d.eligible, clusters: d.clusters, seedHex: 'ab', picked: d.picked, drawnAt: d.at}, 'r'));
  for (const x of d.picked) {
    const k = x.qid.slice(2);
    rows.push({PK: `Q#${x.qid}`, SK: 'SAMPLED', qid: x.qid, weekId: d.weekId, clusterKey: x.clusterKey, question: `Will ${k} happen`, deadline: due[k], resolutionSource: `Source ${k}`, storyTitle: title(k), issuedAt: gen(k)});
  }
}
// q-a: yes, then corrected to no; q-b: void; q-c: none yet; q-d: none yet; q-old is not in a sample
const verdictLine = (qid, k, result, revision, at, extra = {}) => ({qid, threadId: THREAD[k], branchId: `${k}-0`, result, revision, decidedAt: at, decidedBy: 'agent', evidence: extra.evidence ?? null, voidReason: extra.voidReason ?? null, reason: null});
const verdicts = [
  [verdictLine('q-a', 'a', 'yes', 1, '2026-10-26T09:00:00.000Z', {evidence: {quote: 'a quote', url: 'https://x.test'}}), {PK: 'Q#q-a', SK: 'VERDICT', qid: 'q-a', verdict: 'yes', decidedAt: '2026-10-26T09:00:00.000Z', evidence: {quote: 'a quote', url: 'https://x.test'}}],
  [verdictLine('q-a', 'a', 'no', 2, '2026-11-02T09:00:00.000Z', {evidence: {quote: 'fixed', url: null}}), {PK: 'Q#q-a', SK: 'VERDICT#2', qid: 'q-a', verdict: 'no', decidedAt: '2026-11-02T09:00:00.000Z', evidence: {quote: 'fixed'}}],
  [verdictLine('q-b', 'b', 'void', 1, '2026-10-26T09:05:00.000Z', {voidReason: 'event_moot'}), {PK: 'Q#q-b', SK: 'VERDICT', qid: 'q-b', verdict: 'void', voidReason: 'event_moot', decidedAt: '2026-10-26T09:05:00.000Z'}],
];
const build = (today, upTo) => {
  const vs = verdicts.filter(([l]) => l.decidedAt.slice(0, 10) <= upTo);
  const fx = [...facts, ...vs.map(([l]) => F.inboxVerdictFact(l, null, 'r'))];
  const rs = [...rows, ...vs.map(([, r]) => r)];
  return {view: buildTrackRecord(fx, {today}), board: buildQuestionBoard(rs, `${today}T12:00:00.000Z`)};
};
const comparable = (board) => {
  const q = JSON.parse(JSON.stringify(board));
  for (const k of ['schema', 'builtAt', 'settleHealth']) delete q[k];
  for (const w of q.weeks) { delete w.reviewed; delete w.draw; }
  q.sampled.sort((x, y) => x.qid.localeCompare(y.qid));
  return q;
};
const viewQuestions = (view) => {
  const q = JSON.parse(JSON.stringify(view.questions));
  delete q.settleHealth; // compared apart, below
  for (const w of q.weeks) delete w.draw; // the fixture's draws are not reproducible from its forecasts; the draw tests are apart
  q.sampled.sort((x, y) => x.qid.localeCompare(y.qid));
  return q;
};
// the alarm's inputs: the same answers as the board, except the daily tick (a heartbeat, not a fact)
const healthOf = (h) => { const { tickStale, lastTickAt, ...rest } = h; return rest; };

for (const [today, upTo] of [['2026-10-03', '2026-10-03'], ['2026-10-21', '2026-10-21'], ['2026-10-27', '2026-10-27'], ['2026-11-05', '2026-11-05'], ['2026-12-05', '2026-12-05']]) {
  test(`parity with the PredictionLog board on ${today}: questions equal field by field`, () => {
    const {view, board} = build(today, upTo);
    assert.deepEqual(viewQuestions(view), comparable(board));
    assert.deepEqual(view.questions.settleHealth, healthOf(board.settleHealth));
  });
}

test('the view states what it computed: counts, a corrected verdict, the void reason, weeks and warm-up', () => {
  const {view} = build('2026-11-05', '2026-11-05');
  const q = view.questions;
  assert.deepEqual(q.counts, {locked: 4, yes: 0, no: 1, void: 1, awaiting: 2, pastDeadlineUnchecked: 0, resolved: 1});
  const byId = Object.fromEntries(q.sampled.map((s) => [s.qid, s]));
  assert.equal(byId['q-a'].state, 'no');
  assert.deepEqual(byId['q-a'].verdict, {decidedAt: '2026-11-02T09:00:00.000Z', url: null, quote: 'fixed'});
  assert.equal(byId['q-b'].voidReason, 'event_moot');
  assert.equal(byId['q-a'].storyTitle, 'Story a');
  assert.equal(byId['q-a'].question, 'Will a happen');
  assert.equal(byId['q-a'].clusterKey, THREAD.a);
  assert.equal(q.warmUp, 1);
  assert.equal(q.issued, 5);
  assert.equal(q.sampledTotal, 4);
  assert.deepEqual(q.firstCommit, {weekId: '2026-W41', committedAt: '2026-10-01T10:30:00.000Z'});
  assert.equal(q.firstDrawWeek, '2026-W41');
  assert.deepEqual(q.weeks.map((w) => [w.weekId, w.drawn, w.picked, w.due, w.settled]), [['2026-W41', true, 3, 0, 0], ['2026-W42', true, 1, 0, 0], ['2026-W43', false, null, 2, 0], ['2026-W44', false, null, 0, 1], ['2026-W45', false, null, 0, 1]]);
  assert.equal(q.scoring, null);
  assert.equal(validate(view), true, JSON.stringify(validate.errors));
});

test('nothing in the record: honest zeros, no weeks, a valid view', () => {
  const view = buildTrackRecord([], {today: '2026-10-01'});
  assert.deepEqual([view.questions.issued, view.questions.sampled, view.questions.weeks, view.questions.firstCommit, view.questions.scoring, view.builtFrom.factsThrough], [0, [], [], null, null, null]);
  assert.equal(validate(view), true, JSON.stringify(validate.errors));
});

test('a pick whose forecast is not in the record stays in sampledTotal but not in the list', () => {
  const view = buildTrackRecord([...facts.filter((f) => f.kind === 'question_commit' || f.kind === 'question_draw')], {today: '2026-10-27'});
  assert.deepEqual([view.questions.sampledTotal, view.questions.sampled.length, view.questions.counts.locked], [4, 0, 0]);
});

test('the legacy block is the frozen constant and carries its source', () => {
  const {legacy} = buildTrackRecord([], {today: '2026-10-01'});
  assert.equal(legacy.resolvedTriggers, 122);
  assert.equal(legacy.recent.length, 30);
  assert.match(legacy.source, /newsPredictionsSnapshot/);
});

test('the view is part of buildViews and writeGroups, before the manifest', () => {
  const v = V.buildViews(X.golden(), {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1});
  assert.equal(validate(v.trackRecord), true, JSON.stringify(validate.errors));
  const keys = V.writeGroups(v).flat().map(([k]) => k);
  assert.ok(keys.indexOf('track-record.json') > keys.indexOf('index/all.json') && keys.indexOf('track-record.json') < keys.indexOf('manifest.json'));
});

test('scoring: the shared module is the snapshot module (same answers on a grid)', () => {
  const items = Array.from({length: 160}, (_, i) => ({p: (i * 7) % 100, y: i % 3 === 0 ? 1 : 0, cluster: `c${i % 40}`}));
  assert.deepEqual(NewScoring.computeScoring(items, {voidCount: 5}), OldScoring.computeScoring(items, {voidCount: 5}));
  assert.equal(NewScoring.computeScoring(items.slice(0, 149)), null);
  assert.notEqual(NewScoring.computeScoring(items, {}), null);
});

test('the view scores from 150 resolved questions, the same as the board', () => {
  const many = [];
  const rs = [];
  const fx = [];
  for (let i = 0; i < 150; i++) {
    const qid = `s-${i}`;
    const thread = `thread-s${i % 30}`;
    const fc = X.forecast(thread, '2026-10-06T05:00:00.000Z', `PRED#S${i}-1/2026-10-06`, [X.branch(`s${i}-0`, '2026-10-20', {qid, p: (i * 13) % 100, trigger: `Q ${i}`})]);
    fc.payload.topicId = `S${i}-1`;
    fx.push(fc);
    rs.push({PK: `PRED#S${i}-1`, SK: '2026-10-06', generatedAt: '2026-10-06T05:00:00.000Z', questionSchema: 1, methodologyVersion: 1, scenarios: [{triggers: [{qid, text: `Q ${i}`, deadline: '2026-10-20', question: true, p: (i * 13) % 100, resolutionSource: 'r'}]}]});
    rs.push({PK: `Q#${qid}`, SK: 'SAMPLED', qid, weekId: '2026-W41', clusterKey: thread, question: `Q ${i}`, deadline: '2026-10-20', resolutionSource: 'r', storyTitle: `S${i}`, issuedAt: '2026-10-06T05:00:00.000Z'});
    const res = i % 4 === 0 ? 'yes' : 'no';
    fx.push(F.inboxVerdictFact({qid, threadId: thread, branchId: `s${i}-0`, result: res, revision: 1, decidedAt: '2026-10-27T09:00:00.000Z', evidence: null}, null, 'r'));
    rs.push({PK: `Q#${qid}`, SK: 'VERDICT', qid, verdict: res, decidedAt: '2026-10-27T09:00:00.000Z'});
    many.push(qid);
  }
  fx.push(F.inboxDrawFact({type: 'commit', weekId: '2026-W41', weekStart: '2026-10-05', weekEnd: '2026-10-11', commitHash: 'c'.repeat(64), rule: 'v1', committedAt: '2026-10-01T10:30:00.000Z'}, 'r'));
  rs.push({PK: 'SEED#2026-W41', SK: 'COMMIT', weekId: '2026-W41', weekStart: '2026-10-05', commitHash: 'c'.repeat(64), committedAt: '2026-10-01T10:30:00.000Z'});
  const picked = many.map((qid, i) => ({qid, hash: 'h', clusterKey: `thread-s${i % 30}`}));
  fx.push(F.inboxDrawFact({type: 'draw', weekId: '2026-W41', rule: 'v1', K: 150, eligible: 150, clusters: 30, seedHex: 'ab', picked, drawnAt: '2026-10-12T10:30:00.000Z'}, 'r'));
  rs.push({PK: 'SAMPLE#2026-W41', SK: 'DRAW', weekId: '2026-W41', K: 150, eligible: 150, clusters: 30, pool: [], picked: picked.map((x) => ({qid: x.qid, h: 'h', clusterKey: x.clusterKey}))});
  const view = buildTrackRecord(fx, {today: '2026-11-05'});
  const board = buildQuestionBoard(rs, '2026-11-05T12:00:00.000Z');
  assert.notEqual(board.scoring, null);
  assert.deepEqual(view.questions.scoring, board.scoring);
  assert.equal(validate(view), true, JSON.stringify(validate.errors));
});

test('the state words come from the shared rule', () => {
  assert.equal(Q.outcomeState({sampled: true, result: null, deadline: '2026-10-20', today: '2026-10-21'}), 'past_deadline_unchecked');
});

// ---- decision 0052: the draw's pool is rebuilt from the forecast facts, and published only when it reproduces the draw ----
const P = require('../src/_shared/questionPool');
function drawWorld({ tamper = false } = {}) {
  const SEED = 'ab'.repeat(32);
  const fx = [];
  const specs = [['p', '2026-10-06', 30], ['q', '2026-10-07', 40], ['r', '2026-10-08', 5], ['s', '2026-10-08', 50]]; // r has a 5-day lead: not eligible
  for (const [k, day, lead] of specs) {
    const fc = X.forecast(`thread-${k}`, `${day}T05:00:00.000Z`, `PRED#Story ${k}-1/${day}`, [X.branch(`${k}-0`, P.addDays(day, lead), { qid: `q-${k}`, p: 50, trigger: `Will ${k}` })]);
    fc.payload.topicId = `Story ${k}-1`;
    fx.push(fc);
  }
  const pool = P.eligibleQuestions(P.rowsOfFacts(fx), '2026-W41');
  const res = P.draw(SEED, pool.map((x) => ({ qid: x.qid, clusterKey: x.clusterKey })), 22);
  const picked = res.picked.map((x) => ({ qid: x.qid, hash: tamper ? 'f'.repeat(64) : x.h, clusterKey: x.clusterKey }));
  fx.push(F.inboxDrawFact({ type: 'commit', weekId: '2026-W41', weekStart: '2026-10-05', weekEnd: '2026-10-11', commitHash: P.sha256hex(SEED), rule: 'v1', committedAt: '2026-10-01T10:30:00.000Z' }, 'r'));
  fx.push(F.inboxDrawFact({ type: 'draw', weekId: '2026-W41', rule: 'v1', K: 22, eligible: res.eligible, clusters: res.clusters, seedHex: SEED, picked, drawnAt: '2026-10-12T10:30:00.000Z' }, 'r'));
  return { fx, res, pool };
}

test('a drawn week carries its pool and picks as the page verifies them, when the forecast facts reproduce the draw', () => {
  const { fx, res, pool } = drawWorld();
  const view = buildTrackRecord(fx, { today: '2026-10-20' });
  const w = view.questions.weeks.find((x) => x.weekId === '2026-W41');
  assert.equal(pool.length, 3);
  assert.deepEqual(w.draw.pool, pool.map((x) => ({ q: x.qid, c: x.clusterKey })));
  assert.deepEqual(w.draw.picked, res.picked.map((x) => ({ qid: x.qid, h: x.h, clusterKey: x.clusterKey })));
  assert.equal(w.draw.K, 22);
  assert.equal(validate(view), true, JSON.stringify(validate.errors));
});

test('a draw the facts cannot reproduce publishes no pool (honest: the page cannot verify it)', () => {
  const { fx } = drawWorld({ tamper: true });
  const w = buildTrackRecord(fx, { today: '2026-10-20' }).questions.weeks.find((x) => x.weekId === '2026-W41');
  assert.equal('draw' in w, false);
  assert.equal(w.drawn, true);
});

test('only the last four drawn weeks carry a pool', () => {
  const { fx } = drawWorld();
  const more = [];
  for (const [w, start] of [['2026-W42', '2026-10-12'], ['2026-W43', '2026-10-19'], ['2026-W44', '2026-10-26'], ['2026-W45', '2026-11-02']]) {
    more.push(F.inboxDrawFact({ type: 'draw', weekId: w, rule: 'v1', K: 22, eligible: 0, clusters: 0, seedHex: 'ab'.repeat(32), picked: [], drawnAt: `${start}T10:30:00.000Z` }, 'r'));
    more.push(F.inboxDrawFact({ type: 'commit', weekId: w, weekStart: start, weekEnd: start, commitHash: P.sha256hex('ab'.repeat(32)), rule: 'v1', committedAt: `${start}T00:00:01.000Z` }, 'r'));
  }
  const weeks = buildTrackRecord([...fx, ...more], { today: '2026-11-10' }).questions.weeks;
  assert.deepEqual(weeks.filter((w) => w.draw).map((w) => w.weekId), ['2026-W42', '2026-W43', '2026-W44', '2026-W45'], 'W41 is the fifth drawn week back, and an empty pool of an empty draw reproduces');
});
