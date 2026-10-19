'use strict';
// Batch 3 / F: regions no longer take the top-N story-web slots.
const test = require('node:test');
const assert = require('node:assert');
process.env.TOPICS_DDB_TABLE = 'T'; process.env.SUMMARIZE_PREDICT_TABLE = 'T'; process.env.XAI_API_KEY = 'x';
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
const { groupByCountry } = loadWithStub('../src/index.js', {});

const entry = (i, regions, thread) => ({ topicId: 't' + i, threadId: thread, title: 'x' + i, date: '2026-09-1' + (i % 9), regions, category: 'politics' });
test('a region with the most entries is excluded; real countries stay, ranked by count', () => {
  const entries = [];
  for (let i = 0; i < 12; i++) entries.push(entry(i, ['Europe', 'France'], 'th' + (i % 3)));       // Europe 12, France 12
  for (let i = 12; i < 20; i++) entries.push(entry(i, ['Middle East', 'Iran'], 'th' + (i % 3)));   // Middle East 8, Iran 8
  for (let i = 20; i < 24; i++) entries.push(entry(i, ['Asia', 'Japan'], 'j' + (i % 2)));         // Asia 4, Japan 4
  const out = groupByCountry(entries, {}).map((c) => c.countryName);
  assert.deepStrictEqual(out, ['France', 'Iran', 'Japan']);
});
test('aggregates never appear even when they are the only large groups', () => {
  const entries = [];
  for (let i = 0; i < 8; i++) entries.push(entry(i, ['Global', 'Americas'], 'th' + (i % 3)));
  assert.deepStrictEqual(groupByCountry(entries, {}), []);
});
