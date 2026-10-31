'use strict';
// Entries from the inbox (decision 0051): ENTRIES_SOURCE=archive|inbox|compare in the store, the handler and the refresh.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fakeS3} = require('./fake-s3');
const {makeHandler} = require('../src/index');
const {makeStore} = require('../src/store');
const {compareEntries, rangeOfDays, readInboxDays} = require('../src/inboxEntries');
const inbox = require('../../../shared/src/entriesInbox');
const world = require('../../../shared/src/world');
const {fakeClient} = require('../../../shared/test/world.fake');

const P = 'record/shadow/';
const DAY = '2026-10-20';
const PREV = '2026-10-19';
const src = (n, extra = {}) => ({source: 'bbc.com', title: `headline ${n}`, url: `https://www.bbc.com/news/a${n}`, tier: 'primary', outletCountry: 'GB', outletType: 'national', snippet: 'snip', age: '1 hour ago', publishedAt: null, ...extra});
const entry = (n, hour, gen, extra = {}) => ({
  topicId: `Topic ${n}-${n}`, threadId: `thread-${n % 3}`, title: `Title ${n}`, category: 'conflict', regions: ['France'], search_keywords: ['k'], iso3: ['FRA'], actors: ['Emmanuel Macron'],
  event_type: 'unrest', sources: [src(n), src(n + 100)], archivedAt: `${DAY}T${String(hour).padStart(2, '0')}:00:00.${String(n).padStart(3, '0')}Z`, generationId: gen, ai: {summary: `s${n}`}, ...extra,
});
// three runs of the day: run 2 sees topic 1 again under another thread, run 3 sees topic 2 again
const runs = [
  {batch: `${DAY}T04:00:00.000Z`, gen: 'gen-1', entries: [entry(1, 4, 'gen-1'), entry(2, 4, 'gen-1'), entry(3, 4, 'gen-1')]},
  {batch: `${DAY}T12:00:00.000Z`, gen: 'gen-2', entries: [entry(4, 12, 'gen-2'), entry(1, 12, 'gen-2', {threadId: 'thread-9'})]},
  {batch: `${DAY}T20:00:00.000Z`, gen: 'gen-3', entries: [entry(2, 20, 'gen-3'), entry(5, 20, 'gen-3')]},
];
function rowAfter(rs) { let row = []; for (const r of rs) row = inbox.mergeArchiveDay(row, r.entries); return row; }
function linesOf(rs) { return rs.flatMap((r) => inbox.inboxLines(r.entries, {batch: r.batch})); }
function put(f, date, lines) { f.objs.set(`${P}inbox/entries/${date}.jsonl`, {body: lines.map((l) => `${JSON.stringify(l)}\n`).join(''), etag: `"i${date}"`}); }
// the archive: the row the agent's merge leaves, plus an older day
function seed(c) {
  c.put('NewsCache', {id: `archive#${DAY}`, entries: rowAfter(runs)});
  const old = {...entry(7, 5, 'gen-0'), archivedAt: `${PREV}T05:00:00.000Z`};
  c.put('NewsCache', {id: `archive#${PREV}`, entries: [old]});
  return old;
}
const quiet = {log() {}, warn() {}};
const noWarn = () => ({warnings: [], logs: [], log(m) { this.logs.push(m); }, warn(m) { this.warnings.push(m); }});

test('inbox mode reads the same window as the archive: the facts of a nightly run are byte-identical', async () => {
  const c = fakeClient();
  const old = seed(c);
  const out = {};
  for (const mode of ['archive', 'inbox']) {
    const f = fakeS3();
    put(f, DAY, linesOf(runs));
    put(f, PREV, inbox.inboxLines([old], {batch: `${PREV}T05:00:01.000Z`}));
    const handler = makeHandler({store: makeStore(c, {env: {ENTRIES_SOURCE: mode}, s3json: f.s3json}), s3json: f.s3json, manifest: f.manifest, now: () => `${DAY}T23:45:00.000Z`});
    const r = await handler({date: DAY});
    assert.equal(r.status, 'ok', mode);
    out[mode] = f.lines(`${P}facts/${DAY}.jsonl`).filter((x) => x.kind !== 'run');
  }
  assert.equal(JSON.stringify(out.inbox), JSON.stringify(out.archive));
  assert.ok(out.archive.filter((x) => x.kind === 'entry').length === 5 && out.archive.some((x) => x.kind === 'story_born'));
  // the replaced topic is the second run's, on its thread, once
  const one = out.inbox.filter((x) => x.kind === 'entry' && x.payload.topicId === 'Topic 1-1');
  assert.deepEqual(one.map((x) => x.threadId), ['thread-9']);
});

test('inbox mode does not touch the archive rows; a missing inbox day is a missing day', async () => {
  const c = fakeClient();
  seed(c);
  const f = fakeS3();
  put(f, DAY, linesOf(runs));
  const store = makeStore(c, {env: {ENTRIES_SOURCE: 'inbox'}, s3json: f.s3json});
  const input = await store.load(DAY, {prefix: P});
  assert.equal(input.entries.length, 5);
  assert.deepEqual(input.range.missingDays.includes(PREV), true);
  assert.deepEqual(c.calls.filter(([m, t]) => m === 'getItem' && t === 'NewsCache'), [], 'no NewsCache read');
});

