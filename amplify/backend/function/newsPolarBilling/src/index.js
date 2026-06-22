'use strict';

// newsPolarBilling — Polar.sh billing integration (single Lambda, Function URL).
//
// Reverses the 2026-05-26 billing teardown using Polar (Merchant of Record). Plan:
// POLAR_BILLING_PLAN.md. Three jobs on one Function URL:
//   1. POST webhook from Polar (Standard Webhooks signature) → grant/revoke the
//      member tier in USERS_TABLE.
//   2. action 'create_checkout' (Firebase JWT) → create a Polar Checkout Session for
//      the signed-in user and return { url } to redirect to.
//   3. action 'get_membership' (Firebase JWT) → return the user's membership state.
//
// Trust model: the client never supplies product IDs or its own uid. The plan→product
// mapping is server-side env; the uid comes from the *verified* Firebase token and is
// passed to Polar as `customer_external_id`, so the webhook can map the payment back to
// the user. Webhook signatures are verified before any write. No secret is ever logged.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { createHmac, timingSafeEqual, createVerify } = require('crypto');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const USERS_TABLE = process.env.USERS_DDB_TABLE;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const POLAR_API_BASE = (process.env.POLAR_API_BASE || 'https://api.polar.sh').replace(/\/$/, '');
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;
const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;
const PRODUCTS = { monthly: process.env.POLAR_PRODUCT_MONTHLY, yearly: process.env.POLAR_PRODUCT_YEARLY };
const SITE_URL = (process.env.SITE_URL || 'https://globalperspective.net').replace(/\/$/, '');
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS
  || 'https://globalperspective.net,https://www.globalperspective.net,https://benben05059997.github.io,http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((s) => s.trim());

let _ddb = null;
function ddb() {
  if (!_ddb) {
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _ddb;
}

// ── Firebase JWT verify (lightweight, mirrors newsRecommend/newsSavedItems) ──────
let _certCache = null;
let _certCacheExpiry = 0;
async function getGoogleCerts() {
  const now = Date.now();
  if (_certCache && now < _certCacheExpiry) return _certCache;
  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  _certCache = await res.json();
  _certCacheExpiry = now + 3600 * 1000;
  return _certCache;
}
async function verifyFirebaseToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (FIREBASE_PROJECT_ID && payload.aud !== FIREBASE_PROJECT_ID) return null;
    if (FIREBASE_PROJECT_ID && payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    const certs = await getGoogleCerts();
    const cert = certs[header.kid];
    if (!cert) return null;
    const verifier = createVerify('SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    return verifier.verify(cert, parts[2], 'base64url') ? payload : null;
  } catch (err) {
    console.warn('verifyFirebaseToken failed', err.message);
    return null;
  }
}

// ── Polar webhook signature (Standard Webhooks) ─────────────────────────────────
// sig = base64( HMAC-SHA256( `${id}.${ts}.${rawBody}`, secret ) ), prefixed `v1,`.
// The header may carry several space-separated `v1,<b64>` signatures. Polar's secret is
// raw UTF-8 (sometimes `whsec_`-prefixed); Svix-style is base64 — we try both keyings.
function verifyPolarSignature(rawBody, headers) {
  const id = headers['webhook-id'];
  const ts = headers['webhook-timestamp'];
  const sigHeader = headers['webhook-signature'];
  if (!id || !ts || !sigHeader || !POLAR_WEBHOOK_SECRET) return false;
  // Replay guard: reject timestamps more than 5 minutes from now.
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(Number(ts)) || Math.abs(now - Number(ts)) > 300) return false;

  const signed = `${id}.${ts}.${rawBody.toString('utf8')}`;
  const secret = POLAR_WEBHOOK_SECRET.startsWith('whsec_') ? POLAR_WEBHOOK_SECRET.slice(6) : POLAR_WEBHOOK_SECRET;
  const keys = [Buffer.from(secret, 'utf8')];
  try { const b = Buffer.from(secret, 'base64'); if (b.length) keys.push(b); } catch { /* not base64 */ }
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

// We set customer_external_id = Firebase uid at checkout; recover it from the webhook object.
function extractUid(data) {
  return data?.customer?.external_id
    || data?.customer_external_id
    || data?.metadata?.uid
    || data?.customer?.metadata?.uid
    || null;
}

function tierForStatus(status) {
  return (status === 'active' || status === 'trialing') ? 'member' : 'free';
}

async function applyMembership({ uid, tier, status, customerId, subscriptionId, currentPeriodEnd, email }) {
  if (!uid || !USERS_TABLE) return;
  const sets = ['tier = :t', 'subscriptionStatus = :s', 'billingProvider = :prov', 'updatedAt = :now'];
  const vals = { ':t': tier, ':s': status || 'unknown', ':prov': 'polar', ':now': new Date().toISOString() };
  if (customerId) { sets.push('polarCustomerId = :c'); vals[':c'] = customerId; }
  if (subscriptionId) { sets.push('polarSubscriptionId = :sub'); vals[':sub'] = subscriptionId; }
  if (currentPeriodEnd) { sets.push('currentPeriodEnd = :end'); vals[':end'] = currentPeriodEnd; }
  if (email) { sets.push('email = if_not_exists(email, :e)'); vals[':e'] = email; }
  await ddb().send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { uid },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeValues: vals,
  }));
}

