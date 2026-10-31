'use strict';
// The forecasts inbox (decision 0052): the agent mirrors each PRED# put, and each thread reconcile, to <FORECASTS_INBOX_PREFIX>inbox/forecasts/DAY.jsonl, best-effort.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const F = require('../src/_shared/forecastsInbox');

class Cmd { constructor(input) { this.input = input; } }
class Get extends Cmd {}
class Put extends Cmd {}
class DGet extends Cmd {}
class DPut extends Cmd {}
class DUpdate extends Cmd {}
const err = (name, code) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: code } });

// A fake DynamoDB (rows by PK|SK, put-once like the agent's condition) and a fake S3 with ETags.
function harness({ prefix, failS3 = false } = {}) {
  const objs = new Map();
  const rows = new Map();
  const logs = [];
  const real = createRequire(require.resolve('../src/index.js'));
  const s3 = {
    send: async (c) => {
      if (c instanceof Get) {
        const o = objs.get(c.input.Key);
        if (!o) throw err('NoSuchKey', 404);
        return { Body: { transformToString: async () => o.body }, ETag: o.etag };
      }
      if (failS3) throw err('InternalError', 500);
      const o = objs.get(c.input.Key);
      if ((c.input.IfNoneMatch === '*' && o) || (c.input.IfMatch && (!o || o.etag !== c.input.IfMatch))) throw err('PreconditionFailed', 412);
      objs.set(c.input.Key, { body: c.input.Body, etag: `"e${objs.size}-${Math.random()}"` });
      return {};
    },
  };
  const ddb = {
    send: async (c) => {
      if (c instanceof DPut) {
        const k = `${c.input.Item.PK}|${c.input.Item.SK}`;
        if (rows.has(k)) throw err('ConditionalCheckFailedException', 400);
        rows.set(k, JSON.parse(JSON.stringify(c.input.Item)));
        return {};
      }
      if (c instanceof DGet) { const r = rows.get(`${c.input.Key.PK}|${c.input.Key.SK}`); return { Item: r && JSON.parse(JSON.stringify(r)) }; }
      if (c instanceof DUpdate) { // threadId = :t, drawnThreadId = if_not_exists(drawnThreadId, :old)
        const row = rows.get(`${c.input.Key.PK}|${c.input.Key.SK}`);
        row.threadId = c.input.ExpressionAttributeValues[':t'];
        if (row.drawnThreadId === undefined) row.drawnThreadId = c.input.ExpressionAttributeValues[':old'];
        return {};
      }
      return {};
    },
  };
  const sdk = { S3Client: class { constructor() { return s3; } }, GetObjectCommand: Get, PutObjectCommand: Put };
  const context = {
    exports: {}, process: { env: prefix === undefined ? {} : { FORECASTS_INBOX_PREFIX: prefix } }, setTimeout, clearTimeout, Date,
    console: { log: (m) => logs.push(`log ${m}`), error: (m) => logs.push(`error ${m}`), warn: () => {}, info: () => {} },
    require: (n) => (n === '@aws-sdk/client-dynamodb' ? { DynamoDBClient: class {} } : n === '@aws-sdk/lib-dynamodb' ? { GetCommand: DGet, PutCommand: DPut, QueryCommand: Cmd, ScanCommand: Cmd, UpdateCommand: DUpdate, BatchWriteCommand: Cmd, DynamoDBDocumentClient: { from: () => ddb } } : n === '@aws-sdk/client-s3' ? sdk : real(n)),
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/index.js'), 'utf8'), context);
  const i = context.exports._internal;
  return { log: i.logPredictionSnapshot, flush: i.flushForecastsInbox, reconcile: i.reconcilePredictionThreads, objs, rows, logs };
}

const content = JSON.stringify({ scenarios: [{ scenario: 'Likely', triggers: [] }] });
const topic = (id) => ({ id, title: `Title ${id}`, categories: ['politics'] });
const draw = (h, id, thread) => h.log(topic(id), content, { modelId: 'fake' }, 'gen-1', 2026, { threadIdById: { [id]: thread } });
const today = new Date().toISOString().slice(0, 10);
const KEY = `record/shadow/inbox/forecasts/${today}.jsonl`;
const lines = (h) => h.objs.get(KEY).body.trim().split('\n').map((l) => JSON.parse(l));

test('with the prefix unset nothing is written to S3', async () => {
  const h = harness();
  await draw(h, 'a', 'thread-1');
  await h.flush();
  assert.equal(h.objs.size, 0);
  assert.equal(h.rows.size, 1, 'the DynamoDB put stays');
});

test('each logged forecast is one drawn line holding the row as put; a second forecast of the day (put refused) adds none', async () => {
  const h = harness({ prefix: 'record/shadow/' });
  await draw(h, 'a', 'thread-1');
  await draw(h, 'b', 'thread-2');
  await draw(h, 'a', 'thread-9'); // first of the day stands: the put is refused, no line
  await h.flush();
  const l = lines(h);
  assert.deepEqual(l.map((x) => [x.type, x.row.topicId, x.row.threadId]), [['drawn', 'a', 'thread-1'], ['drawn', 'b', 'thread-2']]);
  assert.deepEqual(l[0].row, h.rows.get(`PRED#a|${today}`));
  assert.match(h.logs.join('\n'), /\[inbox\] forecasts: 2 lines for .*2 appended, 0 already stored \(record\/shadow\/\)/);
});

test('a reconcile is a later thread line, and replaying the file gives the row DynamoDB ends as (last wins, drawnThreadId kept)', async () => {
  const h = harness({ prefix: 'record/shadow/' });
  await draw(h, 'a', 'thread-1');
  await draw(h, 'b', 'thread-2');
  await h.reconcile([topic('a'), topic('b')], { a: 'thread-final', b: 'thread-2' }, today);
  await h.flush();
  const l = lines(h);
  assert.deepEqual(l.map((x) => x.type), ['drawn', 'drawn', 'thread'], 'the thread line comes after the drawn lines, and only a row that moved gets one');
  assert.deepEqual([l[2].threadId, l[2].was], ['thread-final', 'thread-1']);
  const replayed = F.replay(l).rows;
  assert.deepEqual(replayed, [h.rows.get(`PRED#a|${today}`), h.rows.get(`PRED#b|${today}`)]);
  assert.equal(replayed[0].drawnThreadId, 'thread-1');
});

test('a retried flush adds nothing; a second run of the day appends its lines to the same file', async () => {
  const h = harness({ prefix: 'record/shadow/' });
  await draw(h, 'a', 'thread-1');
  await h.flush();
  await h.flush(); // nothing queued
  await draw(h, 'c', 'thread-3');
  await h.flush();
  assert.deepEqual(lines(h).map((x) => x.row.topicId), ['a', 'c']);
});

test('a failing S3 never fails the run: logged as [inbox], nothing thrown, DynamoDB untouched', async () => {
  const h = harness({ prefix: 'record/', failS3: true });
  await draw(h, 'a', 'thread-1');
  await h.flush();
  assert.match(h.logs.join('\n'), /error \[inbox\] forecasts not written/);
  assert.equal(h.rows.size, 1);
});
