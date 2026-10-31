'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {world: mkWorld, P, WEEK, entry, forecast, branch, verdict, row} = require('./fixture');
const {loadWorld, assemble} = require('../src/select');
const {checkAnswer, mergeRule} = require('../src/check');
const {shareIndex} = require('../src/select');

async function ctxFor(f, threadId = 'thread-a') {
  const world = await loadWorld({store: f.store, prefix: P, week: WEEK});
  const rowOf = world.rows.find((r) => r.threadId === threadId);
  const assembleOther = (id) => { const r = world.rows.find((x) => x.threadId === id); return r ? assemble(world, r, {withNeighbours: false}) : null; };
  return {row: rowOf, mine: assemble(world, rowOf), world, assembleOther};
}
const run = async (answer, f = mkWorld(), threadId) => checkAnswer(answer, await ctxFor(f, threadId));
const reasons = (r) => r.rejected.map((x) => `${x.subtype}:${x.reason}`);

test('an item with no citation, or with an eventId that is not in the bundle, is rejected', async () => {
  const r = await run({
    line: {text: 'ok', cites: [], confidence: 'high'},
    chapters: [{title: 'T', summary: 's', cites: ['nope'], confidence: 'high'}],
  });
  assert.deepEqual(reasons(r), ['line:no_citation', 'chapter:unknown_eventId']);
  assert.equal(r.accepted.length, 0);
});

test('an eventId of another story is foreign to a line', async () => {
  const r = await run({line: {text: 'ok', cites: ['b1e'], confidence: 'high'}});
  assert.deepEqual(reasons(r), ['line:unknown_eventId']);
});

test('a line with valid cites is accepted; text over 200 chars is rejected', async () => {
  const ok = await run({line: {text: 'Where it stands', cites: ['a2'], confidence: 'high'}});
  assert.deepEqual(ok.accepted.map((a) => [a.subtype, a.payload.text, a.confidence]), [['line', 'Where it stands', 'high']]);
  const long = await run({line: {text: 'x'.repeat(201), cites: ['a2'], confidence: 'high'}});
  assert.deepEqual(reasons(long), ['line:bad_shape']);
});

test('a chapter spans the dates of the facts it cites; dates the model writes are ignored; two chapters from one day are a duplicate', async () => {
  const ch = (cites, over = {}) => ({title: 'T', summary: 's', cites, confidence: 'medium', ...over});
  const good = await run({chapters: [ch(['a2', 'a1'], {from: '2026-10-01', to: '2026-10-30'})]});
  assert.deepEqual(good.accepted.map((a) => [a.payload.from, a.payload.to]), [['2026-10-13', '2026-10-15']]);
  const one = await run({chapters: [ch(['a2'])]});
  assert.deepEqual(one.accepted.map((a) => [a.payload.from, a.payload.to]), [['2026-10-15', '2026-10-15']]);
  const dup = await run({chapters: [ch(['a1']), ch(['a1', 'a2'], {title: 'U'})]});
  assert.deepEqual(reasons(dup), ['chapter:duplicate']);
  assert.deepEqual(reasons(await run({chapters: [ch([])]})), ['chapter:no_citation']);
});

test('the model writes no branch status: a branchStatus answer part is ignored', async () => {
  const r = await run({branchStatus: [{branchId: 'b1', status: 'fired', why: 'because', cites: ['fa'], confidence: 'high'}]});
  assert.deepEqual([r.accepted, r.rejected], [[], []]);
});

test('a link needs a citation from each story and a known other story', async () => {
  const link = (over) => ({links: [{otherThreadId: 'thread-b', mechanism: 'drives it', direction: 'drives', cites: ['a1', 'b1e'], confidence: 'medium', ...over}]});
  assert.equal((await run(link({}))).accepted.length, 1);
  assert.deepEqual(reasons(await run(link({cites: ['a1']}))), ['link:cites_not_from_both']);
  assert.deepEqual(reasons(await run(link({cites: ['b1e']}))), ['link:cites_not_from_both']);
  assert.deepEqual(reasons(await run(link({cites: ['a1', 'zzz']}))), ['link:unknown_eventId']);
  assert.deepEqual(reasons(await run(link({otherThreadId: 'thread-zz'}))), ['link:unknown_story']);
  assert.deepEqual(reasons(await run(link({otherThreadId: 'thread-a'}))), ['link:bad_shape']);
  assert.deepEqual(reasons(await run(link({direction: 'causes'}))), ['link:bad_shape']);
});

