'use strict';
// NOTES_READS (decision 0053): the corrector's history and "already noted" reads answer the same from the record's notes as from
// DynamoDB (notes mode), and compare mode answers from DynamoDB and logs the difference. DynamoDB and S3 are stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const N = require('../src/_shared/notes');

const producer = { lambda: 't', runId: 'r' };
const hist = (d, score) => ({ PK: 'COUNTRY#Japan', SK: `HISTORY#${d}`, countryName: 'Japan', dateKey: d, riskLevel: 'high', riskScore: score, dimensions: { political: score }, lead: 'political', trajectory: 'stable', headline: `h${d}`, generatedAt: `${d}T05:15:00.000Z`, ttl: 1 });
const HIST = [hist('2026-10-24', 60), hist('2026-10-25', 70)];
const driftItem = { countryName: 'Japan', asOf: '2026-10-25', since: '2026-10-24', changeScore: { from: 60, to: 70, delta: 10 }, whyChanged: 'w', noSingleDriver: false, generatedAt: '2026-10-25T05:30:00.000Z' };
const analysis = (d, score) => ({ PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', threadId: 't1', threadTitle: 'T', entryShortTitles: [], storyArc: 'a', trajectory: 'stable', rootCauseChain: null, watchQuestions: [], inflectionTopicId: null, riskScore: score,
  dimensions: { conflict: { score, why: 'w' } }, lead: 'conflict', sentiment: 0, keyActors: [], entryCount: 2, entryTopicIds: [], iso3: [], generatedAt: `${d}T04:40:00.000Z`, model: 'm', latencyMs: 3 });
const THREAD_ROWS = [
  { PK: 'THREAD#t1', SK: 'THREAD_HISTORY#2026-10-10', threadId: 't1', dateKey: '2026-10-10', threadTitle: 'T', trajectory: 'stable', riskScore: 40, dimensions: null, lead: null, entryCount: 1, generatedAt: '2026-10-10T04:41:00.000Z', ttl: 1 },
  { PK: 'THREAD#t1', SK: 'THREAD_HISTORY#2026-10-11', threadId: 't1', dateKey: '2026-10-11', threadTitle: 'T', trajectory: 'stable', riskScore: 50, dimensions: { conflict: { score: 50, why: 'w' } }, lead: 'conflict', entryCount: 2, generatedAt: '2026-10-11T04:41:00.000Z', ttl: 1 },
];
const noteSet = {
  country: [N.countryHistoryNote({ item: HIST[0], iso3: 'JPN', producer }), N.countryHistoryNote({ item: HIST[1], iso3: 'JPN', producer })],
  drift: [N.driftNote({ item: driftItem, iso3: 'JPN', model: 'm', producer })],
  story_analysis: [N.storyAnalysisNote({ item: analysis('2026-10-11', 50), producer })],
  story_history: [N.storyHistoryNote({ item: THREAD_ROWS[0], producer })],
};

