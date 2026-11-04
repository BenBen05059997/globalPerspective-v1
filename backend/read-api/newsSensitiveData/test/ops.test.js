'use strict';
// Action `ops`: the operator's money file. Only a valid Firebase token whose uid is in OPS_OPERATOR_UIDS gets it; every other
// caller gets 403 and the bucket is never read.
const test = require('node:test');
const assert = require('node:assert/strict');
const opsModule = require('../src/ops');
const { loadProxy, invoke } = require('./helpers/proxyHarness');

const OPS = { schemaVersion: 1, asOf: '2026-11-04T10:00:00.000Z', deepseek: { yesterday: { date: '2026-11-03', usd: 0.37 } } };

test('operatorUids: comma list, blanks dropped, empty means nobody', () => {
  assert.deepEqual([...opsModule.operatorUids(' u1, u2 ,,')], ['u1', 'u2']);
  assert.equal(opsModule.operatorUids('').size, 0);
  assert.equal(opsModule.operatorUids(undefined).size, 0);
});

// Replace the S3 reader before index.js loads, then load it with the harness (which stubs the AWS SDK).
function load({ uids, verify, file = OPS, reads = [] }) {
  const original = opsModule.s3JsonReader;
  opsModule.s3JsonReader = () => async (key) => { reads.push(key); if (file instanceof Error) throw file; return file; };
  try { return loadProxy({ env: { OPS_OPERATOR_UIDS: uids }, verify }).handler; } finally { opsModule.s3JsonReader = original; }
}
const bearer = { authorization: 'Bearer token' };

test('operator uid: 200 with the money file', async () => {
  const reads = [];
  const handler = load({ uids: 'u1,u2', verify: async () => ({ user_id: 'u2' }), reads });
  const r = await invoke(handler, { action: 'ops', headers: bearer });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { success: true, data: OPS });
  assert.deepEqual(reads, ['monitoring/ops.json']);
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.ok(r.headers['Access-Control-Allow-Origin']);
});

test('the uid may come as sub, and the header as Authorization', async () => {
  const handler = load({ uids: 'u1', verify: async () => ({ sub: 'u1' }) });
  assert.equal((await invoke(handler, { action: 'ops', headers: { Authorization: 'Bearer t' } })).status, 200);
});

test('another signed-in uid, an invalid token, no token and an empty list are all 403 with a plain error and no read', async () => {
  const cases = [
    { uids: 'u1', verify: async () => ({ user_id: 'someone-else' }), headers: bearer },
    { uids: 'u1', verify: async () => null, headers: bearer },
    { uids: 'u1', verify: async () => ({ user_id: 'u1' }), headers: {} },
    { uids: '', verify: async () => ({ user_id: 'u1' }), headers: bearer },
    { uids: undefined, verify: async () => ({ user_id: 'u1' }), headers: bearer },
  ];
  for (const c of cases) {
    const reads = [];
    const handler = load({ uids: c.uids, verify: c.verify, reads });
    const r = await invoke(handler, { action: 'ops', headers: c.headers });
    assert.equal(r.status, 403, JSON.stringify(c.headers));
    assert.deepEqual(r.body, { success: false, error: 'The ops page is not available for this account.' });
    assert.deepEqual(reads, []);
  }
});

test('the file not written yet is 200 with data null; a read failure is 502, never a made-up value', async () => {
  const none = load({ uids: 'u1', verify: async () => ({ user_id: 'u1' }), file: null });
  const r = await invoke(none, { action: 'ops', headers: bearer });
  assert.equal(r.status, 200);
  assert.equal(r.body.data, null);
  const broken = load({ uids: 'u1', verify: async () => ({ user_id: 'u1' }), file: new Error('AccessDenied') });
  const f = await invoke(broken, { action: 'ops', headers: bearer });
  assert.equal(f.status, 502);
  assert.equal(f.body.success, false);
});

test('s3JsonReader: a missing key is null, any other error is thrown', async () => {
  const Module = require('node:module');
  const original = Module._load;
  let outcome;
  Module._load = function stub(request, ...rest) {
    if (request === '@aws-sdk/client-s3') return { GetObjectCommand: class { constructor(i) { this.input = i; } }, S3Client: class { async send() { if (outcome.err) throw outcome.err; return { Body: { transformToString: async () => JSON.stringify(outcome.ok) } }; } } };
    return original.call(this, request, ...rest);
  };
  try {
    const read = opsModule.s3JsonReader({ bucket: 'b', region: 'r' });
    outcome = { ok: { a: 1 } };
    assert.deepEqual(await read('k'), { a: 1 });
    outcome = { err: Object.assign(new Error('x'), { name: 'NoSuchKey' }) };
    assert.equal(await read('k'), null);
    outcome = { err: Object.assign(new Error('denied'), { name: 'AccessDenied' }) };
    await assert.rejects(read('k'), /denied/);
  } finally { Module._load = original; }
});