const proposal = (over = {}) => ({mergeProposals: [{otherThreadId: 'thread-b', why: 'same event', cites: ['a1', 'b1e'], confidence: 'high', ...over}]});

test('merge rule: all conditions met auto-merges, the older story surviving', async () => {
  const r = await run(proposal());
  assert.equal(r.accepted.length, 1);
  assert.deepEqual(r.accepted[0].autoMerge, {into: 'thread-a', from: 'thread-b'});
  assert.deepEqual(r.accepted[0].autoBlocked, []);
});

test('merge rule: each failing condition leaves a proposal that is not auto-merged', async () => {
  const noCountry = mkWorld({rows: [row('thread-a', {iso3: ['POL'], actorIds: ['name:tusk']}), row('thread-b', {iso3: ['UKR'], actorIds: ['name:tusk']})]});
  const noActor = mkWorld({rows: [row('thread-a', {actorIds: ['name:a']}), row('thread-b', {actorIds: ['name:b']})]});
  const far = mkWorld({days: {
    '2026-09-28': [entry('thread-a', '2026-09-28', 'a1', 'A one')],
    '2026-10-14': [entry('thread-b', '2026-10-14', 'b1e', 'B one')],
  }});
  const backgroundActor = mkWorld({rows: [row('thread-a', {actorIds: ['name:filler']}), row('thread-b', {actorIds: ['name:filler']})]});
  const cases = [
    ['no_shared_country', await run(proposal(), noCountry)],
    ['no_shared_specific_actor', await run(proposal(), noActor)],
    ['no_shared_specific_actor', await run(proposal(), backgroundActor)],
    ['entries_not_within_14_days', await run(proposal(), far)],
    ['confidence_not_high', await run(proposal({confidence: 'medium'}))],
  ];
  for (const [why, r] of cases) {
    assert.equal(r.accepted.length, 1, why);
    assert.equal(r.accepted[0].autoMerge, null, why);
    assert.ok(r.accepted[0].autoBlocked.includes(why), `${why}: ${r.accepted[0].autoBlocked}`);
  }
  // citing only one story is not even a proposal
  assert.deepEqual(reasons(await run(proposal({cites: ['a1']}))), ['merge_proposal:cites_not_from_both']);
});

test('mergeRule is pure over rows, share and entry dates', () => {
  const rows = [row('x'), row('y'), ...Array.from({length: 48}, (_, i) => row(`f${i}`, {actorIds: ['name:f'], iso3: ['USA']}))];
  const share = shareIndex(rows);
  const base = {rowA: rows[0], rowB: rows[1], lastEntryA: '2026-10-15', lastEntryB: '2026-10-01', share, confidence: 'high', citesBoth: true};
  assert.deepEqual(mergeRule(base), {ok: true, failed: []});
  assert.deepEqual(mergeRule({...base, lastEntryB: '2026-09-30'}).failed, ['entries_not_within_14_days']);
  assert.deepEqual(mergeRule({...base, citesBoth: false}).failed, ['cites_not_from_both']);
});

