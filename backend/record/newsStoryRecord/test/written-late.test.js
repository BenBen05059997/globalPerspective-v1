'use strict';
// Stories written after their slot (decision 0061): the marker {writtenAt, slot} on an entries-inbox line reaches the entry fact, the story view
// rows, the today view and the Run; a day without the marker behaves exactly as before.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fakeS3} = require('./fake-s3');
const {makeHandler} = require('../src/index');
const {makeStore} = require('../src/store');
const F = require('../src/facts');
const inbox = require('../../../shared/src/entriesInbox');
const world = require('../../../shared/src/world');
const {fakeClient} = require('../../../shared/test/world.fake');

const P = 'record/';
const DAY = '2026-11-15';
const SLOT = '2026-11-15T12:15:00.000Z';
const WRITTEN = '2026-11-17T01:30:00.000Z';
const MARK = {writtenAt: WRITTEN, slot: SLOT};
const src = (n, publishedAt) => ({source: 'bbc.com', title: `headline ${n}`, url: `https://www.bbc.com/news/a${n}`, tier: 'primary', outletCountry: 'GB', outletType: 'national', snippet: 'snip', age: '1 hour ago', publishedAt});
const entry = (n, archivedAt, extra = {}) => ({
  topicId: `Topic ${n}-${n}`, threadId: `thread-${n}`, title: `Title ${n}`, category: 'conflict', regions: ['France'], search_keywords: ['k'], iso3: ['FRA'], actors: ['Emmanuel Macron'],
  event_type: 'unrest', sources: [src(n, `${DAY}T10:00:00.000Z`)], archivedAt, generationId: 'gen-x', ai: {summary: `s${n}`}, ...extra,
});
const live = [entry(1, `${DAY}T04:26:00.000Z`), entry(2, `${DAY}T04:26:00.001Z`)];
const late = [entry(3, WRITTEN, {writtenLate: MARK}), entry(4, WRITTEN, {writtenLate: MARK, sources: [src(4, null)]})]; // 4 has no publish time
const put = (f, lines) => f.objs.set(`${P}inbox/entries/${DAY}.jsonl`, {body: lines.map((l) => `${JSON.stringify(l)}\n`).join(''), etag: '"i"'});
const linesOf = (batches) => batches.flatMap(([entries, batch]) => inbox.inboxLines(entries, {batch}));

async function runDay(lines) {
  const f = fakeS3();
  put(f, lines);
  const handler = makeHandler({store: makeStore(fakeClient(), {env: {ENTRIES_SOURCE: 'inbox'}, s3json: f.s3json}), s3json: f.s3json, manifest: f.manifest, now: () => `${DAY}T23:45:00.000Z`});
  const run = await handler({date: DAY, shadow: false});
  return {f, run, facts: f.lines(`${P}facts/${DAY}.jsonl`), allFacts: () => f.objs};
}

test('the marker is carried from the inbox line to the entry fact payload; live entries carry none', async () => {
  const {facts, run} = await runDay(linesOf([[live, `${DAY}T04:26:35.000Z`], [late, WRITTEN]]));
  assert.equal(run.status, 'ok');
  const byTopic = Object.fromEntries(facts.filter((x) => x.kind === 'entry').map((x) => [x.payload.topicId, x]));
  assert.deepEqual(byTopic['Topic 3-3'].payload.writtenLate, MARK);
  assert.deepEqual(byTopic['Topic 4-4'].payload.writtenLate, MARK);
  assert.equal('writtenLate' in byTopic['Topic 1-1'].payload, false);
  assert.equal('writtenLate' in byTopic['Topic 2-2'].payload, false);
});

test('a late entry with no publish time stands on its slot: the fact lands in the slot day, not in the day it was written', async () => {
  const {facts} = await runDay(linesOf([[late, WRITTEN]]));
  const noTime = facts.find((x) => x.kind === 'entry' && x.payload.topicId === 'Topic 4-4');
  assert.deepEqual([noTime.at, noTime.date, noTime.precision], [SLOT, DAY, 'day']);
  const timed = facts.find((x) => x.kind === 'entry' && x.payload.topicId === 'Topic 3-3');
  assert.deepEqual([timed.at, timed.precision], [`${DAY}T10:00:00.000Z`, 'exact']);
});

