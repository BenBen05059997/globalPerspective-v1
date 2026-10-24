'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {world: mkWorld, P, WEEK, entry, row} = require('./fixture');
const {loadWorld, selectStories, assemble, ENTRY_CAP, RECOVERED_NOTE} = require('../src/select');
const {weekOf, weekRange, lastEndedWeek, weekBefore} = require('../src/week');

const load = (f, week = WEEK) => loadWorld({store: f.store, prefix: P, week});

test('ISO week helpers: week of a date, its range, the week that ended before now, year boundaries', () => {
  assert.equal(weekOf('2026-10-14'), '2026-W42');
  assert.deepEqual(weekRange('2026-W42'), {from: '2026-10-12', to: '2026-10-18'});
  assert.equal(lastEndedWeek('2026-10-23T22:00:00Z'), '2026-W42');
  assert.equal(lastEndedWeek('2026-10-19T00:00:00Z'), '2026-W42');
  assert.equal(weekOf('2027-01-03'), '2026-W53');
  assert.equal(weekBefore('2026-W02', 3), '2025-W51');
  assert.throws(() => weekRange('2026-W54'));
});

test('selection: active stories with facts are read; stories without facts by the week end are skipped with a reason', async () => {
  const w = await load(mkWorld());
  const {selected, skipped} = selectStories(w);
  assert.deepEqual(selected.map((r) => r.threadId).sort(), ['thread-a', 'thread-b', 'thread-c']);
  assert.equal(skipped.length, 45);
  assert.ok(skipped.every((s) => s.reason === 'no_facts_by_week_end'));
});

test('threadIds limits the selection; an alias row is not an active story', async () => {
  const w = await load(mkWorld());
  assert.deepEqual(selectStories(w, {threadIds: ['thread-b']}).selected.map((r) => r.threadId), ['thread-b']);
  const f = mkWorld({rows: [row('thread-a'), row('thread-b', {aliasOf: 'thread-a'})]});
  assert.deepEqual((await load(f)).rows.map((r) => r.threadId), ['thread-a', ...Array.from({length: 45}, (_, i) => `filler-${i}`)]);
});

test('skip rule: no new entry or verdict since the last reading skips the story; a new verdict or entry brings it back', async () => {
  const f = mkWorld();
  const reading = (threadId, to) => ({schemaVersion: 1, readingId: `r-${threadId}`, week: '2026-W41', threadId, subtype: 'line', payload: {text: 'x'}, cites: ['a1'], covers: {from: '2026-10-05', to}, supersedes: null, run: 'r', model: 'm', promptVersion: 'p', confidence: 'high'});
  f.putLines(`${P}readings/2026-W41.jsonl`, [reading('thread-a', '2026-10-14'), reading('thread-b', '2026-10-14'), reading('thread-c', '2026-10-18')]);
  const {selected, skipped} = selectStories(await load(f), {threadIds: ['thread-a', 'thread-b', 'thread-c']});
  // a: entry + verdicts on 10-15 are newer than 10-14 -> read; b: entry on 10-14 not newer -> skipped; c: nothing newer than 10-18 -> skipped
  assert.deepEqual(selected.map((r) => r.threadId), ['thread-a']);
  assert.deepEqual(skipped.map((s) => [s.threadId, s.reason]), [['thread-b', 'no_new_fact'], ['thread-c', 'no_new_fact']]);
});

test('skip rule: a new verdict alone (no new entry) brings a story back', async () => {
  const days = {
    '2026-10-13': [entry('thread-a', '2026-10-13', 'a1', 'A one')],
    '2026-10-16': [{...require('./fixture').verdict('thread-a', '2026-10-16', 'va1', 'b1', 'yes')}],
  };
  const f = mkWorld({days});
  f.putLines(`${P}readings/2026-W41.jsonl`, [{schemaVersion: 1, readingId: 'r1', week: '2026-W41', threadId: 'thread-a', subtype: 'line', payload: {text: 'x'}, cites: ['a1'], covers: {from: '2026-10-05', to: '2026-10-14'}, supersedes: null, run: 'r', model: 'm', promptVersion: 'p', confidence: 'high'}]);
  assert.deepEqual(selectStories(await load(f), {threadIds: ['thread-a']}).selected.map((r) => r.threadId), ['thread-a']);
});

