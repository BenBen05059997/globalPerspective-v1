'use strict';
// Views are written only when their bytes changed (digests.js, publish.js; decision 0037 amendment 2026-11-04).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {fakeS3} = require('./fake-s3');
const X = require('./views-fixture');
const {md5Of, bodyOf, readDigests} = require('../src/digests');
const {makePublisher} = require('../src/publish');

const P = 'record/shadow/';
const silent = {log() {}};
const AT = '2026-10-22T05:45:00.000Z';

/** Facts as jsonl on one day plus the day manifest; `facts` may be replaced between runs. */
function setup(facts) {
  const f = fakeS3();
  const load = (list) => {
    f.objs.set(`${P}facts/manifest.json`, {body: `${JSON.stringify({schemaVersion: 1, days: [...new Set(list.map((x) => x.date))].sort()})}\n`, etag: '"m"'});
    for (const d of new Set(list.map((x) => x.date))) f.objs.set(`${P}facts/${d}.jsonl`, {body: list.filter((x) => x.date === d).map((x) => `${JSON.stringify(x)}\n`).join(''), etag: `"f${d}"`});
  };
  load(facts);
  const publisher = makePublisher({s3json: f.s3json, log: silent});
  const run = (o = {}) => publisher.publish({prefix: P, today: '2026-10-22', builtAt: AT, runId: 'r1', changedDays: [], ...o});
  return {f, load, run};
}

test('serialization: the digest hashes the exact bytes s3json puts, and the same object twice gives the same md5', async () => {
  const f = fakeS3();
  const obj = {b: 1, a: [1, {z: null, y: 'é'}]};
  await f.s3json.putLatest('k', obj);
  assert.equal(f.objs.get('k').body, bodyOf(obj));
  assert.equal(md5Of(obj), crypto.createHash('md5').update(f.objs.get('k').body).digest('hex'));
  assert.equal(md5Of(obj), md5Of(JSON.parse(JSON.stringify(obj))));
  assert.notEqual(md5Of(obj), md5Of({a: obj.a, b: 1})); // key order is part of the bytes
});

test('a missing digest file writes everything; the log line and result say so', async () => {
  const lines = [];
  const {f} = setup(X.golden());
  const first = await makePublisher({s3json: f.s3json, log: {log: (l) => lines.push(l)}}).publish({prefix: P, today: '2026-10-22', builtAt: AT, runId: 'r1'});
  assert.equal(first.digests, 'missing');
  assert.equal(first.viewsSkipped, 0);
  const d = f.json(`${P}views/digests.json`);
  assert.equal(first.written, Object.keys(d.files).length + 2); // every view + digests.json + manifest
  assert.match(lines[0], /^\[views\] wrote \d+ of \d+ files \(skipped 0 unchanged\), digests: missing$/);
  assert.equal(d.files['stories/thread-a.json'], md5Of(f.json(`${P}views/stories/thread-a.json`)));
  assert.equal(d.files['manifest.json'], undefined);
});

test('an unreadable digest file counts as missing', async () => {
  const {f, run} = setup(X.golden());
  for (const body of ['{not json', '[1]\n', 'null\n']) {
    f.objs.set(`${P}views/digests.json`, {body, etag: '"x"'});
    assert.deepEqual(await readDigests(f.s3json, P), {files: {}, state: 'missing'}, body);
  }
  assert.equal((await run()).digests, 'missing');
});

test('unchanged views are skipped: a second run puts only digests.json and the manifest', async () => {
  const {f, run} = setup(X.golden());
  const first = await run();
  const before = f.puts.length;
  const second = await run({builtAt: '2026-10-22T12:35:00.000Z', runId: 'r2'});
  assert.deepEqual([second.digests, second.written, second.viewsSkipped], ['read', 2, first.written - 2]);
  assert.deepEqual(f.puts.slice(before).map((p) => p.Key.slice(P.length)), ['views/digests.json', 'views/manifest.json']);
  assert.equal(f.json(`${P}views/manifest.json`).runId, 'r2');
});

test('a changed view is written, the others are not, and the order keeps stories before indexes before manifest', async () => {
  const facts = X.golden();
  const {f, load, run} = setup(facts);
  await run();
  const before = f.puts.length;
  load([...facts, X.entry('thread-a', '2026-10-22T04:00:00.000Z', 'A third', {id: 'ea3', iso3: ['FRA'], sources: ['s1']})]);
  await run({runId: 'r2'});
  const keys = f.puts.slice(before).map((p) => p.Key.slice(`${P}views/`.length));
  assert.ok(keys.includes('stories/thread-a.json') && keys.includes('index/all.json'));
  assert.ok(!keys.includes('stories/thread-b.json'));
  assert.ok(keys.indexOf('stories/thread-a.json') < keys.indexOf('index/active.json') && keys.indexOf('index/active.json') < keys.indexOf('index/all.json'));
  assert.deepEqual(keys.slice(-2), ['digests.json', 'manifest.json']);
  const d = f.json(`${P}views/digests.json`);
  assert.equal(d.files['stories/thread-a.json'], md5Of(f.json(`${P}views/stories/thread-a.json`)));
});

test('digest entries of views no longer built are dropped, and no file is deleted', async () => {
  const {f, run} = setup(X.golden());
  await run();
  const d = f.json(`${P}views/digests.json`);
  f.objs.set(`${P}views/digests.json`, {body: bodyOf({...d, files: {...d.files, 'stories/gone.json': 'abc'}}), etag: '"z"'});
  f.objs.set(`${P}views/stories/gone.json`, {body: '{}\n', etag: '"g"'});
  await run({runId: 'r2'});
  assert.equal(f.json(`${P}views/digests.json`).files['stories/gone.json'], undefined);
  assert.ok(f.objs.has(`${P}views/stories/gone.json`));
});

test('a failed write stops the sequence: no digests.json update and the old manifest stays', async () => {
  const facts = X.golden();
  const {f, load, run} = setup(facts);
  await run();
  const oldManifest = f.objs.get(`${P}views/manifest.json`).body;
  const oldDigests = f.objs.get(`${P}views/digests.json`).body;
  load([...facts, X.entry('thread-a', '2026-10-22T04:00:00.000Z', 'A third', {id: 'ea3', iso3: ['FRA'], sources: ['s1']})]);
  f.failPut = (i) => i.Key === `${P}views/index/all.json`;
  await assert.rejects(() => run({runId: 'r2'}));
  assert.equal(f.objs.get(`${P}views/manifest.json`).body, oldManifest);
  assert.equal(f.objs.get(`${P}views/digests.json`).body, oldDigests);
  f.failPut = null;
  await run({runId: 'r3'}); // the next run still sees the story as changed (old digest) and repairs
  assert.equal(f.json(`${P}views/digests.json`).files['stories/thread-a.json'], md5Of(f.json(`${P}views/stories/thread-a.json`)));
});
