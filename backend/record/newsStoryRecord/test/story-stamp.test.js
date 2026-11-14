'use strict';
// The shared story fields (decision 0058 rule 7): storyStamp.js and where views.js and indexViews.js put them.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const {storyStamp, cleanIso3} = require('../src/storyStamp');
const {tierFromScore} = require('../src/_shared/world/tier');
const V = require('../src/views');
const X = require('./views-fixture');

const ajv = new Ajv({allErrors: true, strict: false});
const stampSchema = JSON.parse(readFileSync(resolve(__dirname, '../schema/views/story-stamp.schema.json'), 'utf8'));
const validStamp = ajv.compile(stampSchema);

const base = {threadId: 't1', title: 'A title', iso3: ['FRA'], born: '2026-10-18', lastFactAt: '2026-10-22T06:00:00.000Z'};
const line = {line: {week: '2026-W43', payload: {text: 'One sentence.'}}};
const analysis = (o = {}) => ({generatedAt: '2026-10-21T05:00:00.000Z', threadTitle: 'Model title', ...o});

test('title is passed through unchanged; a story without one has null', () => {
  assert.equal(storyStamp(base).title, 'A title');
  assert.equal(storyStamp({...base, title: undefined}).title, null);
});

test('lastEntryAt and category come from the newest news entry; articles, entries without a category and a story with no entry are handled', () => {
  const e = (at, category, extra = {}) => ({eventId: at, at, category, ...extra});
  const article = (at) => ({eventId: at, at, kind: 'article', title: 'A placed article'}); // article rows carry kind 'article' and no category
  const pick = (entries) => { const s = storyStamp({...base, entries}); return [s.lastEntryAt, s.category]; };
  // no entry (a story of forecasts or verdicts only), or no entries argument: both null; lastFactAt is unaffected
  assert.deepEqual(pick([]), [null, null]);
  assert.deepEqual(pick(undefined), [null, null]);
  assert.equal(storyStamp({...base, entries: []}).lastFactAt, '2026-10-22T06:00:00.000Z');
  // the newest entry sets both; the raw category is kept (no mapped crisis type)
  assert.deepEqual(pick([e('2026-10-20T00:00:00.000Z', 'Diplomacy'), e('2026-10-21T00:00:00.000Z', 'Armed Conflict')]), ['2026-10-21T00:00:00.000Z', 'Armed Conflict']);
  // the newest entry has no category: lastEntryAt is its date, category is the newest entry that has one
  for (const none of [null, undefined, '', '  ']) assert.deepEqual(pick([e('2026-10-19T00:00:00.000Z', 'Health'), e('2026-10-20T00:00:00.000Z', 'Politics'), e('2026-10-21T00:00:00.000Z', none)]), ['2026-10-21T00:00:00.000Z', 'Politics']);
  // every entry without a category: category null
  assert.deepEqual(pick([e('2026-10-21T00:00:00.000Z', null)]), ['2026-10-21T00:00:00.000Z', null]);
  // a placed article newer than the newest entry changes neither field; a story of articles only has no news entry
  assert.deepEqual(pick([e('2026-10-20T00:00:00.000Z', 'Economy'), article('2026-10-22T00:00:00.000Z')]), ['2026-10-20T00:00:00.000Z', 'Economy']);
  assert.deepEqual(pick([article('2026-10-22T00:00:00.000Z')]), [null, null]);
  // the order of the rows does not matter
  assert.deepEqual(pick([e('2026-10-21T00:00:00.000Z', 'Economy'), e('2026-10-20T00:00:00.000Z', 'Health')]), ['2026-10-21T00:00:00.000Z', 'Economy']);
});

