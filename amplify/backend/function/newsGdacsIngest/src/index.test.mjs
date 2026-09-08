// Unit tests for newsGdacsIngest pure helpers (no AWS). Run: node index.test.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _internal } = require('./index.js');
const { parseGeometry, affectedIso3, buildSituation, coolSituation, nextCheckAt, LEVEL_TIER } = _internal;

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log(`  ok ${name}`); };

const feat = (over = {}) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [116.0, 28.0] },
  properties: {
    eventid: '1104081', eventtype: 'FL', alertlevel: 'Orange', alertscore: 2,
    country: 'China', iso3: 'CHN',
    affectedcountries: [{ iso2: 'CN', iso3: 'CHN', countryname: 'China' }],
    name: 'Flood in China', severitydata: { severitytext: 'Magnitude 3', severity: 3 },
    url: { report: 'https://gdacs.org/r' }, datemodified: '2026-09-06T06:23:52',
    ...over,
  },
});
const NOW = '2026-09-08T00:00:00.000Z';
const TTL = 9999999999;

t('parseGeometry reads [lon,lat] as {lat,lon}', () => {
  assert.deepStrictEqual(parseGeometry(feat()), { lat: 28.0, lon: 116.0 });
  assert.strictEqual(parseGeometry({ geometry: null }), null);
  assert.strictEqual(parseGeometry({ geometry: { coordinates: ['x', 'y'] } }), null);
});

t('affectedIso3 dedupes origin + affected, uppercased', () => {
  const p = feat({ affectedcountries: [{ iso3: 'chn' }, { iso3: 'MMR' }] }).properties;
  assert.deepStrictEqual(affectedIso3(p), ['CHN', 'MMR']);
});

t('tier mapping Red→high Orange→elevated Green→low (no critical)', () => {
  assert.strictEqual(LEVEL_TIER.Red, 'high');
  assert.strictEqual(LEVEL_TIER.Orange, 'elevated');
  assert.strictEqual(LEVEL_TIER.Green, 'low');
});

t('open: no prev → emerging, coordinates + history captured', () => {
  const { change, item } = buildSituation(null, feat(), NOW, TTL);
  assert.strictEqual(change, 'opened');
  assert.strictEqual(item.state, 'emerging');
  assert.strictEqual(item.tier, 'elevated');
  assert.deepStrictEqual(item.centroid, { lat: 28, lon: 116 });
  assert.strictEqual(item.situationId, 'gdacs#FL#1104081');
  assert.strictEqual(item.axis, 'humanitarian');
  assert.strictEqual(item.next_check_at, nextCheckAt(NOW, 'elevated'));
  assert.strictEqual(item.history.length, 1);
});

t('raise: Orange→Red → escalating, tier high, cadence 30m', () => {
  const prev = buildSituation(null, feat(), NOW, TTL).item;
  const later = '2026-09-08T01:00:00.000Z';
  const { change, item } = buildSituation(prev, feat({ alertlevel: 'Red' }), later, TTL);
  assert.strictEqual(change, 'raised');
  assert.strictEqual(item.state, 'escalating');
  assert.strictEqual(item.tier, 'high');
  assert.strictEqual(item.cadence_min, 30);
  assert.match(item.what_changed, /Orange→Red/);
  assert.strictEqual(item.history.length, 2);
  assert.strictEqual(item.opened_at, NOW); // preserved
});

t('spread: new country → escalating + spread_arc', () => {
  const prev = buildSituation(null, feat(), NOW, TTL).item;
  const later = '2026-09-08T02:00:00.000Z';
  const two = feat({ affectedcountries: [{ iso3: 'CHN' }, { iso3: 'MMR' }] });
  const { change, item } = buildSituation(prev, two, later, TTL);
  assert.strictEqual(change, 'spread');
  assert.deepStrictEqual(item.iso3_affected, ['CHN', 'MMR']);
  assert.strictEqual(item.spread_arcs.length, 1);
  assert.deepStrictEqual(item.spread_arcs[0], { from: 'CHN', to: 'MMR', since: later });
});

t('unchanged: same level, same countries → stamps refresh, no history growth', () => {
  const prev = buildSituation(null, feat(), NOW, TTL).item;
  const later = '2026-09-08T02:00:00.000Z';
  const { change, item } = buildSituation(prev, feat(), later, TTL);
  assert.strictEqual(change, 'unchanged');
  assert.strictEqual(item.history.length, 1);
  assert.strictEqual(item.updated_at, later);
  assert.strictEqual(item.what_changed, prev.what_changed);
});

t('cool: green feature → cooling low once, then unchanged', () => {
  const prev = buildSituation(null, feat({ alertlevel: 'Red' }), NOW, TTL).item;
  const later = '2026-09-08T03:00:00.000Z';
  const green = feat({ alertlevel: 'Green' });
  const first = coolSituation(prev, green, later, TTL);
  assert.strictEqual(first.change, 'cooled');
  assert.strictEqual(first.item.tier, 'low');
  assert.strictEqual(first.item.state, 'cooling');
  const second = coolSituation(first.item, green, '2026-09-08T04:00:00.000Z', TTL);
  assert.strictEqual(second.change, 'unchanged');
});

t('cool: event gone from feed → cooling with "no longer current"', () => {
  const prev = buildSituation(null, feat(), NOW, TTL).item;
  const { change, item } = coolSituation(prev, null, '2026-09-08T05:00:00.000Z', TTL);
  assert.strictEqual(change, 'cooled');
  assert.match(item.what_changed, /no longer current/);
});

console.log(`\n${pass} tests passed`);
