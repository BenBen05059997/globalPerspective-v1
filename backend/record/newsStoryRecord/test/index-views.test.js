'use strict';
// The many-at-once indexes (indexViews.js): analyses.json, web.json, countries.json. Built from notes by buildViews.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, writeFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const V = require('../src/views');
const IV = require('../src/indexViews');
const X = require('./views-fixture');

const opts = {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1};
const JSONIFY = (x) => JSON.parse(JSON.stringify(x));
const note = (subtype, kind, id, part, at, payload) => ({subtype, subject: {kind, id}, part, at, model: 'deepseek-v4-pro', noteId: `${subtype}${id}${part}${at}`, iso3: [], payload});
const T1 = '2026-10-21T05:00:00.000Z';
const T2 = '2026-10-21T05:00:10.000Z';

// thread-a and thread-b are in a France web (a judged link both ways, a shared-actor edge); thread-c is a node of a Germany web with no edge
const notes = () => [
  note('story_analysis', 'story', 'thread-a', '', '2026-10-20T04:00:00.000Z', {threadTitle: 'Old title', storyArc: 'old'}),
  note('story_analysis', 'story', 'thread-a', '', T1, {threadTitle: 'A title', storyArc: 'A arc', watchQuestions: ['Q1?'], dimensions: {conflict: {score: 60, why: 'w'}}, riskScore: 60, trajectory: 'long text', rootCauseChain: {a: 1}, entryShortTitles: [{topicId: 't', shortTitle: 's'}], keyActors: ['x']}),
  note('drift', 'story', 'thread-a', '', T2, {whatChanged: 'x'}),
  note('story_analysis', 'story', 'thread-b', '', T1, {threadTitle: 'B title'}),
  note('web', 'country', 'FRA', '', T1, {country: 'France', nodes: [{threadId: 'thread-a', summary: 'A sum'}, {threadId: 'thread-b'}], backbone: [{from: 'thread-b', to: 'thread-a', sharedActors: ['Macron'], weight: 1}]}),
  note('link', 'pair', 'thread-a__thread-b', 'FRA', T1, {from: 'thread-a', to: 'thread-b', country: 'France', confidence: 'strong', lagDays: 2, mechanism: 'forward', cited: [{topicId: 't', date: '2026-10-20', title: 'T'}], reverse: {confidence: 'weak', mechanism: 'back', lagDays: 1, cited: []}}),
  note('web', 'country', 'DEU', '', T1, {country: 'Germany', nodes: [{threadId: 'thread-c'}], backbone: []}),
  note('country', 'country', 'UKR', '', T1, {countryName: 'Ukraine', riskScore: 61, riskLevel: 'elevated', headline: 'H', trajectory: 'stable', dimensions: {conflict: {score: 61, why: 'w'}}, riskSignals: ['s1', 's2'], keyActors: ['big'], bluf: 'long'}),
  note('country', 'country', 'UKR', 'systems', T1, {nodes: []}),
  note('drift', 'country', 'UKR', '', T2, {countryName: 'Ukraine', whyChanged: 'x'}),
  note('country', 'country', 'POL', '', T1, {countryName: 'Poland'}), // no generatedAt would be a malformed note; asStored always adds it, so this one is kept with its fields
];
const build = (n = notes(), o = {}) => V.buildViews(X.golden(), {...opts, ...o, notes: n});

test('analyses index: the read fields of every story with an analysis (latest note), never the drift note or the long texts', () => {
  const idx = build().indexes['analyses.json'];
  assert.deepEqual(Object.keys(idx.analyses), ['thread-a', 'thread-b']);
  assert.deepEqual(idx.analyses['thread-a'], {threadId: 'thread-a', threadTitle: 'A title', storyArc: 'A arc', watchQuestions: ['Q1?'], dimensions: {conflict: {score: 60, why: 'w'}}, riskScore: 60, generatedAt: T1});
  assert.equal(JSON.stringify(idx).includes('driftNote'), false);
  assert.deepEqual(build([]).indexes['analyses.json'].analyses, {});
});

test('analyses index equals the story views: each entry is the story view analysis cut to the read fields', () => {
  const v = build();
  for (const [id, a] of Object.entries(v.indexes['analyses.json'].analyses)) {
    const full = v.stories.get(id).analysis;
    for (const k of IV.ANALYSIS_FIELDS) assert.deepEqual(a[k], full[k], `${id}.${k}`);
  }
});

