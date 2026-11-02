'use strict';
// A test helper for the Lambdas that check a Firebase ID token (makeFirebaseVerifier): tokens are signed with a throwaway RSA key and Google's cert
// fetch is replaced by a fake global fetch that serves that key, so no test reaches the network. Usage:
//   const fb = require('.../shared/test/firebaseToken');
//   fb.installCerts();                          // in before(); fb.restoreFetch() in after()
//   headers: { authorization: fb.bearer({ sub: 'u1' }) }   // good token for fb.PROJECT; extra claims override the defaults
//   fb.bearer({}, { key: fb.otherKey })         // signed by a key Google does not serve -> the verifier returns null
const { generateKeyPairSync, createSign } = require('node:crypto');

const PROJECT = 'gp-test';
const goodKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = (k) => k.publicKey.export({ type: 'spki', format: 'pem' });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const nowS = () => Math.floor(Date.now() / 1000);

/** A signed three-part token (no 'Bearer ' prefix). */
function token(claims = {}, { key = goodKey, kid = 'k1' } = {}) {
  const head = b64({ alg: 'RS256', kid });
  const body = b64({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'u1', exp: nowS() + 600, ...claims });
  const sig = createSign('SHA256').update(`${head}.${body}`).sign(key.privateKey).toString('base64url');
  return `${head}.${body}.${sig}`;
}
/** An Authorization header value. */
const bearer = (claims, opts) => `Bearer ${token(claims, opts)}`;

let realFetch;
function installCerts() {
  realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ json: async () => ({ k1: pem(goodKey) }) });
}
function restoreFetch() { globalThis.fetch = realFetch; }

module.exports = { PROJECT, otherKey, token, bearer, installCerts, restoreFetch, nowS };
