'use strict';
// makeFirebaseVerifier: tokens are signed here with a throwaway RSA key; the certs fetch is replaced (global fetch).
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, createSign } = require('node:crypto');
const { makeFirebaseVerifier } = require('../src/firebaseAuth');

const PROJECT = 'gp-test';
const good = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = (k) => k.publicKey.export({ type: 'spki', format: 'pem' });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const nowS = () => Math.floor(Date.now() / 1000);

function token(payload, { key = good, kid = 'k1' } = {}) {
  const head = b64({ alg: 'RS256', kid });
  const body = b64(payload);
  const sig = createSign('SHA256').update(`${head}.${body}`).sign(key.privateKey).toString('base64url');
  return `${head}.${body}.${sig}`;
}
const claims = (extra = {}) => ({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'u1', user_id: 'u1', exp: nowS() + 600, ...extra });

let fetches;
test.beforeEach(() => { fetches = 0; global.fetch = async () => { fetches++; return { json: async () => ({ k1: pem(good) }) }; }; });

async function withLogs(fn) {
  const warns = []; const original = console.warn; console.warn = (...a) => warns.push(a);
  try { return [await fn(), warns]; } finally { console.warn = original; }
}

test('a valid token returns its payload', async () => {
  const verify = makeFirebaseVerifier({ projectId: PROJECT });
  const c = claims();
  assert.deepEqual(await verify(`Bearer ${token(c)}`), c);
});

test('no Bearer prefix, a missing header or a token without three parts: null, no certs fetched', async () => {
  const verify = makeFirebaseVerifier({ projectId: PROJECT });
  for (const h of [undefined, null, '', token(claims()), 'Bearer a.b', 'Bearer a.b.c.d', 'bearer x.y.z']) assert.equal(await verify(h), null);
  assert.equal(fetches, 0);
});

test('expired, wrong audience, wrong issuer, wrong signature and unknown kid are all null', async () => {
  const verify = makeFirebaseVerifier({ projectId: PROJECT });
  assert.equal(await verify(`Bearer ${token(claims({ exp: nowS() - 5 }))}`), null);
  assert.equal(await verify(`Bearer ${token(claims({ aud: 'someone-else' }))}`), null);
  assert.equal(await verify(`Bearer ${token(claims({ iss: 'https://securetoken.google.com/someone-else' }))}`), null);
  assert.equal(await verify(`Bearer ${token(claims(), { key: other })}`), null);
  assert.equal(await verify(`Bearer ${token(claims(), { kid: 'nope' })}`), null);
});

test('without a projectId the aud and iss checks are skipped (exp and signature still apply)', async () => {
  const verify = makeFirebaseVerifier({});
  const c = claims({ aud: 'anything', iss: 'anywhere' });
  assert.deepEqual(await verify(`Bearer ${token(c)}`), c);
  assert.equal(await verify(`Bearer ${token(claims({ exp: nowS() - 5 }))}`), null);
  assert.equal(await verify(`Bearer ${token(claims(), { key: other })}`), null);
});

test('the certs are fetched once and kept for the next token', async () => {
  const verify = makeFirebaseVerifier({ projectId: PROJECT });
  await verify(`Bearer ${token(claims())}`);
  await verify(`Bearer ${token(claims())}`);
  assert.ok(fetches <= 1, `fetched ${fetches} times`); // 0 when an earlier test in this process already filled the cache
});

test('a malformed token logs logLabel with the error message when given, and is silent otherwise', async () => {
  const bad = `Bearer ${b64({ alg: 'RS256' })}.!!!notjson.sig`;
  const [r1, w1] = await withLogs(() => makeFirebaseVerifier({ projectId: PROJECT, logLabel: 'verifyFirebaseToken failed' })(bad));
  assert.equal(r1, null);
  assert.equal(w1.length, 1);
  assert.equal(w1[0][0], 'verifyFirebaseToken failed');
  assert.equal(typeof w1[0][1], 'string');
  const [r2, w2] = await withLogs(() => makeFirebaseVerifier({ projectId: PROJECT })(bad));
  assert.equal(r2, null);
  assert.deepEqual(w2, []);
});
