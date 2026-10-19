import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFirebaseToken } from '../src/auth.js';
import { PROJECT, getCerts, makeToken, otherKey } from './helpers.js';

const v = (token, o = {}) => verifyFirebaseToken(token && `Bearer ${token}`, { projectId: PROJECT, getCerts, ...o });

test('a valid token gives the uid', async () => {
  const r = await v(makeToken({ uid: 'abc' }));
  assert.equal(r.uid, 'abc');
});
test('wrong audience, wrong issuer, expired, unknown kid, wrong signature, wrong alg, malformed all fail', async () => {
  assert.equal(await v(makeToken({ aud: 'other' })), null);
  assert.equal(await v(makeToken({ iss: 'https://evil.example/test-project' })), null);
  assert.equal(await v(makeToken({ exp: Math.floor(Date.now() / 1000) - 10 })), null);
  assert.equal(await v(makeToken({ kid: 'nope' })), null);
  assert.equal(await v(makeToken({ signWith: otherKey })), null);
  assert.equal(await v(makeToken({ alg: 'HS256' })), null);
  assert.equal(await v('a.b'), null);
  assert.equal(await v('not-a-token'), null);
});
test('no header, a non-Bearer header, or no configured project id (fail closed) are all refused', async () => {
  assert.equal(await verifyFirebaseToken(undefined, { projectId: PROJECT, getCerts }), null);
  assert.equal(await verifyFirebaseToken('Basic abc', { projectId: PROJECT, getCerts }), null);
  assert.equal(await verifyFirebaseToken(`Bearer ${makeToken()}`, { projectId: undefined, getCerts }), null);
});
test('a token with no subject is refused', async () => {
  assert.equal(await v(makeToken({ uid: '' })), null);
});