test('line, lineWeek and lineReason: the reading, or null with "no reading yet" (no fallback text)', () => {
  const read = storyStamp({...base, reading: line});
  assert.deepEqual([read.line, read.lineWeek, read.lineReason], ['One sentence.', '2026-W43', null]);
  for (const reading of [undefined, {line: null, chapters: [], links: [], week: '2026-W43'}]) {
    const none = storyStamp({...base, reading, analysis: analysis({storyArc: 'An arc that must not become the line.', riskScore: 40})});
    assert.deepEqual([none.line, none.lineWeek, none.lineReason], [null, null, 'no reading yet']);
  }
});

test('tier: null with a reason without an analysis or without a score; riskAt only with a score', () => {
  const none = storyStamp(base);
  assert.deepEqual([none.tier, none.riskScore, none.riskAt, none.tierReason], [null, null, null, 'no analysis yet']);
  for (const riskScore of [undefined, null, '', 'abc', NaN]) {
    const s = storyStamp({...base, analysis: analysis({riskScore})});
    assert.deepEqual([s.tier, s.riskScore, s.riskAt, s.tierReason], [null, null, null, 'analysis has no score'], String(riskScore));
  }
  const s = storyStamp({...base, analysis: analysis({riskScore: 61})});
  assert.deepEqual([s.tier, s.riskScore, s.riskAt, s.tierReason], ['elevated', 61, '2026-10-21T05:00:00.000Z', null]);
});

test('tier bands equal tierFromScore (low 0-24, moderate 25-49, elevated 50-74, high 75-100); a numeric string counts', () => {
  const cases = [[0, 'low'], [24, 'low'], [25, 'moderate'], [49, 'moderate'], [50, 'elevated'], [74, 'elevated'], [75, 'high'], [100, 'high'], ['62', 'elevated']];
  for (const [riskScore, tier] of cases) {
    const s = storyStamp({...base, analysis: analysis({riskScore})});
    assert.equal(s.tier, tier, String(riskScore));
    assert.equal(s.tier, tierFromScore(riskScore));
    assert.equal(s.riskScore, Number(riskScore));
  }
});

test('iso3: valid codes plus EUU, de-duplicated, sorted; WLD, LAT, UNK and unknown codes dropped', () => {
  assert.deepEqual(cleanIso3(['WLD', 'FRA', 'EUU', 'LAT', 'UNK', 'FRA', 'XYZ', 'deu', 'DEU', '', null]), ['DEU', 'EUU', 'FRA']);
  assert.deepEqual(cleanIso3(undefined), []);
  assert.deepEqual(storyStamp({...base, iso3: ['WLD', 'UNK']}).iso3, []);
});

test('regions: every region the countries fall in (sorted); EUU is Europe; no country and non-countries give []', () => {
  assert.deepEqual(storyStamp({...base, iso3: ['IRN', 'USA', 'FRA', 'UKR']}).regions, ['Europe', 'Middle East', 'North America']); // a multi-region story counts in each
  assert.deepEqual(storyStamp({...base, iso3: ['EUU']}).regions, ['Europe']);
  assert.deepEqual(storyStamp({...base, iso3: ['WLD', 'LAT']}).regions, []);
  assert.deepEqual(storyStamp({...base, iso3: []}).regions, []);
});

test('every stamp satisfies story-stamp.schema.json', () => {
  for (const s of [storyStamp(base), storyStamp({...base, reading: line, analysis: analysis({riskScore: 80}), iso3: ['IRN', 'EUU']}), storyStamp({threadId: 'x', iso3: []})]) assert.equal(validStamp(s), true, JSON.stringify(validStamp.errors));
  assert.equal(validStamp({...storyStamp(base), tier: 'severe'}), false);
  assert.equal(validStamp({...storyStamp(base), regions: ['Atlantis']}), false);
  assert.equal(storyStamp(base).themeId, null); // the builder sets it once the themes are grouped
  assert.equal(validStamp({...storyStamp(base), themeId: 'theme-t1'}), true);
  assert.equal(validStamp({...storyStamp(base), themeId: 'x'}), false);
  assert.equal(validStamp({...storyStamp(base), themeId: undefined}), false); // required
});

