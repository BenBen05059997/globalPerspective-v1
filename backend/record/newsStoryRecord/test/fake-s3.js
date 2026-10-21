'use strict';
// A fake S3 client that models ETags: a stale If-Match or an If-None-Match on an existing key answers 412.
// `beforePut(fake, input)` lets a test race another writer in just before a put. Not a test file.
const {makeS3Json} = require('../src/_shared/s3json');
const {makeManifest} = require('../src/manifest');

class Get { constructor(input) { this.input = input; } }
class Put { constructor(input) { this.input = input; } }
const err = (name, httpStatusCode) => Object.assign(new Error(name), {name, $metadata: {httpStatusCode}});

function fakeS3(initial = {}) {
  const f = {objs: new Map(Object.entries(initial)), puts: [], beforePut: null, failPut: null};
  let n = 0;
  f.client = {
    send: async (c) => {
      const i = c.input;
      if (c instanceof Get) {
        const o = f.objs.get(i.Key);
        if (!o) throw err('NoSuchKey', 404);
        return {Body: {transformToString: async () => o.body}, ETag: o.etag};
      }
      if (f.failPut && f.failPut(i)) throw err('InternalError', 500);
      if (f.beforePut) { const fn = f.beforePut; f.beforePut = null; fn(f, i); }
      const o = f.objs.get(i.Key);
      if ((i.IfNoneMatch === '*' && o) || (i.IfMatch && (!o || o.etag !== i.IfMatch))) throw err('PreconditionFailed', 412);
      n += 1;
      f.puts.push(i);
      f.objs.set(i.Key, {body: i.Body, etag: `"e${n}"`});
      return {};
    },
  };
  const args = {client: f.client, GetObjectCommand: Get, PutObjectCommand: Put, bucket: 'bkt'};
  f.s3json = makeS3Json(args);
  f.manifest = makeManifest(args);
  f.json = (key) => JSON.parse(f.objs.get(key).body);
  f.lines = (key) => (f.objs.has(key) ? f.objs.get(key).body.trimEnd().split('\n').map((l) => JSON.parse(l)) : []);
  f.put = (key, obj) => { n += 1; f.objs.set(key, {body: `${JSON.stringify(obj)}\n`, etag: `"p${n}"`}); };
  return f;
}

module.exports = {fakeS3};
