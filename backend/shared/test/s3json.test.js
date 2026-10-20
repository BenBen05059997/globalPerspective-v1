'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeS3Json } = require('../src/s3json');

class Cmd { constructor(input) { this.input = input; } }
class Get extends Cmd {}
class Put extends Cmd {}

function setup(handler) {
  const sent = [];
  const client = { send: async (c) => { sent.push(c); return handler(c); } };
  return { sent, s3: makeS3Json({ client, GetObjectCommand: Get, PutObjectCommand: Put, bucket: 'bkt' }) };
}
const err = (name, httpStatusCode) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode } });

test('getJson parses the body; NoSuchKey and 404 give null; other errors throw', async () => {
  const ok = setup(() => ({ Body: { transformToString: async () => '{"a":1}\n' } }));
  assert.deepStrictEqual(await ok.s3.getJson('k'), { a: 1 });
  assert.deepStrictEqual(ok.sent[0].input, { Bucket: 'bkt', Key: 'k' });
  const none = setup(() => { throw err('NoSuchKey', 404); });
  assert.strictEqual(await none.s3.getJson('k'), null);
  const nf = setup(() => { throw Object.assign(new Error('x'), { $metadata: { httpStatusCode: 404 } }); });
  assert.strictEqual(await nf.s3.getJson('k'), null);
  const bad = setup(() => { throw err('AccessDenied', 403); });
  await assert.rejects(() => bad.s3.getJson('k'));
});

test('putOnce sends If-None-Match * and returns true, then false on 412', async () => {
  let n = 0;
  const { s3, sent } = setup(() => { n += 1; if (n > 1) throw err('PreconditionFailed', 412); return {}; });
  assert.strictEqual(await s3.putOnce('snap', { v: 1 }), true);
  assert.strictEqual(await s3.putOnce('snap', { v: 2 }), false);
  assert.strictEqual(sent[0].input.IfNoneMatch, '*');
  assert.strictEqual(sent[0].input.Body, '{"v":1}\n');
  assert.strictEqual(sent[0].input.ContentType, 'application/json');
});

test('putOnce rethrows errors other than 412', async () => {
  const { s3 } = setup(() => { throw err('InternalError', 500); });
  await assert.rejects(() => s3.putOnce('k', {}));
});

test('putLatest overwrites with JSON content type, no-cache, no If-None-Match', async () => {
  const { s3, sent } = setup(() => ({}));
  assert.strictEqual(await s3.putLatest('latest.json', { id: 's1' }), undefined);
  const i = sent[0].input;
  assert.strictEqual(i.ContentType, 'application/json');
  assert.strictEqual(i.CacheControl, 'no-cache');
  assert.strictEqual(i.IfNoneMatch, undefined);
  assert.strictEqual(i.Body, '{"id":"s1"}\n');
});
