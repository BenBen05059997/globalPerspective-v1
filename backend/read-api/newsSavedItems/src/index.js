'use strict';

// newsSavedItems — per-user save/bookmark Lambda.
//
// Supports two invocation modes:
//   1. AppSync resolver — event = { info, arguments, request, ... } (the AppSync ctx)
//      Return shape matches the GraphQL types directly:
//        saveItem / unsaveItem  → SavedItemResult { success, error, savedAt }
//        getSavedItems          → SavedItemsListResult { success, items, count }
//
//   2. Lambda Function URL — event = { body, headers, requestContext, ... }
//      Returns HTTP-style { statusCode, headers, body } responses.
//
// The Lambda auto-detects the mode by checking for `event.info?.fieldName`.
//
// Auth: all actions require a Firebase JWT in `Authorization: Bearer <token>`.
// For AppSync, the frontend must send the token in the GraphQL request headers
// (AppSync passes them through to the Lambda as `event.request.headers`).

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

// Map AppSync GraphQL field names → internal action names
const FIELD_TO_ACTION = {
  saveItem: 'save_item',
  unsaveItem: 'unsave_item',
  getSavedItems: 'get_saved_items',
};

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

// CORS is handled by AWS Lambda Function URL config (set via aws lambda
// update-function-url-config). The Lambda must NOT emit Access-Control-*
// headers itself or the browser will reject the duplicated values.

