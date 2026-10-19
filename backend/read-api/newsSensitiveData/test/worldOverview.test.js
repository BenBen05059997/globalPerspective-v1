'use strict';
// Batch 3 / F: world_overview must not serve region SYSTEMS# rows as country situations.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');
process.env.TOPICS_DDB_TABLE = 'T'; process.env.SUMMARIZE_PREDICT_TABLE = 'T';
const node = (i) => ({ threadId: 'th' + i, category: 'politics', peakDate: '2026-09-2' + (i % 9), title: 'x' });
const rows = ['Iran', 'Europe', 'Middle East', 'Japan', 'Asia'].map((n) => ({ countryName: n, nodes: [node(1), node(2)], edges: [], backbone: [], generatedAt: '2026-09-30T00:00:00Z' }));
const orig = Module._load;
Module._load = function (req, ...r) {
  if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: (t, k) => {
    if (k === 'DynamoDBDocumentClient') return { from: () => ({ send: async (c) => (c.input.FilterExpression ? { Items: rows } : { Items: [] }) }) };
    return class { constructor(i) { this.input = i; } };
  } });
  return orig.call(this, req, ...r);
};
const { handler } = require('../src/index.js');
Module._load = orig;

test('world_overview serves real countries only', async () => {
  const res = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'world_overview', payload: {} }) });
  const body = JSON.parse(res.body);
  assert.deepStrictEqual(body.data.situations.map((s) => s.country).sort(), ['Iran', 'Japan']);
});
