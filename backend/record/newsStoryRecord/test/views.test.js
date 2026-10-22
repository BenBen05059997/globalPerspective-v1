'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, writeFileSync} = require('node:fs');
const {resolve} = require('node:path');
const V = require('../src/views');
const X = require('./views-fixture');

const today = '2026-10-22';
const opts = {today, builtAt: '2026-10-22T05:45:00.000Z', runId: '2026-10-22-1', factsManifestDays: 7};
const build = (facts, o = {}) => V.buildViews(facts, {...opts, ...o});
const rowOf = (views, id) => views.all.stories.find((r) => r.threadId === id);
const JSONIFY = (x) => JSON.parse(JSON.stringify(x));

test('golden: a small fact set builds exactly the reviewed view JSON', () => {
  const v = build(X.golden());
  const actual = JSONIFY({
    stories: Object.fromEntries(v.stories), links: Object.fromEntries(v.links), counts: Object.fromEntries([...v.counts].filter(([d]) => ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].includes(d))),
    active: v.active, all: v.all, manifest: v.manifest,
  });
  const file = resolve(__dirname, 'golden/views.golden.json');
  if (process.env.UPDATE_GOLDEN) writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
  assert.deepEqual(actual, JSON.parse(readFileSync(file, 'utf8')));
});

test('every view carries schemaVersion 1 and builtFrom; readings are null with the reason', () => {
  const v = build(X.golden());
  const all = [...v.stories.values(), ...v.links.values(), ...v.counts.values(), v.active, v.all];
  for (const o of all) assert.deepEqual([o.schemaVersion, o.builtFrom], [1, {factsThrough: '2026-10-22', readingsThrough: null}]);
  const a = v.stories.get('thread-a');
  assert.deepEqual([a.line, a.chapters, a.branchStatus, a.reading], [null, [], null, {state: 'none', reason: 'no reading yet'}]);
  assert.deepEqual(v.manifest, {schemaVersion: 1, builtAt: opts.builtAt, runId: opts.runId, factsManifestDays: 7, factsThrough: '2026-10-22', readingsThrough: null});
});

test('liveBranchCount counts branches due today or later with no verdict; latestVerdictAt is the newest verdict', () => {
  const row = rowOf(build(X.golden()), 'thread-a');
  // a-0 due 10-25 live, a-1 due 10-21 past, a-2 due today but has a verdict, a-3 past with a verdict
  assert.deepEqual([row.forkCount, row.branchCount, row.liveBranchCount, row.latestVerdictAt], [1, 4, 1, '2026-10-22T06:00:00.000Z']);
  assert.equal(rowOf(build(X.golden(), {today: '2026-10-25'}), 'thread-a').liveBranchCount, 1);
  assert.equal(rowOf(build(X.golden(), {today: '2026-10-26'}), 'thread-a').liveBranchCount, 0);
  const none = rowOf(build([X.entry('t', '2026-10-20T00:00:00.000Z', 'x')]), 't');
  assert.deepEqual([none.latestVerdictAt, none.liveBranchCount], [null, 0]);
});

test('the newest revision of a verdict wins for a branch', () => {
  const f = [X.entry('t', '2026-10-20T00:00:00.000Z', 'x'), X.forecast('t', '2026-10-20T01:00:00.000Z', 'F', [X.branch('b', '2026-10-30')]),
    X.verdict('t', '2026-10-21T00:00:00.000Z', 'b', 'yes', 1), X.verdict('t', '2026-10-23T00:00:00.000Z', 'b', 'void', 2)];
  assert.deepEqual(build(f).stories.get('t').forks[0].branches[0].verdict, {at: '2026-10-23T00:00:00.000Z', result: 'void', decidedBy: 'agent', evidence: {url: 'https://e.test'}});
});

test('a correction marks the corrected entry and is listed; other entries are untouched', () => {
  const a = build(X.golden()).stories.get('thread-a');
  assert.deepEqual(a.entries.map((e) => [e.eventId, e.corrected]), [['ea1', true], ['ea2', undefined]]);
  assert.deepEqual(a.corrections, [{corrects: 'ea1', at: '2026-10-21T08:00:00.000Z', reason: 'operator'}]);
});