function httpReply(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
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

// ── Core operations (return { ok, data?, error?, status }) ──────────────────
async function saveItemCore(uid, args) {
  const { itemType, itemId, metadata } = args || {};

  const typeErr = validateItemType(itemType);
  if (typeErr) return { ok: false, error: typeErr, status: 400 };

  const idErr = validateItemId(itemId);
  if (idErr) return { ok: false, error: idErr, status: 400 };

  const savedAt = new Date().toISOString();

  try {
    await getDynamoClient().send(new PutCommand({
      TableName: SAVED_ITEMS_TABLE,
      Item: {
        uid,
        savedKey: buildSavedKey(itemType, itemId),
        itemType,
        itemId,
        metadata: sanitizeMetadata(metadata),
        savedAt,
      },
    }));
    console.info('save_item ok', { uid, itemType, itemId });
    return { ok: true, data: { savedAt }, status: 200 };
  } catch (err) {
    console.error('save_item failed', err);
    return { ok: false, error: 'Save failed', status: 500 };
  }
}

async function unsaveItemCore(uid, args) {
  const { itemType, itemId } = args || {};

  const typeErr = validateItemType(itemType);
  if (typeErr) return { ok: false, error: typeErr, status: 400 };

  const idErr = validateItemId(itemId);
  if (idErr) return { ok: false, error: idErr, status: 400 };

  try {
    await getDynamoClient().send(new DeleteCommand({
      TableName: SAVED_ITEMS_TABLE,
      Key: { uid, savedKey: buildSavedKey(itemType, itemId) },
    }));
    console.info('unsave_item ok', { uid, itemType, itemId });
    return { ok: true, status: 200 };
  } catch (err) {
    console.error('unsave_item failed', err);
    return { ok: false, error: 'Unsave failed', status: 500 };
  }
}

async function getSavedItemsCore(uid, args) {
  const { itemType } = args || {};

  const params = {
    TableName: SAVED_ITEMS_TABLE,
    KeyConditionExpression: 'uid = :uid',
    ExpressionAttributeValues: { ':uid': uid },
    Limit: MAX_SAVED_ITEMS,
  };

  if (itemType) {
    const typeErr = validateItemType(itemType);
    if (typeErr) return { ok: false, error: typeErr, status: 400 };
    params.KeyConditionExpression += ' AND begins_with(savedKey, :prefix)';
    params.ExpressionAttributeValues[':prefix'] = `${itemType}#`;
  }

  try {
    const { Items = [] } = await getDynamoClient().send(new QueryCommand(params));
    const items = Items
      .map(({ uid: _u, savedKey: _sk, ...rest }) => rest)
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    console.info('get_saved_items ok', { uid, count: items.length, filterType: itemType || null });
    return { ok: true, data: items, status: 200 };
  } catch (err) {
    console.error('get_saved_items failed', err);
    return { ok: false, error: 'Load failed', status: 500 };
  }
}

// ── AppSync handler ─────────────────────────────────────────────────────────
async function handleAppSync(event) {
  const fieldName = event.info?.fieldName;
  const action = FIELD_TO_ACTION[fieldName];
  if (!action) {
    throw new Error(`Unsupported field: ${fieldName}`);
  }

  if (!SAVED_ITEMS_TABLE) {
    console.error('newsSavedItems misconfigured: SAVED_ITEMS_TABLE env var missing');
    throw new Error('Server misconfiguration');
  }

  // Auth
  const reqHeaders = event.request?.headers || {};
  const authHeader = reqHeaders.authorization || reqHeaders.Authorization || '';
  const jwtPayload = await verifyFirebaseToken(authHeader);
  if (!jwtPayload) {
    throw new Error('Sign in required');
  }
  const uid = jwtPayload.sub;
  const args = event.arguments || {};

  console.info('newsSavedItems (AppSync) received', { fieldName, action, uid, argKeys: Object.keys(args) });

  if (action === 'save_item') {
    const result = await saveItemCore(uid, args);
    if (!result.ok) throw new Error(result.error);
    return {
      success: true,
      error: null,
      savedAt: result.data?.savedAt || null,
    };
  }

  if (action === 'unsave_item') {
    const result = await unsaveItemCore(uid, args);
    if (!result.ok) throw new Error(result.error);
    return {
      success: true,
      error: null,
      savedAt: null,
    };
  }

  if (action === 'get_saved_items') {
    const result = await getSavedItemsCore(uid, args);
    if (!result.ok) throw new Error(result.error);
    const items = result.data || [];
    return {
      success: true,
      items,
      count: items.length,
    };
  }

  throw new Error(`Unhandled action: ${action}`);
}

// ── Function URL handler ────────────────────────────────────────────────────
async function handleFunctionUrl(event) {
  // OPTIONS preflight is handled by AWS Function URL CORS config — this
  // branch is just a fallback if the Lambda is invoked directly.
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '' };
  }

  if (!SAVED_ITEMS_TABLE) {
    console.error('newsSavedItems misconfigured: SAVED_ITEMS_TABLE env var missing');
    return httpReply(500, { success: false, error: 'Server misconfiguration' });
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const jwtPayload = await verifyFirebaseToken(authHeader);
  if (!jwtPayload) {
    return httpReply(401, { success: false, error: 'Sign in required' });
  }
  const uid = jwtPayload.sub;

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
  } catch {
    return httpReply(400, { success: false, error: 'Invalid JSON body' });
  }
  const action = body?.action;
  const payload = body?.payload || {};

  console.info('newsSavedItems (FunctionURL) received', { action, uid, payloadKeys: Object.keys(payload) });

  let result;
  switch (action) {
    case 'save_item':
      result = await saveItemCore(uid, payload);
      return result.ok
        ? httpReply(200, { success: true, data: result.data })
        : httpReply(result.status, { success: false, error: result.error });

    case 'unsave_item':
      result = await unsaveItemCore(uid, payload);
      return result.ok
        ? httpReply(200, { success: true })
        : httpReply(result.status, { success: false, error: result.error });

    case 'get_saved_items':
      result = await getSavedItemsCore(uid, payload);
      return result.ok
        ? httpReply(200, { success: true, data: result.data })
        : httpReply(result.status, { success: false, error: result.error });

    default:
      return httpReply(400, { success: false, error: 'Unsupported action' });
  }
}

// ── Handler — auto-detects AppSync vs Function URL ──────────────────────────
exports.handler = async (event) => {
  try {
    if (event?.info?.fieldName) {
      return await handleAppSync(event);
    }
    return await handleFunctionUrl(event);
  } catch (err) {
    console.error('newsSavedItems unhandled error', err);
    if (event?.info?.fieldName) {
      // AppSync — re-throw so the resolver surfaces it as ctx.error
      throw err;
    }
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: String(err.message || err) }),
    };
  }
};
