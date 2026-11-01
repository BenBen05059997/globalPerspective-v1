'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { CATEGORY_LABEL } = require('../src/categoryLabels');

test('the twelve categories, in the order the digest, the posts and the RSS feed always had, each a capitalised key', () => {
  assert.deepStrictEqual(Object.keys(CATEGORY_LABEL), ['politics', 'economy', 'military', 'conflict', 'disaster', 'technology', 'health', 'business', 'society', 'energy', 'climate', 'science']);
  for (const [k, v] of Object.entries(CATEGORY_LABEL)) assert.strictEqual(v, k[0].toUpperCase() + k.slice(1));
});
test('an unknown or differently-cased category has no label here (each caller keeps its own fallback)', () => {
  assert.strictEqual(CATEGORY_LABEL.Politics, undefined);
  assert.strictEqual(CATEGORY_LABEL.other, undefined);
  assert.strictEqual(CATEGORY_LABEL[''], undefined);
});