test('web index: links once per direction, shared once per pair, threads with state/title/places, webs used, newest web as generatedAt', () => {
  const w = build().indexes['web.json'];
  assert.deepEqual(w.links.map((l) => [l.from, l.to, l.confidence, l.mechanism, l.country, l.generatedAt]), [
    ['thread-a', 'thread-b', 'strong', 'forward', 'France', T1], ['thread-b', 'thread-a', 'weak', 'back', 'France', T1]]);
  assert.deepEqual(w.links[0].cited, [{topicId: 't', date: '2026-10-20', title: 'T'}]);
  assert.deepEqual(w.shared.map((s) => [s.a, s.b, s.actors, s.weight, s.country]), [['thread-a', 'thread-b', ['Macron'], 1, 'France']]);
  assert.deepEqual(w.websUsed, [{country: 'Germany', generatedAt: T1, nodes: 1}, {country: 'France', generatedAt: T1, nodes: 2}]); // by ISO3 (DEU, FRA)
  assert.equal(w.generatedAt, T1);
  assert.equal(w.maxAgeDays, 30);
  assert.deepEqual(w.threads['thread-a'], {state: 'linked', title: 'A second', entries: 2, places: [{name: 'France', n: 2}, {name: 'Germany', n: 1}], analysedIn: [{country: 'France', generatedAt: T1}], iso3: ['FRA', 'DEU']});
  assert.equal(w.threads['thread-c'].state, 'analysed_no_links');
  assert.equal(w.threads['thread-old'], undefined); // no recent entry, in no web: not in the index
});

test('web index is the links views: every judged link and backbone row of every story is in it (one implementation)', () => {
  const v = build();
  const w = v.indexes['web.json'];
  for (const [id, view] of v.links) {
    for (const r of view.judgedLinks) assert.ok(w.links.some((l) => l.from === r.from && l.to === r.to && l.country === r.country && l.mechanism === r.mechanism), `${id}: ${r.from}>${r.to}`);
    for (const b of view.web.backbone) assert.ok(w.shared.some((s) => [s.a, s.b].sort().join() === [id, b.otherThreadId].sort().join() && s.country === b.country && s.weight === b.weight));
    if (view.web.state !== null) assert.equal(w.threads[id].state, view.web.state);
    else assert.equal(id in w.threads, false);
  }
});

test('countries index: the briefing fields and the first risk signal only; no drift, no systems, no long texts', () => {
  const c = build().indexes['countries.json'].countries;
  assert.deepEqual(Object.keys(c), ['POL', 'UKR']);
  assert.deepEqual(c.UKR, {countryName: 'Ukraine', riskScore: 61, riskLevel: 'elevated', dimensions: {conflict: {score: 61, why: 'w'}}, headline: 'H', trajectory: 'stable', riskSignals: ['s1'], generatedAt: T1});
  const text = JSON.stringify(c);
  for (const banned of ['whyChanged', 'bluf', 'keyActors', 'nodes', 'drift']) assert.equal(text.includes(banned), false, banned);
  assert.deepEqual(build([]).indexes['countries.json'].countries, {});
});

test('no notes: every index is empty but valid; the write groups carry them beside index/active.json', () => {
  const v = build([]);
  assert.deepEqual(Object.keys(v.indexes).sort(), ['analyses.json', 'countries.json', 'web.json']);
  assert.deepEqual([v.indexes['web.json'].links, v.indexes['web.json'].shared, v.indexes['web.json'].websUsed, v.indexes['web.json'].generatedAt], [[], [], [], null]);
  const keys = V.writeGroups(build()).map((g) => g.map(([k]) => k));
  assert.deepEqual(keys[1].sort(), ['index/active.json', 'index/analyses.json', 'index/countries.json', 'index/web.json']);
  assert.deepEqual(keys.slice(3), [['track-record.json'], ['manifest.json']]);
});

test('an index over its cap fails the build instead of truncating', () => {
  const big = [note('story_analysis', 'story', 'thread-a', '', T1, {storyArc: 'x'.repeat(IV.INDEX_MAX_BYTES)})];
  assert.throws(() => build(big), /index\/analyses\.json is \d+ bytes, over the/);
});

test('every index carries schemaVersion 1 and builtFrom; the same notes in another order build the same indexes', () => {
  const a = build();
  for (const o of Object.values(a.indexes)) assert.deepEqual([o.schemaVersion, o.builtFrom], [1, {factsThrough: '2026-10-22', readingsThrough: null}]);
  assert.deepEqual(JSONIFY(build(notes().reverse()).indexes), JSONIFY(a.indexes));
});

test('golden: the indexes of the notes fixture are exactly the reviewed JSON, and satisfy their schemas', () => {
  const actual = JSONIFY(build().indexes);
  const file = resolve(__dirname, 'golden/indexviews.golden.json');
  if (process.env.UPDATE_GOLDEN) writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
  assert.deepEqual(actual, JSON.parse(readFileSync(file, 'utf8')));
  const ajv = new Ajv({allErrors: true, strict: false});
  const load = (n) => JSON.parse(readFileSync(resolve(__dirname, '../schema/views', n), 'utf8'));
  for (const [name, schema] of [['analyses.json', 'analyses-index'], ['web.json', 'web-index'], ['countries.json', 'countries-index']]) {
    const validate = ajv.compile(load(`${schema}.schema.json`));
    assert.equal(validate(actual[name]), true, `${name}: ${JSON.stringify(validate.errors)}`);
    assert.deepEqual(load(`examples/${schema}.json`), actual[name]); // the example is the golden
  }
});
