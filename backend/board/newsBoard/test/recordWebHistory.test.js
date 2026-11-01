'use strict';
// RECORD_READS (decision 0054) for the story web and the score histories: under `record` the board reads WEB#INDEX/LATEST from
// record/views/index/web.json and THREAD_HISTORY# / COUNTRY# HISTORY# from the record's notes (story_analysis, story_history, country), and
// makes no DynamoDB call for them; presets and connect come out the same as from DynamoDB. Stale views read DynamoDB; compare logs differences.
const test = require('node:test');
const assert = require('node:assert');
const world = require('../src/world');
const { computePresets } = require('../src/presets');
const { connect } = require('../src/connect');
const { fakeStore, ENV, NOW } = require('./helpers');
const { makeRecordReads } = require('../src/_shared/recordReads');

const iso = (offsetH) => new Date(NOW - offsetH * 3600000).toISOString();
const day = (offsetD) => iso(offsetD * 24).slice(0, 10);
const ANALYSES = {
  'thread-a': { threadTitle: 'A', riskScore: 70, lead: 'political', iso3: ['IRN', 'ISR'], keyActors: [{ name: 'IRGC' }], generatedAt: iso(10) },
  'thread-b': { threadTitle: 'B', riskScore: 50, lead: 'conflict', iso3: ['IRN', 'IRQ'], keyActors: [{ name: 'IRGC' }], generatedAt: iso(12) },
  'thread-c': { threadTitle: 'C', riskScore: 30, lead: 'economic', iso3: ['IRQ'], generatedAt: iso(9) },
};
// the story web: one causal link and one shared-actor pair, the threads with their places
const WEB = {
  generatedAt: iso(3),
  links: [{ from: 'thread-b', to: 'thread-a', confidence: 'weak', lagDays: 3, mechanism: 'B feeds A', cited: [], country: 'Iran', generatedAt: iso(3) }],
  shared: [{ a: 'thread-a', b: 'thread-c', actors: ['IRGC'], weight: 2, country: 'Iraq', generatedAt: iso(3) }],
  threads: {
    'thread-a': { state: 'active', title: 'A', entries: 4, places: [{ name: 'Iran', n: 3 }], analysedIn: [{ country: 'Iran', generatedAt: iso(3) }] },
    'thread-b': { state: 'active', title: 'B', entries: 2, places: [{ name: 'Iraq', n: 2 }], analysedIn: [] },
    'thread-c': { state: 'single_update', title: 'C', entries: 1, places: [], analysedIn: [] },
  },
};
// daily scores: [offset days, score]
const THREAD_SCORES = { 'thread-a': [[3, 40], [2, 55], [1, 70]], 'thread-b': [[3, 30], [2, 42], [1, 50]], 'thread-c': [[3, 20], [2, 35], [1, 50]] };
const COUNTRY_SCORES = { Iran: ['IRN', [[3, 50], [2, 60], [1, 65]]], Iraq: ['IRQ', [[3, 30], [2, 45], [1, 60]]] };

function worldWith() {
  const store = fakeStore();
  for (const [id, a] of Object.entries(ANALYSES)) store.put('world', `THREAD#${id}`, 'THREAD_ANALYSIS', { PK: `THREAD#${id}`, SK: 'THREAD_ANALYSIS', threadId: id, ...a, ttl: Math.floor((NOW + 86400000) / 1000) });
  store.put('news', 'latest', '', { id: 'latest', topics: [], updatedAt: iso(2) });
  store.put('world', 'WEB#INDEX', 'LATEST', { PK: 'WEB#INDEX', SK: 'LATEST', ...WEB });
  const notes = { story_analysis: [], story_history: [], country: [] };
  for (const [id, scores] of Object.entries(THREAD_SCORES)) {
    scores.forEach(([d, score], i) => {
      const at = `${day(d)}T06:00:00.000Z`;
      const row = { threadTitle: ANALYSES[id].threadTitle, trajectory: 'rising', riskScore: score, lead: ANALYSES[id].lead, entryCount: i + 1 };
      store.put('world', `THREAD#${id}`, `THREAD_HISTORY#${day(d)}`, { PK: `THREAD#${id}`, SK: `THREAD_HISTORY#${day(d)}`, threadId: id, dateKey: day(d), ...row, generatedAt: at, ttl: 1 });
      // the newest day is an analysis note, the days before history copies (as the backfill left them)
      const subtype = i === scores.length - 1 ? 'story_analysis' : 'story_history';
      notes[subtype].push({ subtype, subject: { kind: 'story', id }, date: day(d), at, iso3: [], payload: { ...row, ...(subtype === 'story_history' ? { dateKey: day(d), from: 'history' } : {}) } });
    });
  }
  for (const [name, [code, scores]] of Object.entries(COUNTRY_SCORES)) {
    for (const [d, score] of scores) {
      const at = `${day(d)}T07:00:00.000Z`;
      const row = { countryName: name, riskScore: score, riskLevel: 'high', trajectory: 'stable', headline: `${name} ${d}` };
      store.put('world', `COUNTRY#${name}`, `HISTORY#${day(d)}`, { PK: `COUNTRY#${name}`, SK: `HISTORY#${day(d)}`, dateKey: day(d), ...row, generatedAt: at });
      notes.country.push({ subtype: 'country', subject: { kind: 'country', id: code }, date: day(d), at, iso3: [code], payload: row });
    }
  }
  const files = {
    'record/views/manifest.json': { builtAt: iso(1) },
    'record/views/index/web.json': {
      schemaVersion: 1, builtFrom: {}, maxAgeDays: 30, websUsed: [], ...WEB,
      shared: WEB.shared.map((s) => ({ ...s, iso3: ['IRQ'] })), links: WEB.links.map((l) => ({ ...l, iso3: ['IRN'] })),
      threads: Object.fromEntries(Object.entries(WEB.threads).map(([id, t]) => [id, { ...t, iso3: [] }])),
    },
    ...Object.fromEntries(Object.entries(ANALYSES).map(([id, a]) => [`record/views/stories/${id}.json`, { threadId: id, analysis: { ...a, threadId: id, iso3: [...a.iso3].sort() } }])),
  };
  const reads = [];
  store.recordReads = makeRecordReads({ getJson: async (k) => { reads.push(k); return files[k] ?? null; }, now: () => NOW });
  store.noteReader = { all: async (subtype) => { reads.push(`notes/${subtype}`); return notes[subtype] || []; } };
  // every DynamoDB key the world reads ask for
  const ddbReads = [];
  const { getItem, query } = store;
  store.getItem = (table, key) => { ddbReads.push(`${key.PK || key.id}|${key.SK || ''}`); return getItem(table, key); };
  store.query = (table, pk, prefix) => { ddbReads.push(`${pk}|${prefix}`); return query(table, pk, prefix); };
  return { store, reads, files, ddbReads };
}
const env = (mode) => ({ ...ENV, ...(mode ? { RECORD_READS: mode } : {}) });
const OLD_FAMILIES = /^(WEB#INDEX|THREAD#[^|]+\|THREAD_HISTORY#|COUNTRY#[^|]+\|HISTORY#)/;
const PAIRS = [
  [{ kind: 'thread', refId: 'thread-a' }, { kind: 'thread', refId: 'thread-b' }], // two threads that share a country and an actor
  [{ kind: 'thread', refId: 'thread-c' }, { kind: 'country', refId: 'Iraq' }],
  [{ kind: 'country', refId: 'IRN' }, { kind: 'country', refId: 'Iraq' }],
];

test('record: the same story web and the same score histories as DynamoDB', async () => {
  const { store } = worldWith();
  const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'sourceRow' ? undefined : v)));
  assert.deepStrictEqual(strip(await world.webIndex(store, env('record'))), strip(await world.webIndex(store, env())));
  for (const id of Object.keys(THREAD_SCORES)) {
    const d = await world.threadHistory(store, env(), id);
    assert.strictEqual(d.length, THREAD_SCORES[id].length);
    assert.deepStrictEqual(await world.threadHistory(store, env('record'), id), d, id);
  }
  for (const name of Object.keys(COUNTRY_SCORES)) assert.deepStrictEqual(await world.countryHistory(store, env('record'), name), await world.countryHistory(store, env(), name), name);
  assert.deepStrictEqual(await world.countryHistory(store, env('record'), 'Atlantis'), []);
});

