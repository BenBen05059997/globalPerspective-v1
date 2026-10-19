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
const rec = (score, ageDays) => ({ riskScore: score, riskLevel: 'high', generatedAt: iso(ageDays), dimensions: { conflict: score, political: score, economic: score, humanitarian: score } });
const rows = { 'COUNTRY#Iran': rec(70, 3), 'COUNTRY#Europe': rec(95, 3), 'COUNTRY#Japan': rec(90, 40) };
const { maxRegionRisk } = loadWithStub('../src/index.js', rows);

test('a region key and a 40-day-old country record are ignored; the fresh real country counts', async () => {
  assert.strictEqual(await maxRegionRisk(['Iran', 'Europe', 'Japan'], 'conflict'), 70);
  assert.strictEqual(await maxRegionRisk(['Europe'], 'conflict'), 0);
  assert.strictEqual(await maxRegionRisk(['Japan'], 'conflict'), 0);
});
