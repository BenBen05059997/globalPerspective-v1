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
const pinsOf = (n) => Array.from({ length: n }, (_, i) => ({ pinId: `p${i}`, kind: 'thread', refId: `t-${i}`, addedAt: '2026-10-20T08:00:00.000Z' }));
test('more than 40 pins is rejected (12 live + retired headroom; the live budget is checked in code)', () => {
  const base = load('examples/valid-board.json');
  assert.equal(validate({ ...base, pins: pinsOf(40), strings: [] }), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...base, pins: pinsOf(41), strings: [] }), false);
  assert.ok(validate.errors.some((e) => e.keyword === 'maxItems'));
});
test('a retired pin carries retiredAt; list sizes are capped', () => {
  const base = load('examples/valid-board.json');
  assert.equal(validate({ ...base, pins: [{ ...pinsOf(1)[0], retiredAt: '2026-10-21T08:00:00.000Z' }], strings: [] }), true);
  assert.equal(validate({ ...base, pins: [{ ...pinsOf(1)[0], retiredAt: 'soon' }], strings: [] }), false);
  assert.equal(validate({ ...base, dismissed: Array.from({ length: 501 }, (_, i) => `t${i}`) }), false);
  assert.equal(validate({ ...base, summary: { versions: Array.from({ length: 61 }, () => ({ text: 'x', writtenAt: '2026-10-20T09:00:00.000Z' })) } }), false);
  assert.equal(validate({ ...base, weights: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`f${i}`, {}])) }), false);
});
test('unknown string owner is rejected', () => {
  assert.equal(validate(load('examples/invalid-unknown-owner.json')), false);
  assert.ok(validate.errors.some((e) => e.keyword === 'enum'));
});
test('extra property is rejected', () => {
  assert.equal(validate({ ...load('examples/valid-board.json'), extra: 1 }), false);
});
