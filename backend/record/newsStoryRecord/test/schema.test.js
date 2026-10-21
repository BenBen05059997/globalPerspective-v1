'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, readdirSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
// The frontend's Ajv; an isolated worktree points FRONTEND_NODE_MODULES at the main checkout's node_modules.
const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const load = (...p) => JSON.parse(readFileSync(resolve(__dirname, '../schema', ...p), 'utf8'));
const ajv = new Ajv({allErrors: true, strict: false});
const validFact = ajv.compile(load('fact.schema.json'));
const validRun = ajv.compile(load('run.schema.json'));

const facts = {entry: 'entry', story_born: 'story_born', forecast_drawn: 'forecast_drawn', verdict: 'verdict', correction: 'correction', story_merged: 'story_merged', run: 'run-fact'};
for (const [kind, file] of Object.entries(facts)) {
  test(`example ${file}.json is a valid ${kind} fact`, () => {
    const example = load('examples', `${file}.json`);
    assert.equal(example.kind, kind);
    assert.equal(validFact(example), true, JSON.stringify(validFact.errors));
  });
}
for (const file of ['run', 'run-missing-day']) {
  test(`example ${file}.json is a valid Run`, () => assert.equal(validRun(load('examples', `${file}.json`)), true, JSON.stringify(validRun.errors)));
}
test('every example file is covered above', () => {
  assert.deepEqual(readdirSync(resolve(__dirname, '../schema/examples')).sort(), [...Object.values(facts), 'run', 'run-missing-day'].map((n) => `${n}.json`).sort());
});
test('the schema rejects what 0036 forbids', () => {
  const entry = load('examples', 'entry.json');
  for (const bad of [{...entry, schemaVersion: 2}, {...entry, precision: 'hour'}, {...entry, kind: 'chapter'}, {...entry, idBasis: undefined}, {...entry, producer: {lambda: 'x', runId: 'r'}},
    {...load('examples', 'verdict.json'), payload: {...load('examples', 'verdict.json').payload, result: 'not_yet'}}, {...load('examples', 'run-fact.json'), threadId: 'thread-x'}]) {
    assert.equal(validFact(bad), false, JSON.stringify(bad).slice(0, 80));
  }
  assert.equal(validRun({...load('examples', 'run.json'), status: 'done'}), false);
  assert.equal(validRun({...load('examples', 'run.json'), inputs: {archiveDay: {thin: -1}, todayArchive: 'missing'}}), false);
});
