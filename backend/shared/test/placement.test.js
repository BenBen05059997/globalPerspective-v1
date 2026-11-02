'use strict';
// placement.js: the one implementation of alias, assignment and placement rules (decisions 0036 section 3, 0037 section 3, 0040 rule 3)
// that newsStoryRecord views, the prediction resolver and newsRecordReview select all use. Pure: facts in, maps out.
const test = require('node:test');
const assert = require('node:assert/strict');
const { byKey, ordered, resolveAliases, currentAssignments, placeEntries } = require('../src/placement');

const fact = (kind, eventId, at, threadId, payload = {}) => ({ kind, eventId, at, threadId, payload });
const merged = (eventId, at, from, into) => fact('story_merged', eventId, at, into, { from, into });
const split = (eventId, at, from, into) => fact('story_split', eventId, at, into, { from, into });
const assign = (eventId, at, entryId, threadId, by) => fact('assignment', eventId, at, threadId, { entryId, threadId, by });
const entry = (eventId, at, threadId) => fact('entry', eventId, at, threadId);

test('byKey compares by each key in turn and ties give 0', () => {
  const cmp = byKey((x) => x.a, (x) => x.b);
  assert.equal(cmp({ a: 1, b: 9 }, { a: 2, b: 0 }), -1);
  assert.equal(cmp({ a: 2, b: 0 }, { a: 1, b: 9 }), 1);
  assert.equal(cmp({ a: 1, b: 1 }, { a: 1, b: 2 }), -1);
  assert.equal(cmp({ a: 1, b: 2 }, { a: 1, b: 1 }), 1);
  assert.equal(cmp({ a: 1, b: 1 }, { a: 1, b: 1 }), 0);
  assert.equal(byKey()({}, {}), 0);
});

test('ordered sorts by (at, eventId), drops a repeated eventId, leaves the input alone', () => {
  const input = [fact('entry', 'b', '2026-10-02T00:00:00Z'), fact('entry', 'c', '2026-10-01T00:00:00Z'), fact('entry', 'a', '2026-10-02T00:00:00Z'),
    fact('entry', 'c', '2026-10-01T00:00:00Z')];
  const before = JSON.stringify(input);
  assert.deepEqual(ordered(input).map((f) => f.eventId), ['c', 'a', 'b']);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(ordered([]), []);
});

test('ordered gives the same answer whatever order the files were read in', () => {
  const facts = [entry('e3', '2026-10-03T00:00:00Z', 't'), entry('e1', '2026-10-01T00:00:00Z', 't'), entry('e2', '2026-10-02T00:00:00Z', 't')];
  assert.deepEqual(ordered(facts), ordered([...facts].reverse()));
});

test('resolveAliases: a merge points the old story at the survivor; the applied list holds the merge facts', () => {
  const m = merged('m1', '2026-10-21T09:00:00Z', 'thread-c', 'thread-b');
  const r = resolveAliases([entry('e1', '2026-10-20T00:00:00Z', 'thread-c'), m]);
  assert.deepEqual([...r.aliases], [['thread-c', 'thread-b']]);
  assert.deepEqual(r.applied, [m]);
  assert.deepEqual(resolveAliases([]), { aliases: new Map(), applied: [] });
});

test('resolveAliases: transitive (A to B to C gives A to C), whichever order the merges were stored in', () => {
  const ab = merged('m1', '2026-10-01T00:00:00Z', 'A', 'B');
  const bc = merged('m2', '2026-10-02T00:00:00Z', 'B', 'C');
  for (const facts of [[ab, bc], [bc, ab]]) {
    const r = resolveAliases(facts);
    assert.deepEqual([...r.aliases].sort(), [['A', 'C'], ['B', 'C']]);
    assert.deepEqual(r.applied.map((f) => f.eventId), ['m1', 'm2']); // oldest first
  }
  // a later merge of the survivor into another story re-points the whole chain, not just the survivor
  const cd = merged('m3', '2026-10-03T00:00:00Z', 'C', 'D');
  assert.deepEqual([...resolveAliases([ab, bc, cd]).aliases].sort(), [['A', 'D'], ['B', 'D'], ['C', 'D']]);
});

