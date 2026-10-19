'use strict';

// apiKeys — minimal API-key verification for the paid Signal API. Keys are NEVER stored
// in plaintext: the consumer holds `gpsk_<random>`, we store only its sha256 hash as the
// table key. Lookup is O(1) GetItem on the hash — no scan, no secret at rest.
//
// Table GlobalPerspectiveApiKeys (see SIGNAL_API_PLAN.md §7 / infra appendix):
//   PK keyHash (sha256 hex of the presented key)
//   { keyHash, label, tier('free'|'paid'), rateLimitPerMin, active(bool), createdAt }
//
// Issuing a key (operator, offline): generate `gpsk_<24 random bytes base64url>`, hash it,
// PutItem the hash + tier, hand the raw key to the customer once. We can't recover it.

const crypto = require('crypto');

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
}

// Generate a fresh key + its hash. Operator-only helper (not called in the request path).
function mintKey() {
  const raw = 'gpsk_' + crypto.randomBytes(24).toString('base64url');
  return { raw, keyHash: hashKey(raw) };
}

// Extract the presented key from an HTTP event. Accepts either:
//   Authorization: Bearer gpsk_xxx   (preferred)
//   x-api-key: gpsk_xxx
function extractKey(headers = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v;
  const auth = h['authorization'];
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  if (h['x-api-key']) return String(h['x-api-key']).trim();
  return null;
}

// Verify a presented key against the DDB table. Returns the key record (without the hash)
// on success, or null. `getItem(keyHash)` is injected so this stays unit-testable and
// AWS-free.
async function verifyKey(rawKey, getItem) {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith('gpsk_')) return null;
  const keyHash = hashKey(rawKey);
  let rec;
  try { rec = await getItem(keyHash); } catch { return null; }
  if (!rec || rec.active === false) return null;
  return {
    label: rec.label || null,
    tier: rec.tier === 'paid' ? 'paid' : 'free',
    rateLimitPerMin: Number(rec.rateLimitPerMin) || (rec.tier === 'paid' ? 120 : 20),
    keyHash,
  };
}

module.exports = { hashKey, mintKey, extractKey, verifyKey };
