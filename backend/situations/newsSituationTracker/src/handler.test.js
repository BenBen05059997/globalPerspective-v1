'use strict';
// Offline handler I/O tests for newsSituationTracker: fake S3 that records every get/put/delete, fake CloudWatch.
// Covers the live vs shadow (DRY_RUN) write sets, archive-then-delete of dropped situations, absorbed old ids,
// the inbox read contract and the metric dimension. Run: node --test handler.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const core = require('./_shared/situations-core');

// ── fakes ────────────────────────────────────────────────────────────────────
const objects = new Map();
const ops = [];           // { op: 'get'|'put'|'delete', key, input }
const metrics = [];       // PutMetricData inputs
let failPutKey = null;    // substring: a put whose key contains it throws
class GetObjectCommand { constructor(input) { this.input = input; this.kind = 'get'; } }
class PutObjectCommand { constructor(input) { this.input = input; this.kind = 'put'; } }
class DeleteObjectCommand { constructor(input) { this.input = input; this.kind = 'delete'; } }
class S3Client {
  async send(cmd) {
    const key = cmd.input.Key;
    ops.push({ op: cmd.kind, key, input: cmd.input });
    if (cmd.kind === 'get') {
      if (!objects.has(key)) { const e = new Error('missing'); e.name = 'NoSuchKey'; throw e; }
      return { Body: { transformToString: async () => objects.get(key) } };
    }
    if (cmd.kind === 'put') {
      if (failPutKey && key.includes(failPutKey)) throw new Error(`AccessDenied ${key}`);
      objects.set(key, cmd.input.Body);
      return {};
    }
    objects.delete(key);
    return {};
  }
}
class PutMetricDataCommand { constructor(input) { this.input = input; } }
class CloudWatchClient { async send(cmd) { metrics.push(cmd.input); return {}; } }
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === '@aws-sdk/client-s3') return { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand };
  if (request === '@aws-sdk/client-cloudwatch') return { CloudWatchClient, PutMetricDataCommand };
  return realLoad.call(this, request, ...rest);
};
test.after(() => { Module._load = realLoad; });

