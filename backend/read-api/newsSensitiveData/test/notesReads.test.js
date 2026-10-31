'use strict';
// NOTES_READS (decision 0053): the country and story actions answer from DynamoDB (ddb), from the record's notes (notes) or from
// DynamoDB while logging differences (compare), with the same response shape and the same member gating. The SDK is stubbed:
// DynamoDB serves the rows a note below was built from, S3 serves the notes.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const N = require('../src/_shared/notes');

process.env.TOPICS_DDB_TABLE = 'topics';
process.env.SUMMARIZE_PREDICT_TABLE = 'summary';
const producer = { lambda: 't', runId: 'r' };

const strip = ({ PK, SK, ttl, ...rest }) => rest;
const intel = { PK: 'COUNTRY#Japan', SK: 'COUNTRY_INTELLIGENCE', ttl: 1, countryName: 'Japan', headline: 'H', bluf: 'B', keyDevelopments: ['k'], riskLevel: 'elevated', trajectory: 'stable', totalArticles: 9, dayCount: 3, riskScore: 60,
  dimensions: { political: 60 }, lead: 'political', generatedAt: '2026-10-26T05:15:44.865Z', model: 'm', latencyMs: 1 };
// the HISTORY# row of the day the briefing ran is a subset of the briefing (same generatedAt); the other days are history copies
const hist = (d) => (d === '2026-10-26'
  ? { PK: 'COUNTRY#Japan', SK: `HISTORY#${d}`, countryName: 'Japan', dateKey: d, riskLevel: intel.riskLevel, riskScore: intel.riskScore, dimensions: intel.dimensions, lead: intel.lead, trajectory: intel.trajectory, headline: intel.headline, generatedAt: intel.generatedAt, ttl: 1 }
  : { PK: 'COUNTRY#Japan', SK: `HISTORY#${d}`, countryName: 'Japan', dateKey: d, riskLevel: 'high', riskScore: 70, dimensions: { political: 70 }, lead: 'political', trajectory: 'stable', headline: `h${d}`, generatedAt: `${d}T05:15:00.000Z`, ttl: 1 });
const drift = (d) => ({ countryName: 'Japan', asOf: d, since: '2026-10-01', changeScore: { from: 40, to: 50, delta: 10 }, whyChanged: `w${d}`, noSingleDriver: false, generatedAt: `${d}T05:30:00.000Z` });
const analysis = { PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', ttl: 1, threadId: 't1', threadTitle: 'T', entryShortTitles: [{ shortTitle: 's', topicId: 'x' }], storyArc: 'a', trajectory: 'stable', rootCauseChain: null, watchQuestions: [],
  inflectionTopicId: null, riskScore: 50, dimensions: { conflict: { score: 50, why: 'w' } }, lead: 'conflict', sentiment: 0, keyActors: [], entryCount: 2, entryTopicIds: [], iso3: ['JPN'], generatedAt: '2026-10-12T04:40:00.000Z', model: 'm', latencyMs: 3 };
const storyDrift = { PK: 'THREAD#t1', SK: 'DRIFT#2026-10-12', threadId: 't1', asOf: '2026-10-12', since: '2026-10-11', changeScore: { from: 40, to: 50, delta: 10 }, whyChanged: 'sw', noSingleDriver: false, generatedAt: '2026-10-12T05:30:00.000Z', ttl: 1 };
const facts = { PK: 'FACTS#Japan', SK: 'COUNTRY_FACTS', ttl: 1, countryName: 'Japan', headOfGovernment: { name: 'A', since: '2025-10-21' }, leadershipSource: 'wikidata', lastUpdatedAt: '2026-10-26T20:00:01.500Z',
  capital: { names: ['Tokyo'], source: 'wikidata', checkedAt: '2026-10-26T20:00:01Z' } };

const DAYS = ['2026-10-24', '2026-10-25', '2026-10-26'];
const driftRows = DAYS.map(drift);
const noteSet = {
  country: [N.countryNote({ item: strip(intel), iso3: 'JPN', producer }), ...DAYS.slice(0, 2).map((d) => N.countryHistoryNote({ item: hist(d), iso3: 'JPN', producer }))],
  drift: [...driftRows.map((r) => N.driftNote({ item: r, iso3: 'JPN', model: 'm', producer })), N.storyDriftNote({ item: strip(storyDrift), threadId: 't1', model: 'm', producer })],
  story_analysis: [N.storyAnalysisNote({ item: analysis, producer })],
  country_facts: [N.countryFactsNote({ item: facts, iso3: 'JPN', producer })],
};

