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
const {buildViews, writeGroups, entryNotesBy, setPrimaryIso3} = require('../src/views');
const {todayIndex, withStories, primaryCountryBy} = require('../src/todayView');
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
  f.objs.delete(`${P}views/digests.json`); // a view missing from S3 is only rewritten once its digest is gone
  await handler({date: D1}); // the nightly path (no archive row: a tolerated day-zero miss) still publishes the views
  assert.equal(JSON.stringify(f.json(`${P}views/index/today.json`)), JSON.stringify(viaRefresh));
});

test('the schema rejects a view that is not ours', () => {
  const v = todayIndex(days(), new Map(), {});
  for (const bad of [{...v, schemaVersion: 2}, {...v, extra: 1}, {...v, entries: [{...v.entries[0], eventId: 'x'}]}, {...v, latest: {...v.latest, topicIds: 'a'}}, {...v, entries: [{...v.entries[0], notes: {summary: {format: 'html', content: 'x', at: 'a', model: null}}}]}]) {
    assert.equal(validate(bad), false, JSON.stringify(bad).slice(0, 80));
  }
});

test('a topic with more than 10 sources keeps them whole in the entry\'s latest.sources, and the view still satisfies the schema (0054)', () => {
  const many = [...Array(12).keys()].map((n) => ({source: `s${n}.com`, title: 't', url: `https://s${n}.com/a`}));
  const e = entry(3, `${D1}T04:00:02.000Z`, 'gen-3', {sources: many.slice(0, 10)});
  const lines = inbox.inboxLines([e], {batch: `${D1}T04:00:00.000Z`, selection: {topics: {'Topic 3-3': {urgency: 'high', sources: many}}, run: run(1)}});
  const v = todayIndex([{day: D1, lines}], new Map(), {});
  assert.equal(v.entries[0].latest.sources.length, 12);
  assert.equal(v.entries[0].sources.length, 10);
  const placed = withStories(v, new Map());
  assert.ok(validate(placed), JSON.stringify(validate.errors));
});

// Each today entry in its story (decisions 0058, 0063): the builder stamps storyId, role, the story's card and the run's counts by role.
test('withStories: storyId and role from the story view that holds the eventId now; merged-away ids resolve; unknown entries stay null', () => {
  const hex = (c) => c.repeat(40);
  const f = X.golden().map((x) => (x.eventId === 'ea2' ? {...x, eventId: hex('a')} : x.eventId === 'ec1' ? {...x, eventId: hex('c')} : x));
  const views = buildViews(f, {today: D1, builtAt: `${D1}T04:35:00.000Z`, runId: 'r', factsManifestDays: 1});
  const e = (topicId, threadId, eventId, extra = {}) => ({topicId, threadId, title: topicId, archivedAt: `${D1}T04:00:00.000Z`, sources: [], eventId, ...extra});
  const view = {schemaVersion: 1, builtFrom: {}, updatedAt: `${D1}T04:00:00.000Z`,
    latest: {batch: 'b', generationId: null, model: null, limit: 13, updatedAt: null, generatedDate: null, generatedYear: null, topicIds: ['A second-1', 'C first-1', 'gone-1']},
    entries: [e('A second-1', 'thread-a', hex('a'), {latest: {urgency: 'low'}}), e('C first-1', 'thread-c', hex('c'), {latest: {urgency: 'low'}}), e('gone-1', 'thread-x', hex('f'), {latest: {urgency: 'low'}})]};
  const v = withStories(view, views.stories);
  assert.deepEqual(v.entries.map((x) => [x.threadId, x.storyId, x.role]), [['thread-a', 'thread-a', 'move'], ['thread-c', 'thread-b', 'start'], ['thread-x', null, null]]);
  assert.deepEqual(v.latest.roles, {start: 1, move: 1, measure: 0, none: 1});
  assert.deepEqual(Object.keys(v.stories), ['thread-a', 'thread-b']);
  const a = v.stories['thread-a'];
  const s = views.stories.get('thread-a');
  assert.deepEqual(a, {title: s.title, name: null, born: '2026-10-18', category: 'conflict', iso3: s.iso3, regions: s.regions, tier: null, riskScore: null,
    stepCount: 2, stepDays: 2, firstStep: s.firstStep, newestStep: s.newestStep, watch: [], watchAt: null, editionRole: 'move', alsoToday: []});
  assert.equal(validate(v), true, JSON.stringify(validate.errors));
  assert.equal(withStories(null, views.stories), null);
});

test('withStories: the card carries the analysis watch questions (model text) and when they were written; the run\'s entry of a topic is the one with `latest`', () => {
  const story = {aliasOf: null, title: 'T', name: 'The T affair', born: D0, category: null, iso3: [], regions: [], tier: 'high', riskScore: 80, stepCount: 1, stepDays: 1,
    firstStep: {eventId: 'e1', date: D0, title: 'T', role: 'measure'}, newestStep: {eventId: 'e1', date: D0, title: 'T', role: 'measure', sourceCount: 2},
    entries: [{eventId: 'e1', role: 'measure'}], analysis: {watchQuestions: ['Will it?', '', 7, 'And then?'], generatedAt: `${D0}T09:00:00.000Z`}};
  const view = {latest: {topicIds: ['t-1']}, entries: [{topicId: 't-1', eventId: 'old'}, {topicId: 't-1', eventId: 'e1', latest: {}}]};
  const v = withStories(view, new Map([['thread-t', story]]));
  assert.deepEqual(v.stories['thread-t'].watch, ['Will it?', 'And then?']);
  assert.equal(v.stories['thread-t'].watchAt, `${D0}T09:00:00.000Z`);
  assert.deepEqual(v.latest.roles, {start: 0, move: 0, measure: 1, none: 0});
  assert.equal(v.stories['thread-t'].name, 'The T affair'); // the stamp's name (0065), beside the title
});