const INDEX = require.resolve('./index.js');
function load(env = {}) {
  delete require.cache[INDEX];
  const keys = ['DRY_RUN', ...Object.keys(env)];
  const saved = {};
  for (const k of keys) saved[k] = process.env[k];
  delete process.env.DRY_RUN;
  Object.assign(process.env, env);
  try { return require(INDEX); } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const NOW = Date.parse('2026-10-31T12:00:00.000Z');
const NOW_ISO = '2026-10-31T12:00:00.000Z';
const TTL = 9999999999;
const feature = (type, id, level, iso3, country) => ({
  geometry: { type: 'Point', coordinates: [100, 10] },
  properties: { eventid: id, eventtype: type, alertlevel: level, alertscore: 2, country, iso3, affectedcountries: [{ iso3 }], name: `${type} in ${country}`, severitydata: {} },
});
const obsEq = core.buildObservation(feature('EQ', '77', 'Orange', 'PHL', 'Philippines'), '2026-10-31T11:50:00.000Z');
const gdacsState = (type, id, level, iso3, country) => core.buildSituation(null, core.buildObservation(feature(type, id, level, iso3, country), '2026-10-29T00:00:00.000Z'), '2026-10-29T00:00:00.000Z', TTL).item;
const oldClosed = { ...gdacsState('FL', 'old', 'Orange', 'BRA', 'Brazil'), state: 'closed', closed_at: '2026-10-27T00:00:00.000Z' }; // 4 days > 48h
const cooling = gdacsState('TC', '9', 'Red', 'JPN', 'Japan');

const seed = (prefix = '') => {
  const j = (k, v) => objects.set(k, JSON.stringify(v));
  // upstream inputs always live in the live prefixes
  j('situations/inbox/gdacs-latest.json', { source: 'gdacs', observed_at: '2026-10-31T11:50:00.000Z', events: [obsEq] });
  j('stories/index.json', { updated_at: '2026-10-31T11:00:00.000Z', degraded: false, status: 'ok', count: 0, stories: [] });
  const base = prefix ? 'shadow/situations' : 'situations';
  j(`${base}/index.json`, { ids: [oldClosed.situationId, cooling.situationId] });
  j(`${base}/state/gdacs_FL_old.json`, oldClosed);
  j(`${base}/state/gdacs_TC_9.json`, cooling);
};

test.beforeEach((t) => {
  objects.clear(); ops.length = 0; metrics.length = 0; failPutKey = null;
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
});
const writes = () => ops.filter((o) => o.op !== 'get');
const parsed = (k) => JSON.parse(objects.get(k));

// ── live mode ────────────────────────────────────────────────────────────────
test('live: folds the GDACS inbox, archives then deletes an aged-out closed situation, publishes the world bundle', async () => {
  seed();
  const out = await load({ DRY_RUN: 'false' }).handler();

  assert.equal(out.ok, true);
  assert.equal(out.mode, 'live');
  assert.equal(out.observations, 1);

  // new GDACS event opened; the unlisted open one cools (and does not close yet)
  assert.equal(parsed('situations/state/gdacs_EQ_77.json').tier, 'elevated');
  assert.equal(parsed('situations/state/gdacs_TC_9.json').cooling_checks, 1);
  assert.notEqual(parsed('situations/state/gdacs_TC_9.json').state, 'closed');

  // dropped closed situation: full life story copied to archive/, state object removed
  const archive = parsed('situations/archive/gdacs_FL_old.json');
  assert.equal(archive.situationId, 'gdacs#FL#old');
  assert.equal(archive.archived_at, NOW_ISO);
  assert.equal(archive.state, 'closed');
  assert.ok(!objects.has('situations/state/gdacs_FL_old.json'));
  const iPut = ops.findIndex((o) => o.op === 'put' && o.key === 'situations/archive/gdacs_FL_old.json');
  const iDel = ops.findIndex((o) => o.op === 'delete');
  assert.ok(iPut >= 0 && iDel > iPut, 'archive is written before the state object is deleted');
  assert.deepEqual(ops.filter((o) => o.op === 'delete').map((o) => o.key), ['situations/state/gdacs_FL_old.json']);

  // index lists only survivors
  const index = parsed('situations/index.json');
  assert.deepEqual(index.ids.sort(), ['gdacs#EQ#77', 'gdacs#TC#9']);
  assert.equal(index.situations.length, 2);

  // world bundle: latest (60s cache), member (no cache), timestamped snapshot, history
  const world = parsed('world/latest.json');
  assert.equal(world.generated_at, NOW_ISO);
  assert.equal(world.sources.gdacs, '2026-10-31T11:50:00.000Z');
  assert.equal(world.stale, false); // 10 min old GDACS snapshot is fresh
  assert.deepEqual(world._counts, { open: 2, total: 2 });
  assert.equal(parsed('world/latest.member.json')._member, true);
  assert.equal(ops.find((o) => o.key === 'world/latest.json' && o.op === 'put').input.CacheControl, 'public, max-age=60');
  assert.equal(ops.find((o) => o.key === 'world/latest.member.json' && o.op === 'put').input.CacheControl, undefined);
  assert.ok(objects.has('world/2026/10/31/12/1200.json'));
  assert.equal(parsed('situations/history/2026/10/31/12/1200.json').situations.length, 2);
  assert.ok(!writes().some((o) => o.key.includes('shadow')));

  // the inbox is a stable pointer: read, never written or deleted
  assert.ok(!writes().some((o) => o.key.startsWith('situations/inbox/')));
});

test('live: a stale GDACS snapshot marks the bundle stale; a missing one too', async () => {
  seed();
  objects.set('situations/inbox/gdacs-latest.json', JSON.stringify({ observed_at: '2026-10-31T10:00:00.000Z', events: [obsEq] }));
  await load({ DRY_RUN: 'false' }).handler();
  assert.equal(parsed('world/latest.json').stale, true); // 120 min > 45

  objects.clear(); seed(); objects.delete('situations/inbox/gdacs-latest.json');
  const out = await load({ DRY_RUN: 'false' }).handler();
  assert.equal(out.observations, 0);
  assert.equal(parsed('world/latest.json').stale, true);
  assert.equal(parsed('world/latest.json').sources.gdacs, null);
});

test('live: a failed archive write skips the delete (state is kept) and the sweep still publishes', async () => {
  seed();
  failPutKey = 'situations/archive/';
  const out = await load({ DRY_RUN: 'false' }).handler();
  assert.equal(out.ok, true);
  assert.ok(objects.has('situations/state/gdacs_FL_old.json'), 'never delete a state object whose archive was not written');
  assert.equal(ops.filter((o) => o.op === 'delete').length, 0);
  assert.ok(objects.has('world/latest.json'));
});

test('live: a closed situation inside the keep window is kept, not archived', async () => {
  seed();
  const recent = { ...oldClosed, closed_at: '2026-10-31T00:00:00.000Z' }; // 12h
  objects.set('situations/state/gdacs_FL_old.json', JSON.stringify(recent));
  await load({ DRY_RUN: 'false' }).handler();
  assert.ok(objects.has('situations/state/gdacs_FL_old.json'));
  assert.ok(!objects.has('situations/archive/gdacs_FL_old.json'));
  assert.ok(parsed('world/latest.json').situations.some((s) => s.id === 'gdacs#FL#old' && s.state === 'closed'));
});

test('live: an old news state absorbed into a threaded group is archived, and the group carries its alias', async () => {
  seed();
  const storyOld = { storyId: 'conflict#UKR#russia', title: 'Russia strikes', axis: 'conflict', max_severity: 4, outlets: 4, velocity: 1, spread_new_iso3: [], centroid: { lat: 49, lon: 32 }, iso3: ['UKR'], category: 'war', headlines: [] };
  const prior = core.buildStorySituation(null, core.mergeStories([storyOld]), '2026-10-31T06:00:00.000Z', TTL, { corroborationCap: true, raiseCooldownMin: 180 }).item;
  assert.equal(prior.situationId, 'news#conflict#UKR#russia');
  objects.set('situations/index.json', JSON.stringify({ ids: [prior.situationId] }));
  objects.set('situations/state/news_conflict_UKR_russia.json', JSON.stringify(prior));
  objects.set('stories/index.json', JSON.stringify({ updated_at: NOW_ISO, degraded: false, stories: [storyOld] }));
  objects.set('threads/story-map.json', JSON.stringify({ pairs: { 'conflict#UKR#russia': { threadId: 'thread-war-1' } } }));

  await load({ DRY_RUN: 'false' }).handler();

  const grouped = parsed('situations/state/news_UKR_thread-war-1.json');
  assert.equal(grouped.threadId, 'thread-war-1');
  assert.deepEqual(grouped.aliases, ['news#conflict#UKR#russia']);
  assert.equal(parsed('situations/archive/news_conflict_UKR_russia.json').situationId, 'news#conflict#UKR#russia');
  assert.ok(!objects.has('situations/state/news_conflict_UKR_russia.json'));
  const ids = parsed('situations/index.json').ids;
  assert.ok(ids.includes('news#UKR#thread-war-1') && !ids.includes('news#conflict#UKR#russia'));
  const s = parsed('world/latest.json').situations.find((x) => x.id === 'news#UKR#thread-war-1');
  assert.deepEqual(s.aliases, ['news#conflict#UKR#russia']);
  assert.equal(parsed('world/latest.json').ranked.find((r) => r.id === 'news#UKR#thread-war-1').href, '/weekly/thread/thread-war-1');
});

test('live: emits the sweep metrics tagged Mode=live', async () => {
  seed();
  await load({ DRY_RUN: 'false' }).handler();
  const byName = Object.fromEntries(metrics.map((m) => [m.MetricData[0].MetricName, m.MetricData[0]]));
  assert.equal(byName.Opened.Value, 1);
  assert.equal(byName.Observations.Value, 1);
  assert.equal(byName.SituationsOpen.Value, 2);
  assert.equal(byName.Stale.Value, 0);
  for (const m of metrics) {
    assert.equal(m.Namespace, 'GlobalPerspective/Situations');
    assert.deepEqual(m.MetricData[0].Dimensions, [{ Name: 'Mode', Value: 'live' }]);
  }
});

// ── shadow mode ──────────────────────────────────────────────────────────────
test('shadow (DRY_RUN unset or anything but "false"): writes only under shadow/situations and world/shadow, never the live prefixes or the inbox', async () => {
  for (const env of [{}, { DRY_RUN: 'true' }, { DRY_RUN: 'FALSE' }]) {
    objects.clear(); ops.length = 0; metrics.length = 0;
    seed('shadow');
    // a live universe that shadow must not touch
    objects.set('situations/index.json', JSON.stringify({ ids: ['gdacs#FL#live'] }));
    objects.set('world/latest.json', '{"live":true}');
    const liveSnapshot = new Map([...objects].filter(([k]) => k === 'situations/index.json' || k === 'world/latest.json'));

    const out = await load(env).handler();

    assert.equal(out.mode, 'shadow', JSON.stringify(env));
    const w = writes();
    assert.ok(w.length > 0);
    for (const o of w) {
      assert.ok(o.key.startsWith('shadow/situations/') || o.key.startsWith('world/shadow/'), `unexpected shadow write: ${o.op} ${o.key}`);
    }
    for (const [k, v] of liveSnapshot) assert.equal(objects.get(k), v);
    assert.ok(!w.some((o) => o.key.startsWith('situations/inbox/')));

    // shadow still reads the live inputs
    const reads = ops.filter((o) => o.op === 'get').map((o) => o.key);
    assert.ok(reads.includes('situations/inbox/gdacs-latest.json'));
    assert.ok(reads.includes('stories/index.json'));
    assert.ok(reads.includes('shadow/situations/index.json'));
    assert.ok(!reads.includes('situations/index.json'));

    // the shadow universe is complete: state, index, archive of the aged-out one, world bundle
    assert.ok(objects.has('shadow/situations/state/gdacs_EQ_77.json'));
    assert.ok(objects.has('shadow/situations/archive/gdacs_FL_old.json'));
    assert.ok(!objects.has('shadow/situations/state/gdacs_FL_old.json'));
    assert.ok(objects.has('world/shadow/latest.json'));
    assert.ok(objects.has('world/shadow/latest.member.json'));
    assert.ok(objects.has('world/shadow/2026/10/31/12/1200.json'));
    assert.ok(objects.has('shadow/situations/history/2026/10/31/12/1200.json'));

    for (const m of metrics) assert.deepEqual(m.MetricData[0].Dimensions, [{ Name: 'Mode', Value: 'shadow' }]);
  }
});

test('shadow: deletes only shadow state objects', async () => {
  seed('shadow');
  await load({ DRY_RUN: 'true' }).handler();
  assert.deepEqual(ops.filter((o) => o.op === 'delete').map((o) => o.key), ['shadow/situations/state/gdacs_FL_old.json']);
});

// ── news grouping (NEWS_GROUPING) ────────────────────────────────────────────
const gstory = (storyId, over = {}) => ({ storyId, title: storyId, axis: 'conflict', max_severity: 4, outlets: 4, velocity: 1, spread_new_iso3: [], centroid: { lat: 1, lon: 2 }, iso3: [storyId.split('#')[1]], category: 'war', headlines: [], ...over });
const seedStories = (stories) => {
  seed();
  objects.set('stories/index.json', JSON.stringify({ updated_at: '2026-10-31T11:00:00.000Z', degraded: false, status: 'ok', stories }));
};
const dupes = [
  gstory('conflict#IRN#qeshm', { title: 'Qeshm strike', iso3: ['IRN', 'USA'], headlines: [{ title: 'a', url: 'https://x.com/a?utm=1', domain: 'x.com' }, { title: 'b', url: 'https://x.com/b', domain: 'x.com' }] }),
  gstory('political#USA#pentagon', { title: 'Pentagon on Qeshm', iso3: ['USA'], headlines: [{ title: 'a', url: 'https://X.com/a/', domain: 'x.com' }, { title: 'b', url: 'https://x.com/b/', domain: 'x.com' }] }),
];
const newsIds = (key) => parsed(key).ids.filter((i) => i.startsWith('news#'));

test('grouping flag off (default): two stories sharing a URL stay two situations, no new fields, no merge list', async () => {
  seedStories(dupes);
  const out = await load({ DRY_RUN: 'false' }).handler();
  assert.equal(out.grouping, false);
  assert.deepEqual(newsIds('situations/index.json').sort(), ['news#conflict#IRN#qeshm', 'news#political#USA#pentagon']);
  const st = parsed('situations/state/news_conflict_IRN_qeshm.json');
  for (const k of ['member_story_ids', 'member_urls', 'threadIds', 'also_reported_as']) assert.ok(!(k in st), k);
  assert.ok(!writes().some((o) => o.key.includes('/merges/')));
});

test('grouping flag on + DRY_RUN: merges in the shadow universe only, merge list written, live keys untouched', async () => {
  seedStories(dupes);
  const out = await load({ DRY_RUN: 'true', NEWS_GROUPING: 'true' }).handler();
  assert.equal(out.grouping, true);
  assert.equal(out.merges, 1);
  for (const o of writes()) assert.ok(o.key.startsWith('shadow/') || o.key.startsWith('world/shadow/'), `unexpected write ${o.key}`);
  assert.equal(newsIds('shadow/situations/index.json').length, 1);
  const sit = parsed('world/shadow/latest.json').situations.find((s) => s.source === 'news');
  assert.equal(sit.aliases.length, 1);
  const list = parsed('shadow/situations/merges/2026/10/31/12/1200.json');
  assert.equal(list.merges[0].rule, 'url');
  assert.deepEqual(list.merges[0].urls.sort(), ['https://x.com/a', 'https://x.com/b']);
});

test('grouping flag on, live: the next sweep keeps the group (grouped for life)', async () => {
  seedStories(dupes);
  const mod = load({ DRY_RUN: 'false', NEWS_GROUPING: 'true' });
  await mod.handler();
  const ids1 = newsIds('situations/index.json');
  assert.equal(ids1.length, 1);
  // only the second story is left, with unrelated URLs: its story id still belongs to the group
  objects.set('stories/index.json', JSON.stringify({ updated_at: '2026-10-31T11:00:00.000Z', degraded: false, status: 'ok', stories: [{ ...dupes[1], headlines: [] }] }));
  await mod.handler();
  assert.deepEqual(newsIds('situations/index.json'), ids1);
  const s = parsed(`situations/state/${ids1[0].replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
  assert.ok(s.member_story_ids.includes('conflict#IRN#qeshm') && s.member_story_ids.includes('political#USA#pentagon'));
});