async function handleWebhook(rawBody, headers) {
  if (!verifyPolarSignature(rawBody, headers)) return httpReply(401, { error: 'bad_signature' });
  let evt;
  try { evt = JSON.parse(rawBody.toString('utf8')); } catch { return httpReply(400, { error: 'bad_json' }); }

  const type = evt.type || '';
  const data = evt.data || {};
  try {
    if (type.startsWith('subscription.')) {
      const uid = extractUid(data);
      const status = data.status;
      await applyMembership({
        uid,
        tier: tierForStatus(status),
        status,
        customerId: data.customer_id || data.customer?.id,
        subscriptionId: data.id,
        currentPeriodEnd: data.current_period_end || data.ends_at,
        email: data.customer?.email,
      });
    } else if (type === 'order.paid' || type === 'order.created') {
      // First payment / one-off — grant if we can identify the user. Subscription events
      // remain the source of truth for ongoing status.
      const uid = extractUid(data);
      if (uid && data.paid !== false) {
        await applyMembership({
          uid,
          tier: 'member',
          status: 'active',
          customerId: data.customer_id || data.customer?.id,
          subscriptionId: data.subscription_id || data.subscription?.id,
          email: data.customer?.email,
        });
      }
    }
    // Every other event type is acknowledged (200) without action, so Polar stops retrying.
  } catch (err) {
    console.error('webhook handler error', type, err.message);
    return httpReply(500, { error: 'handler_error' });
  }
  return httpReply(200, { received: true });
}

async function createCheckout({ uid, email, plan }) {
  const productId = PRODUCTS[plan === 'yearly' ? 'yearly' : 'monthly'];
  if (!productId) throw new Error('product_not_configured');
  if (!POLAR_ACCESS_TOKEN) throw new Error('token_not_configured');
  const res = await fetch(`${POLAR_API_BASE}/v1/checkouts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${POLAR_ACCESS_TOKEN}` },
    body: JSON.stringify({
      products: [productId],
      success_url: `${SITE_URL}/account?checkout=success`,
      customer_external_id: uid,
      metadata: { uid },
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.url) {
    throw new Error(`polar_checkout_failed ${res.status}: ${j ? JSON.stringify(j).slice(0, 300) : 'no body'}`);
  }
  return { url: j.url };
}

async function getMembership(uid) {
  if (!USERS_TABLE) return { tier: 'free' };
  const out = await ddb().send(new GetCommand({ TableName: USERS_TABLE, Key: { uid } }));
  const it = out.Item || {};
  return {
    tier: it.tier === 'member' ? 'member' : 'free',
    status: it.subscriptionStatus || null,
    currentPeriodEnd: it.currentPeriodEnd || null,
    provider: it.billingProvider || null,
  };
}

// ── HTTP plumbing ───────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,webhook-id,webhook-timestamp,webhook-signature',
    'Content-Type': 'application/json',
  };
}
function httpReply(statusCode, body, origin) {
  return { statusCode, headers: corsHeaders(origin), body: JSON.stringify(body) };
}

exports.handler = async (event = {}) => {
  // Normalize header keys to lowercase (Function URL usually does, but be safe).
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;
  const origin = headers.origin;
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';

  if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(origin) };

  const rawBody = event.body
    ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body, 'utf8'))
    : Buffer.alloc(0);

  // A Polar webhook is identified by the Standard-Webhooks signature header.
  if (headers['webhook-signature']) {
    return handleWebhook(rawBody, headers);
  }

  // Otherwise it's a frontend action (Firebase-JWT gated).
  let body = {};
  try { body = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {}; } catch { /* tolerate */ }

  let uid = null;
  let email = null;
  const claims = await verifyFirebaseToken(headers.authorization);
  if (claims) { uid = claims.user_id || claims.sub; email = claims.email || null; }

  const action = body.action;
  if (action === 'create_checkout') {
    if (!uid) return httpReply(401, { error: 'sign_in_required' }, origin);
    try {
      return httpReply(200, await createCheckout({ uid, email, plan: body.plan }), origin);
    } catch (err) {
      console.error('create_checkout error', err.message);
      return httpReply(502, { error: 'checkout_failed' }, origin);
    }
  }
  if (action === 'get_membership') {
    if (!uid) return httpReply(401, { error: 'sign_in_required' }, origin);
    try {
      return httpReply(200, await getMembership(uid), origin);
    } catch (err) {
      console.error('get_membership error', err.message);
      return httpReply(500, { error: 'internal_error' }, origin);
    }
  }
  return httpReply(400, { error: 'unknown_action' }, origin);
};
