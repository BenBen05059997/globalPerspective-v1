// Firebase ID-token verification without firebase-admin: the same checks newsAnalyze makes (RS256 signature
// against Google's public x509 certs, exp, aud, iss), plus: it FAILS CLOSED when the project id is not
// configured, and it requires a subject. No secret is involved (the certs are public).
import { createVerify } from 'node:crypto';

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = null;
let certExpiry = 0;

async function defaultCerts(fetchImpl = fetch) {
  const now = Date.now();
  if (certCache && now < certExpiry) return certCache;
  const res = await fetchImpl(CERT_URL);
  certCache = await res.json();
  certExpiry = now + 3600 * 1000;
  return certCache;
}

/**
 * @param {string|undefined} authHeader  "Bearer <jwt>"
 * @param {{projectId:string, getCerts?:()=>Promise<Object>, now?:()=>number}} opts
 * @returns {Promise<{uid:string, claims:object}|null>}
 */
export async function verifyFirebaseToken(authHeader, { projectId, getCerts = defaultCerts, now = () => Date.now() } = {}) {
  if (!projectId) return null; // fail closed
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header.alg !== 'RS256') return null;
    if (!(payload.exp > Math.floor(now() / 1000))) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    const uid = payload.user_id || payload.sub;
    if (!uid || typeof uid !== 'string') return null;
    const certs = await getCerts();
    const cert = certs && certs[header.kid];
    if (!cert) return null;
    const verifier = createVerify('SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    return verifier.verify(cert, parts[2], 'base64url') ? { uid, claims: payload } : null;
  } catch {
    return null;
  }
}
