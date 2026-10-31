'use strict';
// NOTES_READS (decision 0053): the story analyses answer the same from the record's notes as from DynamoDB; compare mode answers
// from DynamoDB and logs the difference. DynamoDB and S3 are stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const N = require('../src/_shared/notes');

const producer = { lambda: 't', runId: 'r' };
const analysis = { PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', ttl: 1, threadId: 't1', threadTitle: 'T', entryShortTitles: [], storyArc: 'a', trajectory: 'stable', rootCauseChain: null, watchQuestions: [], inflectionTopicId: null, riskScore: 50,
  dimensions: { conflict: { score: 50, why: 'w' } }, lead: 'conflict', sentiment: 0, keyActors: [], entryCount: 2, entryTopicIds: [], iso3: ['JPN'], generatedAt: '2026-10-12T04:40:00.000Z', model: 'm', latencyMs: 3 };
const note = N.storyAnalysisNote({ item: analysis, producer });

function load(mode, { skew } = {}) {
  const logs = { warn: [], info: [] };
  const original = Module._load;
  Module._load = function (name, ...args) {
    if (name === '@aws-sdk/client-s3') {
      return {
        S3Client: class { async send(cmd) {
          const k = cmd.input.Key;
          if (k === 'record/notes/story_analysis/manifest.json') return { Body: { transformToString: async () => JSON.stringify({ schemaVersion: 1, days: [note.date] }) } };
          if (k === `record/notes/story_analysis/${note.date}.jsonl`) return { Body: { transformToString: async () => JSON.stringify(note) } };
          throw Object.assign(new Error('no'), { name: 'NoSuchKey' });
        } },
        GetObjectCommand: class { constructor(input) { this.input = input; } },
        PutObjectCommand: class { constructor(input) { this.input = input; } },
        };
    }
    if (name === '@aws-sdk/client-dynamodb') return { DynamoDBClient: class {} };
    if (name === '@aws-sdk/lib-dynamodb') {
      const cmd = class { constructor(input) { this.input = input; } };
      const send = async (c) => (c.input.Key && c.input.Key.PK === 'THREAD#t1' ? { Item: skew ? { ...analysis, threadTitle: 'other' } : analysis } : {});
      return { DynamoDBDocumentClient: { from: () => ({ send }) }, GetCommand: cmd, PutCommand: cmd, ScanCommand: cmd };
    }
    return original.call(this, name, ...args);
  };
  process.env.NOTES_READS = mode;
  process.env.SUMMARIZE_PREDICT_TABLE = 'T';
  delete require.cache[require.resolve('../src/index.js')];
  const { loadThreadAnalyses } = require('../src/index.js');
  const call = async (entries) => {
    const info = console.info; const warn = console.warn;
    console.info = (...x) => logs.info.push(x.join(' ')); console.warn = (...x) => logs.warn.push(x.join(' '));
    try { return await loadThreadAnalyses(entries); } finally { console.info = info; console.warn = warn; Module._load = original; }
  };
  return { call, logs };
}

test('notes mode: the story analyses match what DynamoDB answers; an unknown story is absent', async () => {
  const d = await load('ddb').call([{ threadId: 't1' }, { threadId: 'gone' }]);
  const n = await load('notes').call([{ threadId: 't1' }, { threadId: 'gone' }]);
  assert.deepEqual(Object.keys(n), ['t1']);
  const strip = ({ ttl, ...r }) => r;
  assert.deepEqual(strip(n.t1), strip(d.t1));
});

test('compare mode answers from DynamoDB and logs the difference', async () => {
  const c = load('compare', { skew: true });
  assert.equal((await c.call([{ threadId: 't1' }])).t1.threadTitle, 'other');
  assert.ok(c.logs.warn.some((l) => l.includes('[notes-compare] threadAnalysis t1') && l.includes('threadTitle')), c.logs.warn.join('\n'));
});