test('alias rule: needs a wikidata Q-number, known actors, and no conflict with the operator file', async () => {
  const alias = (over = {}) => ({aliases: [{variants: ['name:tusk'], canonical: 'name:donald tusk', wikidataId: 'Q946', cites: ['a1'], confidence: 'high', ...over}]});
  assert.deepEqual((await run(alias())).accepted.map((a) => a.payload), [{variants: ['name:tusk'], canonical: 'name:donald tusk', wikidataId: 'Q946'}]);
  assert.deepEqual(reasons(await run(alias({wikidataId: null}))), ['alias:alias_no_wikidata']);
  assert.deepEqual(reasons(await run(alias({wikidataId: '946'}))), ['alias:alias_no_wikidata']);
  assert.deepEqual(reasons(await run(alias({variants: ['name:nobody']}))), ['alias:alias_unknown_actor']);
  assert.deepEqual(reasons(await run(alias({canonical: 'tusk'}))), ['alias:bad_shape']);
  const f = mkWorld();
  f.put(`${P}operator/aliases.json`, {schemaVersion: 1, aliases: [{canonical: 'name:d. tusk', variants: ['name:tusk'], wikidataId: 'Q946'}]});
  assert.deepEqual(reasons(await run(alias(), f)), ['alias:alias_conflicts_operator']);
  const same = mkWorld();
  same.put(`${P}operator/aliases.json`, {schemaVersion: 1, aliases: [{canonical: 'name:donald tusk', variants: ['name:tusk'], wikidataId: 'Q946'}]});
  assert.equal((await run(alias(), same)).accepted.length, 1);
  const reverse = mkWorld();
  reverse.put(`${P}operator/aliases.json`, {schemaVersion: 1, aliases: [{canonical: 'name:other', variants: ['name:donald tusk'], wikidataId: null}]});
  assert.deepEqual(reasons(await run(alias(), reverse)), ['alias:alias_conflicts_operator']);
});

test('a missing or malformed answer part is rejected, not thrown; a repeated item is a duplicate', async () => {
  const r = await run({chapters: 'none', line: 'text'});
  assert.deepEqual(reasons(r).sort(), ['chapter:bad_shape', 'line:bad_shape']);
  const dup = await run({links: [1, 2].map(() => ({otherThreadId: 'thread-b', mechanism: 'm', direction: 'drives', cites: ['a1', 'b1e'], confidence: 'high'}))});
  assert.deepEqual(reasons(dup), ['link:duplicate']);
  assert.equal((await run({})).accepted.length, 0);
});

// Y3: assignment proposals (0040 rule 3, answer 6)
const assign = (over = {}) => ({assignments: [{entryId: 'a2', threadId: 'thread-b', why: 'about the other event', cites: ['a2', 'b1e'], confidence: 'medium', ...over}]});

test('Y3: an entry of the story being read can be proposed to an active story, or to new', async () => {
  const r = await run(assign());
  assert.deepEqual(r.accepted.map((a) => [a.subtype, a.payload, a.cites]), [['assignment', {entryId: 'a2', threadId: 'thread-b', why: 'about the other event'}, ['a2', 'b1e']]]);
  assert.equal(r.accepted[0].autoMerge, undefined);
  const fresh = await run(assign({threadId: 'new', cites: ['a2']}));
  assert.deepEqual(fresh.accepted.map((a) => a.payload.threadId), ['new']);
});

test('Y3: a neighbour entry is accepted only when cited; an entry the model was never shown is not', async () => {
  const cited = await run(assign({entryId: 'b1e', threadId: 'thread-a', cites: ['b1e', 'a1']}));
  assert.equal(cited.accepted.length, 1);
  assert.deepEqual(reasons(await run(assign({entryId: 'b1e', threadId: 'thread-a', cites: ['a1']}))), ['assignment:entry_not_in_scope']);
  assert.deepEqual(reasons(await run(assign({entryId: 'c1', threadId: 'thread-b', cites: ['a1', 'c1']}))), ['assignment:unknown_eventId']);
  assert.deepEqual(reasons(await run(assign({entryId: 'zzz', cites: ['a1']}))), ['assignment:entry_not_in_scope']);
});

test('Y3: the target must be an active story other than the one the entry is in; cites must be shown ids; no cite is no proposal', async () => {
  assert.deepEqual(reasons(await run(assign({threadId: 'thread-zz'}))), ['assignment:unknown_story']);
  assert.deepEqual(reasons(await run(assign({threadId: 'thread-a'}))), ['assignment:already_assigned']);
  assert.deepEqual(reasons(await run(assign({cites: ['a2', 'nope']}))), ['assignment:unknown_eventId']);
  assert.deepEqual(reasons(await run(assign({cites: []}))), ['assignment:no_citation']);
  assert.deepEqual(reasons(await run(assign({why: ''}))), ['assignment:bad_shape']);
  assert.deepEqual(reasons(await run({assignments: [assign().assignments[0], assign().assignments[0]]})), ['assignment:duplicate']);
});