function load(mode, { skewNotes } = {}) {
  const logs = { warn: [], info: [], s3Clients: 0 };
  const original = Module._load;
  const ddbRows = (input) => {
    const k = input.Key || {};
    if (k.SK === 'COUNTRY_INTELLIGENCE' && k.PK === 'COUNTRY#Japan') return { Item: intel };
    if (k.SK === 'COUNTRY_FACTS' && k.PK === 'FACTS#Japan') return { Item: facts };
    if (k.SK === 'THREAD_ANALYSIS' && k.PK === 'THREAD#t1') return { Item: analysis };
    if (input.KeyConditionExpression) {
      const pk = input.ExpressionAttributeValues[':pk'];
      const prefix = input.ExpressionAttributeValues[':prefix'] || input.ExpressionAttributeValues[':d'];
      if (pk === 'COUNTRY#Japan' && prefix === 'HISTORY#') return { Items: DAYS.map(hist).reverse() };
      if (pk === 'COUNTRY#Japan' && prefix === 'DRIFT#') return { Items: driftRows.map((r) => ({ PK: pk, SK: `DRIFT#${r.asOf}`, ttl: 1, ...r })).reverse() };
      if (pk === 'COUNTRY#Japan' && prefix === 'DRIFTLOG#') return { Items: driftRows.map((r) => ({ PK: pk, SK: `DRIFTLOG#${r.asOf}`, ...r })).reverse() };
      if (pk === 'THREAD#t1' && prefix === 'DRIFT#') return { Items: [storyDrift] };
      return { Items: [] };
    }
    if (input.FilterExpression) return { Items: [...driftRows.map((r) => ({ PK: 'COUNTRY#Japan', SK: `DRIFT#${r.asOf}`, ...r })), storyDrift] };
    return {};
  };
  const lines = (arr) => arr.map((n) => JSON.stringify(skewNotes && n.subtype === 'drift' ? { ...n, payload: { ...n.payload, whyChanged: 'skewed' } } : n)).join('\n');
  Module._load = function (name, ...args) {
    if (name === '@aws-sdk/client-s3') {
      return {
        S3Client: class { constructor() { logs.s3Clients += 1; } async send(cmd) {
          const m = /^record\/notes\/([a-z_]+)\/(manifest\.json|(\d{4}-\d{2}-\d{2})\.jsonl)$/.exec(cmd.input.Key);
          const none = Object.assign(new Error('no'), { name: 'NoSuchKey' });
          if (!m || !noteSet[m[1]]) throw none;
          const body = m[2] === 'manifest.json' ? JSON.stringify({ schemaVersion: 1, days: [...new Set(noteSet[m[1]].map((n) => n.date))] }) : lines(noteSet[m[1]].filter((n) => n.date === m[3]));
          return { Body: { transformToString: async () => body } };
        } },
        GetObjectCommand: class { constructor(input) { this.input = input; } },
        PutObjectCommand: class { constructor(input) { this.input = input; } },
      };
    }
    if (name === '@aws-sdk/client-dynamodb') return { DynamoDBClient: class {} };
    if (name === '@aws-sdk/lib-dynamodb') {
      const cmd = class { constructor(input) { this.input = input; } };
      return { DynamoDBDocumentClient: { from: () => ({ send: async (c) => ddbRows(c.input) }) }, GetCommand: cmd, QueryCommand: cmd, ScanCommand: cmd, BatchGetCommand: cmd };
    }
    return original.call(this, name, ...args);
  };
  process.env.NOTES_READS = mode;
  for (const f of ['../src/index.js', '../src/records.js']) delete require.cache[require.resolve(f)];
  const { handler } = require('../src/index.js');
  const call = async (action, payload) => {
    const info = console.info; const warn = console.warn;
    console.info = (...a) => logs.info.push(a.join(' ')); console.warn = (...a) => logs.warn.push(a.join(' '));
    try { return JSON.parse((await handler({ headers: {}, httpMethod: 'POST', body: JSON.stringify({ action, payload }) })).body); } finally { console.info = info; console.warn = warn; Module._load = original; }
  };
  // the stub stays in place until the first call has run (the S3 client is built lazily, on the first notes read)
  return { call, logs };
}

const ACTIONS = [
  ['country_history', { countryName: 'Japan' }],
  ['corrections_feed', {}],
  ['thread_analysis', { threadIds: ['t1', 'nope'] }],
  ['country_intelligence', { countryNames: ['Japan', 'Nowhere'] }],
  ['country_facts', { countryNames: ['Japan'] }],
  ['country_preview', { countryName: 'Japan' }],
  ['thread_preview', { threadId: 't1' }],
];

test('notes mode answers every action with the DynamoDB mode response (signed out: drift depth capped to 1 with the honest total)', async () => {
  for (const [action, payload] of ACTIONS) {
    const a = await load('ddb').call(action, payload);
    const b = await load('notes').call(action, payload);
    assert.deepEqual(b, a, action);
    assert.equal(a.success, true, action);
  }
  const h = await load('notes').call('country_history', { countryName: 'Japan' });
  assert.deepEqual([h.snapshots.length, h.driftNotes.length, h.driftNotesTotal, h.driftNotesGated], [3, 1, 3, true]);
  assert.equal(h.driftNotes[0].asOf, '2026-10-26');
  const f = await load('notes').call('corrections_feed', {});
  assert.deepEqual([f.total, f.notes.length, f.gated], [4, 4, false]); // 5 shown free; 4 exist
  const t = await load('notes').call('thread_analysis', { threadIds: ['t1', 'nope'] });
  assert.deepEqual([Object.keys(t.data), t.data.t1.driftNote.asOf], [['t1'], '2026-10-12']);
});

test('compare mode answers from DynamoDB and logs "same" or the first difference per read', async () => {
  const same = load('compare');
  const out = await same.call('country_history', { countryName: 'Japan' });
  assert.equal(out.snapshots.length, 3);
  assert.ok(same.logs.info.some((l) => l.includes('[notes-compare] countryHistory') && l.endsWith(': same')), same.logs.info.join('\n'));
  const skew = load('compare', { skewNotes: true });
  const again = await skew.call('country_history', { countryName: 'Japan' });
  assert.equal(again.driftNotes[0].whyChanged, 'w2026-10-26'); // the DynamoDB answer
  assert.ok(skew.logs.warn.some((l) => l.includes('[notes-compare] countryHistory') && l.includes('whyChanged')), skew.logs.warn.join('\n'));
});

test('ddb mode (the default) never builds an S3 client', async () => {
  const r = load('ddb');
  await r.call('country_history', { countryName: 'Japan' });
  assert.equal(r.logs.s3Clients, 0);
  const n = load('notes');
  await n.call('country_history', { countryName: 'Japan' });
  assert.equal(n.logs.s3Clients, 1);
});