test('resolveAliases: a merge that would close a cycle, or moves a story already merged, or names nothing useful is ignored', () => {
  const ab = merged('m1', '2026-10-01T00:00:00Z', 'A', 'B');
  const ba = merged('m2', '2026-10-02T00:00:00Z', 'B', 'A'); // would make A and B each other's survivor
  const ac = merged('m3', '2026-10-03T00:00:00Z', 'A', 'C'); // A is already merged into B
  const self = merged('m4', '2026-10-04T00:00:00Z', 'X', 'X');
  const noFrom = fact('story_merged', 'm5', '2026-10-05T00:00:00Z', 'Y', { into: 'Y' });
  const noInto = fact('story_merged', 'm6', '2026-10-06T00:00:00Z', 'Y', { from: 'Y' });
  const r = resolveAliases([ab, ba, ac, self, noFrom, noInto]);
  assert.deepEqual([...r.aliases], [['A', 'B']]);
  assert.deepEqual(r.applied.map((f) => f.eventId), ['m1']);
  // a three-story cycle is caught through the chain
  const cyc = resolveAliases([merged('c1', '2026-10-01T00:00:00Z', 'A', 'B'), merged('c2', '2026-10-02T00:00:00Z', 'B', 'C'), merged('c3', '2026-10-03T00:00:00Z', 'C', 'A')]);
  assert.deepEqual(cyc.applied.map((f) => f.eventId), ['c1', 'c2']);
  assert.equal(cyc.aliases.get('A'), 'C');
});

test('resolveAliases: a story_split for the same (from, into) at or after the merge cancels it; an earlier or other split does not', () => {
  const m = merged('m1', '2026-10-10T00:00:00Z', 'A', 'B');
  const aliasesWith = (...extra) => [...resolveAliases([m, ...extra]).aliases];
  assert.deepEqual(aliasesWith(split('s1', '2026-10-11T00:00:00Z', 'A', 'B')), []); // later split
  assert.deepEqual(aliasesWith(split('s2', '2026-10-10T00:00:00Z', 'A', 'B')), []); // same instant
  assert.deepEqual(aliasesWith(split('s3', '2026-10-09T00:00:00Z', 'A', 'B')), [['A', 'B']]); // split before the merge: the merge still stands
  assert.deepEqual(aliasesWith(split('s4', '2026-10-11T00:00:00Z', 'A', 'Z')), [['A', 'B']]); // different survivor
  assert.deepEqual(aliasesWith(split('s5', '2026-10-11T00:00:00Z', 'Q', 'B')), [['A', 'B']]); // different story
  // after a cancelled merge, the story can be merged elsewhere
  const again = resolveAliases([m, split('s6', '2026-10-11T00:00:00Z', 'A', 'B'), merged('m2', '2026-10-12T00:00:00Z', 'A', 'C')]);
  assert.deepEqual([...again.aliases], [['A', 'C']]);
});

test('resolveAliases: a repeated merge fact (same eventId) counts once', () => {
  const m = merged('m1', '2026-10-01T00:00:00Z', 'A', 'B');
  assert.equal(resolveAliases([m, { ...m }]).applied.length, 1);
});

test('currentAssignments: the latest `at` wins; only assignment facts count', () => {
  const facts = [assign('a1', '2026-10-01T00:00:00Z', 'e1', 'T1', 'ingest'), assign('a2', '2026-10-03T00:00:00Z', 'e1', 'T3', 'review'),
    assign('a3', '2026-10-02T00:00:00Z', 'e1', 'T2', 'operator'), entry('e1', '2026-10-01T00:00:00Z', 'T0'), assign('a4', '2026-10-01T00:00:00Z', 'e2', 'T9', 'ingest')];
  const cur = currentAssignments(facts);
  assert.equal(cur.get('e1').eventId, 'a2'); // later beats a higher-ranked assigner
  assert.equal(cur.get('e2').eventId, 'a4');
  assert.deepEqual([...cur.keys()].sort(), ['e1', 'e2']);
  assert.equal(currentAssignments([]).size, 0);
});

