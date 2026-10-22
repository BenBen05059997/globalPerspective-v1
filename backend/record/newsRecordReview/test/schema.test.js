'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, readdirSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const load = (...p) => JSON.parse(readFileSync(resolve(__dirname, '../schema', ...p), 'utf8'));
const ajv = new Ajv({allErrors: true, strict: false});
const validReading = ajv.compile(load('reading.schema.json'));
const validRun = ajv.compile(load('review-run.schema.json'));

test('the examples are valid', () => {
  assert.equal(validReading(load('examples', 'reading.json')), true, JSON.stringify(validReading.errors));
  assert.equal(validRun(load('examples', 'review-run.json')), true, JSON.stringify(validRun.errors));
});

test('every example file is covered', () => {
  assert.deepEqual(readdirSync(resolve(__dirname, '../schema/examples')).sort(), ['model-output.json', 'reading.json', 'review-run.json']);
});

test('the reading schema rejects what the spec forbids', () => {
  const r = load('examples', 'reading.json');
  const bad = [
    {...r, schemaVersion: 2}, {...r, subtype: 'summary'}, {...r, cites: []}, {...r, confidence: 'certain'}, {...r, readingId: 'abc'}, {...r, supersedes: undefined},
    {...r, subtype: 'line', payload: {text: 'x'.repeat(201)}},
    {...r, subtype: 'branch_status', payload: {branchId: 'b', status: 'resurrected', why: 'x'}},
    {...r, subtype: 'alias', payload: {variants: ['name:a'], canonical: 'name:b', wikidataId: 'not-a-q'}},
    {...r, subtype: 'link', payload: {otherThreadId: 't', mechanism: 'm', direction: 'causes'}},
  ];
  bad.forEach((b, i) => assert.equal(validReading(b), false, `case ${i}`));
  assert.equal(validRun({...load('examples', 'review-run.json'), status: 'done'}), false);
});