test('withStories (SPEC R1): one card per story; editionRole from the edition\'s steps; latest.roles counts stories, none counts unplaced items; alsoToday lists the other edition steps', () => {
  const step = (eventId, role, date = D1) => ({eventId, date, title: `H ${eventId}`, role, kind: 'entry'});
  const card = (entries, first, newest) => ({aliasOf: null, title: newest.title, name: null, born: D0, category: null, iso3: [], regions: [], tier: null, riskScore: null,
    stepCount: entries.length, stepDays: 1, firstStep: first, newestStep: {...newest, sourceCount: 1}, entries, analysis: null});
  // ferry: born in this edition with a start, then a move and one more move, all in the edition; title = newest move, first step = the start
  const ferry = [step('f1', 'start'), step('f2', 'move'), step('f3', 'move')];
  // old: started long ago, two moves in the edition
  const old = [step('o0', 'start', D0), step('o1', 'move'), step('o2', 'move')];
  // gauge: first step is a measured change (not a start), measured again in the edition
  const gauge = [step('g1', 'measure'), step('g2', 'measure')];
  // limited: the record may not hold its real start (role null)
  const limited = [step('l1', null)];
  // earlier: a step earlier today, none in the edition
  const earlier = [step('e1', 'move')];
  const stories = new Map([
    ['ferry', card(ferry, ferry[0], ferry[2])], ['old', card(old, old[0], old[2])], ['gauge', card(gauge, gauge[0], gauge[1])],
    ['limited', card(limited, limited[0], limited[0])], ['earlier', card(earlier, earlier[0], earlier[0])],
  ]);
  const e = (topicId, eventId, inRun = true) => ({topicId, threadId: 'x', title: topicId, archivedAt: `${D1}T04:00:00.000Z`, sources: [], eventId, ...(inRun ? {latest: {}} : {})});
  const run = ['t-f1', 't-f2', 't-f3', 't-o1', 't-o2', 't-g1', 't-g2', 't-l1', 't-none'];
  const view = {latest: {topicIds: run}, entries: [...run.map((t) => e(t, t.slice(2))), e('t-e1', 'e1', false)]};
  const v = withStories(view, stories);
  const pick = (id) => [v.stories[id].editionRole, v.stories[id].alsoToday.map((x) => x.eventId)];
  assert.deepEqual(pick('ferry'), ['start', ['f2']]); // f1 is the first-step line, f3 the title: only f2 is "Also today"
  assert.deepEqual(pick('old'), ['move', ['o1']]);
  assert.deepEqual(pick('gauge'), ['measure', []]); // its first step is a measured change, so never a start
  assert.deepEqual(pick('limited'), [null, []]);
  assert.deepEqual(pick('earlier'), [null, []]); // no step in this edition
  assert.deepEqual(v.stories.ferry.alsoToday, [{eventId: 'f2', date: D1, title: 'H f2', role: 'move'}]);
  // 9 items in the run: 3 stories by kind (ferry once, not three times), none = the unplaced item + the limited story's item
  assert.deepEqual(v.latest.roles, {start: 1, move: 1, measure: 1, none: 2});
  // every card in a kind group is counted once: the count line and the groups agree
  const grouped = Object.values(v.stories).filter((c) => c.editionRole);
  assert.deepEqual(['start', 'move', 'measure'].map((r) => grouped.filter((c) => c.editionRole === r).length), [1, 1, 1]);
});

test('primaryIso3: the model\'s primaryCountry of the newest step, resolved to ISO3; unknown stays absent (never guessed)', () => {
  const by = primaryCountryBy(days());
  assert.deepEqual([...by.values()].sort(), ['France', 'France', 'France'], 'only the lines of the selection run carry primaryCountry (topics 2, 3, 4)');
  assert.equal(by.get(eventOf(entry(3, ''), D1)), 'France');
  assert.equal(by.has(eventOf(entry(1, ''), D0)), false);
  const step = (n, day) => ({eventId: eventOf(entry(n, ''), day), date: day, title: `Title ${n}`, role: 'move', sourceCount: 1});
  const stories = new Map([['a', {newestStep: step(3, D1)}], ['b', {newestStep: step(1, D0)}], ['c', {newestStep: null}], ['d', {threadId: 'd', aliasOf: 'a'}]]);
  setPrimaryIso3(stories, by);
  assert.equal(stories.get('a').primaryIso3, 'FRA');
  assert.equal(stories.get('a').newestStep.primaryIso3, 'FRA');
  assert.equal('primaryIso3' in stories.get('b'), false);
  assert.equal('primaryIso3' in stories.get('b').newestStep, false);
  assert.equal('primaryIso3' in stories.get('c'), false);
  const odd = primaryCountryBy([{day: D1, lines: inbox.inboxLines([entry(5, `${D1}T04:00:00.000Z`, 'gen-3')], {batch: `${D1}T04:00:00.000Z`, selection: {topics: {'Topic 5-5': {primaryCountry: 'the Middle East'}}, run: run(1)}})}]);
  const s2 = new Map([['x', {newestStep: step(5, D1)}]]);
  setPrimaryIso3(s2, odd);
  assert.equal('primaryIso3' in s2.get('x'), false, 'a region is not a country');
});
