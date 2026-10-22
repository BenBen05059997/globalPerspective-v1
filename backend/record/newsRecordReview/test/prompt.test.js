'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const {PROMPT_VERSION, MAX_TOKENS, SYSTEM, buildMessages, parseAnswer} = require('../src/prompt');
const {world: mkWorld, P, WEEK} = require('./fixture');
const {loadWorld, assemble} = require('../src/select');

// The frontend's Ajv; an isolated worktree points FRONTEND_NODE_MODULES at the main checkout's node_modules.
const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const ajv = new Ajv({allErrors: true, strict: false});
const load = (...p) => JSON.parse(readFileSync(resolve(__dirname, '../schema', ...p), 'utf8'));

test('the prompt has a version and a token cap, and tells the model to return JSON with the cite rule', () => {
  assert.match(PROMPT_VERSION, /^review-\d+$/);
  assert.ok(MAX_TOKENS > 0 && MAX_TOKENS <= 4000);
  for (const needle of ['JSON', 'eventId', 'fired', 'holding', 'neighbours', 'wikidataId']) assert.ok(SYSTEM.includes(needle), needle);
});

test('buildMessages puts the week and the bundle, with every eventId, in the user message', async () => {
  const w = await loadWorld({store: mkWorld().store, prefix: P, week: WEEK});
  const a = assemble(w, w.rows.find((r) => r.threadId === 'thread-a'));
  const {system, user} = buildMessages(a.bundle);
  assert.equal(system, SYSTEM);
  assert.ok(user.includes('2026-W42') && user.includes('2026-10-12') && user.includes('"a1"') && user.includes('"va1"'));
});

test('parseAnswer strips a code fence, reads {} for an empty answer, and rejects non-objects', () => {
  assert.deepEqual(parseAnswer('```json\n{"line":null}\n```'), {line: null});
  assert.deepEqual(parseAnswer(''), {});
  assert.throws(() => parseAnswer('[1]'), /not a JSON object/);
  assert.throws(() => parseAnswer('not json'));
});

test('the model-output schema accepts the example and rejects shape errors', () => {
  const valid = ajv.compile(load('model-output.schema.json'));
  const ex = load('examples', 'model-output.json');
  assert.equal(valid(ex), true, JSON.stringify(valid.errors));
  assert.equal(valid({...ex, line: {text: 'x'.repeat(201), cites: ['a'], confidence: 'high'}}), false);
  assert.equal(valid({...ex, links: [{...ex.links[0], direction: 'causes'}]}), false);
  assert.equal(valid({...ex, extra: 1}), false);
  assert.equal(valid({}), true);
});
