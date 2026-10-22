'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/views');
const Rd = require('../src/readings');
const X = require('./views-fixture');

const opts = {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: '2026-10-22-1', factsManifestDays: 7};
const build = (facts, readings = [], o = {}) => V.buildViews(facts, {...opts, readings, ...o});
const rowOf = (v, id) => v.all.stories.find((r) => r.threadId === id);
const C1 = '1'.repeat(40);
const C2 = '2'.repeat(40);

test('T1: ISO weeks, and the weeks to read run from the first fact day to today without listing', () => {
  assert.deepEqual([Rd.isoWeekOf('2026-10-19'), Rd.isoWeekOf('2026-10-25'), Rd.isoWeekOf('2026-01-01'), Rd.isoWeekOf('2027-01-03')], ['2026-W43', '2026-W43', '2026-W01', '2026-W53']);
  assert.deepEqual(Rd.weeksBetween('2026-10-05', '2026-10-22'), ['2026-W41', '2026-W42', '2026-W43']);
  assert.deepEqual(Rd.weeksBetween('2026-10-22', '2026-10-22'), ['2026-W43']);
});

test('T1: no readings leaves every view as before (reading none, readingsThrough null, no index line)', () => {
  const v = build(X.golden());
  const a = v.stories.get('thread-a');
  assert.deepEqual([a.line, a.chapters, a.branchStatus, a.reading], [null, [], null, {state: 'none', reason: 'no reading yet'}]);
  assert.deepEqual([v.manifest.readingsThrough, v.active.builtFrom.readingsThrough], [null, null]);
  assert.equal('line' in rowOf(v, 'thread-a'), false);
  assert.deepEqual(build(X.golden(), []), build(X.golden()));
});

test('T1: the latest week wins per (thread, subtype, key); a superseded reading is dropped even if it is the only one of its week', () => {
  const rs = [
    X.reading('2026-W42', 'thread-a', 'line', {text: 'old line'}),
    X.reading('2026-W43', 'thread-a', 'line', {text: 'new line'}, {cites: [C1]}),
    X.reading('2026-W41', 'thread-a', 'chapter', {title: 'Early', from: '2026-10-01', to: '2026-10-07', summary: 's1'}, {key: 'a'}),
    X.reading('2026-W42', 'thread-a', 'chapter', {title: 'Early v1', from: '2026-10-08', to: '2026-10-14', summary: 's2'}, {key: 'b', readingId: 'ch-b1'}),
    X.reading('2026-W43', 'thread-a', 'chapter', {title: 'Mid v2', from: '2026-10-08', to: '2026-10-18', summary: 's3'}, {key: 'b2', supersedes: 'ch-b1', cites: [C2]}),
  ];
  const a = build(X.golden(), rs).stories.get('thread-a');
  assert.deepEqual(a.line, {text: 'new line', week: '2026-W43', cites: [C1]});
  assert.deepEqual(a.chapters.map((c) => [c.title, c.from, c.to]), [['Early', '2026-10-01', '2026-10-07'], ['Mid v2', '2026-10-08', '2026-10-18']]);
  assert.deepEqual(a.chapters[1].cites, [C2]);
  assert.deepEqual(a.reading, {state: 'read', week: '2026-W43'});
  // order of the input lines does not matter
  assert.deepEqual(build(X.golden(), [...rs].reverse()).stories.get('thread-a'), a);
  // a re-run of the same week with the same key: later run id wins
  const rerun = [X.reading('2026-W43', 'thread-a', 'line', {text: 'first'}, {run: 'review-1', readingId: 'x1'}), X.reading('2026-W43', 'thread-a', 'line', {text: 'second'}, {run: 'review-2', readingId: 'x2'})];
  assert.equal(build(X.golden(), rerun).stories.get('thread-a').line.text, 'second');
  assert.equal(build(X.golden(), [rs[0]]).manifest.readingsThrough, '2026-W42');
  assert.equal(build(X.golden(), rs).manifest.readingsThrough, '2026-W43');
});

test('T1: malformed readings are skipped, never thrown on', () => {
  const bad = [null, 'x', {subtype: 'line'}, X.reading('2026-W43', 'thread-a', 'line', {text: ''}), X.reading('week43', 'thread-a', 'line', {text: 'x'}), X.reading('2026-W43', 'thread-a', 'branch_status', {branchId: 'a-0', status: 'maybe'})];
  assert.deepEqual(build(X.golden(), bad).stories.get('thread-a').reading, {state: 'none', reason: 'no reading yet'});
});

