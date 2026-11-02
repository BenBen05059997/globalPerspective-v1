'use strict';

// Firebase ID-token check without firebase-admin, one copy for newsRecommend, newsSavedItems and newsSensitiveData:
//   const verifyFirebaseToken = makeFirebaseVerifier({ projectId: process.env.FIREBASE_PROJECT_ID, logLabel: '...' });
//   await verifyFirebaseToken('Bearer <jwt>')  -> the token's payload, or null
// Checks: three-part token, exp, aud and iss against the projectId, then the RS256-style SHA256 signature against
// Google's public securetoken certs (fetched with global fetch, kept 1 h per warm Lambda). With no projectId it FAILS CLOSED:
// every token is refused (null) without fetching certs, and one console.warn names FIREBASE_PROJECT_ID when the verifier is built;
// newsSharedAnalysis/src/auth.js is the same rule in its own strict copy.
// A parse or verify failure returns null; `logLabel`, when given, is printed with the error message (console.warn), else it is silent.
const { createVerify } = require('crypto');

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let _certCache = null;
let _certCacheExpiry = 0;

async function getGoogleCerts() {
  const now = Date.now();
  if (_certCache && now < _certCacheExpiry) return _certCache;
  const res = await fetch(CERT_URL);
  _certCache = await res.json();
  _certCacheExpiry = now + 3600 * 1000;
  return _certCache;
}

function makeFirebaseVerifier({ projectId, logLabel } = {}) {
  if (!projectId) console.warn(`${logLabel || 'firebaseAuth'}: FIREBASE_PROJECT_ID is not set, every Firebase token will be refused`);
  return async function verifyFirebaseToken(authHeader) {
    if (!projectId) return null; // fail closed: without a project id any Google-signed token from any Firebase project would pass
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) return null;
      if (payload.aud !== projectId) return null;
      if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
      const certs = await getGoogleCerts();
      const cert = certs[header.kid];
      if (!cert) return null;
      const verifier = createVerify('SHA256');
      verifier.update(`${parts[0]}.${parts[1]}`);
      return verifier.verify(cert, parts[2], 'base64url') ? payload : null;
    } catch (err) {
      if (logLabel) console.warn(logLabel, err.message);
      return null;
    }
  };
}

module.exports = { makeFirebaseVerifier, getGoogleCerts };
