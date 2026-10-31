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
  assert.deepEqual([a.line, a.chapters, a.reading], [null, [], {state: 'none', reason: 'no reading yet'}]);
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
  assert.deepEqual(build(f).stories.get('t').forks[0].branches[0].verdict, {at: '2026-10-23T00:00:00.000Z', result: 'void', decidedBy: 'agent', evidence: {url: 'https://e.test'}, voidReason: null});
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

// Links need 5% specificity, so these tests pad the active index with unrelated stories: 100 fillers make one carrier 1% and two 2%.
const pad = (at, n = 100) => Array.from({length: n}, (_, i) => X.entry(`pad${String(i).padStart(3, '0')}`, at, 'x', {sources: [`p${i}`]}));
const day = (d) => `${d}T10:00:00.000Z`;

test('links: sources never count; an outlet-only pair has no row', () => {
  const f = [X.entry('me', day('2026-10-20'), 'x', {sources: ['s1']}), X.entry('twin', day('2026-10-20'), 'x', {sources: ['s1']}), ...pad(day('2026-10-20'))];
  assert.deepEqual(build(f).links.get('me').links, []);
});

test('links: a background country carried by 5% or more of active stories never links on its own', () => {
  const at = day('2026-10-20');
  const bg = Array.from({length: 6}, (_, i) => X.entry(`bg${i}`, at, 'x', {iso3: ['USA'], sources: [`b${i}`]}));
  const f = [...bg, ...pad(at, 94)]; // 6 of 100 = 6%
  assert.deepEqual(build(f).links.get('bg0').links, []);
  const rare = [...bg.slice(0, 4), ...pad(at, 96)]; // 4 of 100 = 4%
  assert.deepEqual(build(rare).links.get('bg0').links.map((l) => l.otherThreadId), ['bg1', 'bg2', 'bg3']);
});

test('links: a rare shared actor gives a row with grounds and daysApart; sources are listed but not counted', () => {
  const f = [X.entry('me', day('2026-10-20'), 'x', {actorIds: ['name:x'], sources: ['s1']}), X.entry('near', day('2026-10-17'), 'x', {actorIds: ['name:x'], sources: ['s1']}), ...pad(day('2026-10-20'))];
  assert.deepEqual(build(f).links.get('me').links, [{otherThreadId: 'near', sharedActorIds: ['name:x'], sharedIso3: [], sharedSourceIds: ['s1'], grounds: 1, daysApart: 3}]);
  assert.deepEqual(build(f).links.get('near').links.map((l) => [l.otherThreadId, l.daysApart]), [['me', 3]]);
});

test('links: 14 days apart links, 15 days apart does not', () => {
  const mk = (gap) => [X.entry('me', day('2026-10-21'), 'x', {actorIds: ['name:x']}), X.entry('far', day(`2026-10-${String(21 - gap).padStart(2, '0')}`), 'x', {actorIds: ['name:x']}), ...pad(day('2026-10-21'))];
  assert.deepEqual(build(mk(14)).links.get('me').links.map((l) => l.daysApart), [14]);
  assert.deepEqual(build(mk(15)).links.get('me').links, []);
});

