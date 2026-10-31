'use strict';
// The rss action (decision 0054): RECORD_READS=ddb|record|compare. The feed built from the record's today view is the same XML as the feed
// built from NewsCache `today-archive` / `latest`; record mode with no view answers from DynamoDB; compare returns DynamoDB's feed.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

process.env.TOPICS_DDB_TABLE = 'topics';
process.env.SUMMARIZE_PREDICT_TABLE = 'summary';
const items = {};   // NewsCache id -> item
const files = {};   // S3 key -> object
const reads = [];   // what was read
const original = Module._load;
Module._load = function load(name, ...args) {
  if (name === '@aws-sdk/lib-dynamodb') {
    class Cmd { constructor(input) { this.input = input; } }
    return { GetCommand: Cmd, ScanCommand: Cmd, QueryCommand: Cmd, BatchGetCommand: Cmd, DynamoDBDocumentClient: { from: () => ({ send: async (c) => { reads.push(`ddb:${c.input.Key && c.input.Key.id}`); return { Item: items[c.input.Key && c.input.Key.id] }; } }) } };
  }
  if (name === '@aws-sdk/client-s3') {
    class GetObjectCommand { constructor(input) { this.input = input; } }
    class S3Client { async send(c) { reads.push(`s3:${c.input.Key}`); const v = files[c.input.Key]; if (v === undefined) { const e = new Error('nf'); e.name = 'NoSuchKey'; throw e; } return { Body: { transformToString: async () => JSON.stringify(v) } }; } }
    return { S3Client, GetObjectCommand };
  }
  if (name.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => class {} });
  return original.call(this, name, ...args);
};
const { handler } = require('../src/index.js');
test.after(() => { Module._load = original; }); // recordReads loads the S3 client on first use, so the mock stays until the end

const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
const entry = (n, h) => ({
  topicId: `Topic ${n}-${n}`, threadId: `thread-t${n}`, title: `Title & ${n}`, category: 'conflict', regions: ['France', 'Spain'],
  sources: [1, 2, 3].map((k) => ({ source: `outlet${k}.com`, title: `Src ${k}`, url: `https://outlet${k}.com/${n}` })),
  archivedAt: hoursAgo(h), generationId: 'g', ai: { summary: `## Heading\n**Bold** summary ${n} <b>` },
});
const entries = [entry(1, 3), entry(2, 2), entry(3, 30)]; // the third is outside 24 h
const event = { headers: {}, httpMethod: 'GET', queryStringParameters: { action: 'rss' }, requestContext: { domainName: 'x.example', stage: 'default' } };
const run = async (mode) => {
  process.env.RECORD_READS = mode;
  reads.length = 0;
  const res = await handler(event);
  assert.equal(res.statusCode, 200);
  return res.body;
};
const setup = ({ ddb = true, view = true, fresh = true } = {}) => {
  for (const k of Object.keys(items)) delete items[k];
  for (const k of Object.keys(files)) delete files[k];
  if (ddb) items['today-archive'] = { id: 'today-archive', entries, updatedAt: hoursAgo(2) };
  if (view) {
    files['record/views/index/today.json'] = {
      schemaVersion: 1, updatedAt: hoursAgo(2), latest: null,
      entries: entries.map((e) => ({ ...e, eventId: `ev-${e.topicId}`, sources: [...e.sources, { source: 'extra.com', url: 'https://extra.com/x' }] })),
    };
  }
  files['record/views/manifest.json'] = { builtAt: fresh ? hoursAgo(1) : hoursAgo(30) };
};

test('ddb (default): only DynamoDB is read; the feed holds the entries of the last 24 h', async () => {
  setup();
  const xml = await run('ddb');
  assert.equal((xml.match(/<item>/g) || []).length, 2);
  assert.match(xml, /<title>Title &amp; 1<\/title>/);
  assert.deepEqual(reads, ['ddb:today-archive']);
});

test('record: the same XML as ddb, DynamoDB not read', async () => {
  setup();
  const fromDdb = await run('ddb');
  const fromRecord = await run('record');
  assert.equal(fromRecord, fromDdb);
  assert.ok(!reads.some((r) => r.startsWith('ddb:')), reads.join());
});

test('record with no view, or a stale one, answers from DynamoDB', async () => {
  setup({ view: false });
  const a = await run('record');
  assert.equal((a.match(/<item>/g) || []).length, 2);
  assert.ok(reads.includes('ddb:today-archive'));
  setup({ fresh: false });
  await run('record');
  assert.ok(reads.includes('ddb:today-archive'));
  assert.ok(!reads.includes('s3:record/views/index/today.json'), 'a stale manifest stops the view read');
});

test('compare: the DynamoDB feed is returned and both sources are read', async () => {
  setup();
  const xml = await run('compare');
  assert.equal((xml.match(/<item>/g) || []).length, 2);
  assert.ok(reads.includes('ddb:today-archive') && reads.includes('s3:record/views/index/today.json'));
});

test('record with the latest-run fallback: no today-archive entries -> topics of the run, same feed as the latest item', async () => {
  setup({ ddb: false });
  const topic = (n) => ({ topicId: `Topic ${n}-${n}`, id: `Topic ${n}-${n}`, title: `Title ${n}`, category: 'politics', regions: ['France'], sources: [{ source: 's.com', url: 'https://s.com/a' }], threadId: null });
  const upd = hoursAgo(2);
  items.latest = { id: 'latest', topics: [topic(1), topic(2)], updatedAt: upd };
  files['record/views/index/today.json'] = {
    schemaVersion: 1, updatedAt: upd,
    latest: { updatedAt: upd, topicIds: ['Topic 1-1', 'Topic 2-2'], model: 'm', limit: 13, generationId: 'g', generatedDate: 'd', generatedYear: 2026 },
    entries: [1, 2].map((n) => ({ ...topic(n), eventId: `e${n}`, archivedAt: hoursAgo(40), generationId: 'g', ai: null })), // older than 24 h: not in the today list
  };
  const fromDdb = await run('ddb');
  const fromRecord = await run('record');
  assert.equal(fromRecord, fromDdb);
  assert.equal((fromRecord.match(/<item>/g) || []).length, 2);
});