// --- the builder -------------------------------------------------------------------------------------------------------------------
const opts = {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1};
const note = (subtype, kind, id, at, payload, iso3 = []) => ({subtype, subject: {kind, id}, part: '', at, model: 'm', noteId: `${subtype}${id}${at}`, iso3, payload});
const facts = () => [
  ...X.golden(),
  X.entry('thread-w', '2026-10-21T10:00:00.000Z', 'World story', {id: 'ew1', iso3: ['WLD', 'IRN', 'UNK', 'USA', 'EUU']}),
  X.entry('thread-n', '2026-10-21T11:00:00.000Z', 'No country', {id: 'en1'}),
];
const notes = [note('story_analysis', 'story', 'thread-a', '2026-10-21T05:00:00.000Z', {threadTitle: 'Model title', riskScore: 77}),
  note('story_analysis', 'story', 'thread-w', '2026-10-21T05:00:00.000Z', {threadTitle: 'No score here'})];
const readings = [X.reading('2026-W43', 'thread-a', 'line', {text: 'Macron holds'})];
const v = V.buildViews(facts(), {...opts, notes, readings});
const rowOf = (file, id) => file.stories.find((r) => r.threadId === id);
const STAMP = ['threadId', 'title', 'line', 'lineWeek', 'lineReason', 'iso3', 'regions', 'tier', 'riskScore', 'riskAt', 'tierReason', 'lastFactAt', 'born', 'themeId'];
const pickStamp = (o, keys = STAMP) => Object.fromEntries(keys.map((k) => [k, o[k]]));

test('the stamp title is the existing titleOf result, in the story view, both index files and index/web.json', () => {
  for (const [id, story] of v.stories) {
    if (story.aliasOf) continue;
    assert.equal(story.title, V.titleOf(story.entries, opts.today), id); // all entries are within the cap here, so the view's entries are the entries titleOf saw
    assert.equal(rowOf(v.all, id).title, story.title);
  }
  assert.equal(v.stories.get('thread-a').title, 'A second');
  assert.equal(v.indexes['analyses.json'].analyses['thread-a'].title, 'A second');
  assert.equal(v.indexes['analyses.json'].analyses['thread-a'].threadTitle, 'Model title'); // the model's wording stays beside it
});

test('the same stamp is in the story view (without line), the rows of all.json and active.json and index/analyses.json', () => {
  for (const id of ['thread-a', 'thread-w', 'thread-n', 'thread-b']) {
    const row = pickStamp(rowOf(v.all, id));
    assert.deepEqual(pickStamp(v.stories.get(id), STAMP.filter((k) => k !== 'line')), pickStamp(row, STAMP.filter((k) => k !== 'line')), id);
    assert.deepEqual(pickStamp(rowOf(v.active, id)), row, id);
    const a = v.indexes['analyses.json'].analyses[id];
    if (a) assert.deepEqual(pickStamp(a), row, id);
    assert.equal(v.indexes['web.json'].threads[id] === undefined || v.indexes['web.json'].threads[id].tier === row.tier, true);
  }
  assert.equal(typeof v.stories.get('thread-a').line, 'object'); // the story view keeps its reading object
  assert.deepEqual(v.stories.get('thread-a').line.text, rowOf(v.all, 'thread-a').line);
});