test('a reading of the same week does not skip a story on a re-run', async () => {
  const f = mkWorld();
  f.putLines(`${P}readings/${WEEK}.jsonl`, [{schemaVersion: 1, readingId: 'r1', week: WEEK, threadId: 'thread-b', subtype: 'line', payload: {text: 'x'}, cites: ['b1e'], covers: {from: '2026-10-08', to: '2026-10-18'}, supersedes: null, run: 'r', model: 'm', promptVersion: 'p', confidence: 'high'}]);
  const w = await load(f);
  assert.equal(w.thisWeekReadings.length, 1);
  assert.ok(selectStories(w, {threadIds: ['thread-b']}).selected.length === 1);
});

test('the manifest must be built through the week end', async () => {
  await assert.rejects(load(mkWorld({factsThrough: '2026-10-17'})), /views not built through 2026-10-18/);
  await assert.rejects(load(require('./fake-s3').fakeS3()), /views not built/);
});

test('assemble: eventIds on every fact, verdicts attached to branches, legacy-void branches dropped, facts after the week end excluded', async () => {
  const days = {
    '2026-10-13': [entry('thread-a', '2026-10-13', 'a1', 'A one'), require('./fixture').forecast('thread-a', '2026-10-13', 'fa', [require('./fixture').branch('b1', '2026-10-16'), require('./fixture').branch('b2', '2026-10-30')])],
    '2026-10-15': [require('./fixture').verdict('thread-a', '2026-10-15', 'va1', 'b1', 'yes'), require('./fixture').verdict('thread-a', '2026-10-15', 'vl', 'b2', 'void', {voidReason: 'issued_before_method'})],
    '2026-10-19': [entry('thread-a', '2026-10-19', 'late', 'After the week')],
  };
  const f = mkWorld({days});
  const w = await load(f);
  const a = assemble(w, w.rows.find((r) => r.threadId === 'thread-a'));
  assert.deepEqual(a.bundle.entries.map((e) => e.eventId), ['a1']);
  assert.deepEqual(a.bundle.forks[0].branches.map((b) => [b.branchId, b.verdict && b.verdict.result]), [['b1', 'yes']]);
  assert.ok(a.citable.has('a1') && a.citable.has('fa') && a.citable.has('va1') && !a.citable.has('late'));
  assert.deepEqual(a.covers, {from: '2026-10-13', to: '2026-10-18'});
  assert.equal(a.branches.get('b1').result, 'yes');
});

test('assemble caps entries at the newest 60 and reports the omitted count', async () => {
  const many = Array.from({length: 75}, (_, i) => entry('thread-a', '2026-10-13', `e${String(i).padStart(3, '0')}`, `T${i}`, {at: `2026-10-13T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`}));
  const f = mkWorld({days: {'2026-10-13': many}});
  const w = await load(f);
  const a = assemble(w, w.rows.find((r) => r.threadId === 'thread-a'));
  assert.equal(ENTRY_CAP, 60);
  assert.equal(a.bundle.entries.length, 60);
  assert.equal(a.bundle.entriesOmitted, 15);
  assert.equal(a.bundle.entries.at(-1).eventId, 'e074');
});

test('assemble carries the previous readings, the operator aliases that touch the story, and cheap neighbours', async () => {
  const f = mkWorld();
  f.put(`${P}operator/aliases.json`, {schemaVersion: 1, aliases: [{canonical: 'name:donald tusk', variants: ['name:tusk'], wikidataId: 'Q946'}, {canonical: 'name:other', variants: ['name:o'], wikidataId: null}]});
  f.putLines(`${P}readings/2026-W41.jsonl`, [{schemaVersion: 1, readingId: 'r1', week: '2026-W41', threadId: 'thread-a', subtype: 'line', payload: {text: 'old'}, cites: ['a1'], covers: {from: '2026-10-05', to: '2026-10-11'}, supersedes: null, run: 'r', model: 'm', promptVersion: 'p', confidence: 'high'}]);
  const w = await load(f);
  const a = assemble(w, w.rows.find((r) => r.threadId === 'thread-a'));
  assert.deepEqual(a.bundle.previousReadings.map((r) => r.payload.text), ['old']);
  assert.deepEqual(a.bundle.operatorAliases.map((x) => x.canonical), ['name:donald tusk']);
  assert.deepEqual(a.bundle.neighbours.map((n) => n.threadId), ['thread-b']); // shares name:tusk (2 of 48 stories); thread-c shares nothing
  assert.deepEqual(a.bundle.neighbours[0].entries.map((e) => e.eventId), ['b1e']);
});

