'use strict';
// An in-memory store with the same interface as src/store.js, plus world fixtures shaped like the live rows.

const { createHandler } = require('../src');

const ENV = { SAVED_ITEMS_TABLE: 'saved', USER_PREFS_TABLE: 'prefs', SUMMARIZE_PREDICT_TABLE: 'world', TOPICS_DDB_TABLE: 'news' };
const NOW = Date.parse('2026-10-20T12:00:00.000Z');

function fakeStore() {
  const rows = new Map(); // `${table}|${pk}|${sk}` -> item
  const calls = [];
  const k = (t, pk, sk) => `${t}|${pk}|${sk}`;
  const store = {
    calls,
    rows,
    put(table, pk, sk, item) { rows.set(k(table, pk, sk), item); },
    async getBoards(uid) { return [...rows.values()].filter((i) => i.uid === uid && String(i.savedKey).startsWith('board#')); },
    async getBoard(uid, boardId) { return rows.get(k('saved', uid, `board#${boardId}`)) || null; },
    async putBoard(item) { calls.push(['putBoard', item.savedKey]); rows.set(k('saved', item.uid, item.savedKey), item); },
    async deleteBoard(uid, boardId) { calls.push(['deleteBoard', boardId]); rows.delete(k('saved', uid, `board#${boardId}`)); },
    async getFollows(uid) {
      const it = rows.get(k('prefs', uid, '')) || {};
      return { followedThreads: [...(it.followedThreads || [])], followedActors: [...(it.followedActors || [])] };
    },
    async setFollows(uid, fields) {
      calls.push(['setFollows', Object.keys(fields)]);
      const key = k('prefs', uid, '');
      rows.set(key, { ...(rows.get(key) || { uid }), ...fields }); // SET on the given attributes only
    },
    async getItem(table, key) { return rows.get(k(table, key.PK || key.id, key.SK || '')) || null; },
    async batchGet(table, keys) { return keys.map((key) => rows.get(k(table, key.PK, key.SK))).filter(Boolean); },
    async query(table, pk, prefix) {
      return [...rows.entries()].filter(([key]) => key.startsWith(`${table}|${pk}|${prefix}`)).map(([, v]) => v);
    },
  };
  return store;
}

const verifyAs = (uid) => async (header) => (header === `Bearer ${uid}` ? { sub: uid } : null);
const verify = async (header) => (header && header.startsWith('Bearer ') ? { sub: header.slice(7) } : null);

function setup({ withWorld = true, now = NOW } = {}) {
  const store = fakeStore();
  let clock = now;
  const handler = createHandler({ store, verify, now: () => clock, env: ENV });
  if (withWorld) seedWorld(store);
  const call = async (uid, body) => {
    const res = await handler({
      requestContext: { http: { method: 'POST' } },
      headers: uid ? { authorization: `Bearer ${uid}` } : {},
      body: JSON.stringify(body),
    });
    return { status: res.statusCode, headers: res.headers, ...JSON.parse(res.body) };
  };
  return { store, call, handler, setNow: (t) => { clock = t; } };
}