function load(mode, { skew } = {}) {
  const logs = { warn: [], info: [] };
  const original = Module._load;
  Module._load = function (name, ...args) {
    if (name === '@aws-sdk/client-s3') {
      return {
        S3Client: class { async send(cmd) {
          const m = /^record\/notes\/([a-z_]+)\/(manifest\.json|(\d{4}-\d{2}-\d{2})\.jsonl)$/.exec(cmd.input.Key);
          if (!m || !noteSet[m[1]]) throw Object.assign(new Error('no'), { name: 'NoSuchKey' });
          const body = m[2] === 'manifest.json' ? JSON.stringify({ schemaVersion: 1, days: [...new Set(noteSet[m[1]].map((n) => n.date))] }) : noteSet[m[1]].filter((n) => n.date === m[3]).map((n) => JSON.stringify(n)).join('\n');
          return { Body: { transformToString: async () => body } };
        } },
        GetObjectCommand: class { constructor(input) { this.input = input; } },
        PutObjectCommand: class { constructor(input) { this.input = input; } },
      };
    }
    if (name === '@aws-sdk/client-dynamodb') return { DynamoDBClient: class {} };
    if (name === '@aws-sdk/lib-dynamodb') {
      const cmd = class { constructor(input) { this.input = input; } };
      const send = async (c) => {
        const i = c.input;
        if (i.Key) return { Item: i.Key.SK === 'DRIFT#2026-10-25' && i.Key.PK === 'COUNTRY#Japan' ? { ...driftItem } : (skew && i.Key.PK === 'THREAD#t1' ? { PK: 'x' } : undefined) };
        const prefix = i.ExpressionAttributeValues[':h'];
        if (prefix === 'HISTORY#') return { Items: skew ? [HIST[0]] : HIST };
        if (prefix === 'THREAD_HISTORY#') return { Items: THREAD_ROWS };
        return { Items: [] };
      };
      return { DynamoDBDocumentClient: { from: () => ({ send }) }, GetCommand: cmd, QueryCommand: cmd, PutCommand: cmd };
    }
    return original.call(this, name, ...args);
  };
  process.env.NOTES_READS = mode;
  process.env.SUMMARIZE_PREDICT_TABLE = 'T';
  process.env.TOPICS_DDB_TABLE = 'T';
  delete require.cache[require.resolve('../src/index.js')];
  const { reads } = require('../src/index.js');
  const wrap = (fn) => async (...a) => {
    const info = console.info; const warn = console.warn;
    console.info = (...x) => logs.info.push(x.join(' ')); console.warn = (...x) => logs.warn.push(x.join(' '));
    try { return await fn(...a); } finally { console.info = info; console.warn = warn; Module._load = original; }
  };
  return { reads: Object.fromEntries(Object.entries(reads).map(([k, fn]) => [k, wrap(fn)])), logs };
}

test('notes mode: history, already-noted and thread history match what DynamoDB answers', async () => {
  const strip = (rows) => rows.map(({ dateKey, riskLevel, riskScore, dimensions, trajectory, headline, lead }) => ({ dateKey, riskLevel, riskScore, dimensions, trajectory, headline, lead }));
  const byDay = (rows) => rows.slice().sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
  const d = await load('ddb').reads.readHistory('Japan');
  const n = await load('notes').reads.readHistory('Japan');
  assert.deepEqual(byDay(strip(n)), byDay(strip(d)));
  assert.equal(n.length, 2);
  assert.deepEqual([await load('notes').reads.alreadyNoted('Japan', '2026-10-25'), await load('notes').reads.alreadyNoted('Japan', '2026-10-24'), await load('notes').reads.alreadyNoted('Atlantis', '2026-10-25')], [true, false, false]);
  assert.deepEqual([await load('ddb').reads.alreadyNoted('Japan', '2026-10-25'), await load('ddb').reads.alreadyNoted('Japan', '2026-10-24')], [true, false]);
  const td = await load('ddb').reads.readThreadHistory('t1');
  const tn = await load('notes').reads.readThreadHistory('t1');
  assert.deepEqual(byDay(tn), byDay(td).map((r) => ({ ...r, dimensions: r.dimensions }))); // 10-10 from the history copy, 10-11 from the analysis note
});

test('compare mode answers from DynamoDB and logs the difference; the default mode logs nothing', async () => {
  const c = load('compare', { skew: true });
  const rows = await c.reads.readHistory('Japan');
  assert.equal(rows.length, 1); // DynamoDB's (skewed) answer
  assert.ok(c.logs.warn.some((l) => l.includes('[notes-compare] readHistory Japan')), c.logs.warn.join('\n'));
  const same = load('compare');
  await same.reads.readHistory('Japan');
  assert.ok(same.logs.info.some((l) => l.includes('[notes-compare] readHistory Japan: same')), same.logs.info.join('\n'));
  const quiet = load('ddb');
  await quiet.reads.readHistory('Japan');
  assert.equal(quiet.logs.info.length + quiet.logs.warn.length, 0);
});
