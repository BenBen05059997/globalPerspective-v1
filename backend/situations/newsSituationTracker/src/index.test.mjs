// Unit tests for the tracker's pure fold/assemble logic (no AWS). Run: node index.test.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _internal } = require('./index.js');
const core = require('./_shared/situations-core.js');
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

// ── news situations keyed by country + thread (L2 linking, 2026-10-19) ──
const { planNewsSituations, summarize } = _internal;
const story = (storyId, over = {}) => ({ storyId, title: storyId, axis: storyId.split('#')[0], max_severity: 4, outlets: 4, velocity: 1, spread_new_iso3: [], centroid: { lat: 49, lon: 32 }, iso3: [storyId.split('#')[1]], category: 'war', headlines: [], ...over });
const ukr = [story('conflict#UKR#russia'), story('political#UKR#zelensky'), story('conflict#UKR#kharkiv'), story('conflict#FRA#macron')];

t('planNewsSituations: same country + thread fold into one id; unthreaded keep the storyId key', () => {
  const map = { 'conflict#UKR#russia': { threadId: 'thread-war-1' }, 'political#UKR#zelensky': { threadId: 'thread-war-1' }, 'conflict#FRA#macron': { threadId: 'thread-war-1' } };
  const { groups, absorbed } = planNewsSituations(ukr, {}, map, new Set());
  const ids = groups.map((g) => g.id).sort();
  assert.deepStrictEqual(ids, ['news#FRA#thread-war-1', 'news#UKR#thread-war-1', 'news#conflict#UKR#kharkiv']);
  const g = groups.find((x) => x.id === 'news#UKR#thread-war-1');
  assert.strictEqual(g.stories.length, 2);
  assert.strictEqual(g.threadId, 'thread-war-1');
  assert.deepStrictEqual(g.aliases, ['news#conflict#UKR#russia', 'news#political#UKR#zelensky']);
  assert.deepStrictEqual(groups.find((x) => x.id === 'news#conflict#UKR#kharkiv').aliases, []);
  assert.deepStrictEqual(absorbed, []);
});

t('planNewsSituations: a prior situation latches its thread for its stories when the map drops them', () => {
  const prior = { 'news#UKR#thread-war-1': { situationId: 'news#UKR#thread-war-1', source: 'news', threadId: 'thread-war-1', storyIds: ['conflict#UKR#russia', 'political#UKR#zelensky'], state: 'peak' } };
  const { groups } = planNewsSituations(ukr.slice(0, 2), prior, {}, new Set());
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].id, 'news#UKR#thread-war-1');
  assert.strictEqual(groups[0].prev, prior['news#UKR#thread-war-1']);
});

t('planNewsSituations: an old per-story situation is absorbed into its group (life story kept)', () => {
  const old = buildStoryOld();
  const prior = { 'news#conflict#UKR#russia': old }; // latched thread-war-1 before the re-key
  const { groups, absorbed } = planNewsSituations(ukr.slice(0, 2), prior, { 'political#UKR#zelensky': { threadId: 'thread-war-1' } }, new Set());
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].id, 'news#UKR#thread-war-1');
  assert.strictEqual(groups[0].prev, old);
  assert.deepStrictEqual(absorbed, ['news#conflict#UKR#russia']);
  const built = { [groups[0].id]: core.buildStorySituation(groups[0].prev, core.mergeStories(groups[0].stories), T1, TTL, { threadId: groups[0].threadId, situationId: groups[0].id, aliases: groups[0].aliases }) };
  const foldPrior = { ...prior }; for (const id of absorbed) delete foldPrior[id];
  const { states } = foldSweep(foldPrior, [], T1, TTL, { extraBuilt: built });
  assert.deepStrictEqual(Object.keys(states), ['news#UKR#thread-war-1']); // no cooling ghost under the old id
  const s = states['news#UKR#thread-war-1'];
  assert.strictEqual(s.opened_at, old.opened_at);
  assert.ok(s.aliases.includes('news#conflict#UKR#russia'));
  assert.deepStrictEqual(summarize(s).aliases, s.aliases); // world/latest.json carries the aliases
});
function buildStoryOld() {
  return { ...core.buildStorySituation(null, ukr[0], NOW, TTL, { threadId: 'thread-war-1' }).item };
}

t('planNewsSituations: GDACS merge rule still skips a humanitarian story in a disaster country', () => {
  const { groups } = planNewsSituations([story('humanitarian#UKR#flood')], {}, {}, new Set(['UKR']));
  assert.strictEqual(groups.length, 0);
});

t('summarize: no aliases field when there are none', () => {
  assert.ok(!('aliases' in summarize({ situationId: 'gdacs#FL#1', aliases: [] })));
});

console.log(`\n${pass} tests passed`);
