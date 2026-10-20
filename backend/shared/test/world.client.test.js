'use strict';
const test = require('node:test');
const assert = require('node:assert');
const w = require('../src/world');

class Cmd { constructor(input) { this.input = input; } }
class Get extends Cmd {}
class Query extends Cmd {}
class Batch extends Cmd {}
class Scan extends Cmd {}
class GetObject extends Cmd {}
const C = { GetCommand: Get, QueryCommand: Query, BatchGetCommand: Batch, ScanCommand: Scan };

function dynamo(handler) {
  const sent = [];
  return { sent, client: w.makeDynamoClient({ client: { send: async (c) => { sent.push(c); return handler(c, sent.length); } }, ...C }) };
}

test('getItem returns the item or null', async () => {
  const hit = dynamo(() => ({ Item: { id: 'latest' } }));
  assert.deepStrictEqual(await hit.client.getItem('NewsCache', { id: 'latest' }), { id: 'latest' });
  assert.deepStrictEqual(hit.sent[0].input, { TableName: 'NewsCache', Key: { id: 'latest' } });
  assert.strictEqual(await dynamo(() => ({})).client.getItem('t', { id: 'x' }), null);
});

test('query paginates, uses begins_with only when a prefix is given', async () => {
  const d = dynamo((c, n) => (n === 1 ? { Items: [{ SK: 'a' }], LastEvaluatedKey: { PK: 'p', SK: 'a' } } : { Items: [{ SK: 'b' }] }));
  assert.deepStrictEqual(await d.client.query('t', 'PRED#x', 'THREAD_HISTORY#'), [{ SK: 'a' }, { SK: 'b' }]);
  assert.strictEqual(d.sent.length, 2);
  assert.match(d.sent[0].input.KeyConditionExpression, /begins_with/);
  assert.deepStrictEqual(d.sent[1].input.ExclusiveStartKey, { PK: 'p', SK: 'a' });
  const all = dynamo(() => ({ Items: [] }));
  await all.client.query('t', 'PRED#x');
  assert.strictEqual(all.sent[0].input.KeyConditionExpression, '#pk = :pk'); // an empty begins_with would be rejected by DynamoDB
  assert.deepStrictEqual(all.sent[0].input.ExpressionAttributeValues, { ':pk': 'PRED#x' });
});

test('batchGet chunks by 100, retries unprocessed keys, throws if they never clear', async () => {
  const keys = Array.from({ length: 150 }, (_, i) => ({ PK: `k${i}`, SK: 's' }));
  let first = true;
  const d = dynamo((c) => {
    const ks = c.input.RequestItems.t.Keys;
    if (ks.length === 100 && first) { first = false; return { Responses: { t: ks.slice(0, 90) }, UnprocessedKeys: { t: { Keys: ks.slice(90) } } }; }
    return { Responses: { t: ks } };
  });
  assert.strictEqual((await d.client.batchGet('t', keys)).length, 150);
  assert.deepStrictEqual(d.sent.map((c) => c.input.RequestItems.t.Keys.length), [100, 10, 50]);
  const stuck = dynamo((c) => ({ Responses: {}, UnprocessedKeys: { t: { Keys: c.input.RequestItems.t.Keys } } }));
  await assert.rejects(() => stuck.client.batchGet('t', [{ PK: 'a', SK: 'b' }]), /unprocessed/);
  assert.deepStrictEqual(await dynamo(() => ({})).client.batchGet('t', []), []);
});

test('scan passes the filter, paginates and stops at the cap', async () => {
  const d = dynamo((c, n) => ({ Items: [{ n }, { n }], LastEvaluatedKey: { k: n } }));
  const spec = { expression: 'begins_with(PK, :p)', values: { ':p': 'PRED#' }, maxItems: 5 };
  const out = await d.client.scan('t', spec);
  assert.strictEqual(out.length, 5);
  assert.strictEqual(d.sent.length, 3);
  assert.strictEqual(d.sent[0].input.FilterExpression, 'begins_with(PK, :p)');
  assert.ok(!('ExpressionAttributeNames' in d.sent[0].input));
});

test('makeS3Client: getS3Json parses, null for a missing key, other errors throw; makeClient merges', async () => {
  const missing = Object.assign(new Error('x'), { name: 'NoSuchKey' });
  const denied = Object.assign(new Error('x'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
  const make = (fn) => w.makeS3Client({ client: { send: fn }, GetObjectCommand: GetObject, bucket: 'b' });
  assert.deepStrictEqual(await make(async () => ({ Body: { transformToString: async () => '{"a":1}' } })).getS3Json('web/latest.json'), { a: 1 });
  assert.strictEqual(await make(async () => { throw missing; }).getS3Json('k'), null);
  await assert.rejects(() => make(async () => { throw denied; }).getS3Json('k'));
  const merged = w.makeClient(dynamo(() => ({})).client, make(async () => ({})));
  assert.deepStrictEqual(w.REQUIRED.filter((m) => typeof merged[m] !== 'function'), []);
});
