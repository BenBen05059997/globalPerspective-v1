'use strict';
// Offline tests for newsGdacsIngest: fixture GeoJSON, fake fetch, fake S3. Run: node --test index.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ── fake @aws-sdk/client-s3 (works with or without the SDK installed) ────────
const puts = [];
let failKeys = new Set();
class PutObjectCommand { constructor(input) { this.input = input; } }
class S3Client {
  async send(cmd) {
    if (!(cmd instanceof PutObjectCommand)) throw new Error('unexpected command');
    if ([...failKeys].some((k) => cmd.input.Key.endsWith(k))) throw new Error(`AccessDenied ${cmd.input.Key}`);
    puts.push(cmd.input);
    return {};
  }
}
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === '@aws-sdk/client-s3') return { S3Client, PutObjectCommand };
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

// ── fixture: a trimmed GDACS EVENTS4APP FeatureCollection ────────────────────
const eq = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [121.62, 17.31] },
  properties: {
    eventtype: 'EQ', eventid: 1512345, episodeid: 1700001, eventname: '', name: 'Earthquake in Philippines',
    htmldescription: '<b>Orange</b> alert for earthquake. ' + 'x'.repeat(600),
    alertlevel: 'Orange', alertscore: 1.5, episodealertlevel: 'Orange', episodealertscore: 1.5,
    istemporary: 'false', iscurrent: 'true', country: 'Philippines', iso3: 'PHL',
    affectedcountries: [{ iso2: 'PH', iso3: 'PHL', countryname: 'Philippines' }],
    fromdate: '2026-10-30T02:11:00', todate: '2026-10-30T02:11:00', datemodified: '2026-10-30T03:00:00',
    severitydata: { severity: 6.4, severitytext: 'Magnitude 6.4M, Depth:10km', severityunit: 'M' },
    url: { geometry: 'https://gdacs.example/g', report: 'https://gdacs.example/report/EQ/1512345', details: 'https://gdacs.example/d' },
  },
};
const tc = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[-80.5, 25.1], [-80.0, 25.1], [-80.0, 25.6], [-80.5, 25.1]]] },
  properties: {
    eventtype: 'TC', eventid: 1001234, episodeid: 14, name: 'HURRICANE-4 ZETA',
    alertlevel: 'Red', alertscore: 2.5, episodealertlevel: 'Red', episodealertscore: 2.5,
    iscurrent: 'true', country: 'United States', iso3: 'USA',
    affectedcountries: [{ iso2: 'US', iso3: 'USA', countryname: 'United States' }, { iso2: 'CU', iso3: 'CUB', countryname: 'Cuba' }],
    datemodified: '2026-10-30T06:00:00',
    severitydata: { severity: 213, severitytext: 'Category 4 (maximum sustained wind speed of 213 km/h)', severityunit: 'km/h' },
    url: { report: 'https://gdacs.example/report/TC/1001234' },
  },
};
const flGreen = {
  type: 'Feature', geometry: null,
  properties: { eventtype: 'FL', eventid: 1103000, name: 'Flood in Brazil', alertlevel: 'Green', alertscore: 0.5, iscurrent: 'false', country: 'Brazil', iso3: 'BRA' },
};
const noId = { type: 'Feature', geometry: null, properties: { eventtype: 'VO', alertlevel: 'Red', name: 'No event id' } };
const noType = { type: 'Feature', geometry: null, properties: { eventid: 5, alertlevel: 'Orange' } };
const FEED = { type: 'FeatureCollection', features: [eq, tc, flGreen, noId, noType] };

const NOW = Date.parse('2026-10-31T00:20:00.000Z');
const NOW_ISO = '2026-10-31T00:20:00.000Z';
const realFetch = globalThis.fetch;
function fakeFetch(impl) { globalThis.fetch = async (...a) => impl(...a); }
const okJson = (body) => ({ ok: true, status: 200, json: async () => body });
const keyed = () => Object.fromEntries(puts.map((p) => [p.Key, JSON.parse(p.Body)]));

