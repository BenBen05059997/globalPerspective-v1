// Validates the weekly schema against its examples, and ties its item caps to sections.js.
// Run: node --test backend/weekly/test/schema.test.mjs   (or: node --test backend/weekly/test/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const schemaDir = path.join(here, '../schema');
// ajv is not a dependency of backend/; borrow the frontend's copy.
const require = createRequire(path.join(root, 'global-perspectives-starter/frontend/package.json'));
const Ajv = require('ajv');
const { SECTIONS } = createRequire(import.meta.url)('../sections.js');

const load = (p) => JSON.parse(readFileSync(path.join(schemaDir, p), 'utf8'));
const schema = load('weekly.schema.json');
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const valid = () => load('examples/valid-2026-10-18.json');
// The frontend's ajv is v6 (dataPath ".a[0].b"); normalise to the v8 form ("/a/0/b").
const pathOf = (e) => e.instancePath ?? e.dataPath.replace(/\[(\d+)\]/g, '/$1').replace(/\.(\w+)/g, '/$1');
const errorsOf = (o) => (validate(o) ? [] : validate.errors.map((e) => ({ keyword: e.keyword, instancePath: pathOf(e) })));

test('valid example passes', () => {
  assert.equal(validate(valid()), true, JSON.stringify(validate.errors));
});

test('a fact without sources is rejected', () => {
  const e = errorsOf(load('examples/invalid-fact-without-sources.json'));
  assert.ok(e.some((x) => x.keyword === 'minItems' && x.instancePath === '/lead/happened/sources'), JSON.stringify(e));
});

test('a first read with confidence medium is rejected', () => {
  const e = errorsOf(load('examples/invalid-first-read-medium.json'));
  assert.ok(e.some((x) => x.keyword === 'enum' && x.instancePath === '/new/0/firstRead/confidence'), JSON.stringify(e));
});

test('four new items are rejected', () => {
  const e = errorsOf(load('examples/invalid-4-new-items.json'));
  assert.ok(e.some((x) => x.keyword === 'maxItems' && x.instancePath === '/new'), JSON.stringify(e));
});

test('an unknown branch status is rejected', () => {
  const e = errorsOf(load('examples/invalid-unknown-status.json'));
  assert.ok(e.some((x) => x.keyword === 'enum' && x.instancePath === '/trace/0/branches/0/status'), JSON.stringify(e));
});

test('an extra property and an unknown file status are rejected', () => {
  assert.equal(validate({ ...valid(), extra: 1 }), false);
  assert.equal(validate({ ...valid(), status: 'sent' }), false);
});

test('empty optional sections are valid; a missing section is not', () => {
  assert.equal(validate({ ...valid(), moved: [], trace: [], dates: [], new: [] }), true, JSON.stringify(validate.errors));
  const { trace, ...rest } = valid();
  assert.equal(validate(rest), false);
});

test('schema item caps equal the max values in sections.js', () => {
  for (const s of SECTIONS) {
    const prop = schema.properties[s.key];
    assert.ok(prop, `${s.key} is missing from the schema`);
    assert.equal(prop.maxItems ?? null, s.single ? null : s.max, `${s.key} maxItems`);
    assert.equal(prop.type === 'array', !s.single, `${s.key} single/list`);
  }
  assert.deepEqual(SECTIONS.map((s) => s.key), Object.keys(schema.properties).filter((k) => SECTIONS.some((s) => s.key === k)));
});
