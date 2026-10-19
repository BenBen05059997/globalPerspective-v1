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
const { topCountries, linkRelated } = loadWithStub('../src/index.js', {});

test('aggregates do not take the top-N slots of the weekly brief', () => {
  const e = (regions) => ({ regions });
  const entries = [e(['Middle East', 'Iran']), e(['Middle East', 'Israel']), e(['Middle East']), e(['Europe', 'France']), e(['Europe']), e(['Iran'])];
  assert.deepStrictEqual(topCountries(entries, 3), ['Iran', 'Israel', 'France']);
});

test('aliases count as one canonical country (the COUNTRY# key)', () => {
  const entries = [{ regions: ['USA'] }, { regions: ['United States', 'USA'] }, { regions: ['France'] }];
  assert.deepStrictEqual(topCountries(entries, 2), ['United States', 'France']);
});

test('related signals come from the story web, not the model', () => {
  const sig = (threadId, lede, related = null) => ({ threadId, lede, related });
  const signals = [sig('t1', 'One'), sig('t2', 'Two'), sig('t3', 'Three', 'model text')];
  const web = { links: [{ from: 't1', to: 't2' }, { from: 't1', to: 'other' }], shared: [{ a: 't3', b: 't2' }] };
  linkRelated(signals, web);
  assert.deepStrictEqual(signals.map((s) => [s.relatedThreadIds, s.related]), [
    [['t2'], 'Two'], [['t1', 't3'], 'One'], [['t2'], 'model text'],
  ]);
  assert.deepStrictEqual(linkRelated([sig('t1', 'One')], null)[0].relatedThreadIds, []);
});