test('the Run records the late stories; a day with none has no such key and the same facts as before', async () => {
  const mixed = await runDay(linesOf([[live, `${DAY}T04:26:35.000Z`], [late, WRITTEN]]));
  assert.deepEqual(mixed.run.inputs.lateWritten, {entries: 2, slots: [SLOT]});
  assert.equal(mixed.f.json(`${P}runs/${DAY}.json`).inputs.lateWritten.entries, 2);
  const plain = await runDay(linesOf([[live, `${DAY}T04:26:35.000Z`]]));
  assert.equal('lateWritten' in plain.run.inputs, false);
  assert.deepEqual(Object.keys(plain.run.inputs).sort(), ['archiveDay', 'rawDay', 'todayArchive']);
  const entryFacts = (r) => r.facts.filter((x) => x.kind === 'entry').map((x) => JSON.stringify(x.payload));
  assert.equal(entryFacts(plain).every((p) => !p.includes('writtenLate')), true);
});

test('the story view row and the today view carry the marker', async () => {
  const {f} = await runDay(linesOf([[live, `${DAY}T04:26:35.000Z`], [late, WRITTEN]]));
  const row = f.json(`${P}views/stories/thread-3.json`).entries.find((e) => e.topicId === 'Topic 3-3');
  assert.deepEqual(row.writtenLate, MARK);
  assert.equal('writtenLate' in f.json(`${P}views/stories/thread-1.json`).entries[0], false);
  const today = f.json(`${P}views/index/today.json`).entries;
  assert.deepEqual(today.find((e) => e.topicId === 'Topic 3-3').writtenLate, MARK);
  assert.ok(today.filter((e) => !e.topicId.startsWith('Topic 3') && !e.topicId.startsWith('Topic 4')).every((e) => !('writtenLate' in e)));
});

test('a malformed marker is no marker', () => {
  const day = (m) => world.archiveDayOfEntries(DAY, [entry(1, `${DAY}T04:00:00.000Z`, {writtenLate: m})], {}).entries[0];
  assert.deepEqual(day(MARK).writtenLate, MARK);
  for (const bad of [null, 'late', {writtenAt: 'x', slot: SLOT}, {slot: SLOT}, {writtenAt: WRITTEN}, []]) assert.equal('writtenLate' in day(bad), false, JSON.stringify(bad));
  assert.equal('writtenLate' in F.entryFact(day(null), 'r').payload, false);
});

test('a malformed marker on an inbox line makes no Run gap and no marker on the fact', async () => {
  const badLate = [entry(5, WRITTEN, {writtenLate: {writtenAt: WRITTEN}}), entry(6, WRITTEN, {writtenLate: true})];
  const {run, facts} = await runDay(linesOf([[live, `${DAY}T04:26:35.000Z`], [badLate, WRITTEN]]));
  assert.equal('lateWritten' in run.inputs, false);
  assert.equal(facts.filter((x) => x.kind === 'entry').every((x) => !('writtenLate' in x.payload)), true);
});

// ---- the schemas know the marker ----------------------------------------------------------------------------
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const Ajv = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'))('ajv');
const load = (...p) => JSON.parse(readFileSync(resolve(__dirname, '../schema', ...p), 'utf8'));

test('the fact, Run, story view and today view schemas accept what a late day produces, and reject a marker of another shape', async () => {
  const ajv = new Ajv({allErrors: true, strict: false});
  ajv.addSchema(load('views/story-stamp.schema.json'));
  const [fact, runSchema, story, todayIndex] = [load('fact.schema.json'), load('run.schema.json'), load('views/story.schema.json'), load('views/today-index.schema.json')].map((s) => ajv.compile(s));
  const {f, run, facts} = await runDay(linesOf([[live, `${DAY}T04:26:35.000Z`], [late, WRITTEN]]));
  for (const x of facts.filter((y) => y.kind === 'entry')) assert.equal(fact(x), true, JSON.stringify(fact.errors));
  assert.equal(runSchema(f.json(`${P}runs/${DAY}.json`)), true, JSON.stringify(runSchema.errors));
  assert.equal(story(f.json(`${P}views/stories/thread-3.json`)), true, JSON.stringify(story.errors));
  assert.equal(todayIndex(f.json(`${P}views/index/today.json`)), true, JSON.stringify(todayIndex.errors));
  const bad = {...facts.find((y) => y.kind === 'entry' && y.payload.writtenLate)};
  bad.payload = {...bad.payload, writtenLate: {writtenAt: WRITTEN}};
  assert.equal(fact(bad), false);
  assert.equal(run.status, 'ok');
});
