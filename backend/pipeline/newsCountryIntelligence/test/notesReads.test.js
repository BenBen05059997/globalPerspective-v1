'use strict';
// NOTES_READS (decision 0053): the briefing's story analyses, previous briefing, recent corrections and country facts answer the same
// from the record's notes as from DynamoDB; compare mode answers from DynamoDB and logs the difference. DynamoDB and S3 are stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const N = require('../src/_shared/notes');

const producer = { lambda: 't', runId: 'r' };
const intel = { PK: 'COUNTRY#Japan', SK: 'COUNTRY_INTELLIGENCE', ttl: 1, countryName: 'Japan', headline: 'H', bluf: 'B', riskLevel: 'elevated', riskScore: 60, dimensions: { political: 60 }, lead: 'political', trajectory: 'stable',
  totalArticles: 9, generatedAt: '2026-10-26T05:15:44.865Z', model: 'm', latencyMs: 1 };
const drift = (d, why) => ({ countryName: 'Japan', asOf: d, since: '2026-10-01', changeScore: { from: 40, to: 50, delta: 10 }, whyChanged: why, noSingleDriver: false, generatedAt: `${d}T05:30:00.000Z` });
const DRIFTS = [drift('2026-10-23', 'a'), drift('2026-10-24', 'b'), drift('2026-10-25', 'c')];
const analysis = { PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', ttl: 1, threadId: 't1', threadTitle: 'T', entryShortTitles: [], storyArc: 'a', trajectory: 'stable', rootCauseChain: null, watchQuestions: [], inflectionTopicId: null, riskScore: 50,
  dimensions: { conflict: { score: 50, why: 'w' } }, lead: 'conflict', sentiment: 0, keyActors: [], entryCount: 2, entryTopicIds: [], iso3: ['JPN'], generatedAt: '2026-10-12T04:40:00.000Z', model: 'm', latencyMs: 3 };
const facts = { PK: 'FACTS#Japan', SK: 'COUNTRY_FACTS', ttl: 1, countryName: 'Japan', leadershipString: 'A (Head of Government, since 2025-10-21)', lastUpdatedAt: '2026-10-26T20:00:01.500Z' };
const noteSet = {
  country: [N.countryNote({ item: (({ PK, SK, ttl, ...r }) => r)(intel), iso3: 'JPN', producer })],
  drift: DRIFTS.map((item) => N.driftNote({ item, iso3: 'JPN', model: 'm', producer })),
  story_analysis: [N.storyAnalysisNote({ item: analysis, producer })],
  country_facts: [N.countryFactsNote({ item: facts, iso3: 'JPN', producer })],
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
        if (i.Key) {
          if (i.Key.SK === 'COUNTRY_INTELLIGENCE') return { Item: skew ? { ...intel, headline: 'other' } : intel };
          if (i.Key.SK === 'THREAD_ANALYSIS') return { Item: analysis };
          if (i.Key.SK === 'COUNTRY_FACTS') return { Item: facts };
          return {};
        }
        return { Items: DRIFTS.map((r) => ({ PK: 'COUNTRY#Japan', SK: `DRIFT#${r.asOf}`, ttl: 1, ...r })).reverse().slice(0, i.Limit) };
      };
      return { DynamoDBDocumentClient: { from: () => ({ send }) }, GetCommand: cmd, QueryCommand: cmd, PutCommand: cmd };
    }
    return original.call(this, name, ...args);
  };
  process.env.NOTES_READS = mode;
  process.env.SUMMARIZE_PREDICT_TABLE = 'T';
  delete require.cache[require.resolve('../src/index.js')];
  const { reads } = require('../src/index.js');
  const wrap = (fn) => async (...a) => {
    const info = console.info; const warn = console.warn; const log = console.log;
    console.info = (...x) => logs.info.push(x.join(' ')); console.warn = (...x) => logs.warn.push(x.join(' ')); console.log = () => {};
    try { return await fn(...a); } finally { console.info = info; console.warn = warn; console.log = log; Module._load = original; }
  };
  return { reads: { ...Object.fromEntries(Object.entries(reads).filter(([, v]) => typeof v === 'function' && v.name !== 'editorialFacts').map(([k, fn]) => [k, wrap(fn)])), editorialFacts: reads.editorialFacts }, logs };
}

test('notes mode: story analyses, previous briefing, recent corrections and country facts match what DynamoDB answers', async () => {
  const strip = ({ ttl, ...r }) => r;
  const d = load('ddb'); const n = load('notes');
  assert.deepEqual(strip((await n.reads.readExisting('Japan'))), strip((await d.reads.readExisting('Japan'))));
  assert.equal(await load('notes').reads.readExisting('Atlantis'), null);
  assert.deepEqual(await load('notes').reads.loadThreadAnalyses([{ threadId: 't1' }, { threadId: 'gone' }]).then((a) => Object.keys(a)), ['t1']);
  assert.deepEqual(strip((await load('notes').reads.loadThreadAnalyses([{ threadId: 't1' }])).t1), strip((await load('ddb').reads.loadThreadAnalyses([{ threadId: 't1' }])).t1));
  const block = await load('notes').reads.buildDriftBlock('Japan');
  assert.equal(block, await load('ddb').reads.buildDriftBlock('Japan'));
  assert.match(block, /As of 2026-10-25.*\n- As of 2026-10-24/); // the newest two, newest first
  const nf = load('notes'); await nf.reads.loadAndMergeDDBFacts('Japan');
  assert.equal(nf.reads.editorialFacts().Japan.currentLeadership, facts.leadershipString);
});

test('compare mode answers from DynamoDB and logs the difference', async () => {
  const c = load('compare', { skew: true });
  assert.equal((await c.reads.readExisting('Japan')).headline, 'other');
  assert.ok(c.logs.warn.some((l) => l.includes('[notes-compare] readExisting Japan') && l.includes('headline')), c.logs.warn.join('\n'));
  const same = load('compare');
  await same.reads.readExisting('Japan');
  assert.ok(same.logs.info.some((l) => l.includes('[notes-compare] readExisting Japan: same')), same.logs.info.join('\n'));
});
