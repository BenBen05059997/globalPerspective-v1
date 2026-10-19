'use strict';
// L2-IDS (2026-10-19): related ids derived server-side — iso3[] from the resolver, threadId where the row has
// it, canonical-first country lookups, past weekly briefs by week, question verdicts from Q# rows.
// Row shapes follow live samples read 2026-10-19 (DAILY_BRIEF#2026-10-18, WEEKLY_BRIEF#2026-10-18, WEB#INDEX).
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');
process.env.TOPICS_DDB_TABLE = 'T'; process.env.SUMMARIZE_PREDICT_TABLE = 'T'; process.env.PREDICTION_LOG_TABLE = 'P';
const L = require('../src/lib');

const items = {}; // `${PK}|${SK}` -> item
const send = async (c) => {
  const i = c.input;
  if (i.Key) return { Item: items[`${i.Key.PK}|${i.Key.SK}`] };
  const v = i.ExpressionAttributeValues || {};
  if (!i.KeyConditionExpression) return { Items: Object.values(items).filter((it) => String(it.SK).startsWith(v[':d'] || '')) }; // Scan
  const pk = v[':pk'];
  const pre = v[':prefix'] || v[':d'] || '';
  let rows = Object.values(items).filter((it) => it.PK === pk && String(it.SK).startsWith(pre));
  if (v[':s']) rows = Object.values(items).filter((it) => it.PK === pk && String(it.SK) >= v[':s']);
  rows.sort((a, b) => String(b.SK).localeCompare(String(a.SK)));
  return { Items: i.Limit ? rows.slice(0, i.Limit) : rows };
};
const orig = Module._load;
Module._load = function (req, ...r) {
  if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: (t, k) => {
    if (k === 'DynamoDBDocumentClient') return { from: () => ({ send }) };
    return class { constructor(input) { this.input = input; } };
  } });
  return orig.call(this, req, ...r);
};
const { handler } = require('../src/index.js');
Module._load = orig;
const call = async (action, payload) => JSON.parse((await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action, payload }) })).body);
const put = (it) => { items[`${it.PK}|${it.SK}`] = it; };

test('countryKeys: canonical name first, then the requested spelling', () => {
  assert.deepStrictEqual(L.countryKeys('Democratic Republic of the Congo'), ['DR Congo', 'Democratic Republic of the Congo']);
  assert.deepStrictEqual(L.countryKeys('United States'), ['United States']);
  assert.deepStrictEqual(L.countryKeys('Middle East'), ['Middle East']);
});

test('daily_brief: stories and country to watch carry iso3; stored values win', async () => {
  put({ PK: 'DAILY_BRIEF#2026-10-18', SK: 'DAILY_BRIEF', dateKey: '2026-10-18', ttl: 1,
    topStories: [{ title: 'a', regions: ['Israel', 'West Bank'], threadId: 'thread-a' }, { title: 'b', regions: ['Iran', 'Strait of Hormuz'], iso3: ['IRN'] }],
    countryToWatch: { countryName: 'France', riskLevel: 'high' } });
  const b = await call('daily_brief', { dateKey: '2026-10-18' });
  assert.deepStrictEqual(b.data.topStories.map((s) => s.iso3), [['ISR', 'PSE'], ['IRN']]);
  assert.strictEqual(b.data.topStories[0].threadId, 'thread-a');
  assert.deepStrictEqual(b.data.countryToWatch.iso3, ['FRA']);
  assert.strictEqual(b.data.ttl, undefined);
});

test('weekly_brief: signals carry iso3; week= reads one past published week, a draft is null', async () => {
  put({ PK: 'WEEKLY_BRIEF#2026-10-11', SK: 'WEEKLY_BRIEF', weekOf: '2026-10-11', status: 'published', signals: [{ threadId: 't1', region: 'Saudi Arabia · Yemen' }] });
  put({ PK: 'WEEKLY_BRIEF#2026-06-21', SK: 'WEEKLY_BRIEF', weekOf: '2026-06-21', status: 'draft', signals: [] });
  const b = await call('weekly_brief', { week: '2026-10-11' });
  assert.strictEqual(b.data.weekOf, '2026-10-11');
  assert.deepStrictEqual(b.data.signals[0].iso3, ['SAU', 'YEM']);
  assert.strictEqual((await call('weekly_brief', { week: '2026-06-21' })).data, null);
  assert.strictEqual((await call('weekly_brief', { week: 'last week' })).success, false);
});

