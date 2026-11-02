'use strict';
// Offline tests for newsGdeltConflict: a GDELT 2.0 export fixture (61-column TSV), fake fetch, fake S3.
// adm-zip is replaced by a stub that "unzips" a plain-text buffer, so the aggregation runs without the dependency;
// the real archive format is not exercised. Run: node --test index.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const puts = [];
let failPut = false;
class PutObjectCommand { constructor(input) { this.input = input; } }
class S3Client {
  async send(cmd) {
    if (failPut) throw new Error('AccessDenied');
    puts.push(cmd.input);
    return {};
  }
}
class FakeAdmZip {
  constructor(buf) {
    this.text = buf.toString('utf8');
    if (this.text.startsWith('<html')) throw new Error('Invalid or unsupported zip format. No END header found');
  }
  getEntries() { return [{ entryName: '20261031114500.export.CSV' }]; }
  readAsText() { return this.text; }
}
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === '@aws-sdk/client-s3') return { S3Client, PutObjectCommand };
  if (request === 'adm-zip') return FakeAdmZip;
  return realLoad.call(this, request, ...rest);
};
test.after(() => { Module._load = realLoad; });

const INDEX = require.resolve('./index.js');
function load(env = {}) {
  delete require.cache[INDEX];
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
  try { return require(INDEX); } finally {
    for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

// One GDELT 2.0 export row: 61 tab-separated columns; only the ones the Lambda reads are filled.
function row({ quad = '4', root = '19', mentions = 20, goldstein = -8, tone = -4, geo = '', cc = '', url = 'https://news.example/x', cols = 61 } = {}) {
  const c = Array(cols).fill('');
  c[28] = root; c[29] = quad; c[30] = String(goldstein); c[31] = String(mentions); c[34] = String(tone);
  if (cols > 52) c[52] = geo;
  if (cols > 53) c[53] = cc;
  if (cols > 60) c[60] = url;
  return c.join('\t');
}
const EXPORT = [
  row({ geo: "Kharkiv, Kharkivs'ka Oblast, Ukraine", cc: 'UP', mentions: 50, goldstein: -9, tone: -5, root: '19', url: 'https://news.example/ua-top' }),
  row({ geo: 'Kyiv, Ukraine', cc: 'UP', mentions: 30, goldstein: -10, tone: -7.26, root: '18', url: 'https://news.example/ua-2' }),
  row({ geo: 'Khartoum, Sudan', cc: 'SU', mentions: 12, goldstein: -6.5, tone: -2, root: '20', url: 'https://news.example/sd' }),
  row({ geo: '', cc: 'IS', mentions: 15, root: '17', url: 'https://news.example/il' }),          // no place name: falls back to the FIPS code
  row({ geo: 'Gaza, Israel', mentions: 40, root: '14', url: 'https://news.example/unmapped' }),   // unmapped CAMEO root
  row({ geo: 'Paris, France', quad: '3', mentions: 500 }),                                       // verbal conflict, not QuadClass 4
  row({ geo: 'Lagos, Nigeria', mentions: 9 }),                                                    // below GDELT_MIN_MENTIONS (10)
  row({ geo: 'Short, Row', cols: 40 }),                                                           // truncated row
  '',
].join('\n');

const LASTUPDATE = [
  '184503 aaa http://data.gdeltproject.org/gdeltv2/20261031114500.export.CSV.zip',
  '200100 bbb http://data.gdeltproject.org/gdeltv2/20261031114500.mentions.CSV.zip',
  '900200 ccc http://data.gdeltproject.org/gdeltv2/20261031114500.gkg.csv.zip',
].join('\n');
const EXPORT_URL = 'http://data.gdeltproject.org/gdeltv2/20261031114500.export.CSV.zip';

const NOW = Date.parse('2026-10-31T12:00:00.000Z');
const realFetch = globalThis.fetch;
const fetched = [];
function fakeFetch({ lastupdate = { ok: true, status: 200, text: async () => LASTUPDATE }, exp = { ok: true, status: 200, arrayBuffer: async () => Buffer.from(EXPORT) } } = {}) {
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    const r = String(url).includes('lastupdate') ? lastupdate : exp;
    if (r instanceof Error) throw r;
    return r;
  };
}

test.beforeEach((t) => {
  puts.length = 0; fetched.length = 0; failPut = false;
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
});
test.afterEach(() => { globalThis.fetch = realFetch; });

test('aggregates QuadClass 4 rows by country and writes the day snapshot to S3', async () => {
  fakeFetch();
  const out = await load().handler();

  assert.deepEqual(fetched, [
    'http://data.gdeltproject.org/gdeltv2/lastupdate.txt',
    EXPORT_URL, // the .export.CSV.zip line is chosen, not mentions or gkg
  ]);
  assert.equal(out.ok, true);
  assert.equal(out.conflictCountries, 4); // Ukraine, Sudan, IS (code fallback), Israel
  assert.equal(out.stored, 4);
  assert.equal(out.corpus.key, 'corpus/gdelt/2026-10-31.json');

  assert.equal(puts.length, 1);
  assert.equal(puts[0].Key, 'corpus/gdelt/2026-10-31.json');
  assert.equal(puts[0].ContentType, 'application/json');
  const body = JSON.parse(puts[0].Body);
  assert.equal(body.day, '2026-10-31');
  assert.equal(body.generated_at, '2026-10-31T12:00:00.000Z');
  assert.equal(body.count, 4);
  assert.deepEqual(body.countries.map((c) => c.country), ['Ukraine', 'Israel', 'IS', 'Sudan']); // by total mentions

  const ua = body.countries[0];
  assert.deepEqual(ua, {
    conflictKey: '2026-10-31#Ukraine', day: '2026-10-31', country: 'Ukraine',
    totalMentions: 80, eventCount: 2, minGoldstein: -10, worstTone: -7.3,
    topEvent: 'Fight/Combat', topEventMentions: 50, sourceUrl: 'https://news.example/ua-top',
    sourceFile: EXPORT_URL, ingestedAt: '2026-10-31T12:00:00.000Z',
  });
  assert.equal(body.countries[1].topEvent, 'CAMEO 14');
  assert.equal(body.countries.find((c) => c.country === 'Sudan').topEvent, 'Mass violence');
  assert.equal(body.countries.find((c) => c.country === 'IS').topEvent, 'Coerce');
  assert.ok(!body.countries.some((c) => c.country === 'France' || c.country === 'Nigeria'));
});

test('GDELT_TOP_N and GDELT_MIN_MENTIONS tune the snapshot', async () => {
  fakeFetch();
  const out = await load({ GDELT_TOP_N: '2', GDELT_MIN_MENTIONS: '40' }).handler();
  const body = JSON.parse(puts[0].Body);
  assert.equal(out.conflictCountries, 2); // Ukraine (50) and Israel (40); Sudan 12 and 'IS' 15 fall below
  assert.deepEqual(body.countries.map((c) => c.country), ['Ukraine', 'Israel']);
  assert.equal(body.countries[0].totalMentions, 50); // the 30-mention Kyiv row is now below the threshold
});

test('an export with no conflict rows still writes an empty snapshot', async () => {
  fakeFetch({ exp: { ok: true, status: 200, arrayBuffer: async () => Buffer.from(row({ quad: '1' }) + '\n') } });
  const out = await load().handler();
  assert.equal(out.ok, true);
  assert.equal(out.stored, 0);
  assert.deepEqual(JSON.parse(puts[0].Body).countries, []);
});

test('fetch failures return ok:false with the reason and write nothing', async () => {
  const cases = [
    [{ lastupdate: { ok: false, status: 404 } }, 'lastupdate HTTP 404'],
    [{ lastupdate: { ok: true, status: 200, text: async () => '1 a http://x/y.mentions.CSV.zip\n' } }, 'no export URL in lastupdate'],
    [{ exp: { ok: false, status: 502 } }, 'export HTTP 502'],
    [{ exp: new Error('ETIMEDOUT') }, 'ETIMEDOUT'],
    [{ lastupdate: new Error('ENOTFOUND') }, 'ENOTFOUND'],
  ];
  for (const [opts, error] of cases) {
    fakeFetch(opts);
    assert.deepEqual(await load().handler(), { ok: false, error });
  }
  assert.equal(puts.length, 0);
});

test('a corrupt (non-zip) download returns ok:false and writes nothing', async () => {
  fakeFetch({ exp: { ok: true, status: 200, arrayBuffer: async () => Buffer.from('<html>error page</html>') } });
  const out = await load().handler();
  assert.equal(out.ok, false);
  assert.match(out.error, /zip/i);
  assert.equal(puts.length, 0);
});

test('a failing S3 write is reported in the result but does not fail the run', async () => {
  fakeFetch();
  failPut = true;
  const out = await load().handler();
  assert.equal(out.ok, true);
  assert.equal(out.stored, 4);
  assert.equal(out.corpus.error, 'AccessDenied');
});

test('GDELT_CORPUS_PREFIX relocates the snapshot key', async () => {
  fakeFetch();
  await load({ GDELT_CORPUS_PREFIX: 'shadow/gdelt' }).handler();
  assert.equal(puts[0].Key, 'shadow/gdelt/2026-10-31.json');
});