test.beforeEach((t) => {
  puts.length = 0; failKeys = new Set();
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
});
test.afterEach(() => { globalThis.fetch = realFetch; });

test('buildEventItem maps a GDACS feature to the corpus item shape', () => {
  const { buildEventItem } = load()._internal;
  const item = buildEventItem(eq, NOW_ISO, 1234);
  assert.equal(item.eventKey, 'EQ#1512345');
  assert.equal(item.alertLevel, 'Orange');
  assert.equal(item.alertScore, 1.5);
  assert.equal(item.episodeAlertLevel, 'Orange');
  assert.equal(item.isCurrent, true);
  assert.equal(item.country, 'Philippines');
  assert.equal(item.iso3, 'PHL');
  assert.deepEqual([item.lat, item.lon], [17.31, 121.62]); // GeoJSON [lon,lat] -> lat/lon
  assert.equal(item.name, 'Earthquake in Philippines');
  assert.equal(item.description.length, 500);
  assert.equal(item.severity, 6.4);
  assert.equal(item.severityText, 'Magnitude 6.4M, Depth:10km');
  assert.equal(item.severityUnit, 'M');
  assert.equal(item.reportUrl, 'https://gdacs.example/report/EQ/1512345');
  assert.equal(item.ingestedAt, NOW_ISO);
  assert.equal(item.ttl, 1234);
});

test('buildEventItem reads nested polygon coordinates and defaults for sparse features', () => {
  const { buildEventItem } = load()._internal;
  const t = buildEventItem(tc, NOW_ISO, 1);
  assert.deepEqual([t.lat, t.lon], [25.1, -80.5]);
  assert.equal(t.affectedCountries.length, 2);

  const g = buildEventItem(flGreen, NOW_ISO, 1);
  assert.equal(g.lat, null);
  assert.equal(g.lon, null);
  assert.equal(g.isCurrent, false);
  assert.equal(g.severity, null);
  assert.equal(g.reportUrl, null);
  assert.equal(g.description, '');
  const bare = buildEventItem({ properties: { eventtype: 'DR', eventid: 9 } }, NOW_ISO, 1);
  assert.equal(bare.alertLevel, 'Green'); // missing alertlevel is Green, not undefined
  assert.equal(bare.alertScore, null);
});

test('handler writes the corpus mirror and an Orange/Red-only inbox snapshot the tracker reads', async () => {
  fakeFetch(async () => okJson(FEED));
  const out = await load().handler();

  assert.equal(out.ok, true);
  assert.equal(out.stored, 3); // eq, tc, flGreen; features without eventid/eventtype are skipped
  assert.equal(out.withGeo, 2);
  assert.deepEqual(out.byLevel, { Green: 1, Orange: 1, Red: 1 });
  assert.equal(out.inbox.key, 'situations/inbox/gdacs-latest.json');
  assert.equal(out.inbox.count, 2);
  assert.equal(out.corpus.key, 'corpus/gdacs/latest.json');

  assert.deepEqual(puts.map((p) => p.Key).sort(), ['corpus/gdacs/latest.json', 'situations/inbox/gdacs-latest.json']);
  for (const p of puts) assert.equal(p.ContentType, 'application/json');
  const bodies = keyed();

  const corpus = bodies['corpus/gdacs/latest.json'];
  assert.equal(corpus.source, 'gdacs');
  assert.equal(corpus.observed_at, NOW_ISO);
  assert.equal(corpus.count, 3);
  assert.deepEqual(corpus.events.map((e) => e.eventKey), ['EQ#1512345', 'TC#1001234', 'FL#1103000']);
  assert.equal(corpus.events[0].ttl, Math.floor(NOW / 1000) + 30 * 86400);

  const inbox = bodies['situations/inbox/gdacs-latest.json'];
  assert.equal(inbox.source, 'gdacs');
  assert.equal(inbox.observed_at, NOW_ISO);
  assert.deepEqual(inbox.events.map((e) => [e.eventKey, e.level]), [['EQ#1512345', 'Orange'], ['TC#1001234', 'Red']]);
  const tcObs = inbox.events[1];
  assert.deepEqual(tcObs.iso3_affected, ['USA', 'CUB']);
  assert.deepEqual(tcObs.centroid, { lat: 25.1, lon: -80.5 });
  assert.equal(tcObs.source, 'gdacs');
  assert.equal(tcObs.observed_at, NOW_ISO);
});

