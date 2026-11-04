'use strict';

// newsSavedItems — per-user save/bookmark Lambda, invoked through its Lambda Function URL.
// event = { body, headers, requestContext, ... }; returns HTTP-style { statusCode, headers, body }.
//
// Auth: all actions require a Firebase JWT in `Authorization: Bearer <token>`.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { makeFirebaseVerifier } = require('./_shared/firebaseAuth');
const { httpReply } = require('./_shared/httpReply');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const SAVED_ITEMS_TABLE = process.env.SAVED_ITEMS_TABLE;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

const ALLOWED_ITEM_TYPES = new Set(['thread', 'country', 'daily', 'weekly', 'pair']);
const MAX_SAVED_ITEMS = 500;
const MAX_QUERY_PAGES = 10;
const BOARD_PREFIX = 'board#';
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

// ── Firebase JWT verification (lightweight, no firebase-admin; one copy in _shared/firebaseAuth.js) ──
const verifyFirebaseToken = makeFirebaseVerifier({ projectId: FIREBASE_PROJECT_ID, logLabel: 'verifyFirebaseToken: parse/verify failed' });

// CORS is handled by AWS Lambda Function URL config (set via aws lambda
// update-function-url-config). The Lambda must NOT emit Access-Control-*
// headers itself or the browser will reject the duplicated values.

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
    // Boards (newsBoard, savedKey `board#<id>`) share this table but are not saved items. savedKey is the sort key, so a
    // FilterExpression on it is rejected by DynamoDB: drop them here, and keep paging until MAX_SAVED_ITEMS saves are in
    // hand (Limit counts rows read, boards included).
    const rows = [];
    let startKey;
    for (let page = 0; page < MAX_QUERY_PAGES && rows.length < MAX_SAVED_ITEMS; page += 1) {
      const { Items = [], LastEvaluatedKey } = await getDynamoClient().send(new QueryCommand(
        startKey ? { ...params, ExclusiveStartKey: startKey } : params,
      ));
      for (const row of Items) if (!String(row.savedKey).startsWith(BOARD_PREFIX)) rows.push(row);
      if (!LastEvaluatedKey) break;
      startKey = LastEvaluatedKey;
    }
    const items = rows
      .slice(0, MAX_SAVED_ITEMS)
      .map(({ uid: _u, savedKey: _sk, ...rest }) => rest)
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    console.info('get_saved_items ok', { uid, count: items.length, filterType: itemType || null });
    return { ok: true, data: items, status: 200 };
  } catch (err) {
    console.error('get_saved_items failed', err);
    return { ok: false, error: 'Load failed', status: 500 };
  }
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

// ── Handler ─────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  try {
    return await handleFunctionUrl(event);
  } catch (err) {
    console.error('newsSavedItems unhandled error', err);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: String(err.message || err) }),
    };
  }
};
