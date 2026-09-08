// Unit tests for the tracker's pure fold/assemble logic (no AWS). Run: node index.test.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _internal } = require('./index.js');
const core = require('./situations-core.js');
const { foldSweep, assembleWorld, deriveRanked, deriveLede, computeStale } = _internal;

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log(`  ok ${name}`); };

const obs = (over = {}) => core.buildObservation({
  geometry: { type: 'Point', coordinates: [116, 28] },
  properties: {
    eventid: over.id || '1', eventtype: over.type || 'FL', alertlevel: over.level || 'Orange',
    alertscore: 2, country: over.country || 'China', iso3: over.iso3 || 'CHN',
    affectedcountries: (over.aff || ['CHN']).map((c) => ({ iso3: c })),
    name: over.name || 'Flood in China', severitydata: {},
  },
}, over.at || '2026-09-08T00:00:00.000Z');

const NOW = '2026-09-08T00:00:00.000Z';
const T1 = '2026-09-08T00:10:00.000Z';
const TTL = 9999999999;

t('fold: first sweep opens a situation', () => {
  const { states, counts } = foldSweep({}, [obs()], NOW, TTL);
  assert.strictEqual(counts.opened, 1);
  const s = states['gdacs#FL#1'];
  assert.strictEqual(s.state, 'emerging');
  assert.strictEqual(s.tier, 'elevated');
});

t('fold: raise across sweeps → escalating', () => {
  const first = foldSweep({}, [obs()], NOW, TTL).states;
  const { states, counts } = foldSweep(first, [obs({ level: 'Red' })], T1, TTL);
  assert.strictEqual(counts.raised, 1);
  assert.strictEqual(states['gdacs#FL#1'].state, 'escalating');
  assert.strictEqual(states['gdacs#FL#1'].tier, 'high');
});

t('fold: disappearance → cools, then closes after N sweeps', () => {
  let states = foldSweep({}, [obs()], NOW, TTL).states;
  // sweep with empty observations 3× (closeAfter default 3)
  let r;
  for (let i = 1; i <= 3; i++) r = foldSweep(states, [], `2026-09-08T0${i}:00:00.000Z`, TTL, { closeAfter: 3 }), states = r.states;
  assert.strictEqual(states['gdacs#FL#1'].state, 'closed');
  assert.ok(states['gdacs#FL#1'].closed_at);
  assert.strictEqual(r.counts.closed, 1);
});

t('fold: closed situation dropped after keepHours', () => {
  let states = foldSweep({}, [obs()], NOW, TTL).states;
  for (let i = 1; i <= 3; i++) states = foldSweep(states, [], `2026-09-08T0${i}:00:00.000Z`, TTL, { closeAfter: 3 }).states;
  // closed_at ≈ 03:00; fold 2h later with a 1h keep window → dropped (and reported for archiving)
  const r2 = foldSweep(states, [], '2026-09-08T05:00:00.000Z', TTL, { keepHours: 1 });
  assert.ok(!('gdacs#FL#1' in r2.states), 'closed situation should be dropped from state');
  assert.deepStrictEqual(r2.dropped, ['gdacs#FL#1'], 'dropped id reported for archiving');
});

t('assembleWorld: shape + ranked order (high+escalating first)', () => {
  let states = foldSweep({}, [obs({ id: '1', level: 'Orange' })], NOW, TTL).states;
  states = foldSweep(states, [obs({ id: '1', level: 'Orange' }), obs({ id: '2', type: 'TC', level: 'Red', country: 'Philippines', iso3: 'PHL' })], T1, TTL).states;
  const w = assembleWorld(states, T1, { gdacs: T1 });
  assert.strictEqual(w.schema, 1);
  assert.strictEqual(w.stale, false);
  assert.strictEqual(w.ranked[0].tier, 'high'); // Red cyclone outranks Orange flood
  assert.ok(Array.isArray(w.systemic));
  assert.ok(w.lede.length > 0);
});

t('computeStale: gdacs stamp older than threshold', () => {
  assert.strictEqual(computeStale({ gdacs: '2026-09-08T00:00:00.000Z' }, '2026-09-08T00:30:00.000Z', { gdacs: 45 }), false);
  assert.strictEqual(computeStale({ gdacs: '2026-09-08T00:00:00.000Z' }, '2026-09-08T01:00:00.000Z', { gdacs: 45 }), true);
  assert.strictEqual(computeStale({ gdacs: null }, NOW), true);
});

t('deriveLede: empty → honest no-situations line', () => {
  assert.match(deriveLede([], []), /No critical situations/);
});

console.log(`\n${pass} tests passed`);