test('T1: branch status fills only open branches; a verdict always decides (yes, no and void are never overridden)', () => {
  // thread-a: a-0 open (due 10-25), a-1 open (due 10-21, no verdict), a-2 yes, a-3 no
  const rs = ['a-0', 'a-1', 'a-2', 'a-3', 'nope'].map((id, i) => X.reading('2026-W43', 'thread-a', 'branch_status', {branchId: id, status: i % 2 ? 'late' : 'holding', why: `why ${id}`}, {key: id}));
  const a = build(X.golden(), rs).stories.get('thread-a');
  assert.deepEqual(a.branchStatus, {'a-0': {status: 'holding', why: 'why a-0', week: '2026-W43'}, 'a-1': {status: 'late', why: 'why a-1', week: '2026-W43'}});
  const verdicts = Object.fromEntries(a.forks.flatMap((k) => k.branches).map((b) => [b.branchId, b.verdict && b.verdict.result]));
  assert.deepEqual(verdicts, {'a-0': null, 'a-1': null, 'a-2': 'yes', 'a-3': 'no'});
  // a reading that says dead for a yes-branch changes nothing
  const contra = [X.reading('2026-W43', 'thread-a', 'branch_status', {branchId: 'a-2', status: 'dead', why: 'x'}, {key: 'a-2'})];
  const b = build(X.golden(), contra).stories.get('thread-a');
  assert.equal(b.branchStatus, null);
  assert.equal(b.forks[0].branches.find((x) => x.branchId === 'a-2').verdict.result, 'yes');
  // a void verdict is a verdict too
  const withVoid = [...X.golden(), X.verdict('thread-a', '2026-10-22T07:00:00.000Z', 'a-0', 'void')];
  assert.equal(build(withVoid, rs).stories.get('thread-a').branchStatus['a-0'], undefined);
});

test('T1: the index row gets line (text) only when a line reading exists; a merged story keeps its alias row', () => {
  const v = build(X.golden(), [X.reading('2026-W43', 'thread-a', 'line', {text: 'Macron holds'}), X.reading('2026-W43', 'thread-c', 'line', {text: 'ignored'})]);
  assert.equal(rowOf(v, 'thread-a').line, 'Macron holds');
  assert.equal('line' in rowOf(v, 'thread-b'), false);
  assert.equal('line' in rowOf(v, 'thread-c'), false);
  assert.deepEqual(Object.keys(v.stories.get('thread-c')).sort(), ['aliasOf', 'builtFrom', 'schemaVersion', 'threadId']);
  assert.equal(v.active.stories.find((r) => r.threadId === 'thread-a').line, 'Macron holds');
});

const pad = (at, n = 100) => Array.from({length: n}, (_, i) => X.entry(`pad${String(i).padStart(3, '0')}`, at, 'x', {sources: [`p${i}`]}));
test('T1: confirmedLinks come from link readings of the story, point at the survivor of a merged story, and drop self links', () => {
  const at = '2026-10-20T04:00:00.000Z';
  const f = [X.entry('me', at, 'x'), X.entry('you', at, 'x'), X.entry('old', at, 'x'), X.merged('you', '2026-10-21T00:00:00.000Z', 'old'), ...pad(at)];
  const rs = [
    X.reading('2026-W43', 'me', 'link', {otherThreadId: 'old', mechanism: 'sanctions', direction: 'drives'}, {key: 'old', cites: [C1]}),
    X.reading('2026-W42', 'me', 'link', {otherThreadId: 'you', mechanism: 'earlier', direction: 'shared_cause'}, {key: 'you'}),
    X.reading('2026-W43', 'me', 'link', {otherThreadId: 'me', mechanism: 'self', direction: 'drives'}, {key: 'me'}),
  ];
  const l = build(f, rs).links.get('me');
  // 'old' resolves to 'you'; both readings are separate keys so both stay, sorted by week
  assert.deepEqual(l.confirmedLinks.map((c) => [c.otherThreadId, c.mechanism, c.direction, c.week]), [['you', 'earlier', 'shared_cause', '2026-W42'], ['you', 'sanctions', 'drives', '2026-W43']]);
  assert.deepEqual([l.confirmedLinks[1].cites, l.confirmedLinksReason], [[C1], null]);
  assert.deepEqual([build(f, rs).links.get('you').confirmedLinks, build(f, rs).links.get('you').confirmedLinksReason], [[], 'no reading yet']);
});