test('rows: reading, analysis score and countries come through; cleaned iso3 and regions of a multi-region story', () => {
  const a = rowOf(v.all, 'thread-a');
  assert.deepEqual(pickStamp(a, ['line', 'lineWeek', 'lineReason', 'tier', 'riskScore', 'riskAt', 'tierReason', 'regions', 'iso3']),
    {line: 'Macron holds', lineWeek: '2026-W43', lineReason: null, tier: 'high', riskScore: 77, riskAt: v.indexes['analyses.json'].analyses['thread-a'].generatedAt, tierReason: null, regions: ['Europe'], iso3: ['DEU', 'FRA']});
  const w = rowOf(v.all, 'thread-w');
  assert.deepEqual(pickStamp(w, ['iso3', 'regions', 'tier', 'tierReason', 'line', 'lineReason']), {iso3: ['EUU', 'IRN', 'USA'], regions: ['Europe', 'Middle East', 'North America'], tier: null, tierReason: 'analysis has no score', line: null, lineReason: 'no reading yet'});
  const n = rowOf(v.all, 'thread-n');
  assert.deepEqual(pickStamp(n, ['iso3', 'regions', 'tierReason']), {iso3: [], regions: [], tierReason: 'no analysis yet'});
});

test('an alias row is stamped like any row and keeps aliasOf; the alias story view stays a stub', () => {
  const c = rowOf(v.all, 'thread-c');
  assert.equal(c.aliasOf, 'thread-b');
  assert.deepEqual(pickStamp(c, ['title', 'iso3', 'regions', 'tier', 'tierReason', 'lineReason']), {title: 'C first', iso3: [], regions: [], tier: null, tierReason: 'no analysis yet', lineReason: 'no reading yet'});
  assert.deepEqual(Object.keys(v.stories.get('thread-c')).sort(), ['aliasOf', 'builtFrom', 'schemaVersion', 'threadId']);
});

test('link grounds use the cleaned codes: WLD is never a shared country ground', () => {
  const raw = [...X.golden(), X.entry('thread-x', '2026-10-21T10:00:00.000Z', 'X', {id: 'ex1', iso3: ['WLD']}), X.entry('thread-y', '2026-10-21T11:00:00.000Z', 'Y', {id: 'ey1', iso3: ['WLD']}),
    ...Array.from({length: 40}, (_, i) => X.entry(`pad-${i}`, '2026-10-21T12:00:00.000Z', `P${i}`, {id: `ep${i}`, sources: [`p${i}`]}))];
  const w = V.buildViews(raw, opts);
  assert.deepEqual(w.links.get('thread-x').links, []);
  assert.deepEqual(rowOf(w.all, 'thread-x').iso3, []);
});

test('index/web.json: a thread keeps its own iso3 (top places) beside the stamp; a thread the record has no row for still carries the fields, null with reasons', () => {
  const w = V.buildViews(facts(), {...opts, notes: [...notes, note('web', 'country', 'FRA', '2026-10-21T05:00:00.000Z', {country: 'France', nodes: [{threadId: 'thread-a', summary: 'A sum'}, {threadId: 'thread-ghost', summary: 'Ghost summary'}], backbone: []})]}).indexes['web.json'];
  assert.deepEqual(w.threads['thread-a'].iso3, ['FRA', 'DEU']);
  assert.deepEqual(w.threads['thread-a'].regions, ['Europe']);
  const g = w.threads['thread-ghost'];
  assert.deepEqual(pickStamp(g, ['threadId', 'title', 'regions', 'tier', 'tierReason', 'lineReason', 'born', 'lastFactAt']), {threadId: 'thread-ghost', title: 'Ghost summary', regions: [], tier: null, tierReason: 'no analysis yet', lineReason: 'no reading yet', born: null, lastFactAt: null});
});

test('the built views with a stamp satisfy the schemas that reference story-stamp.schema.json', () => {
  const load = (n) => JSON.parse(readFileSync(resolve(__dirname, '../schema/views', n), 'utf8'));
  const checker = new Ajv({allErrors: true, strict: false});
  checker.addSchema(stampSchema);
  const ok = (name, obj) => { const check = checker.compile(load(`${name}.schema.json`)); assert.equal(check(obj), true, `${name}: ${JSON.stringify(check.errors)}`); };
  for (const s of v.stories.values()) ok('story', s);
  ok('index', v.active);
  ok('index', v.all);
  ok('analyses-index', v.indexes['analyses.json']);
  ok('web-index', v.indexes['web.json']);
});
