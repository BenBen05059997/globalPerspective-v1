'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { escapeHtml } = require('../src/escapeHtml');

test('escapes & < > " and leaves the apostrophe alone', () => {
  assert.strictEqual(escapeHtml(`<a href="x">Tom & Jerry's</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry\'s&lt;/a&gt;');
});
test('the ampersand goes first: an existing entity is escaped, not left as markup', () => {
  assert.strictEqual(escapeHtml('&lt;'), '&amp;lt;');
});
test('null and undefined are empty; other values are stringified (0 and false stay visible)', () => {
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
  assert.strictEqual(escapeHtml(0), '0');
  assert.strictEqual(escapeHtml(false), 'false');
  assert.strictEqual(escapeHtml(['a<', 'b']), 'a&lt;,b');
});
test('equals the copies the alert and digest renderers carried, for every 3-character string of a markup-heavy alphabet', () => {
  const old = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const alphabet = ['&', '<', '>', '"', "'", ' ', 'a', '\n', 'é', '\u{1F600}'];
  for (const a of alphabet) for (const b of alphabet) for (const c of alphabet) assert.strictEqual(escapeHtml(a + b + c), old(a + b + c));
});