// --- placement: assignments, recovered articles and merges (same rules as the views and the resolver) ---
const {fact} = require('./fixture');
const article = (threadId, date, eventId, title, extra = {}) => fact('article', threadId, date, eventId, {title, url: `https://x/${eventId}`, outlet: 'Reuters', snippet: 'hidden', recoveredFrom: 'gap-2026-10', ...extra});
const assignment = (date, eventId, entryId, threadId, by = 'review') => fact('assignment', null, date, eventId, {entryId, threadId, by, reason: 'r'});
const bundleOf = async (f, id) => { const w = await load(f); return assemble(w, w.rows.find((r) => r.threadId === id)); };

test('placement: an article placed by an assignment is a headline-only item of its story; an unassigned article stays out', async () => {
  const days = {
    '2026-10-13': [entry('thread-a', '2026-10-13', 'a1', 'A one'), article(null, '2026-10-12', 'art1', 'Recovered headline'), article(null, '2026-10-12', 'art2', 'Unassigned headline')],
    '2026-10-14': [assignment('2026-10-14', 'as1', 'art1', 'thread-a')],
  };
  const b = await bundleOf(mkWorld({days}), 'thread-a');
  assert.deepEqual(b.bundle.entries.map((e) => e.eventId), ['art1', 'a1']);
  const art = b.bundle.entries[0];
  assert.equal(art.kind, 'article');
  assert.equal(art.summary, RECOVERED_NOTE);
  assert.equal(art.recovered, true);
  assert.ok(!JSON.stringify(b.bundle).includes('hidden') && !JSON.stringify(b.bundle).includes('art2'));
  assert.ok(b.citable.has('art1'));
  assert.ok(!b.entryIds.has('art1') && b.entryIds.has('a1'));
});

test('placement: a reassigned entry is read on its new story and gone from the old one; the latest assignment wins', async () => {
  const days = {
    '2026-10-13': [entry('thread-a', '2026-10-13', 'a1', 'A one'), entry('thread-a', '2026-10-13', 'a2', 'A two')],
    '2026-10-14': [assignment('2026-10-14', 'as1', 'a1', 'thread-b'), fact('story_born', 'thread-b', '2026-10-14', 'sb', {born: '2026-10-14'})],
    '2026-10-15': [assignment('2026-10-15', 'as2', 'a1', 'thread-c')],
  };
  const f = mkWorld({days});
  assert.deepEqual((await bundleOf(f, 'thread-a')).bundle.entries.map((e) => e.eventId), ['a2']);
  assert.deepEqual((await bundleOf(f, 'thread-c')).bundle.entries.map((e) => e.eventId), ['a1']);
});

test('placement: a merged-away story is read as part of its survivor (entries and articles), and a later split gives it back', async () => {
  const merged = fact('story_merged', 'thread-a', '2026-10-14', 'm1', {from: 'thread-b', into: 'thread-a', reason: 'same'});
  const days = {
    '2026-10-13': [entry('thread-a', '2026-10-13', 'a1', 'A one'), entry('thread-b', '2026-10-13', 'b1', 'B one'), article('thread-b', '2026-10-12', 'bart', 'B recovered')],
    '2026-10-14': [merged],
  };
  const rows = [row('thread-a', {aliases: ['thread-b']}), row('thread-b', {aliasOf: 'thread-a'})];
  const w = await load(mkWorld({days, rows}));
  assert.deepEqual(w.rows.map((r) => r.threadId).slice(0, 1), ['thread-a']);
  assert.ok(!w.rows.some((r) => r.threadId === 'thread-b'));
  assert.deepEqual(assemble(w, w.rows[0]).bundle.entries.map((e) => e.eventId), ['bart', 'a1', 'b1']);
});

test('placement: a story with no assignments, articles or merges gives byte-identical bundles to before', async () => {
  const w = await load(mkWorld());
  const out = selectStories(w).selected.map((r) => JSON.stringify(assemble(w, r).bundle));
  assert.equal(require('node:crypto').createHash('sha256').update(out.join('\n')).digest('hex'), '3ad83aefa33c944522cec1d4778a478069a6af1fe2f745487c981dfd0c2ee922');
});
