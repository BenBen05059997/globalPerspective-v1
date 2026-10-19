'use strict';

// Pure, dependency-free billing helpers (crypto only — no AWS SDK, no env, no I/O), split
// out of index.js so they can be unit-tested locally without DynamoDB. index.js requires
// these; the test in ../test/lib.test.js imports the SAME functions (no copy → no drift).

const { createHmac, timingSafeEqual } = require('crypto');

// Parse POLAR_CREDIT_PACKS env (JSON: { "<packKey>": { "productId": "...", "credits": N } }).
// Anything malformed ⇒ {} (buy-credits stays disabled). Never throws.
function parseCreditPacks(raw) {
  try {
    const obj = JSON.parse(raw || '{}');
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch { return {}; }
}

// Reverse index: productId → credits, used to resolve an incoming order's product to a grant.
function packCreditsByProduct(creditPacks) {
  return Object.fromEntries(
    Object.values(creditPacks || {})
      .filter((p) => p && p.productId && Number(p.credits) > 0)
      .map((p) => [p.productId, Number(p.credits)]),
  );
}

// Every product id an order payload might reference (Polar order shapes vary).
function orderProductIds(data) {
  const ids = [];
  if (data?.product_id) ids.push(data.product_id);
  if (data?.product?.id) ids.push(data.product.id);
  for (const it of data?.items || data?.line_items || []) {
    if (it?.product_id) ids.push(it.product_id);
    if (it?.product?.id) ids.push(it.product.id);
  }
  return ids;
}

// If a paid order is for a known credit pack, its credit amount; else 0 (⇒ treat as membership).
function packCreditsForOrder(data, byProduct) {
  for (const id of orderProductIds(data)) {
    if (byProduct[id]) return byProduct[id];
  }
  return 0;
}

function tierForStatus(status) {
  return (status === 'active' || status === 'trialing') ? 'member' : 'free';
}

// We set customer_external_id = Firebase uid at checkout; recover it from any webhook object.
function extractUid(data) {
  return data?.customer?.external_id
    || data?.customer_external_id
    || data?.metadata?.uid
    || data?.customer?.metadata?.uid
    || null;
}

// Standard-Webhooks signature: sig = base64( HMAC-SHA256(`${id}.${ts}.${rawBody}`, secret) ),
// header carries space-separated `v1,<b64>` sigs. Polar's secret is raw UTF-8 (sometimes
// `whsec_`-prefixed); Svix-style is base64 — try both keyings. `nowSec` is injectable so the
// 5-minute replay window is testable. rawBody: Buffer | string.
function verifyPolarSignature(rawBody, headers, secret, nowSec = Math.floor(Date.now() / 1000)) {
  const id = headers['webhook-id'];
  const ts = headers['webhook-timestamp'];
  const sigHeader = headers['webhook-signature'];
  if (!id || !ts || !sigHeader || !secret) return false;
  if (!Number.isFinite(Number(ts)) || Math.abs(nowSec - Number(ts)) > 300) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const signed = `${id}.${ts}.${body}`;
  const key = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const keys = [Buffer.from(key, 'utf8')];
  try { const b = Buffer.from(key, 'base64'); if (b.length) keys.push(b); } catch { /* not base64 */ }
  const expected = keys.map((k) => createHmac('sha256', k).update(signed).digest('base64'));
  const provided = sigHeader.split(' ').map((s) => (s.includes(',') ? s.split(',')[1] : s)).filter(Boolean);

  for (const p of provided) {
    for (const e of expected) {
      try {
        const pb = Buffer.from(p, 'base64');
        const eb = Buffer.from(e, 'base64');
        if (pb.length === eb.length && timingSafeEqual(pb, eb)) return true;
      } catch { /* skip malformed */ }
    }
  }
  return false;
}

// Helper for callers/tests that need to PRODUCE a valid signature for a payload.
function signPolarPayload(rawBody, { id, ts }, secret) {
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const key = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const sig = createHmac('sha256', Buffer.from(key, 'utf8')).update(`${id}.${ts}.${body}`).digest('base64');
  return `v1,${sig}`;
}

module.exports = {
  parseCreditPacks,
  packCreditsByProduct,
  orderProductIds,
  packCreditsForOrder,
  tierForStatus,
  extractUid,
  verifyPolarSignature,
  signPolarPayload,
};
