'use strict';
// index/today.json (decision 0051): built by buildViews from the entries inbox and the entry notes, by nightly and refresh runs alike.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {readFileSync} = require('node:fs');
const {createRequire} = require('node:module');
const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const {fakeS3} = require('./fake-s3');
const {makeHandler} = require('../src/index');
const {buildViews, writeGroups, entryNotesBy} = require('../src/views');
const {todayIndex} = require('../src/todayView');
const inbox = require('../../../shared/src/entriesInbox');
const R = require('../../../shared/src/record');
const N = require('../../../shared/src/notes');
const X = require('./views-fixture');

const P = 'record/shadow/';
const D0 = '2026-10-22';
const D1 = '2026-10-23';
const validate = new Ajv({allErrors: true, strict: false}).compile(JSON.parse(readFileSync(resolve(__dirname, '../schema/views/today-index.schema.json'), 'utf8')));
const entry = (n, at, gen, extra = {}) => ({
  topicId: `Topic ${n}-${n}`, threadId: `thread-${n}`, title: `Title ${n}`, category: 'conflict', regions: ['France'], search_keywords: ['k'], iso3: ['FRA'], actors: ['Emmanuel Macron'], event_type: 'unrest',
  sources: [{source: 'bbc.com', title: 't', url: `https://www.bbc.com/news/a${n}`, tier: 'primary', age: '1 hour ago'}], archivedAt: at, generationId: gen, ai: {summary: `s${n}`}, ...extra,
});
const topicsOf = (...ns) => Object.fromEntries(ns.map((n) => [`Topic ${n}-${n}`, {urgency: n === 3 ? 'high' : 'low', x_trending: n === 3, primaryCountry: 'France', significance: 'high', urgencyReason: 'r', internal: 'not copied'}]));
const run = (of, extra = {}) => ({of, model: 'deepseek-v4-pro', limit: 13, updatedAt: `${D1}T04:16:00.000Z`, generatedDate: 'October 23, 2026', generatedYear: 2026, generationId: 'gen-3', ...extra});
// yesterday 20:00 run (topics 1, 2), today 04:00 run (topics 2 again, 3, 4)
const days = () => [
  {day: D0, lines: inbox.inboxLines([entry(1, `${D0}T20:00:01.000Z`, 'gen-2'), entry(2, `${D0}T20:00:02.000Z`, 'gen-2')], {batch: `${D0}T20:00:00.000Z`})},
  {day: D1, lines: inbox.inboxLines([entry(2, `${D1}T04:00:01.000Z`, 'gen-3', {threadId: 'thread-9'}), entry(3, `${D1}T04:00:02.000Z`, 'gen-3'), entry(4, `${D1}T04:00:03.000Z`, 'gen-3')], {batch: `${D1}T04:00:00.000Z`, selection: {topics: topicsOf(2, 3, 4), run: run(3)}})},
];
const eventOf = (e, day) => R.entryIdentity({sources: e.sources, date: day, title: e.title}).eventId;
const noteFor = (e, day, part, content, at, extra = {}) => N.buildNote({subtype: 'entry', subjectId: eventOf(e, day), part, at, payload: {format: part === 'prediction' ? 'json' : 'markdown', content, topicId: e.topicId}, cites: [eventOf(e, day)], model: 'deepseek-flash', producer: {lambda: 'agent', runId: 'g'}, ...extra});

test('no lines, no view', () => {
  assert.equal(todayIndex([], new Map(), {}), null);
  assert.equal(todayIndex([{day: D0, lines: []}, {day: D1, lines: []}], new Map(), {}), null);
});

test('the entries are the today-archive item: a topic seen again replaces its earlier entry (across midnight), in write order', () => {
  const v = todayIndex(days(), new Map(), {factsThrough: D0});
  assert.deepEqual(v.entries.map((e) => [e.topicId, e.threadId]), [['Topic 1-1', 'thread-1'], ['Topic 2-2', 'thread-9'], ['Topic 3-3', 'thread-3'], ['Topic 4-4', 'thread-4']]);
  assert.equal(v.updatedAt, `${D1}T04:00:00.000Z`);
  assert.ok(v.entries.every((e) => /^[0-9a-f]{40}$/.test(e.eventId)));
  assert.equal(v.entries[0].eventId, eventOf(entry(1, ''), D0), 'the id of the day the entry was written under, as the entry fact has it');
});

test('an entry 24 h or more before the newest write is not in the view', () => {
  const d = days();
  d[0].lines = inbox.inboxLines([entry(1, `${D0}T03:00:00.000Z`, 'gen-1')], {batch: `${D0}T03:00:00.000Z`}); // 25 h before 04:00
  assert.deepEqual(todayIndex(d, new Map(), {}).entries.map((e) => e.topicId), ['Topic 2-2', 'Topic 3-3', 'Topic 4-4']);
});

