'use strict';

// newsSavedItems — per-user bookmark/save Lambda.
//
// Stores items the user has saved (threads, countries, daily briefs, and
// eventually pairs) in the GlobalPerspectiveSavedItems DynamoDB table.
//
// Invoked via Lambda Function URL. CORS and preflight are configured on the
// Function URL itself; this code still emits Access-Control headers on
// responses as a belt-and-suspenders measure.
//
// Actions (POST body: { action, payload }):
//   - save_item       { itemType, itemId, metadata? }
//   - unsave_item     { itemType, itemId }
//   - get_saved_items { itemType? }                (optional filter)
//
// All actions require a Firebase JWT in `Authorization: Bearer <token>`.
// Verification is done locally (no firebase-admin) against Google's public
// x509 certs, matching the pattern used by newsSensitiveData.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const SAVED_ITEMS_TABLE = process.env.SAVED_ITEMS_TABLE;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

const ALLOWED_ITEM_TYPES = new Set(['thread', 'country', 'daily', 'pair']);
const MAX_SAVED_ITEMS = 500;
const MAX_METADATA_BYTES = 4096;

// ── DynamoDB client (singleton) ─────────────────────────────────────────────
let _ddb = null;
function getDynamoClient() {
  if (!_ddb) {
    const base = new DynamoDBClient({ region: REGION });
    _ddb = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _ddb;
}

// ── Firebase JWT verification (lightweight, no firebase-admin) ──────────────
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
    const { createVerify } = require('crypto');
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
    const isValid = verifier.verify(cert, parts[2], 'base64url');
    return isValid ? payload : null;
  } catch (err) {
    console.warn('verifyFirebaseToken: parse/verify failed', err.message);
    return null;
  }
}

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://benben05059997.github.io',
  'https://globalperspective.net',
  'https://www.globalperspective.net',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };
}

function reply(statusCode, body, headers) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

// ── Validation ──────────────────────────────────────────────────────────────
function validateItemType(itemType) {
  if (!itemType || typeof itemType !== 'string') return 'itemType is required';
  if (!ALLOWED_ITEM_TYPES.has(itemType)) return `itemType must be one of: ${[...ALLOWED_ITEM_TYPES].join(', ')}`;
  return null;
}

function validateItemId(itemId) {
  if (!itemId || typeof itemId !== 'string') return 'itemId is required';
  if (itemId.length > 256) return 'itemId too long (max 256)';
  if (itemId.includes('#')) return 'itemId cannot contain "#"';
  return null;
}

function sanitizeMetadata(metadata) {
  if (metadata == null) return {};
  if (typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const serialized = JSON.stringify(metadata);
  if (serialized.length > MAX_METADATA_BYTES) {
    console.warn('sanitizeMetadata: metadata too large, dropping', { size: serialized.length });
    return {};
  }
  return metadata;
}

function buildSavedKey(itemType, itemId) {
  return `${itemType}#${itemId}`;
}

// ── Action handlers ─────────────────────────────────────────────────────────
async function handleSaveItem(uid, payload, headers) {
  const { itemType, itemId, metadata } = payload || {};

  const typeErr = validateItemType(itemType);
  if (typeErr) return reply(400, { success: false, error: typeErr }, headers);

  const idErr = validateItemId(itemId);
  if (idErr) return reply(400, { success: false, error: idErr }, headers);

  const savedAt = new Date().toISOString();
  const item = {
    uid,
    savedKey: buildSavedKey(itemType, itemId),
    itemType,
    itemId,
    metadata: sanitizeMetadata(metadata),
    savedAt,
  };

  try {
    await getDynamoClient().send(new PutCommand({
      TableName: SAVED_ITEMS_TABLE,
      Item: item,
    }));
    console.info('save_item ok', { uid, itemType, itemId });
    return reply(200, { success: true, data: { savedAt } }, headers);
  } catch (err) {
    console.error('save_item failed', err);
    return reply(500, { success: false, error: 'Save failed' }, headers);
  }
}

async function handleUnsaveItem(uid, payload, headers) {
  const { itemType, itemId } = payload || {};

  const typeErr = validateItemType(itemType);
  if (typeErr) return reply(400, { success: false, error: typeErr }, headers);

  const idErr = validateItemId(itemId);
  if (idErr) return reply(400, { success: false, error: idErr }, headers);

  try {
    await getDynamoClient().send(new DeleteCommand({
      TableName: SAVED_ITEMS_TABLE,
      Key: { uid, savedKey: buildSavedKey(itemType, itemId) },
    }));
    console.info('unsave_item ok', { uid, itemType, itemId });
    return reply(200, { success: true }, headers);
  } catch (err) {
    console.error('unsave_item failed', err);
    return reply(500, { success: false, error: 'Unsave failed' }, headers);
  }
}

async function handleGetSavedItems(uid, payload, headers) {
  const { itemType } = payload || {};

  const params = {
    TableName: SAVED_ITEMS_TABLE,
    KeyConditionExpression: 'uid = :uid',
    ExpressionAttributeValues: { ':uid': uid },
    Limit: MAX_SAVED_ITEMS,
  };

  if (itemType) {
    const typeErr = validateItemType(itemType);
    if (typeErr) return reply(400, { success: false, error: typeErr }, headers);
    params.KeyConditionExpression += ' AND begins_with(savedKey, :prefix)';
    params.ExpressionAttributeValues[':prefix'] = `${itemType}#`;
  }

  try {
    const { Items = [] } = await getDynamoClient().send(new QueryCommand(params));
    // Strip internal keys and sort newest first
    const items = Items
      .map(({ uid: _u, savedKey: _sk, ...rest }) => rest)
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    console.info('get_saved_items ok', { uid, count: items.length, filterType: itemType || null });
    return reply(200, { success: true, data: items }, headers);
  } catch (err) {
    console.error('get_saved_items failed', err);
    return reply(500, { success: false, error: 'Load failed' }, headers);
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = corsHeaders(event);

  // Preflight (Function URL handles this, but respond explicitly too)
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!SAVED_ITEMS_TABLE) {
    console.error('newsSavedItems misconfigured: SAVED_ITEMS_TABLE env var missing');
    return reply(500, { success: false, error: 'Server misconfiguration' }, headers);
  }

  // Auth — all actions require a valid Firebase token
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const jwtPayload = await verifyFirebaseToken(authHeader);
  if (!jwtPayload) {
    return reply(401, { success: false, error: 'Sign in required' }, headers);
  }
  const uid = jwtPayload.sub;

  // Parse body
  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
  } catch {
    return reply(400, { success: false, error: 'Invalid JSON body' }, headers);
  }
  const action = body?.action;
  const payload = body?.payload || {};

  console.info('newsSavedItems received', { action, uid, payloadKeys: Object.keys(payload) });

  try {
    switch (action) {
      case 'save_item':
        return await handleSaveItem(uid, payload, headers);
      case 'unsave_item':
        return await handleUnsaveItem(uid, payload, headers);
      case 'get_saved_items':
        return await handleGetSavedItems(uid, payload, headers);
      default:
        return reply(400, { success: false, error: 'Unsupported action' }, headers);
    }
  } catch (err) {
    console.error('newsSavedItems unhandled error', err);
    return reply(502, { success: false, error: String(err.message || err) }, headers);
  }
};