test('currentAssignments: at a tie operator beats review beats ingest, an unknown assigner ranks last, then the larger eventId wins', () => {
  const at = '2026-10-05T00:00:00Z';
  const winner = (...facts) => currentAssignments(facts).get('e1').eventId;
  // the order of the input must not matter
  assert.equal(winner(assign('a1', at, 'e1', 'T1', 'ingest'), assign('a2', at, 'e1', 'T2', 'review'), assign('a3', at, 'e1', 'T3', 'operator')), 'a3');
  assert.equal(winner(assign('a3', at, 'e1', 'T3', 'operator'), assign('a2', at, 'e1', 'T2', 'review'), assign('a1', at, 'e1', 'T1', 'ingest')), 'a3');
  assert.equal(winner(assign('a1', at, 'e1', 'T1', 'ingest'), assign('a2', at, 'e1', 'T2', 'review')), 'a2');
  assert.equal(winner(assign('a1', at, 'e1', 'T1', 'ingest'), assign('a9', at, 'e1', 'T9', 'robot')), 'a1'); // unknown `by` ranks -1, below ingest
  assert.equal(winner(assign('a1', at, 'e1', 'T1', 'operator'), assign('a7', at, 'e1', 'T7', 'operator')), 'a7');
  assert.equal(winner(assign('a7', at, 'e1', 'T7', 'operator'), assign('a1', at, 'e1', 'T1', 'operator')), 'a7');
});

test('placeEntries: with no assignments nothing moves and placed is the facts unchanged', () => {
  const facts = [entry('e1', '2026-10-01T00:00:00Z', 'archive-1'), fact('correction', 'c1', '2026-10-02T00:00:00Z', 'archive-1', { corrects: 'e1' })];
  const r = placeEntries(facts);
  assert.deepEqual(r.placed, facts);
  assert.equal(r.reassigned.size, 0);
  assert.equal(r.keep.size, 0);
  assert.deepEqual(placeEntries([]), { placed: [], reassigned: new Map(), keep: new Set() });
});

test('placeEntries: an assignment that agrees with the archive thread moves nothing and the assignment fact itself is not placed', () => {
  const facts = [entry('e1', '2026-10-01T00:00:00Z', 'T1'), assign('a1', '2026-10-01T00:00:01Z', 'e1', 'T1', 'ingest')];
  const r = placeEntries(facts);
  assert.deepEqual(r.placed.map((f) => f.eventId), ['e1']);
  assert.equal(r.placed[0].threadId, 'T1');
  assert.equal(r.reassigned.size, 0);
});

test('placeEntries: the current assignment moves an entry and its corrections to the assigned story; the old archive thread is kept', () => {
  const e = entry('e1', '2026-10-01T00:00:00Z', 'archive-1');
  const corr = fact('correction', 'c1', '2026-10-02T00:00:00Z', 'archive-1', { corrects: 'e1' });
  const other = entry('e2', '2026-10-01T00:00:00Z', 'archive-1'); // not reassigned
  const r = placeEntries([e, corr, other, assign('a1', '2026-10-03T00:00:00Z', 'e1', 'T-new', 'review')]);
  const by = Object.fromEntries(r.placed.map((f) => [f.eventId, f.threadId]));
  assert.deepEqual(by, { e1: 'T-new', c1: 'T-new', e2: 'archive-1' });
  assert.deepEqual([...r.reassigned], [['e1', 'archive-1']]);
  assert.deepEqual([...r.keep], ['archive-1']);
  assert.equal(e.threadId, 'archive-1'); // inputs are not mutated
  assert.equal(corr.threadId, 'archive-1');
});

