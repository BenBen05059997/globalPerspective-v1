'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, readdirSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const dir = resolve(__dirname, '../schema/views');
const load = (...p) => JSON.parse(readFileSync(resolve(dir, ...p), 'utf8'));
const ajv = new Ajv({allErrors: true, strict: false});
const validate = Object.fromEntries(['story', 'index', 'links', 'counts', 'manifest'].map((n) => [n, ajv.compile(load(`${n}.schema.json`))]));
const examples = {story: ['story', 'story-alias', 'story-read'], index: ['index-active', 'index-all'], links: ['links', 'links-confirmed'], counts: ['counts'], manifest: ['manifest']};

for (const [type, files] of Object.entries(examples)) {
  for (const file of files) {
    test(`example ${file}.json is a valid ${type} view`, () => assert.equal(validate[type](load('examples', `${file}.json`)), true, JSON.stringify(validate[type].errors)));
  }
}
test('every view example file is covered above', () => {
  assert.deepEqual(readdirSync(resolve(dir, 'examples')).sort(), Object.values(examples).flat().map((n) => `${n}.json`).sort());
});
test('the built golden views satisfy the schemas', () => {
  const g = JSON.parse(readFileSync(resolve(__dirname, 'golden/views.golden.json'), 'utf8'));
  for (const s of Object.values(g.stories)) assert.equal(validate.story(s), true, JSON.stringify(validate.story.errors));
  for (const s of Object.values(g.links)) assert.equal(validate.links(s), true, JSON.stringify(validate.links.errors));
  for (const s of Object.values(g.counts)) assert.equal(validate.counts(s), true, JSON.stringify(validate.counts.errors));
  for (const s of [g.active, g.all]) assert.equal(validate.index(s), true, JSON.stringify(validate.index.errors));
});
test('built views with readings satisfy the schemas', () => {
  const X = require('./views-fixture');
  const V = require('../src/views');
  const c = ['3'.repeat(40)];
  const readings = [X.reading('2026-W43', 'thread-a', 'line', {text: 'A line'}, {cites: c}), X.reading('2026-W43', 'thread-a', 'chapter', {title: 'T', from: '2026-10-18', to: '2026-10-20', summary: 'S'}, {cites: c}),
    X.reading('2026-W43', 'thread-a', 'link', {otherThreadId: 'thread-b', mechanism: 'm', direction: 'drives'}, {cites: c})];
  const f = [...X.golden(), ...Array.from({length: 60}, (_, i) => X.entry(`pad${i}`, '2026-10-20T04:00:00.000Z', 'x', {sources: [`p${i}`]}))];
  const v = V.buildViews(f, {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1, readings});
  assert.equal(validate.story(v.stories.get('thread-a')), true, JSON.stringify(validate.story.errors));
  assert.equal(validate.links(v.links.get('thread-a')), true, JSON.stringify(validate.links.errors));
  assert.equal(v.links.get('thread-a').confirmedLinks.length, 1);
  for (const s of [v.active, v.all]) assert.equal(validate.index(s), true, JSON.stringify(validate.index.errors));
  assert.equal(validate.manifest(v.manifest), true, JSON.stringify(validate.manifest.errors));
  assert.equal(v.manifest.readingsThrough, '2026-W43');
});
test('the schemas reject what 0037 forbids', () => {
  const story = load('examples', 'story.json');
  const links = load('examples', 'links.json');
  for (const bad of [{...story, line: 'a made-up line'}, {...story, chapters: [{x: 1}]}, {...story, reading: {state: 'none', reason: 'oops'}}, {...story, schemaVersion: 2},
    {...story, builtFrom: {factsThrough: '2026-10-20', readingsThrough: '2026-10-18'}}, {...story, line: {text: 'x', week: '2026-W43', cites: []}}, {...story, reading: {state: 'read', reason: 'x'}}, {...story, entries: Array(401).fill(story.entries[0])}]) {
    assert.equal(validate.story(bad), false, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(validate.links({...links, confirmedLinks: [{x: 1}]}), false);
  assert.equal(validate.links({...links, confirmedLinks: [{otherThreadId: 'b', mechanism: 'm', direction: 'sideways', week: '2026-W43', cites: ['c']}]}), false);
  assert.equal(validate.links({...links, links: [{...links.links[0], grounds: 0}]}), false);
  assert.equal(validate.index({...load('examples', 'index-active.json'), stories: [{threadId: 'x'}]}), false);
});
test('Y2: views with a reassigned entry (and an emptied story) satisfy the schemas', () => {
  const X = require('./views-fixture');
  const V = require('../src/views');
  const f = [...X.golden(), X.assignment('ea2', 'thread-b', '2026-10-21T10:00:00.000Z'), X.assignment('eo1', 'thread-a', '2026-10-22T00:00:00.000Z')];
  const v = V.buildViews(f, {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1});
  for (const id of ['thread-a', 'thread-b', 'thread-old']) assert.equal(validate.story(v.stories.get(id)), true, JSON.stringify(validate.story.errors));
  assert.ok(v.stories.get('thread-b').entries.some((e) => e.reassignedFrom === 'thread-a'));
  for (const s of [v.active, v.all]) assert.equal(validate.index(s), true, JSON.stringify(validate.index.errors));
});
test('views with an article placed by an assignment satisfy the schemas', () => {
  const X = require('./views-fixture');
  const V = require('../src/views');
  const art = X.fact('article', null, '2026-10-16T03:00:00.000Z', {id: 'art1', sourceIds: ['s9'], payload: {url: 'https://x.test/1', canonicalUrl: 'https://x.test/1', title: 'T', outlet: null, feed: null, snippet: null, lang: null, recoveredAt: null, recoveredFrom: 'gdelt-gkg'}});
  const v = V.buildViews([...X.golden(), art, X.assignment('art1', 'thread-c', '2026-10-24T00:00:00.000Z')], {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1, countDays: ['2026-10-16']});
  assert.equal(validate.story(v.stories.get('thread-b')), true, JSON.stringify(validate.story.errors));
  assert.equal(v.stories.get('thread-b').entries.some((e) => e.kind === 'article'), true);
  assert.equal(validate.counts(v.counts.get('2026-10-16')), true, JSON.stringify(validate.counts.errors));
  for (const s of [v.active, v.all]) assert.equal(validate.index(s), true, JSON.stringify(validate.index.errors));
});