test('the inbox snapshot is what the tracker folds: Orange/Red events open gdacs# situations', async () => {
  fakeFetch(async () => okJson(FEED));
  await load().handler();
  const snap = keyed()['situations/inbox/gdacs-latest.json'];
  const { foldSweep } = require('../../newsSituationTracker/src/index.js')._internal;
  // The tracker's readObservations uses snap.events and snap.observed_at.
  const { states, counts } = foldSweep({}, snap.events, snap.observed_at, 9999999999);
  assert.equal(counts.opened, 2);
  assert.equal(states['gdacs#EQ#1512345'].tier, 'elevated');
  assert.equal(states['gdacs#TC#1001234'].tier, 'high');
  assert.equal(states['gdacs#FL#1103000'], undefined);
});

test('a feed with no Orange/Red events still writes an empty inbox snapshot (stable pointer)', async () => {
  fakeFetch(async () => okJson({ features: [flGreen] }));
  const out = await load().handler();
  assert.equal(out.ok, true);
  assert.equal(out.inbox.count, 0);
  const inbox = keyed()['situations/inbox/gdacs-latest.json'];
  assert.deepEqual(inbox.events, []);
  assert.equal(inbox.observed_at, NOW_ISO);
});

test('fetch failure returns ok:false and writes nothing (non-200, network error, bad JSON)', async () => {
  const cases = [
    async () => ({ ok: false, status: 503, json: async () => ({}) }),
    async () => { throw new Error('ECONNRESET'); },
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }),
  ];
  for (const impl of cases) {
    fakeFetch(impl);
    const out = await load().handler();
    assert.equal(out.ok, false);
    assert.ok(out.error);
  }
  assert.equal(puts.length, 0);
});

test('non-200 error names the status', async () => {
  fakeFetch(async () => ({ ok: false, status: 503 }));
  assert.deepEqual(await load().handler(), { ok: false, error: 'GDACS HTTP 503' });
});

test('SITUATIONS_INBOX_DISABLED=true skips the inbox but still mirrors the corpus', async () => {
  fakeFetch(async () => okJson(FEED));
  const out = await load({ SITUATIONS_INBOX_DISABLED: 'true' }).handler();
  assert.equal(out.ok, true);
  assert.equal(out.inbox, null);
  assert.deepEqual(puts.map((p) => p.Key), ['corpus/gdacs/latest.json']);
});

test('a failing corpus or inbox write is reported but never fails the run', async () => {
  fakeFetch(async () => okJson(FEED));
  failKeys = new Set(['corpus/gdacs/latest.json']);
  let out = await load().handler();
  assert.equal(out.ok, true);
  assert.match(out.corpus.error, /AccessDenied/);
  assert.equal(out.inbox.count, 2); // inbox still written

  puts.length = 0; failKeys = new Set(['gdacs-latest.json']);
  out = await load().handler();
  assert.equal(out.ok, true);
  assert.match(out.inbox.error, /AccessDenied/);
  assert.equal(out.corpus.count, 3);
});

test('SITUATIONS_INBOX_PREFIX and GDACS_CORPUS_PREFIX relocate the keys', async () => {
  fakeFetch(async () => okJson(FEED));
  await load({ SITUATIONS_INBOX_PREFIX: 'shadow/inbox', GDACS_CORPUS_PREFIX: 'shadow/corpus' }).handler();
  assert.deepEqual(puts.map((p) => p.Key).sort(), ['shadow/corpus/latest.json', 'shadow/inbox/gdacs-latest.json']);
});
