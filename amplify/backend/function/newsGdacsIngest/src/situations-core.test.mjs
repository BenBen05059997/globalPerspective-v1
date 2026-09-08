// Unit tests for situations-core (no AWS). Run: node situations-core.test.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const core = require('./situations-core.js');
const { buildObservation, buildSituation, coolSituation, nextCheckAt, LEVEL_TIER, parseGeometry, affectedIso3 } = core;

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
const obs = (over) => buildObservation(feat(over), NOW);

t('parseGeometry reads [lon,lat] as {lat,lon}', () => {
  assert.deepStrictEqual(parseGeometry(feat()), { lat: 28.0, lon: 116.0 });
  assert.strictEqual(parseGeometry({ geometry: null }), null);
});

t('affectedIso3 dedupes + uppercases', () => {
  assert.deepStrictEqual(affectedIso3(feat({ affectedcountries: [{ iso3: 'chn' }, { iso3: 'MMR' }] }).properties), ['CHN', 'MMR']);
});

t('tier mapping Red→high Orange→elevated Green→low', () => {
  assert.strictEqual(LEVEL_TIER.Red, 'high');
  assert.strictEqual(LEVEL_TIER.Orange, 'elevated');
  assert.strictEqual(LEVEL_TIER.Green, 'low');
});

t('buildObservation: compact fact, clean severity, coordinates', () => {
  const o = obs();
  assert.strictEqual(o.source, 'gdacs');
  assert.strictEqual(o.eventKey, 'FL#1104081');
  assert.strictEqual(o.level, 'Orange');
  assert.strictEqual(o.verb_label, 'China — flood (Magnitude 3)');
  assert.deepStrictEqual(o.centroid, { lat: 28, lon: 116 });
  assert.deepStrictEqual(o.iso3_affected, ['CHN']);
  assert.strictEqual(o.axis, 'humanitarian');
});

t('buildObservation: "Magnitude 0" severity suppressed', () => {
  const o = buildObservation(feat({ severitydata: { severitytext: 'Magnitude 0 ' } }), NOW);
  assert.strictEqual(o.verb_label, 'China — flood');
  assert.strictEqual(o.severityText, '');
});

t('fold open: no prev → emerging, coordinates + history', () => {
  const { change, item } = buildSituation(null, obs(), NOW, TTL);
  assert.strictEqual(change, 'opened');
  assert.strictEqual(item.state, 'emerging');
  assert.strictEqual(item.tier, 'elevated');
  assert.strictEqual(item.situationId, 'gdacs#FL#1104081');
  assert.deepStrictEqual(item.centroid, { lat: 28, lon: 116 });
  assert.strictEqual(item.next_check_at, nextCheckAt(NOW, 'elevated'));
  assert.strictEqual(item.history.length, 1);
  assert.strictEqual(item.check_count, 0);
});

t('fold raise: Orange→Red → escalating, tier high, cadence 30m, opened_at preserved', () => {
  const prev = buildSituation(null, obs(), NOW, TTL).item;
  const later = '2026-09-08T01:00:00.000Z';
  const { change, item } = buildSituation(prev, obs({ alertlevel: 'Red' }), later, TTL);
  assert.strictEqual(change, 'raised');
  assert.strictEqual(item.state, 'escalating');
  assert.strictEqual(item.tier, 'high');
  assert.strictEqual(item.cadence_min, 30);
  assert.match(item.what_changed, /Orange→Red/);
  assert.strictEqual(item.opened_at, NOW);
  assert.strictEqual(item.check_count, 1);
  assert.strictEqual(item.history.length, 2);
});

t('fold spread: new country → escalating + spread_arc', () => {
  const prev = buildSituation(null, obs(), NOW, TTL).item;
  const later = '2026-09-08T02:00:00.000Z';
  const { change, item } = buildSituation(prev, obs({ affectedcountries: [{ iso3: 'CHN' }, { iso3: 'MMR' }] }), later, TTL);
  assert.strictEqual(change, 'spread');
  assert.deepStrictEqual(item.iso3_affected, ['CHN', 'MMR']);
  assert.deepStrictEqual(item.spread_arcs, [{ from: 'CHN', to: 'MMR', since: later }]);
});

t('fold unchanged: same level+countries → stamps refresh, no history growth', () => {
  const prev = buildSituation(null, obs(), NOW, TTL).item;
  const later = '2026-09-08T02:00:00.000Z';
  const { change, item } = buildSituation(prev, obs(), later, TTL);
  assert.strictEqual(change, 'unchanged');
  assert.strictEqual(item.history.length, 1);
  assert.strictEqual(item.updated_at, later);
  assert.strictEqual(item.what_changed, prev.what_changed);
});

t('cool: green observation → cooling low once, then unchanged', () => {
  const prev = buildSituation(null, obs({ alertlevel: 'Red' }), NOW, TTL).item;
  const green = obs({ alertlevel: 'Green' });
  const first = coolSituation(prev, green, '2026-09-08T03:00:00.000Z', TTL);
  assert.strictEqual(first.change, 'cooled');
  assert.strictEqual(first.item.tier, 'low');
  assert.strictEqual(first.item.state, 'cooling');
  const second = coolSituation(first.item, green, '2026-09-08T04:00:00.000Z', TTL);
  assert.strictEqual(second.change, 'unchanged');
});

t('cool: gone from feed (obs null) → "no longer current"', () => {
  const prev = buildSituation(null, obs(), NOW, TTL).item;
  const { change, item } = coolSituation(prev, null, '2026-09-08T05:00:00.000Z', TTL);
  assert.strictEqual(change, 'cooled');
  assert.match(item.what_changed, /no longer current/);
});

console.log(`\n${pass} tests passed`);
