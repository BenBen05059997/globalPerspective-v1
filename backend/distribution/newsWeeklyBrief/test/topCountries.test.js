'use strict';
const test = require('node:test');
const assert = require('node:assert');
process.env.TOPICS_DDB_TABLE = 'T'; process.env.SUMMARIZE_PREDICT_TABLE = 'T';
const Module = require('node:module');
function loadWithStub(file, rows) {
  const orig = Module._load;
  Module._load = function (req, ...r) {
    if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: (t, k) => {
      if (k === 'DynamoDBDocumentClient') return { from: () => ({ send: async (c) => ({ Item: rows[c.input.Key.PK] }) }) };
      return class { constructor(i) { this.input = i; } };
    } });
    return orig.call(this, req, ...r);
  };
  try { return require(file); } finally { Module._load = orig; }
}
const { topCountries } = loadWithStub('../src/index.js', {});

test('aggregates do not take the top-N slots of the weekly brief', () => {
  const e = (regions) => ({ regions });
  const entries = [e(['Middle East', 'Iran']), e(['Middle East', 'Israel']), e(['Middle East']), e(['Europe', 'France']), e(['Europe']), e(['Iran'])];
  assert.deepStrictEqual(topCountries(entries, 3), ['Iran', 'Israel', 'France']);
});
