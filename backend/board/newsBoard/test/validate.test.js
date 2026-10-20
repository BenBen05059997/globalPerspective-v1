'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateBoard } = require('../src/validate');

const examples = path.join(__dirname, '../../schema/examples');
const schemaPath = path.join(__dirname, '../../schema/board.schema.json');
const load = (f) => JSON.parse(fs.readFileSync(path.join(examples, f), 'utf8'));

// ajv is the frontend's (the board schema test borrows it too); skipped when its node_modules are not installed.
let ajvValidate = null;
try {
  const req = require('module').createRequire(path.join(__dirname, '../../../../global-perspectives-starter/frontend/package.json'));
  const Ajv = req('ajv');
  const addFormats = (() => { try { return req('ajv-formats'); } catch { return null; } })();
  const ajv = new Ajv({ allErrors: true, strict: false });
  if (addFormats) addFormats(ajv);
  ajvValidate = ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
} catch { /* no ajv here */ }

test('the Lambda reads the one schema file (symlink)', () => {
  assert.equal(fs.realpathSync(path.join(__dirname, '../src/board.schema.json')), fs.realpathSync(schemaPath));
});

for (const f of fs.readdirSync(examples).filter((n) => n.endsWith('.json'))) {
  test(`example ${f}: validator agrees with the schema (${f.startsWith('valid') ? 'valid' : 'invalid'})`, () => {
    const board = load(f);
    assert.equal(validateBoard(board).ok, f.startsWith('valid'), JSON.stringify(validateBoard(board).errors));
    if (ajvValidate) assert.equal(validateBoard(board).ok, ajvValidate(board));
  });
}

test('mutations: validator and ajv reject the same things', (t) => {
  if (!ajvValidate) return t.skip('frontend ajv not installed');
  const base = load('valid-board.json');
  const mutate = (fn) => { const b = JSON.parse(JSON.stringify(base)); fn(b); return b; };
  const cases = {
    missingUid: mutate((b) => { delete b.uid; }),
    extraTop: mutate((b) => { b.x = 1; }),
    extraPin: mutate((b) => { b.pins[0].x = 1; }),
    badKind: mutate((b) => { b.pins[0].kind = 'planet'; }),
    emptyName: mutate((b) => { b.name = ''; }),
    longName: mutate((b) => { b.name = 'x'.repeat(81); }),
    pinsNotArray: mutate((b) => { b.pins = {}; }),
    badOwner: mutate((b) => { b.strings[0].owner = 'theirs'; }),
    badStrength: mutate((b) => { b.strings[0].strength = 'huge'; }),
    longLine: mutate((b) => { b.strings[1].line = 'x'.repeat(281); }),
    weightHigh: mutate((b) => { b.weights['fork-hormuz-1']['branch-open'] = 1.5; }),
    weightNotNumber: mutate((b) => { b.weights['fork-hormuz-1']['branch-open'] = '0.5'; }),
    badDate: mutate((b) => { b.updatedAt = 'yesterday'; }),
    summaryExtra: mutate((b) => { b.summary.extra = true; }),
    versionMissing: mutate((b) => { delete b.summary.versions[0].writtenAt; }),
    dismissedEmptyString: mutate((b) => { b.dismissed = ['']; }),
    ok: mutate(() => {}),
  };
  for (const [name, board] of Object.entries(cases)) assert.equal(validateBoard(board).ok, ajvValidate(board), name);
});

test('errors name the path', () => {
  const b = load('valid-board.json');
  b.pins[1].kind = 'x';
  assert.match(validateBoard(b).errors.join(' '), /pins\[1\]\.kind/);
});