test('country_intelligence / country_history: an alias reads the canonical record, else its own', async () => {
  put({ PK: 'COUNTRY#United States', SK: 'COUNTRY_INTELLIGENCE', countryName: 'United States', riskScore: 85 });
  put({ PK: 'COUNTRY#Democratic Republic of the Congo', SK: 'COUNTRY_INTELLIGENCE', countryName: 'Democratic Republic of the Congo', riskScore: 90 });
  put({ PK: 'COUNTRY#Democratic Republic of the Congo', SK: 'HISTORY#2026-09-08', riskScore: 90 });
  const b = await call('country_intelligence', { countryNames: ['USA', 'Democratic Republic of the Congo'] });
  assert.strictEqual(b.data.USA.riskScore, 85); // keyed by the requested name
  assert.strictEqual(b.data['Democratic Republic of the Congo'].riskScore, 90); // not merged yet: its own record
  const h = await call('country_history', { countryName: 'Democratic Republic of the Congo' });
  assert.strictEqual(h.snapshots.length, 1);
});

test('web_index: links, shared links and threads carry iso3', async () => {
  put({ PK: 'WEB#INDEX', SK: 'LATEST', runId: 'r1', links: [{ from: 'a', to: 'b', country: 'Japan' }], shared: [{ a: 'a', b: 'c', country: 'USA' }],
    threads: { a: { state: 'linked', places: [{ n: 2, name: 'South Africa' }, { n: 1, name: 'Europe' }] }, b: { state: 'single_update', places: [] } } });
  const b = await call('web_index', {});
  assert.deepStrictEqual(b.data.links[0].iso3, ['JPN']);
  assert.deepStrictEqual(b.data.shared[0].iso3, ['USA']);
  assert.deepStrictEqual(b.data.threads.a.iso3, ['ZAF']);
  assert.deepStrictEqual(b.data.threads.b.iso3, []);
  assert.deepStrictEqual((await call('web_index', { threadId: 'a' })).data.meta.iso3, ['ZAF']);
});

test('corrections_feed: country notes carry iso3, every note its threadId', async () => {
  const rows = [
    { PK: 'COUNTRY#France', SK: 'DRIFT#2026-10-09', asOf: '2026-10-09', triggerEvent: { topicId: 'x-0', threadId: 'thread-fr', title: 'x' } },
    { PK: 'THREAD#thread-q', SK: 'DRIFT#2026-10-08', asOf: '2026-10-08', threadId: 'thread-q' },
  ];
  rows.forEach(put);
  const b = await call('corrections_feed', {});
  const fr = b.notes.find((n) => n.name === 'France');
  const th = b.notes.find((n) => n.scope === 'thread');
  assert.deepStrictEqual([fr.iso3, fr.threadId], [['FRA'], 'thread-fr']);
  assert.deepStrictEqual([th.iso3, th.threadId], [[], 'thread-q']);
});

test('prediction_snapshot: returns threadId; a question trigger\'s verdict comes from its Q# verdict row', async () => {
  put({ PK: 'PRED#t-0', SK: '2026-10-01', topicId: 't-0', threadId: 'thread-t', methodologyVersion: 1, questionSchema: 1, generatedAt: '2026-10-01T04:00:00Z',
    scenarios: [{ label: 'Most Likely', probability: 0.6, triggers: [
      { id: '0-0', text: 'q yes', deadline: '2026-10-10', question: true, qid: 'q1', p: 70 },
      { id: '0-1', text: 'q open', deadline: '2026-12-10', question: true, qid: 'q2', p: 40 },
      { id: '0-2', text: 'legacy', deadline: '2026-10-10', finalVerdict: 'not_fired' },
    ] }] });
  put({ PK: 'Q#q1', SK: 'SAMPLED', qid: 'q1' });
  put({ PK: 'Q#q1', SK: 'VERDICT', qid: 'q1', verdict: 'yes', evidence: { url: 'https://example.org/a' } });
  const b = await call('prediction_snapshot', { topicIds: ['t-0'] });
  assert.strictEqual(b.snapshot.threadId, 'thread-t');
  const [yes, open, legacy] = b.snapshot.scenarios[0].triggers;
  assert.deepStrictEqual([yes.state, yes.verdict], ['yes', 'fired']);
  assert.strictEqual(open.verdict, null);
  assert.strictEqual(legacy.verdict, 'not_fired');
});

test('archive light entries carry iso3 from their regions', () => {
  assert.deepStrictEqual(L.lightEntry({ topicId: 't', regions: ['USA', 'Europe', 'Russia'] }).iso3, ['USA', 'RUS']);
});
