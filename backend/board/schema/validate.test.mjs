// Validates the board schema against its examples. Run: node --test backend/board/schema/validate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
// ajv is not a dependency of backend/; borrow the frontend's copy.
const require = createRequire(path.join(root, 'global-perspectives-starter/frontend/package.json'));
const Ajv = require('ajv');
const addFormats = (() => { try { return require('ajv-formats'); } catch { return null; } })();

const load = (p) => JSON.parse(readFileSync(path.join(here, p), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
if (addFormats) addFormats(ajv);
const validate = ajv.compile(load('board.schema.json'));

test('valid example passes', () => {
  assert.equal(validate(load('examples/valid-board.json')), true, JSON.stringify(validate.errors));
});
test('13 pins is rejected (budget 12)', () => {
  assert.equal(validate(load('examples/invalid-13-pins.json')), false);
  assert.ok(validate.errors.some((e) => e.keyword === 'maxItems'));
});
test('unknown string owner is rejected', () => {
  assert.equal(validate(load('examples/invalid-unknown-owner.json')), false);
  assert.ok(validate.errors.some((e) => e.keyword === 'enum'));
});
test('extra property is rejected', () => {
  assert.equal(validate({ ...load('examples/valid-board.json'), extra: 1 }), false);
});
