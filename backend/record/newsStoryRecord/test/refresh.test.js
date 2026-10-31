'use strict';
// The refresh of decision 0050: {refresh:true} puts today's archive entries into the views as provisional entries and writes nothing else.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fakeS3} = require('./fake-s3');
const {makeHandler} = require('../src/index');
const {buildViews} = require('../src/views');
const {entryFact, provisionalEntryFact} = require('../src/facts');
const X = require('./views-fixture');

const P = 'record/shadow/';
const TODAY = '2026-10-23';
const at = `${TODAY}T12:40:00.000Z`;
const entry = (n, extra = {}) => ({
  date: TODAY, archive: `archive#${TODAY}`, topicId: `Topic ${n}-${n}`, threadId: `thread-${n % 2}`, title: `Title ${n}`, category: 'conflict',
  regions: [], iso3: ['FRA'], actors: ['Emmanuel Macron'], eventType: 'unrest', archivedAt: `${TODAY}T04:20:00.000Z`, generationId: 'gen-1', continuesTopic: null,
  sources: [{source: 'www.bbc.co.uk', title: 't', url: `https://www.bbc.co.uk/news/a${n}`, tier: null, outletCountry: null, outletType: null, snippet: null}],
  sourceKey: `today-archive|gen-1|Topic ${n}-${n}`, sourceRow: {store: 'NewsCache', key: {id: 'today-archive'}, index: n}, ...extra,
});
const store = (entries) => ({async loadDay(d) { assert.equal(d, TODAY); return entries; }, async load() { throw new Error('a refresh reads no window'); }});
const make = (entries, f = fakeS3()) => ({f, handler: makeHandler({store: store(entries), s3json: f.s3json, manifest: f.manifest, now: () => at})});
// real facts as lines of their day files, with the manifest
function withFacts(f, facts) {
  const days = {};
  for (const x of facts) (days[x.date] ||= []).push(x);
  for (const [d, xs] of Object.entries(days)) f.objs.set(`${P}facts/${d}.jsonl`, {body: xs.map((x) => `${JSON.stringify(x)}\n`).join(''), etag: `"s${d}"`});
  f.put(`${P}facts/manifest.json`, {schemaVersion: 1, days: Object.keys(days).sort()});
}

test('a refresh writes views only: no fact, no Run, no run fact, no manifest day; the entries are provisional', async () => {
  const f = fakeS3();
  withFacts(f, X.golden());
  const factsBefore = [...f.objs].filter(([k]) => k.includes('/facts/')).map(([k, o]) => [k, o.body]);
  const {handler} = make([entry(1), entry(2)], f);
  const r = await handler({refresh: true});
  assert.deepEqual([r.refresh, r.entries, r.provisional, r.skipped.length], [true, 2, 2, 0]);
  const written = f.puts.map((p) => p.Key);
  assert.ok(written.length > 0 && written.every((k) => k.startsWith(`${P}views/`)), 'only views are written');
  assert.deepEqual([...f.objs].filter(([k]) => k.includes('/facts/')).map(([k, o]) => [k, o.body]), factsBefore);
  assert.equal(f.objs.has(`${P}runs/${TODAY}.json`), false);
  const m = f.json(`${P}views/manifest.json`);
  assert.deepEqual([m.factsThrough, m.provisionalThrough, m.provisionalEntries, m.builtAt], ['2026-10-22', TODAY, 2, at]);
  const story = f.json(`${P}views/stories/thread-1.json`);
  assert.deepEqual(story.entries.filter((e) => e.provisional).map((e) => e.title), ['Title 1']);
  assert.equal(story.builtFrom.provisionalThrough, TODAY);
  const weekly = f.json(`${P}views/index/weekly.json`);
  assert.equal(weekly.days[TODAY].entries.length, 2);
  assert.ok(f.json(`${P}views/index/active.json`).stories.some((s) => s.threadId === 'thread-0'));
});

test('the nightly build replaces the provisional entries: no marker, factsThrough moves, and the views equal a build without a refresh', () => {
  const real = [...X.golden()];
  const prov = [entry(1), entry(2)].map((e) => provisionalEntryFact(e, 'refresh-x'));
  const opts = {today: TODAY, builtAt: at, runId: 'r', factsManifestDays: 3};
  const refreshed = buildViews(real, {...opts, provisional: prov});
  const plain = buildViews(real, opts);
  assert.equal(plain.manifest.provisionalThrough, undefined);
  assert.equal(JSON.stringify(plain.stories.get('thread-a')), JSON.stringify(buildViews(real, {...opts, provisional: []}).stories.get('thread-a')));
  // the nightly facts of the same entries: the views carry them as plain entries, whatever the refresh showed
  const nightly = buildViews([...real, ...[entry(1), entry(2)].map((e) => entryFact(e, 'night'))], opts);
  assert.equal(nightly.manifest.provisionalThrough, undefined);
  assert.equal(nightly.manifest.factsThrough, TODAY);
  assert.ok(nightly.stories.get('thread-1').entries.every((e) => !e.provisional));
  // a refresh after the nightly run (same entries) adds nothing: the real fact wins by eventId
  const again = buildViews([...real, ...[entry(1), entry(2)].map((e) => entryFact(e, 'night'))], {...opts, provisional: prov});
  assert.equal(JSON.stringify(again.stories), JSON.stringify(nightly.stories));
  assert.equal(again.manifest.provisionalThrough, undefined);
  assert.equal(refreshed.manifest.factsThrough, '2026-10-22');
});

test('an entry the agent replaced during the day (new thread, new article) is not frozen: the next refresh shows the replacement only', async () => {
  const f = fakeS3();
  withFacts(f, X.golden());
  const first = make([entry(1, {threadId: 'interim'})], f);
  await first.handler({refresh: true});
  assert.ok(f.objs.has(`${P}views/stories/interim.json`));
  const next = make([entry(1, {threadId: 'thread-b', title: 'Title 1 again', sources: [{source: 'www.bbc.co.uk', title: 't', url: 'https://www.bbc.co.uk/news/other'}]})], f);
  await next.handler({refresh: true});
  assert.equal(f.lines(`${P}facts/${TODAY}.jsonl`).length, 0, 'no fact was ever appended');
  const active = f.json(`${P}views/index/active.json`).stories.map((s) => s.threadId);
  assert.equal(active.includes('interim'), false, 'the interim thread is out of the index');
  assert.deepEqual(f.json(`${P}views/stories/thread-b.json`).entries.filter((e) => e.provisional).map((e) => e.title), ['Title 1 again']);
});

test('an entry that cannot be made a fact is skipped and counted, the rest is shown', async () => {
  const f = fakeS3();
  withFacts(f, X.golden());
  const bad = entry(3, {archivedAt: null, date: 'not-a-day', sources: []});
  const {handler} = make([entry(1), bad], f);
  const r = await handler({refresh: true});
  assert.deepEqual([r.entries, r.provisional, r.skipped.length], [2, 1, 1]);
});

test('a failed view write throws so the schedule sees it, and the old manifest stays', async () => {
  const f = fakeS3();
  withFacts(f, X.golden());
  f.put(`${P}views/manifest.json`, {old: true});
  f.failPut = (i) => i.Key.endsWith('index/active.json');
  const {handler} = make([entry(1)], f);
  await assert.rejects(handler({refresh: true}));
  assert.deepEqual(f.json(`${P}views/manifest.json`), {old: true});
});