test('aliases resolve transitively, a cycle and a second move of a merged story are ignored', () => {
  const m = (into, from, at) => X.merged(into, at, from);
  const f = [m('b', 'a', '2026-10-01T00:00:00.000Z'), m('c', 'b', '2026-10-02T00:00:00.000Z'), m('a', 'c', '2026-10-03T00:00:00.000Z'), m('z', 'a', '2026-10-04T00:00:00.000Z')];
  const {aliases, applied} = V.resolveAliases(f);
  assert.deepEqual([...aliases], [['a', 'c'], ['b', 'c']]);
  assert.equal(applied.length, 2);
});

test('a merged story is an alias view, an alias row in all.json only, and its entries move to the survivor tagged fromThreadId', () => {
  const v = build(X.golden());
  assert.deepEqual(v.stories.get('thread-c'), {schemaVersion: 1, builtFrom: {factsThrough: '2026-10-22', readingsThrough: null}, threadId: 'thread-c', aliasOf: 'thread-b'});
  assert.equal(v.active.stories.some((r) => r.threadId === 'thread-c'), false);
  assert.equal(rowOf(v, 'thread-c').aliasOf, 'thread-b');
  const b = v.stories.get('thread-b');
  assert.deepEqual(b.entries.map((e) => [e.eventId, e.fromThreadId]), [['ec1', 'thread-c'], ['eb1', undefined]]);
  assert.deepEqual(b.merges, [{from: 'thread-c', into: 'thread-b', at: '2026-10-21T09:05:00.000Z', reason: 'same event'}]);
  assert.deepEqual(rowOf(v, 'thread-b').aliases, ['thread-c']);
  assert.equal(rowOf(v, 'thread-b').entryCount, 2);
  assert.equal(b.forks.length, 0); // the merged story's forecasts do not move (Choices)
});

test('active index: a fact 59 days back is active, 60 days back is only in all.json; rows by lastFactAt desc then id', () => {
  const day = (n) => `${new Date(Date.parse('2026-10-22T00:00:00Z') - n * 86400000).toISOString().slice(0, 10)}T10:00:00.000Z`;
  const f = [X.entry('in', day(59), 'x'), X.entry('out', day(60), 'x'), X.entry('b-new', day(1), 'x'), X.entry('a-new', day(1), 'x')];
  const v = build(f);
  assert.deepEqual(v.active.stories.map((r) => r.threadId), ['a-new', 'b-new', 'in']);
  assert.deepEqual(v.all.stories.map((r) => r.threadId), ['a-new', 'b-new', 'in', 'out']);
  assert.equal(v.links.has('out'), false);
});

test('links: grounds count the non-empty shared lists, zero rows drop, sort by grounds then id, max 50, inactive stories excluded', () => {
  const at = '2026-10-20T00:00:00.000Z';
  const e = (id, o) => X.entry(id, at, id, o);
  const f = [
    e('me', {iso3: ['FRA'], actorIds: ['name:x'], sources: ['s1']}),
    e('three', {iso3: ['FRA'], actorIds: ['name:x'], sources: ['s1']}),
    e('two', {iso3: ['FRA'], actorIds: ['name:x'], sources: ['s9']}),
    e('one-b', {iso3: ['FRA'], sources: ['s8']}),
    e('one-a', {iso3: ['FRA'], sources: ['s7']}),
    e('none', {iso3: ['DEU'], actorIds: ['name:q'], sources: ['s5']}),
    X.entry('stale', '2026-01-01T00:00:00.000Z', 's', {iso3: ['FRA'], actorIds: ['name:x'], sources: ['s1']}),
  ];
  const links = build(f).links.get('me');
  assert.deepEqual(links.links.map((l) => [l.otherThreadId, l.grounds]), [['three', 3], ['two', 2], ['one-a', 1], ['one-b', 1]]);
  assert.deepEqual(links.links[0], {otherThreadId: 'three', sharedActorIds: ['name:x'], sharedIso3: ['FRA'], sharedSourceIds: ['s1'], grounds: 3});
  assert.deepEqual([links.confirmedLinks, links.confirmedLinksReason], [[], 'no reading yet']);
  const many = Array.from({length: 70}, (_, i) => X.entry(`t${String(i).padStart(2, '0')}`, at, 'x', {iso3: ['FRA']}));
  const capped = build(many).links.get('t00').links;
  assert.equal(capped.length, 50);
  assert.deepEqual(capped.slice(0, 2).map((l) => l.otherThreadId), ['t01', 't02']);
});