test('record presets and connect are the same as ddb, with no DynamoDB read of WEB#INDEX, THREAD_HISTORY# or HISTORY#', async () => {
  const { store, ddbReads, reads } = worldWith();
  const d = await computePresets(store, env(), NOW);
  const dc = await Promise.all(PAIRS.map(([a, b]) => connect(store, env(), NOW, a, b)));
  assert.ok(d.length > 0 && d.some((p) => p.strings.length));
  assert.ok(dc.every((c) => c.result && c.result.grounds.some((g) => g.kind === 'comovement')));
  assert.ok(ddbReads.some((k) => OLD_FAMILIES.test(k)));
  ddbReads.length = 0;
  assert.deepStrictEqual(await computePresets(store, env('record'), NOW), d);
  assert.deepStrictEqual(await Promise.all(PAIRS.map(([a, b]) => connect(store, env('record'), NOW, a, b))), dc);
  assert.deepStrictEqual(ddbReads.filter((k) => OLD_FAMILIES.test(k)), []);
  for (const k of ['record/views/index/web.json', 'notes/story_analysis', 'notes/story_history', 'notes/country']) assert.ok(reads.includes(k), k);
});

test('stale views: record mode reads the web and the histories from DynamoDB', async () => {
  const { store, files, ddbReads, reads } = worldWith();
  files['record/views/manifest.json'] = { builtAt: iso(30) };
  const out = await connect(store, env('record'), NOW, ...PAIRS[0]);
  assert.ok(out.result.grounds.some((g) => g.kind === 'comovement'));
  for (const k of ['WEB#INDEX|LATEST', 'THREAD#thread-a|THREAD_HISTORY#', 'THREAD#thread-b|THREAD_HISTORY#']) assert.ok(ddbReads.includes(k), k);
  assert.ok(!reads.some((k) => k.startsWith('notes/') || k.endsWith('index/web.json')));
  assert.strictEqual((await world.countryHistory(store, env('record'), 'Iran')).length, 3);
});

test('compare: DynamoDB answers and a difference is logged', async (t) => {
  const { store, files } = worldWith();
  files['record/views/index/web.json'].links[0].mechanism = 'changed';
  const warned = [];
  t.mock.method(console, 'warn', (m) => warned.push(m));
  t.mock.method(console, 'log', () => {});
  const w = await world.webIndex(store, env('compare'));
  assert.strictEqual(w.links[0].mechanism, 'B feeds A');
  assert.ok(warned.some((m) => /board web_index: DIFFER .*mechanism/.test(m)), warned.join('\n'));
  store.put('world', 'THREAD#thread-a', `THREAD_HISTORY#${day(4)}`, { PK: 'THREAD#thread-a', SK: `THREAD_HISTORY#${day(4)}`, dateKey: day(4), riskScore: 20 });
  assert.strictEqual((await world.threadHistory(store, env('compare'), 'thread-a')).length, 4);
  assert.ok(warned.some((m) => m.includes('board thread_history thread-a: DIFFER')), warned.join('\n'));
});
