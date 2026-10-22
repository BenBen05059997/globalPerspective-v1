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
const examples = {story: ['story', 'story-alias'], index: ['index-active', 'index-all'], links: ['links'], counts: ['counts'], manifest: ['manifest']};

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
test('the schemas reject what 0037 forbids', () => {
  const story = load('examples', 'story.json');
  const links = load('examples', 'links.json');
  for (const bad of [{...story, line: 'a made-up line'}, {...story, chapters: [{x: 1}]}, {...story, reading: {state: 'none', reason: 'oops'}}, {...story, schemaVersion: 2},
    {...story, builtFrom: {factsThrough: '2026-10-20', readingsThrough: '2026-10-18'}}, {...story, entries: Array(401).fill(story.entries[0])}]) {
    assert.equal(validate.story(bad), false, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(validate.links({...links, confirmedLinks: [{x: 1}]}), false);
  assert.equal(validate.links({...links, links: [{...links.links[0], grounds: 0}]}), false);
  assert.equal(validate.index({...load('examples', 'index-active.json'), stories: [{threadId: 'x'}]}), false);
});
