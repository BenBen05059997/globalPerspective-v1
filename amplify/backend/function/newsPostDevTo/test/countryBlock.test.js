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
const iso = (d) => new Date(Date.now() - d * 864e5).toISOString();
const rows = { 'COUNTRY#Iran': { riskLevel: 'high', generatedAt: iso(2) }, 'COUNTRY#Middle East': { riskLevel: 'high', generatedAt: iso(2) }, 'COUNTRY#Cuba': { riskLevel: 'high', generatedAt: iso(45) } };
const { loadCountryIntelligence } = loadWithStub('../src/index.js', rows);

test('the daily brief country block ignores region keys and records older than 30 days', async () => {
  const intel = await loadCountryIntelligence([{ regions: ['Iran', 'Middle East', 'Cuba'] }]);
  assert.deepStrictEqual(Object.keys(intel), ['Iran']);
});
