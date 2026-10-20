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

// A fake S3 that models ETags: If-Match / If-None-Match failures answer 412. `beforePut` lets a test race a writer in.
function fakeS3(initial = {}) {
  const objs = new Map(Object.entries(initial)); // key -> { body, etag }
  let n = 0;
  const f = { objs, puts: [], beforePut: null };
  f.client = {
    send: async (c) => {
      const i = c.input;
      if (c instanceof Get) {
        const o = objs.get(i.Key);
        if (!o) throw err('NoSuchKey', 404);
        return { Body: { transformToString: async () => o.body }, ETag: o.etag };
      }
      if (f.beforePut) { const fn = f.beforePut; f.beforePut = null; fn(f); }
      const o = objs.get(i.Key);
      if ((i.IfNoneMatch === '*' && o) || (i.IfMatch && (!o || o.etag !== i.IfMatch))) throw err('PreconditionFailed', 412);
      n += 1;
      f.puts.push(i);
      objs.set(i.Key, { body: i.Body, etag: `"e${n}"` });
      return {};
    },
  };
  f.s3 = makeS3Json({ client: f.client, GetObjectCommand: Get, PutObjectCommand: Put, bucket: 'bkt' });
  return f;
}
const ev = (id, v = 1) => ({ eventId: id, v });
const lines = (f, key) => f.objs.get(key).body.trimEnd().split('\n').map((l) => JSON.parse(l));

test('getLines: [] and null etag when missing; parses each line and returns the ETag', async () => {
  const f = fakeS3({ k: { body: '{"eventId":"a"}\n\n{"eventId":"b"}\n', etag: '"x"' } });
  assert.deepStrictEqual(await f.s3.getLines('k'), { lines: [{ eventId: 'a' }, { eventId: 'b' }], etag: '"x"' });
  assert.deepStrictEqual(await f.s3.getLines('none'), { lines: [], etag: null });
});

test('appendLines creates the object with If-None-Match, one JSON object per line, ndjson type', async () => {
  const f = fakeS3();
  const r = await f.s3.appendLines('t.jsonl', [ev('a'), ev('b')]);
  assert.deepStrictEqual([r.appended, r.skipped, r.stored.map((e) => e.eventId)], [2, 0, ['a', 'b']]);
  assert.strictEqual(f.puts[0].IfNoneMatch, '*');
  assert.strictEqual(f.puts[0].IfMatch, undefined);
  assert.strictEqual(f.puts[0].ContentType, 'application/x-ndjson');
  assert.strictEqual(f.puts[0].Body, '{"eventId":"a","v":1}\n{"eventId":"b","v":1}\n');
});

test('appendLines appends in order with If-Match and keeps earlier lines', async () => {
  const f = fakeS3();
  await f.s3.appendLines('t', [ev('a')]);
  const r = await f.s3.appendLines('t', [ev('c'), ev('b')]);
  assert.deepStrictEqual(r.stored.map((e) => e.eventId), ['a', 'c', 'b']);
  assert.strictEqual(f.puts[1].IfMatch, '"e1"');
  assert.deepStrictEqual(lines(f, 't').map((e) => e.eventId), ['a', 'c', 'b']);
});

test('appendLines dedupes by id: stored payload wins, repeats inside one call count once, nothing new means no write', async () => {
  const f = fakeS3();
  await f.s3.appendLines('t', [ev('a', 1)]);
  const r = await f.s3.appendLines('t', [ev('a', 2), ev('b'), ev('b', 9)]);
  assert.deepStrictEqual([r.appended, r.skipped], [1, 2]);
  assert.deepStrictEqual(r.stored, [ev('a', 1), ev('b', 1)]);
  const before = f.puts.length;
  const again = await f.s3.appendLines('t', [ev('a', 3), ev('b', 3)]);
  assert.deepStrictEqual([again.appended, again.skipped, f.puts.length], [0, 2, before]);
  await assert.rejects(() => f.s3.appendLines('t', [{ v: 1 }]), /eventId/);
  assert.deepStrictEqual((await f.s3.appendLines('t2', [{ k: 'x' }, { k: 'x' }], { idKey: 'k' })).appended, 1);
});

test('appendLines: a 412 re-reads and retries, so a concurrent writer is merged, not overwritten', async () => {
  const f = fakeS3();
  await f.s3.appendLines('t', [ev('a')]);
  f.beforePut = (fs) => { fs.objs.set('t', { body: '{"eventId":"a","v":1}\n{"eventId":"z","v":1}\n', etag: '"other"' }); };
  const r = await f.s3.appendLines('t', [ev('b')]);
  assert.deepStrictEqual(r.stored.map((e) => e.eventId), ['a', 'z', 'b']);
  assert.deepStrictEqual(lines(f, 't').map((e) => e.eventId), ['a', 'z', 'b']);
  // create race: someone created the object first -> retry as an If-Match append
  const g = fakeS3();
  g.beforePut = (fs) => { fs.objs.set('n', { body: '{"eventId":"q","v":1}\n', etag: '"o"' }); };
  assert.deepStrictEqual((await g.s3.appendLines('n', [ev('b')])).stored.map((e) => e.eventId), ['q', 'b']);
});

test('appendLines: conflict on every attempt throws a clear error and writes nothing', async () => {
  const f = fakeS3({ t: { body: '{"eventId":"a"}\n', etag: '"1"' } });
  const orig = f.client.send;
  f.client.send = async (c) => { if (c instanceof Put) throw err('PreconditionFailed', 412); return orig(c); };
  await assert.rejects(() => f.s3.appendLines('t', [ev('b')], { retries: 2 }), /lost the write race 3 times/);
  assert.strictEqual(f.objs.get('t').body, '{"eventId":"a"}\n');
  await assert.rejects(() => { f.client.send = async (c) => { if (c instanceof Put) throw err('InternalError', 500); return orig(c); }; return f.s3.appendLines('t', [ev('b')]); }, /InternalError/);
});
