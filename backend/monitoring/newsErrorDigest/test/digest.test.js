'use strict';
// Run: npm test (in ../src) or node --test backend/monitoring/newsErrorDigest/test/
// Offline: the @aws-sdk/* packages are stubbed (the Lambda runtime provides them), DynamoDB and SNS are fakes that log every command.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const INDEX = path.resolve(__dirname, '../src/index.js');
const TABLE = 'ErrorsT';
const TOPIC = 'arn:aws:sns:ap-northeast-1:000000000000:gp-alerts';
const STATE_KEY = 'DIGEST#STATE';

const realConsole = { info: console.info, warn: console.warn, error: console.error };
let origLoad;
let fake;

/**
 * A fresh Lambda module against a fake world. `pages` = the pages the Scan returns (array of arrays; a page other than
 * the last carries LastEvaluatedKey), `state` = the stored DIGEST#STATE item (undefined = first ever run).
 * `fail` = { scan, get, put, publish } -> Error to throw from that call.
 */
function load({ pages = [[]], state, fail = {}, env = {} } = {}) {
  if (origLoad) Module._load = origLoad;
  fake = { calls: [], published: [] };
  let scanIdx = 0;
  const cmdClass = (name) => ({ [name]: class { constructor(input) { this.input = input; } } })[name];
  const stub = {
    '@aws-sdk/client-dynamodb': { DynamoDBClient: class {} },
    '@aws-sdk/lib-dynamodb': {
      DynamoDBDocumentClient: {
        from: () => ({
          send: async (cmd) => {
            const name = cmd.constructor.name;
            fake.calls.push({ name, input: cmd.input });
            const kind = { ScanCommand: 'scan', GetCommand: 'get', PutCommand: 'put' }[name];
            if (fail[kind]) throw fail[kind];
            if (name === 'ScanCommand') {
              const items = pages[scanIdx] || [];
              const more = scanIdx < pages.length - 1;
              scanIdx += 1;
              return { Items: items, ...(more ? { LastEvaluatedKey: { errKey: `page${scanIdx}` } } : {}) };
            }
            if (name === 'GetCommand') return state ? { Item: state } : {};
            return {};
          },
        }),
      },
      ScanCommand: cmdClass('ScanCommand'), GetCommand: cmdClass('GetCommand'), PutCommand: cmdClass('PutCommand'),
    },
    '@aws-sdk/client-sns': {
      SNSClient: class { async send(cmd) { fake.calls.push({ name: 'Publish', input: cmd.input }); if (fail.publish) throw fail.publish; fake.published.push(cmd.input); return {}; } },
      PublishCommand: cmdClass('PublishCommand'),
    },
  };
  origLoad = Module._load;
  Module._load = function (request, ...rest) { return Object.prototype.hasOwnProperty.call(stub, request) ? stub[request] : origLoad.call(this, request, ...rest); };
  const full = { CLIENT_ERRORS_TABLE: TABLE, SNS_TOPIC_ARN: TOPIC, SPIKE_MIN_DELTA: undefined, ...env };
  for (const [k, v] of Object.entries(full)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  delete require.cache[INDEX];
  return require(INDEX).handler;
}

beforeEach(() => { console.info = () => {}; console.warn = () => {}; console.error = () => {}; });
afterEach(() => {
  if (origLoad) { Module._load = origLoad; origLoad = null; }
  delete require.cache[INDEX];
  Object.assign(console, realConsole);
});

const row = (day, hash, over = {}) => ({ errKey: `${day}#${hash}`, hashId: hash, count: 1, message: `boom ${hash}`, sampleUrl: `https://globalperspective.net/${hash}`, lastSeen: `${day}T10:00:00Z`, ...over });
const baseline = (counts) => ({ errKey: STATE_KEY, counts });
const puts = () => fake.calls.filter((c) => c.name === 'PutCommand');
const scans = () => fake.calls.filter((c) => c.name === 'ScanCommand');

// ── configuration ─────────────────────────────────────────────────────────────

test('missing CLIENT_ERRORS_TABLE or SNS_TOPIC_ARN returns misconfigured and touches nothing', async () => {
  for (const env of [{ CLIENT_ERRORS_TABLE: undefined }, { SNS_TOPIC_ARN: undefined }]) {
    const handler = load({ env });
    assert.deepEqual(await handler(), { ok: false, error: 'misconfigured' });
    assert.equal(fake.calls.length, 0, JSON.stringify(Object.keys(env)));
  }
});

// ── the scan ──────────────────────────────────────────────────────────────────

test('scans the whole table, following LastEvaluatedKey page by page', async () => {
  const handler = load({
    pages: [[row('2026-10-30', 'aaa')], [row('2026-10-30', 'bbb')], [row('2026-10-31', 'ccc')]],
    state: baseline({}),
  });
  const res = await handler();
  assert.equal(scans().length, 3);
  assert.equal(scans()[0].input.TableName, TABLE);
  assert.equal(scans()[0].input.ExclusiveStartKey, undefined);
  assert.deepEqual(scans()[1].input.ExclusiveStartKey, { errKey: 'page1' });
  assert.deepEqual(scans()[2].input.ExclusiveStartKey, { errKey: 'page2' });
  assert.equal(res.new, 3, 'rows from every page are folded');
});

// ── grouping ──────────────────────────────────────────────────────────────────

test('day rows of one fingerprint are summed; the freshest row supplies message and url', async () => {
  const handler = load({
    pages: [[
      row('2026-10-29', 'fp1', { count: 3, message: 'old text', sampleUrl: 'https://x/old', lastSeen: '2026-10-29T09:00:00Z' }),
      row('2026-10-31', 'fp1', { count: 4, message: 'newest text', sampleUrl: 'https://x/new', lastSeen: '2026-10-31T09:00:00Z' }),
      row('2026-10-30', 'fp1', { count: 2, message: 'middle text', sampleUrl: 'https://x/mid', lastSeen: '2026-10-30T09:00:00Z' }),
    ]],
    state: baseline({}),
  });
  const res = await handler();
  assert.equal(res.new, 1, 'one fingerprint, not three');
  const [pub] = fake.published;
  assert.match(pub.Message, /\[9× total, \+9\] newest text/);
  assert.match(pub.Message, /last seen 2026-10-31T09:00:00Z · https:\/\/x\/new/);
  assert.doesNotMatch(pub.Message, /old text|middle text/);
  // the persisted baseline holds the folded total
  assert.deepEqual(puts()[0].input.Item.counts, { fp1: 9 });
});

test('fingerprint falls back to the errKey suffix; the DIGEST# state row and rows with no fingerprint are ignored', async () => {
  const handler = load({
    pages: [[
      { errKey: '2026-10-31#abc#def', count: 2, message: 'no hashId', lastSeen: '2026-10-31T00:00:00Z' },
      { errKey: STATE_KEY, hashId: 'state-row', counts: { x: 1 }, count: 99 },
      { errKey: 'DIGEST#OTHER', hashId: 'other', count: 99 },
      { message: 'no key at all', count: 7 },
      { errKey: 'nohash', count: 5 },
    ]],
    state: baseline({}),
  });
  await handler();
  assert.deepEqual(puts()[0].input.Item.counts, { 'abc#def': 2 });
});

// ── baseline / quiet / threshold ──────────────────────────────────────────────

test('first ever run writes the baseline and never alerts, however many errors exist', async () => {
  const handler = load({ pages: [[row('2026-10-31', 'a', { count: 50 }), row('2026-10-31', 'b', { count: 80 })]], state: undefined });
  const res = await handler();
  assert.deepEqual(res, { ok: true, baseline: true, fingerprints: 2 });
  assert.equal(fake.published.length, 0);
  assert.equal(puts().length, 1);
  const item = puts()[0].input.Item;
  assert.equal(puts()[0].input.TableName, TABLE);
  assert.equal(item.errKey, STATE_KEY);
  assert.deepEqual(item.counts, { a: 50, b: 80 });
});

test('the stored baseline carries lastRun and a 90-day ttl', async () => {
  const before = Math.floor(Date.now() / 1000);
  const handler = load({ pages: [[row('2026-10-31', 'a')]], state: baseline({ a: 1 }) });
  await handler();
  const item = puts()[0].input.Item;
  assert.ok(!Number.isNaN(Date.parse(item.lastRun)));
  assert.ok(item.ttl >= before + 90 * 86400 && item.ttl <= before + 90 * 86400 + 5);
});

test('a quiet run (same counts) publishes nothing, but still rewrites the baseline', async () => {
  const handler = load({ pages: [[row('2026-10-31', 'a', { count: 4 })]], state: baseline({ a: 4 }) });
  const res = await handler();
  assert.deepEqual(res, { ok: true, new: 0, spiking: 0, fingerprints: 1 });
  assert.equal(fake.published.length, 0);
  assert.equal(puts().length, 1);
});

test('an empty table with a baseline is quiet, and vanished fingerprints drop out of the baseline', async () => {
  const handler = load({ pages: [[]], state: baseline({ gone: 3 }) });
  assert.deepEqual(await handler(), { ok: true, new: 0, spiking: 0, fingerprints: 0 });
  assert.equal(fake.published.length, 0);
  assert.deepEqual(puts()[0].input.Item.counts, {});
});

test('growth below SPIKE_MIN_DELTA (default 5) stays quiet; growth of exactly 5 alerts', async () => {
  let handler = load({ pages: [[row('2026-10-31', 'a', { count: 14 })]], state: baseline({ a: 10 }) });
  assert.equal((await handler()).spiking, 0);
  assert.equal(fake.published.length, 0);

  handler = load({ pages: [[row('2026-10-31', 'a', { count: 15 })]], state: baseline({ a: 10 }) });
  const res = await handler();
  assert.deepEqual(res, { ok: true, new: 0, spiking: 1 });
  assert.equal(fake.published.length, 1);
  assert.match(fake.published[0].Message, /SPIKING \(1\) — grew by >= 5 since last digest:/);
  assert.match(fake.published[0].Message, /\[15× total, \+5\]/);
});

test('SPIKE_MIN_DELTA from the environment moves the threshold', async () => {
  const handler = load({ pages: [[row('2026-10-31', 'a', { count: 13 })]], state: baseline({ a: 10 }), env: { SPIKE_MIN_DELTA: '3' } });
  assert.equal((await handler()).spiking, 1);
  assert.match(fake.published[0].Message, /grew by >= 3 since last digest/);
});

test('a decrease never alerts; a fingerprint present in the baseline at 0 is not "new"', async () => {
  const handler = load({
    pages: [[row('2026-10-31', 'down', { count: 2 }), row('2026-10-31', 'zero', { count: 3 })]],
    state: baseline({ down: 20, zero: 0 }),
  });
  const res = await handler();
  assert.equal(res.new, 0);
  assert.equal(res.spiking, 0, 'zero -> 3 is +3, under the default delta');
  assert.equal(fake.published.length, 0);
});

// ── the alert ─────────────────────────────────────────────────────────────────

test('publishes ONE message for new + spiking: topic, subject, sections, ordering, trailer', async () => {
  const handler = load({
    pages: [[
      row('2026-10-31', 'smallNew', { count: 2, message: 'small new error' }),
      row('2026-10-31', 'bigNew', { count: 9, message: 'big new error' }),
      row('2026-10-31', 'spikeSmall', { count: 17, message: 'spike small' }),
      row('2026-10-31', 'spikeBig', { count: 40, message: 'spike big' }),
      row('2026-10-31', 'known', { count: 7, message: 'known steady' }),
    ]],
    state: baseline({ spikeSmall: 10, spikeBig: 10, known: 7 }),
  });
  const res = await handler();
  assert.deepEqual(res, { ok: true, new: 2, spiking: 2 });
  assert.equal(fake.published.length, 1);
  const pub = fake.published[0];
  assert.equal(pub.TopicArn, TOPIC);
  assert.equal(pub.Subject, '[GP] Client errors: 2 new, 2 spiking');
  assert.match(pub.Message, /^NEW \(2\) — first time seen since last digest:/);
  assert.ok(pub.Message.indexOf('big new error') < pub.Message.indexOf('small new error'), 'new sorted by total, biggest first');
  assert.ok(pub.Message.indexOf('spike big') < pub.Message.indexOf('spike small'), 'spiking sorted by delta, biggest first');
  assert.ok(pub.Message.indexOf('NEW (') < pub.Message.indexOf('SPIKING ('));
  assert.match(pub.Message, /\[9× total, \+9\] big new error/);
  assert.match(pub.Message, /\[40× total, \+30\] spike big/);
  assert.doesNotMatch(pub.Message, /known steady/, 'known, steady errors are not repeated');
  assert.match(pub.Message, /node scripts\/errors\.mjs --days 3/);
  assert.match(pub.Message, /\nChecked: \d{4}-\d\d-\d\dT[\d:.]+Z$/);
});

test('only-new and only-spiking alerts omit the other section and say so in the subject', async () => {
  let handler = load({ pages: [[row('2026-10-31', 'n')]], state: baseline({}) });
  await handler();
  assert.equal(fake.published[0].Subject, '[GP] Client errors: 1 new, 0 spiking');
  assert.doesNotMatch(fake.published[0].Message, /SPIKING/);

  handler = load({ pages: [[row('2026-10-31', 's', { count: 9 })]], state: baseline({ s: 1 }) });
  await handler();
  assert.equal(fake.published[0].Subject, '[GP] Client errors: 0 new, 1 spiking');
  assert.doesNotMatch(fake.published[0].Message, /NEW \(/);
});

test('the body carries message, last seen and url only: long messages are cut at 120 chars, stacks and other fields never appear', async () => {
  const long = 'x'.repeat(300);
  const handler = load({
    pages: [[row('2026-10-31', 'a', {
      message: long, stack: 'Error: boom\n    at secretFn (webpack:///src/secret.js:1:1)', userAgent: 'UA-SECRET-STRING',
      uid: 'user-uid-123', ip: '203.0.113.9',
    })]],
    state: baseline({}),
  });
  await handler();
  const msg = fake.published[0].Message;
  assert.ok(msg.includes('x'.repeat(120)) && !msg.includes('x'.repeat(121)), 'message truncated to 120');
  for (const leak of ['secretFn', 'webpack:', 'UA-SECRET-STRING', 'user-uid-123', '203.0.113.9']) {
    assert.ok(!msg.includes(leak), `${leak} must not be in the alert`);
  }
  assert.ok(!msg.includes(TOPIC) && !fake.published[0].Subject.includes(TOPIC));
});

test('a row with no message, url or lastSeen still renders (placeholders, no "undefined")', async () => {
  const handler = load({ pages: [[{ errKey: '2026-10-31#bare', count: 1 }]], state: baseline({}) });
  await handler();
  const msg = fake.published[0].Message;
  assert.match(msg, /\[1× total, \+1\] \n      last seen \? · /);
  assert.doesNotMatch(msg, /undefined|null/);
});

// ── failures ──────────────────────────────────────────────────────────────────

test('a failing scan rejects and writes/publishes nothing', async () => {
  const handler = load({ fail: { scan: new Error('ProvisionedThroughputExceeded') } });
  await assert.rejects(handler(), /ProvisionedThroughputExceeded/);
  assert.equal(puts().length, 0);
  assert.equal(fake.published.length, 0);
});

test('a failing state read rejects before the baseline is touched or anything is published', async () => {
  const handler = load({ pages: [[row('2026-10-31', 'a')]], fail: { get: new Error('AccessDenied') } });
  await assert.rejects(handler(), /AccessDenied/);
  assert.equal(puts().length, 0);
  assert.equal(fake.published.length, 0);
});

test('a failing baseline write rejects without publishing (so the next run sees the same diff)', async () => {
  const handler = load({ pages: [[row('2026-10-31', 'a')]], state: baseline({}), fail: { put: new Error('ConditionalCheckFailed') } });
  await assert.rejects(handler(), /ConditionalCheckFailed/);
  assert.equal(fake.published.length, 0);
});

test('a failing SNS publish rejects (the run is visibly failed, not silently successful)', async () => {
  const handler = load({ pages: [[row('2026-10-31', 'a')]], state: baseline({}), fail: { publish: new Error('TopicNotFound') } });
  await assert.rejects(handler(), /TopicNotFound/);
  // Current behaviour, pinned: the baseline was already advanced before the publish, so a retry of the same data is quiet.
  assert.equal(puts().length, 1);
  assert.deepEqual(puts()[0].input.Item.counts, { a: 1 });
});
