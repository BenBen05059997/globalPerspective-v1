'use strict';
const test = require('node:test');
const assert = require('node:assert');
const world = require('../src/world');
const { computePresets } = require('../src/presets');
const { fakeStore, ENV, NOW } = require('./helpers');

test('world.js reads through _shared/world: the board store is the world client', async () => {
  const store = fakeStore();
  store.put('world', 'THREAD#t1', 'THREAD_ANALYSIS', { threadId: 't1', threadTitle: 'One', riskScore: '62', iso3: ['IRN'], keyActors: ['Iran', { name: 'OPEC' }], ttl: Math.floor(NOW / 1000) + 100 });
  store.put('world', 'THREAD#t2', 'THREAD_ANALYSIS', { threadId: 't2', threadTitle: 'Expired', riskScore: 10, ttl: Math.floor(NOW / 1000) - 100 });
  const rows = await world.analyses(store, ENV, ['t1', 't2', 't3'], NOW);
  assert.ok(rows instanceof Map);
  assert.deepStrictEqual([...rows.keys()], ['t1']); // t2 past its TTL, t3 has no row
  assert.strictEqual(rows.get('t1').riskScore, 62); // numeric string normalised
  assert.deepStrictEqual(world.threadActors('t1', rows.get('t1'), null, { shared: [] }), ['Iran', 'OPEC']);
  assert.deepStrictEqual((await world.analyses(store, ENV, [], NOW)).size, 0);
});

test('world.js history and index come back normalised; absent rows are empty', async () => {
  const store = fakeStore();
  store.put('world', 'THREAD#t1', 'THREAD_HISTORY#2026-10-02', { dateKey: '2026-10-02', riskScore: 40 });
  store.put('world', 'THREAD#t1', 'THREAD_HISTORY#2026-10-01', { SK: 'THREAD_HISTORY#2026-10-01', riskScore: 30 }); // real rows carry SK; the date comes from it
  store.put('world', 'THREAD#t1', 'THREAD_HISTORY#2026-10-03', { dateKey: '2026-10-03' }); // no score: dropped
  const h = await world.threadHistory(store, ENV, 't1');
  assert.deepStrictEqual(h.map((p) => [p.date, p.score]), [['2026-10-01', 30], ['2026-10-02', 40]]);
  assert.deepStrictEqual(await world.countryHistory(store, ENV, 'Nowhere'), []);
  assert.deepStrictEqual(await world.webIndex(store, ENV), { generatedAt: null, links: [], shared: [], threads: {} });
  assert.deepStrictEqual(await world.latestTopics(store, ENV), []);
});

test('threadOutlets: distinct hosts of a topic, one name per outlet; no topic is no outlets', () => {
  assert.deepStrictEqual(world.threadOutlets({ sources: [{ source: 'Reuters.com' }, { source: 'www.reuters.com' }, { source: 'bbc.com' }, {}] }), ['bbc.com', 'reuters.com']);
  assert.deepStrictEqual(world.threadOutlets(undefined), []);
});

test('presets skip an analysis that has no risk score instead of ranking it as 0', async () => {
  const store = fakeStore();
  const put = (id, extra) => store.put('world', `THREAD#${id}`, 'THREAD_ANALYSIS', { threadId: id, threadTitle: id, iso3: ['IRN'], ...extra });
  put('scored-a', { riskScore: 50 });
  put('scored-b', { riskScore: 40 });
  put('unscored', {});
  store.put('world', 'WEB#INDEX', 'LATEST', { links: [], shared: [], threads: { 'scored-a': {}, 'scored-b': {}, unscored: {} } });
  const presets = await computePresets(store, ENV, NOW);
  assert.deepStrictEqual(presets.map((p) => p.pins.map((x) => x.refId)), [['scored-a', 'scored-b']]);
});

test('presets: a story is in every region its countries fall in, whatever the order of its list', async () => {
  for (const iso3 of [['COD', 'NGA', 'CHE'], ['CHE', 'COD', 'NGA']]) { // most-mentioned first (DynamoDB) and sorted (the record's note)
    const store = fakeStore();
    const analysis = (id, risk, extra) => store.put('world', `THREAD#${id}`, 'THREAD_ANALYSIS', { threadId: id, threadTitle: id, riskScore: risk, ...extra });
    analysis('ebola', 70, { iso3 });
    analysis('sahel', 60, { iso3: ['MLI'] });
    analysis('paris', 50, { iso3: ['FRA'] });
    analysis('geneva-only', 40, { iso3: ['CHE', 'CHE'] });
    store.put('world', 'WEB#INDEX', 'LATEST', { links: [], shared: [], threads: { ebola: {}, sahel: {}, paris: {}, 'geneva-only': {} } });
    const presets = await computePresets(store, ENV, NOW);
    assert.deepStrictEqual(presets.map((p) => [p.region, p.pins.map((x) => x.refId)]), [
      ['Africa', ['ebola', 'sahel']],
      ['Europe', ['ebola', 'paris', 'geneva-only']],
    ]);
  }
});
