'use strict';
// Smoke test of the whole handler with the AWS SDK and https stubbed (no network): proves a run
// writes a FACTS# record carrying leadership + capital + population, each with source + as-of.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');
const { EventEmitter } = require('node:events');

const puts = [];
const fakeSdk = new Proxy({}, { get: (t, k) => {
  if (k === 'DynamoDBDocumentClient') return { from: () => ({ send: async (c) => (c.__put ? (puts.push(c.input.Item), {}) : { Item: null }) }) };
  if (k === 'PutCommand') return class { constructor(i) { this.input = i; this.__put = true; } };
  return class { constructor(i) { this.input = i; } };
} });
const WD = 'http://www.wikidata.org/entity/';
const respond = (url) => {
  const q = decodeURIComponent(url);
  if (/Special:EntityData/.test(q)) return { entities: { Q1: { labels: { en: { value: 'Someone' } } } } };
  if (/P298/.test(q)) return { results: { bindings: [{ c: { value: WD + 'Q17' }, iso: { value: 'JPN' } }] } };
  if (/P36/.test(q)) return { results: { bindings: [{ c: { value: WD + 'Q17' }, capLabel: { value: 'Tokyo' } }] } };
  if (/P1082/.test(q)) return { results: { bindings: [{ c: { value: WD + 'Q17' }, pop: { value: '123802000' }, time: { value: '2024-10-01T00:00:00Z' } }] } };
  return { results: { bindings: [{ role: { value: 'head_of_government' }, officeholder: { value: WD + 'Q1' }, startTime: { value: '2025-10-21T00:00:00Z' } }] } };
};
const fakeHttps = { get: (opts, cb) => { const req = new EventEmitter(); const res = new EventEmitter(); res.statusCode = 200; res.headers = {};
  setImmediate(() => { cb(res); res.emit('data', JSON.stringify(respond(opts.hostname + opts.path))); res.emit('end'); }); return req; } };

test('handler: a D2 country (Japan) stores capital + population with source and as-of and NO leadership', async () => {
  const orig = Module._load;
  Module._load = function (req, ...r) { if (req.startsWith('@aws-sdk/')) return fakeSdk; if (req === 'https') return fakeHttps; return orig.call(this, req, ...r); };
  process.env.SUMMARIZE_PREDICT_TABLE = 'T';
  const origTimeout = global.setTimeout; global.setTimeout = (fn) => origTimeout(fn, 0);
  try {
    const { handler } = require('../src/index.js');
    const out = JSON.parse((await handler({ countries: ['Japan'] })).body);
    assert.deepStrictEqual(out.updated, ['Japan']);
    const item = puts.find((p) => p.PK === 'FACTS#Japan');
    assert.ok(!('leadershipString' in item) && !('headOfState' in item) && !('acledData' in item));
    assert.ok(item.lastUpdatedAt);
    assert.deepStrictEqual(item.capital.names, ['Tokyo']);
    assert.strictEqual(item.capital.source, 'wikidata'); assert.ok(item.capital.checkedAt);
    assert.strictEqual(item.population.value, 123802000); assert.strictEqual(item.population.year, 2024); assert.ok(item.population.checkedAt);
  } finally { Module._load = orig; global.setTimeout = origTimeout; }
});

test('the original 12 (and only they) keep leadership', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/index.js'), 'utf8');
  const list = eval('(' + src.match(/const TARGET_COUNTRIES = (\[[\s\S]*?\n\]);/)[1] + ')');
  assert.strictEqual(list.length, 40);
  assert.strictEqual(list.filter((c) => c.leadership).length, 12);
  assert.ok(list.filter((c) => c.leadership).every((c) => c.wikiQid && c.acled));
  assert.ok(list.filter((c) => !c.leadership).every((c) => c.iso3 && !c.acled));
});

test('handler: an original-12 country (Iran) still stores leadership with source + date', async () => {
  const orig = Module._load;
  Module._load = function (req, ...r) { if (req.startsWith('@aws-sdk/')) return fakeSdk; if (req === 'https') return fakeHttps; return orig.call(this, req, ...r); };
  process.env.SUMMARIZE_PREDICT_TABLE = 'T';
  const origTimeout = global.setTimeout; global.setTimeout = (fn) => origTimeout(fn, 0);
  try {
    delete require.cache[require.resolve('../src/index.js')];
    const { handler } = require('../src/index.js');
    const out = JSON.parse((await handler({ countries: ['Iran'] })).body);
    assert.deepStrictEqual(out.updated, ['Iran']);
    const item = puts.filter((p) => p.PK === 'FACTS#Iran').pop();
    assert.match(item.leadershipString, /Head of Government: Someone/);
    assert.strictEqual(item.leadershipSource, 'wikidata'); assert.ok(item.lastUpdatedAt);
  } finally { Module._load = orig; global.setTimeout = origTimeout; }
});
