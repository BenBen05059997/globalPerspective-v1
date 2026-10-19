'use strict';
// The S3 client is not tested; only the pure key builder is. @aws-sdk is stubbed so index.js loads without node_modules.
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.TOPICS_DDB_TABLE = 'T'; process.env.SUMMARIZE_PREDICT_TABLE = 'T'; process.env.XAI_API_KEY = 'x';
const Module = require('node:module');
const orig = Module._load;
Module._load = function (req, ...r) {
  if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: (t, k) => (k === 'DynamoDBDocumentClient' ? { from: () => ({}) } : class {}) });
  return orig.call(this, req, ...r);
};
let webHistoryKey;
try { ({ webHistoryKey } = require('../src/index.js')); } finally { Module._load = orig; }

test('webHistoryKey is the UTC date as web/YYYY/MM/DD.json', () => {
  assert.equal(webHistoryKey(new Date('2026-10-20T05:00:00Z')), 'web/2026/10/20.json');
});
test('webHistoryKey pads month and day', () => {
  assert.equal(webHistoryKey(new Date('2026-01-05T00:00:00Z')), 'web/2026/01/05.json');
});
test('webHistoryKey uses UTC, not local time', () => {
  assert.equal(webHistoryKey(new Date('2026-12-31T23:59:59Z')), 'web/2026/12/31.json');
});