// Three Middle East threads (two share actors, two are linked), one Europe thread, one thread with no region.
function seedWorld(store) {
  const day = (n) => new Date(NOW - n * 86400000).toISOString().slice(0, 10);
  store.put('world', 'WEB#INDEX', 'LATEST', {
    links: [{ from: 'thread-hormuz', to: 'thread-oil', confidence: 'medium', lagDays: 2, mechanism: 'Hormuz closure raises crude prices.', cited: [], country: 'Iran', generatedAt: '2026-10-19T05:00:00.000Z' }],
    shared: [
      { a: 'thread-hormuz', b: 'thread-oil', actors: ['Iran', 'oil'], weight: 2, country: 'Iran', generatedAt: '2026-10-19T05:00:00.000Z' },
      { a: 'thread-hormuz', b: 'thread-gaza', actors: ['Iran', 'Hezbollah'], weight: 2, country: 'Iran', generatedAt: '2026-10-19T05:00:00.000Z' },
    ],
    threads: {
      'thread-hormuz': { state: 'linked', title: 'Hormuz tanker incident', entries: 4, places: [{ name: 'Iran', n: 3 }], analysedIn: [] },
      'thread-oil': { state: 'linked', title: 'Oil spikes', entries: 3, places: [{ name: 'Saudi Arabia', n: 2 }], analysedIn: [] },
      'thread-gaza': { state: 'analysed_no_links', title: 'Gaza talks', entries: 2, places: [{ name: 'Israel', n: 2 }], analysedIn: [] },
      'thread-eu': { state: 'single_update', title: 'EU summit', entries: 1, places: [{ name: 'France', n: 1 }], analysedIn: [] },
      'thread-nowhere': { state: 'single_update', title: 'Somewhere', entries: 1, places: [], analysedIn: [] },
    },
  });
  const analysis = (id, risk, extra = {}) => store.put('world', `THREAD#${id}`, 'THREAD_ANALYSIS', { PK: `THREAD#${id}`, SK: 'THREAD_ANALYSIS', threadId: id, threadTitle: `Title ${id}`, riskScore: risk, lead: 'conflict', keyActors: [], ...extra });
  analysis('thread-hormuz', 80, { iso3: ['IRN'], keyActors: [{ name: 'Strait of Hormuz', mentionCount: 5 }, { name: 'Iran' }] });
  analysis('thread-oil', 60, { iso3: ['SAU'], keyActors: [{ name: 'OPEC' }, { name: 'iran' }] });
  analysis('thread-gaza', 70, {}); // older row: no iso3 attribute, region from the web's places
  analysis('thread-eu', 50, { iso3: ['FRA'] });
  analysis('thread-nowhere', 90, {});
  store.put('news', 'latest', '', { id: 'latest', topics: [
    { threadId: 'thread-hormuz', title: 'Tanker hit near Hormuz', actors: ['Iran'], iso3: ['IRN'], sources: [{ source: 'reuters.com' }, { source: 'bbc.com' }] },
    { threadId: 'thread-oil', title: 'Oil spikes', actors: [], iso3: ['SAU'], sources: [{ source: 'reuters.com' }, { source: 'ft.com' }] },
  ] });
  // Daily scores: hormuz and oil move together twice (lag 1 day).
  const series = (id, scores) => scores.forEach(([d, s]) => store.put('world', `THREAD#${id}`, `THREAD_HISTORY#${day(d)}`, { dateKey: day(d), riskScore: s }));
  series('thread-hormuz', [[10, 40], [8, 55], [4, 56], [3, 70]]);
  series('thread-oil', [[10, 30], [7, 45], [4, 46], [2, 60]]);
  series('thread-gaza', [[10, 50], [3, 51]]);
  store.put('world', 'COUNTRY#Iran', `HISTORY#${day(10)}`, { dateKey: day(10), riskScore: 30 });
  store.put('world', 'COUNTRY#Iran', `HISTORY#${day(8)}`, { dateKey: day(8), riskScore: 50 });
  store.put('world', 'COUNTRY#Iran', `HISTORY#${day(4)}`, { dateKey: day(4), riskScore: 52 });
  store.put('world', 'COUNTRY#Iran', `HISTORY#${day(3)}`, { dateKey: day(3), riskScore: 70 });
}

const validBoardBody = (over = {}) => ({
  name: 'Gulf',
  pins: [
    { pinId: 'p1', kind: 'thread', refId: 'thread-hormuz', addedAt: '2026-10-20T08:00:00.000Z' },
    { pinId: 'p2', kind: 'country', refId: 'USA', addedAt: '2026-10-20T08:01:00.000Z' },
  ],
  strings: [{ a: 'p2', b: 'p1', owner: 'ours', strength: 'inferred', mechanism: 'shared place' }],
  weights: {}, dismissed: [], summary: { versions: [] },
  ...over,
});

module.exports = { setup, fakeStore, verifyAs, ENV, NOW, validBoardBody };