test('placeEntries: operator reassignment beats the ingest one and a later reassignment back to the archive thread undoes the move', () => {
  const e = entry('e1', '2026-10-01T00:00:00Z', 'archive-1');
  const moved = placeEntries([e, assign('a1', '2026-10-02T00:00:00Z', 'e1', 'T-ingest', 'ingest'), assign('a2', '2026-10-02T00:00:00Z', 'e1', 'T-op', 'operator')]);
  assert.equal(moved.placed[0].threadId, 'T-op');
  const back = placeEntries([e, assign('a1', '2026-10-02T00:00:00Z', 'e1', 'T-op', 'operator'), assign('a2', '2026-10-03T00:00:00Z', 'e1', 'archive-1', 'operator')]);
  assert.equal(back.placed[0].threadId, 'archive-1');
  assert.equal(back.reassigned.size, 0);
  assert.equal(back.keep.size, 0);
});

test('placeEntries: an assignment may place an article; an unassigned article keeps no thread; an entry with no archive thread is placed but leaves nothing to keep', () => {
  const article = fact('article', 'art1', '2026-10-01T00:00:00Z', null);
  const free = fact('article', 'art2', '2026-10-01T00:00:00Z', null);
  const noThread = entry('e9', '2026-10-01T00:00:00Z', null);
  const r = placeEntries([article, free, noThread, assign('a1', '2026-10-02T00:00:00Z', 'art1', 'T1', 'review'), assign('a2', '2026-10-02T00:00:00Z', 'e9', 'T2', 'ingest')]);
  const by = Object.fromEntries(r.placed.map((f) => [f.eventId, f.threadId]));
  assert.deepEqual(by, { art1: 'T1', art2: null, e9: 'T2' });
  assert.equal(r.reassigned.size, 0); // neither had an archive thread to leave
  assert.equal(r.keep.size, 0);
});

test('placeEntries: an assignment naming no entry or article fact, or a fact of another kind, does nothing', () => {
  const run = fact('run', 'r1', '2026-10-01T00:00:00Z', 'T1');
  const born = fact('story_born', 'b1', '2026-10-01T00:00:00Z', 'T1');
  const r = placeEntries([run, born, assign('a1', '2026-10-02T00:00:00Z', 'ghost', 'T9', 'operator'), assign('a2', '2026-10-02T00:00:00Z', 'r1', 'T9', 'operator')]);
  assert.deepEqual(r.placed, [run, born]);
  assert.equal(r.reassigned.size, 0);
});

test('placeEntries: every archive thread an entry left is kept, however many entries left it', () => {
  const r = placeEntries([entry('e1', '2026-10-01T00:00:00Z', 'A'), entry('e2', '2026-10-01T00:00:00Z', 'A'), entry('e3', '2026-10-01T00:00:00Z', 'B'),
    assign('a1', '2026-10-02T00:00:00Z', 'e1', 'X', 'review'), assign('a2', '2026-10-02T00:00:00Z', 'e2', 'X', 'review'), assign('a3', '2026-10-02T00:00:00Z', 'e3', 'Y', 'operator')]);
  assert.deepEqual([...r.reassigned].sort(), [['e1', 'A'], ['e2', 'A'], ['e3', 'B']]);
  assert.deepEqual([...r.keep].sort(), ['A', 'B']);
});

test('alias resolution and placement compose on one fact list: placement names the thread, the alias folds it afterwards', () => {
  const facts = [entry('e1', '2026-10-01T00:00:00Z', 'A'), merged('m1', '2026-10-02T00:00:00Z', 'A', 'B'), assign('a1', '2026-10-03T00:00:00Z', 'e1', 'A', 'operator')];
  assert.deepEqual([...resolveAliases(facts).aliases], [['A', 'B']]);
  assert.equal(placeEntries(facts).placed.find((f) => f.eventId === 'e1').threadId, 'A');
});