test('links: sorted by the rarest shared ID then otherThreadId; max 50; inactive stories excluded', () => {
  const at = day('2026-10-20');
  const f = [
    X.entry('me', at, 'x', {actorIds: ['name:rare', 'name:less'], iso3: ['FRA']}),
    X.entry('z-rare', at, 'x', {actorIds: ['name:rare']}),
    X.entry('a-less', at, 'x', {actorIds: ['name:less']}),
    X.entry('b-less', at, 'x', {actorIds: ['name:less']}),
    X.entry('c-both', at, 'x', {actorIds: ['name:less'], iso3: ['FRA']}),
    X.entry('stale', '2026-01-01T00:00:00.000Z', 's', {actorIds: ['name:rare']}),
    ...pad(at, 150),
  ];
  const links = build(f).links.get('me');
  // name:rare is carried by 2 of 156 active stories; FRA by 2; name:less by 4 -> rare and FRA before less
  assert.deepEqual(links.links.map((l) => [l.otherThreadId, l.grounds]), [['c-both', 2], ['z-rare', 1], ['a-less', 1], ['b-less', 1]]);
  assert.deepEqual([links.confirmedLinks, links.confirmedLinksReason], [[], 'no reading yet']);
  const many = Array.from({length: 60}, (_, i) => X.entry(`t${String(i).padStart(2, '0')}`, at, 'x', {actorIds: ['name:m']}));
  const capped = build([...many, ...pad(at, 1500)]).links.get('t00').links;
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

test('O2: legacy branches (no question or no qid) carry legacy:true and count neither as due nor as live', () => {
  const f = [X.entry('t', '2026-10-20T00:00:00.000Z', 'x'),
    X.forecast('t', '2026-10-20T01:00:00.000Z', 'F', [X.branch('r', '2026-10-25'), X.branch('old', '2026-10-25', {question: false, qid: null}), X.branch('noq', '2026-10-25', {qid: undefined})])];
  const v = build(f);
  const b = v.stories.get('t').forks[0].branches;
  assert.deepEqual(b.map((x) => [x.branchId, x.legacy]), [['r', undefined], ['old', true], ['noq', true]]);
  const row = rowOf(v, 't');
  assert.deepEqual([row.branchCount, row.liveBranchCount], [3, 1]);
  assert.deepEqual(build(f, {countDays: ['2026-10-25']}).counts.get('2026-10-25').byStory, {t: {newEntries: 0, branchesDue: 1, verdicts: 0}});
});

test('X3: counts.articles is the article facts of that day; articles are not entries, not in stories, and the index is unchanged', () => {
  const art = (id, at) => X.fact('article', null, at, {id, payload: {url: `https://x.test/${id}`, canonicalUrl: `https://x.test/${id}`, title: id, outlet: null, feed: null, snippet: null, lang: null, recoveredAt: null, recoveredFrom: null}});
  const base = build(X.golden());
  const v = build([...X.golden(), art('a1', '2026-10-20T03:00:00.000Z'), art('a2', '2026-10-20T09:00:00.000Z'), art('a3', '2026-10-21T00:00:00.000Z')]);
  assert.deepEqual([v.counts.get('2026-10-20').articles, v.counts.get('2026-10-21').articles, v.counts.get('2026-10-22').articles], [2, 1, 0]);
  assert.deepEqual(v.counts.get('2026-10-20').total, base.counts.get('2026-10-20').total);
  assert.deepEqual(JSONIFY([v.stories, v.all, v.active, v.manifest.factsThrough]), JSONIFY([base.stories, base.all, base.active, base.manifest.factsThrough]));
});

// Y2: views follow the latest assignment per entry (0040 rule 3).
const T1 = '2026-10-18T04:00:00.000Z';
const ingestAll = (facts) => facts.filter((f) => f.kind === 'entry' && f.threadId).map((e) => X.assignment(e.eventId, e.threadId, e.at, 'ingest'));
const stripIds = (v) => JSONIFY({stories: [...v.stories], links: [...v.links], counts: [...v.counts], active: v.active, all: v.all});

test('Y2: ingest assignments alone change nothing: the views are byte-identical to the views without them', () => {
  const plain = X.golden();
  const withIngest = [...X.golden(), ...ingestAll(X.golden())];
  assert.deepEqual(stripIds(build(withIngest)), stripIds(build(plain)));
  // an ingest assignment to a merged-away thread behaves like the entry's own thread
  assert.equal(JSON.stringify(build(withIngest).manifest), JSON.stringify(build(plain).manifest));
});

test('Y2: an assignment is a no-op for an entry that does not exist, and assignment facts are not stories', () => {
  const f = [...X.golden(), X.assignment('nope', 'thread-zzz', '2026-10-21T00:00:00.000Z')];
  const v = build(f);
  assert.equal(v.stories.has('thread-zzz'), false);
  assert.deepEqual(stripIds(v), stripIds(build(X.golden())));
});

test('Y2: a reassigned entry leaves the old story and joins the new one tagged reassignedFrom; rows, counts and links follow', () => {
  const f = [...X.golden(), X.assignment('ea2', 'thread-b', '2026-10-21T10:00:00.000Z', 'operator', {reason: 'about the other story'})];
  const v = build(f);
  const a = v.stories.get('thread-a');
  const b = v.stories.get('thread-b');
  assert.deepEqual(a.entries.map((e) => e.eventId), ['ea1']);
  assert.deepEqual(b.entries.map((e) => [e.eventId, e.reassignedFrom, e.fromThreadId]), [['ec1', undefined, 'thread-c'], ['eb1', undefined, undefined], ['ea2', 'thread-a', undefined]]);
  assert.deepEqual([rowOf(v, 'thread-a').entryCount, rowOf(v, 'thread-b').entryCount], [1, 3]);
  assert.deepEqual(rowOf(v, 'thread-b').title, 'C first');
  assert.deepEqual(v.counts.get('2026-10-20').byStory, {'thread-b': {newEntries: 1, branchesDue: 0, verdicts: 0}, 'thread-a': {newEntries: 0, branchesDue: 1, verdicts: 1}});
  assert.deepEqual(a.iso3, ['FRA']); // DEU came with ea2
  assert.deepEqual(b.iso3, ['DEU', 'FRA', 'UKR']);
  // the old story keeps its forecasts and verdicts
  assert.equal(a.forks.length, 1);
});

test('Y2: link specificity uses current membership: an actor that moved with its entry now links the new pair', () => {
  const day = '2026-10-20T10:00:00.000Z';
  const pad = Array.from({length: 40}, (_, i) => X.entry(`pad${i}`, day, 'x', {sources: [`p${i}`], actorIds: [`name:pad${i}`]}));
  const base = [X.entry('s-a', day, 'A', {id: 'x1', actorIds: ['name:rare']}), X.entry('s-b', day, 'B', {id: 'x2'}), ...pad];
  assert.equal(build(base).links.get('s-b').links.length, 0);
  const moved = build([...base, X.assignment('x1', 's-b', '2026-10-21T00:00:00.000Z')]);
  assert.deepEqual(moved.stories.get('s-b').actorIds, ['name:rare']);
  assert.deepEqual(moved.stories.get('s-a').entries, []);
});

test('Y2: precedence: latest at wins; at a tie operator beats review beats ingest; back-assigning to the original thread clears the tag', () => {
  const at = '2026-10-21T10:00:00.000Z';
  const who = (...as) => { const v = build([...X.golden(), ...as]); return v.stories.get('thread-b').entries.some((e) => e.eventId === 'ea2') ? 'b' : v.stories.get('thread-d')?.entries?.some((e) => e.eventId === 'ea2') ? 'd' : 'a'; };
  const to = (thread, by, when = at) => X.assignment('ea2', thread, when, by);
  assert.equal(who(to('thread-b', 'review'), to('thread-d', 'ingest')), 'b', 'review beats ingest at a tie');
  assert.equal(who(to('thread-d', 'operator'), to('thread-b', 'review')), 'd', 'operator beats review at a tie');
  assert.equal(who(to('thread-d', 'operator', '2026-10-21T09:00:00.000Z'), to('thread-b', 'review')), 'b', 'a later review beats an earlier operator');
  assert.equal(who(to('thread-b', 'operator'), to('thread-a', 'operator', '2026-10-22T00:00:00.000Z')), 'a', 'the operator can send it back');
  const back = build([...X.golden(), to('thread-b', 'operator'), to('thread-a', 'operator', '2026-10-22T00:00:00.000Z')]);
  assert.deepEqual(back.stories.get('thread-a').entries.map((e) => [e.eventId, e.reassignedFrom]), [['ea1', undefined], ['ea2', undefined]]);
  assert.deepEqual(stripIds(back).stories, stripIds(build(X.golden())).stories.map(([id, s]) => [id, id === 'thread-a' || id === 'thread-b' ? back.stories.get(id) : s]));
});

test('Y2: reassigning to a merged-away story lands on the survivor tagged fromThreadId; reassigning out of an emptied story keeps the story', () => {
  const v = build([...X.golden(), X.assignment('eb1', 'thread-c', '2026-10-22T00:00:00.000Z')]);
  assert.deepEqual(v.stories.get('thread-b').entries.map((e) => [e.eventId, e.fromThreadId, e.reassignedFrom]), [['ec1', 'thread-c', undefined], ['eb1', 'thread-c', 'thread-b']]);
  const e = build([...X.golden(), X.assignment('eo1', 'thread-a', '2026-10-22T00:00:00.000Z')]);
  assert.deepEqual(e.stories.get('thread-old').entries, []);
  assert.equal(rowOf(e, 'thread-old').entryCount, 0);
  assert.equal(e.stories.get('thread-a').entries.find((x) => x.eventId === 'eo1').reassignedFrom, 'thread-old');
});

test('Y2: a correction follows its entry, and factsThrough counts an assignment day', () => {
  const v = build([...X.golden(), X.assignment('ea1', 'thread-b', '2026-10-23T00:00:00.000Z')]);
  assert.equal(v.stories.get('thread-b').entries.find((e) => e.eventId === 'ea1').corrected, true);
  assert.equal(v.stories.get('thread-a').corrections.length, 0);
  assert.equal(v.manifest.factsThrough, '2026-10-23');
});

// AJ: an assignment may name an article fact (the recovered articles the gap benchmark links to stories).
const art = (id, at, o = {}) => X.fact('article', null, at, {id, sourceIds: ['s9'], payload: {url: `https://x.test/${id}`, canonicalUrl: `https://x.test/${id}`, title: `Title ${id}`, outlet: 'X News', feed: null, snippet: 'snippet' in o ? o.snippet : 'a snippet', lang: null, recoveredAt: null, recoveredFrom: o.recoveredFrom ?? null}});
const A1 = () => art('art1', '2026-10-16T03:00:00.000Z', {recoveredFrom: 'gdelt-gkg'});

test('AJ: an assigned article sits on the story as a kind:article entry; counts, born and lastFactAt follow; newEntries does not', () => {
  const base = build(X.golden());
  const v = build([...X.golden(), A1(), X.assignment('art1', 'thread-a', '2026-10-24T00:00:00.000Z')]);
  const a = v.stories.get('thread-a');
  assert.deepEqual(a.entries[0], {
    eventId: 'art1', date: '2026-10-16', at: '2026-10-16T03:00:00.000Z', precision: 'exact', title: 'Title art1', summary: 'a snippet',
    sources: [{outlet: 'X News', url: 'https://x.test/art1'}], kind: 'article', recovered: true, recoveredFrom: 'gdelt-gkg',
  });
  assert.deepEqual(a.entries.slice(1).map((e) => e.eventId), ['ea1', 'ea2']);
  assert.equal(a.entries.slice(1).some((e) => 'kind' in e), false);
  assert.equal(a.born, '2026-10-16');
  assert.equal(rowOf(v, 'thread-a').entryCount, rowOf(base, 'thread-a').entryCount + 1);
  assert.equal(rowOf(v, 'thread-a').born, '2026-10-16');
  assert.ok(a.sourceIds.includes('s9'));
  const c = v.counts.get('2026-10-16');
  assert.deepEqual([c.articles, c.byStory['thread-a']], [1, {newEntries: 0, branchesDue: 0, verdicts: 0, articlesPlaced: 1}]);
  assert.equal(c.total.newEntries, 0);
  assert.equal(c.total.articlesPlaced, 1);
  assert.equal('articlesPlaced' in base.counts.get('2026-10-20').total, false);
});

test('AJ: an article with no assignment stays out of every story; a summary-less article has summary null', () => {
  const v = build([...X.golden(), A1(), art('art2', '2026-10-16T04:00:00.000Z', {snippet: null}), X.assignment('art2', 'thread-b', '2026-10-24T00:00:00.000Z')]);
  assert.equal(v.stories.get('thread-a').entries.some((e) => e.eventId === 'art1'), false);
  assert.equal(JSON.stringify([...v.stories.values()]).includes('art1'), false);
  const e = v.stories.get('thread-b').entries.find((x) => x.eventId === 'art2');
  assert.deepEqual([e.summary, e.recovered, e.recoveredFrom], [null, false, null]);
});

test('AJ: the latest operator assignment moves an article to another story', () => {
  const f = [...X.golden(), A1(), X.assignment('art1', 'thread-a', '2026-10-24T00:00:00.000Z', 'review'), X.assignment('art1', 'thread-b', '2026-10-24T00:00:00.000Z', 'operator')];
  const v = build(f);
  assert.equal(v.stories.get('thread-a').entries.some((e) => e.eventId === 'art1'), false);
  assert.equal(v.stories.get('thread-b').entries.some((e) => e.eventId === 'art1'), true);
  const later = build([...f, X.assignment('art1', 'thread-a', '2026-10-25T00:00:00.000Z', 'operator')]);
  assert.equal(later.stories.get('thread-a').entries[0].eventId, 'art1');
  assert.equal(later.stories.get('thread-b').entries.some((e) => e.eventId === 'art1'), false);
});

test('AJ: an article assigned to a merged-away story follows the survivor, tagged fromThreadId', () => {
  const v = build([...X.golden(), A1(), X.assignment('art1', 'thread-c', '2026-10-24T00:00:00.000Z')]);
  const e = v.stories.get('thread-b').entries.find((x) => x.eventId === 'art1');
  assert.deepEqual([e.kind, e.fromThreadId], ['article', 'thread-c']);
  assert.equal(v.counts.get('2026-10-16').byStory['thread-b'].articlesPlaced, 1);
});

test('AJ: a build with articles but no article assignment is identical to the entry-only build', () => {
  const plain = build(X.golden());
  const v = build([...X.golden(), A1(), art('art2', '2026-10-17T00:00:00.000Z')]);
  const noCounts = (x) => ({...stripIds(x), counts: undefined}); // counts.articles legitimately differs
  assert.deepEqual(noCounts(v), noCounts(plain));
  assert.deepEqual(JSONIFY([...v.counts.values()].map((c) => c.byStory)), JSONIFY([...plain.counts.values()].map((c) => c.byStory)));
});