test('compare mode uses the archive and logs a clean comparison when the two agree', async () => {
  const c = fakeClient();
  const old = seed(c);
  const f = fakeS3();
  put(f, DAY, linesOf(runs));
  put(f, PREV, inbox.inboxLines([old], {batch: `${PREV}T05:00:01.000Z`}));
  const log = noWarn();
  const store = makeStore(c, {env: {ENTRIES_SOURCE: 'compare'}, s3json: f.s3json, log});
  const input = await store.load(DAY, {prefix: P});
  assert.equal(input.entries.length, 5);
  assert.equal(log.warnings.length, 0);
  assert.match(log.logs[0], /^\[entries-compare\] .*"differing":0/);
});

test('compare mode names the difference (a topic only in the archive, a changed thread) and still serves the archive', async () => {
  const c = fakeClient();
  seed(c);
  const f = fakeS3();
  // the inbox lacks run 3 and has run 2's topic 1 on another thread
  const lines = linesOf(runs.slice(0, 2)).map((l) => (l.topicId === 'Topic 1-1' && l.generationId === 'gen-2' ? {...l, threadId: 'thread-x'} : l));
  put(f, DAY, lines);
  const log = noWarn();
  const store = makeStore(c, {env: {ENTRIES_SOURCE: 'compare'}, s3json: f.s3json, log});
  const input = await store.load(DAY, {prefix: P});
  assert.equal(input.entries.length, 5, 'the archive is used');
  assert.equal(log.warnings.length, 1);
  const body = JSON.parse(log.warnings[0].replace('[entries-compare] ', ''));
  assert.equal(body.differing, 1);
  const d = body.differences[0];
  assert.deepEqual([d.date, d.onlyArchive, d.onlyInbox], [DAY, ['Topic 5-5'], []]);
  const one = d.changed.find((x) => x.topicId === 'Topic 1-1');
  assert.ok(one.fields.includes('threadId'));
  assert.ok(d.changed.find((x) => x.topicId === 'Topic 2-2').fields.includes('generationId'), 'run 3 is missing, so topic 2 is still run 1\'s');
  assert.equal(body.skippedDays, 29, 'days before the inbox starts are not differences');
});

test('compare mode writes no inbox-derived fact: the facts equal an archive-mode run', async () => {
  const c = fakeClient();
  seed(c);
  const a = fakeS3();
  const b = fakeS3();
  put(b, DAY, linesOf(runs.slice(0, 1))); // an inbox that disagrees
  const ha = makeHandler({store: makeStore(c, {env: {}, s3json: a.s3json}), s3json: a.s3json, manifest: a.manifest, now: () => `${DAY}T23:45:00.000Z`});
  const hb = makeHandler({store: makeStore(c, {env: {ENTRIES_SOURCE: 'compare'}, s3json: b.s3json, log: quiet}), s3json: b.s3json, manifest: b.manifest, now: () => `${DAY}T23:45:00.000Z`});
  await ha({date: DAY});
  await hb({date: DAY});
  assert.equal(JSON.stringify(b.lines(`${P}facts/${DAY}.jsonl`)), JSON.stringify(a.lines(`${P}facts/${DAY}.jsonl`)));
});

test('the refresh reads today from the inbox in inbox mode (provisional entries), and from the archive by default', async () => {
  const c = fakeClient();
  seed(c);
  const f = fakeS3();
  put(f, DAY, linesOf(runs));
  const at = `${DAY}T20:35:00.000Z`;
  const viaInbox = makeHandler({store: makeStore(c, {env: {ENTRIES_SOURCE: 'inbox'}, s3json: f.s3json}), s3json: f.s3json, manifest: f.manifest, now: () => at});
  const r = await viaInbox({refresh: true});
  assert.deepEqual([r.entries, r.provisional, r.skipped.length], [5, 5, 0]);
  assert.deepEqual(c.calls.filter(([m, t]) => m === 'getItem' && t === 'NewsCache'), []);
  const g = fakeS3();
  const viaArchive = makeHandler({store: makeStore(c, {env: {}, s3json: g.s3json}), s3json: g.s3json, manifest: g.manifest, now: () => at});
  await viaArchive({refresh: true});
  assert.equal(JSON.stringify(f.json(`${P}views/index/weekly.json`).days), JSON.stringify(g.json(`${P}views/index/weekly.json`).days));
});

test('ENTRIES_SOURCE must be a known value and the inbox modes need the record bucket', async () => {
  assert.throws(() => makeStore(fakeClient(), {env: {ENTRIES_SOURCE: 'both'}}), /ENTRIES_SOURCE/);
  const store = makeStore(fakeClient(), {env: {ENTRIES_SOURCE: 'inbox'}});
  await assert.rejects(store.load(DAY), /record bucket/);
});

test('compareEntries: order, counts and provenance are all differences; equal ranges have none', () => {
  const days = new Map([[DAY, linesOf(runs)]]);
  const a = rangeOfDays(days, DAY, DAY);
  assert.equal(compareEntries(a, rangeOfDays(days, DAY, DAY)).differing, 0);
  const swapped = {...a, days: [{...a.days[0], entries: [...a.days[0].entries].reverse()}]};
  const d = compareEntries(a, swapped).differences[0];
  assert.equal(d.orderDiffers, true);
  const moved = {...a, days: [{...a.days[0], entries: a.days[0].entries.map((e, i) => ({...e, sourceRow: {...e.sourceRow, index: i + 1}}))}]};
  assert.ok(compareEntries(a, moved).differences[0].changed.every((x) => x.fields.includes('sourceRow')), 'the position is in the provenance');
});

test('readInboxDays: a day with no file or no line is absent', async () => {
  const f = fakeS3();
  put(f, DAY, linesOf(runs));
  const days = await readInboxDays(f.s3json, P, world.addDays(DAY, -2), DAY);
  assert.deepEqual([...days.keys()], [DAY]);
});