test('the latest run: its topics in order, with the fields only `latest` held; only the whole run counts', () => {
  const v = todayIndex(days(), new Map(), {});
  assert.deepEqual(v.latest, {batch: `${D1}T04:00:00.000Z`, generationId: 'gen-3', model: 'deepseek-v4-pro', limit: 13, updatedAt: `${D1}T04:16:00.000Z`, generatedDate: 'October 23, 2026', generatedYear: 2026, topicIds: ['Topic 2-2', 'Topic 3-3', 'Topic 4-4']});
  const three = v.entries.find((e) => e.topicId === 'Topic 3-3');
  assert.deepEqual(three.latest, {urgency: 'high', urgencyReason: 'r', significance: 'high', x_trending: true, primaryCountry: 'France'});
  assert.equal(v.entries[0].latest, undefined, 'an entry of an older run has none');
  const partial = days();
  partial[1].lines = inbox.inboxLines([entry(3, `${D1}T04:00:02.000Z`, 'gen-3')], {batch: `${D1}T04:00:00.000Z`, selection: {topics: topicsOf(3), run: run(3)}}); // 1 line of 3
  assert.equal(todayIndex(partial, new Map(), {}).latest, null);
  const legacy = days();
  legacy[1].lines = inbox.inboxLines([entry(3, `${D1}T04:00:02.000Z`, 'gen-3')], {batch: `${D1}T04:00:00.000Z`});
  assert.equal(todayIndex(legacy, new Map(), {}).latest, null);
});

test('full model text comes from the entry notes, for the latest run only; the exact note beats an archive copy', () => {
  const d = days();
  const e3 = entry(3, `${D1}T04:00:02.000Z`, 'gen-3');
  const e1 = entry(1, `${D0}T20:00:01.000Z`, 'gen-2');
  const lines = [
    noteFor(e3, D1, 'summary', '- full summary', `${D1}T04:00:30.000Z`),
    noteFor(e3, D1, 'prediction', {precedents: []}, `${D1}T04:00:40.000Z`),
    noteFor(e3, D1, 'summary', 'cut copy', `${D1}T04:01:00.000Z`, {payload: {format: 'text', content: 'cut copy', topicId: e3.topicId, from: 'archive'}, model: null}),
    noteFor(e1, D0, 'summary', 'older run', `${D0}T20:00:30.000Z`),
  ];
  const v = todayIndex(d, entryNotesBy(lines), {});
  const three = v.entries.find((e) => e.topicId === 'Topic 3-3');
  assert.deepEqual(three.notes.summary, {format: 'markdown', content: '- full summary', at: `${D1}T04:00:30.000Z`, model: 'deepseek-flash'});
  assert.deepEqual(three.notes.prediction.content, {precedents: []});
  assert.equal(three.notes.trace_cause, undefined);
  assert.equal(v.entries.find((e) => e.topicId === 'Topic 1-1').notes, undefined, 'a note of an entry outside the latest run is not carried');
  assert.equal(v.entries.find((e) => e.topicId === 'Topic 4-4').notes, undefined);
});

test('buildViews writes index/today.json only when the inbox has lines, and it satisfies the schema', () => {
  const opts = {today: D1, builtAt: `${D1}T04:35:00.000Z`, runId: 'r', factsManifestDays: 1};
  const without = buildViews(X.golden(), opts);
  assert.equal(without.indexes['today.json'], undefined);
  assert.equal(writeGroups(without).flat().some(([k]) => k === 'index/today.json'), false);
  const v = buildViews(X.golden(), {...opts, todayDays: days()});
  assert.equal(validate(v.indexes['today.json']), true, JSON.stringify(validate.errors));
  assert.ok(writeGroups(v)[1].some(([k]) => k === 'index/today.json'));
  assert.deepEqual(v.indexes['today.json'].builtFrom, v.active.builtFrom);
  // the other views do not change
  assert.equal(JSON.stringify(without.active), JSON.stringify(v.active));
  assert.equal(JSON.stringify([...without.stories]), JSON.stringify([...v.stories]));
});

test('a refresh and a nightly run both write the view from the inbox of the last two days', async () => {
  const f = fakeS3();
  for (const {day, lines} of days()) f.objs.set(`${P}inbox/entries/${day}.jsonl`, {body: lines.map((l) => `${JSON.stringify(l)}\n`).join(''), etag: `"i${day}"`});
  f.put(`${P}facts/manifest.json`, {schemaVersion: 1, days: []});
  const store = {async loadDay() { return []; }, async load() { return {date: D1, dayRow: null, entries: [], births: {}, snapshots: [], threadOfTopic: new Map()}; }};
  const handler = makeHandler({store, s3json: f.s3json, manifest: f.manifest, now: () => `${D1}T04:35:00.000Z`});
  await handler({refresh: true});
  const viaRefresh = f.json(`${P}views/index/today.json`);
  assert.equal(validate(viaRefresh), true, JSON.stringify(validate.errors));
  assert.deepEqual(viaRefresh.entries.map((e) => e.topicId), ['Topic 1-1', 'Topic 2-2', 'Topic 3-3', 'Topic 4-4']);
  f.objs.delete(`${P}views/index/today.json`);
  await handler({date: D1}); // the nightly path (no archive row: a tolerated day-zero miss) still publishes the views
  assert.equal(JSON.stringify(f.json(`${P}views/index/today.json`)), JSON.stringify(viaRefresh));
});

test('the schema rejects a view that is not ours', () => {
  const v = todayIndex(days(), new Map(), {});
  for (const bad of [{...v, schemaVersion: 2}, {...v, extra: 1}, {...v, entries: [{...v.entries[0], eventId: 'x'}]}, {...v, latest: {...v.latest, topicIds: 'a'}}, {...v, entries: [{...v.entries[0], notes: {summary: {format: 'html', content: 'x', at: 'a', model: null}}}]}]) {
    assert.equal(validate(bad), false, JSON.stringify(bad).slice(0, 80));
  }
});