test('counts: new entries, branches due and verdicts per story per fact day; the week files cover last week to today', () => {
  const v = build(X.golden());
  assert.deepEqual(v.counts.get('2026-10-20').byStory, {'thread-a': {newEntries: 1, branchesDue: 1, verdicts: 1}});
  assert.deepEqual(v.counts.get('2026-10-21').byStory, {'thread-a': {newEntries: 0, branchesDue: 1, verdicts: 0}});
  assert.deepEqual(v.counts.get('2026-10-17').byStory, {'thread-b': {newEntries: 1, branchesDue: 0, verdicts: 0}}); // the merged story counts for its survivor
  assert.deepEqual(v.counts.get('2026-10-22').total, {newEntries: 0, branchesDue: 1, verdicts: 1});
  // 2026-10-22 is a Thursday: previous week starts Monday 10-12
  assert.deepEqual([...v.counts.keys()][0], '2026-10-12');
  assert.equal([...v.counts.keys()].at(-1), '2026-10-22');
  assert.equal(V.countDaysFor('2026-10-19').length, 8); // a Monday: last Monday through today
  assert.deepEqual(V.countDaysFor('2026-10-25').slice(0, 2), ['2026-10-12', '2026-10-13']); // a Sunday is still in the week of 10-19
  assert.deepEqual(V.countDaysFor('2026-10-22', ['2026-09-01', '2026-10-20']).slice(0, 2), ['2026-09-01', '2026-10-12']);
});

test('entries cap at 400, newest kept, with the omitted count', () => {
  const f = Array.from({length: 405}, (_, i) => X.entry('big', `2026-10-${String(1 + (i % 20)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00.000Z`, `e${i}`, {id: `id${String(i).padStart(3, '0')}`}));
  const s = build(f).stories.get('big');
  assert.deepEqual([s.entries.length, s.entriesOmitted], [400, 5]);
  const all = [...f].map((x) => [x.date, x.at, x.eventId]).sort();
  assert.equal(s.entries[0].eventId, all[5][2]);
  assert.equal(rowOf(build(f), 'big').entryCount, 405);
});

test('all.json over 5 MB fails the build instead of truncating', () => {
  const f = [X.entry('huge', '2026-10-20T00:00:00.000Z', 'x'.repeat(6 * 1024 * 1024))];
  assert.throws(() => build(f), /index\/all\.json is \d+ bytes, over the 5242880 cap/);
});

test('same facts, any order, give the same objects; only builtAt and runId may differ', () => {
  const a = build(X.golden());
  const b = build([...X.golden()].reverse(), {builtAt: '2027-01-01T00:00:00.000Z', runId: 'other'});
  assert.equal(JSON.stringify(V.writeGroups({...a, manifest: null}).slice(0, 3)), JSON.stringify(V.writeGroups({...b, manifest: null}).slice(0, 3)));
  assert.deepEqual({...a.manifest, builtAt: 0, runId: 0}, {...b.manifest, builtAt: 0, runId: 0});
});

test('writeGroups orders stories, links and counts, then active, then all, then the manifest', () => {
  const groups = V.writeGroups(build(X.golden()));
  assert.deepEqual(groups.slice(1).map((g) => g.map(([k]) => k)), [['index/active.json'], ['index/all.json'], ['manifest.json']]);
  assert.deepEqual([...new Set(groups[0].map(([k]) => k.split('/')[0]))], ['stories', 'links', 'counts']);
});
