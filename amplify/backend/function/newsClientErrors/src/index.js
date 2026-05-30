'use strict';

// newsClientErrors — passive client-error sink.
//
// A dedicated, PUBLIC Lambda Function URL that receives uncaught frontend
// errors (window 'error' + 'unhandledrejection') and aggregates them in a
// DynamoDB table keyed by day + a hash of the error, so a flood of identical
// errors collapses into one counter row instead of N rows. Read them back with
// `node scripts/errors.mjs`.
//
// Why a separate Lambda (not the content proxy): the proxy has a cold-start
// concurrency limiter; error traffic is bursty and untrusted, so it stays off
// the proxy entirely (same precedent as newsSavedItems).
//
// Auth: NONE — errors originate from anonymous visitors. Abuse is bounded by
// (1) a hard body-size cap, (2) per-field length caps, and (3) the counter
// design (identical errors increment one row; the 30-day TTL reaps old rows).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { createHash } = require('crypto');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const ERRORS_TABLE = process.env.CLIENT_ERRORS_TABLE;
const TTL_DAYS = Number(process.env.ERROR_TTL_DAYS || 30);

// Abuse bounds — reject anything larger than these.
const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_URL = 1000;
const MAX_UA = 500;

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

function httpReply(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function clamp(v, max) {
  if (typeof v !== 'string') return '';
  return v.length > max ? v.slice(0, max) : v;
}

// Group errors that are "the same bug": hash the message + the first stack
// frame, with volatile bits (line:col, numbers, blob/hashed URLs) normalized
// out so the same error from different sessions collapses into one row.
function fingerprint(message, stack) {
  const firstFrame = (stack || '').split('\n').find(l => /\bat\b|@/.test(l)) || '';
  const norm = `${message}\n${firstFrame}`
    .replace(/:\d+:\d+/g, '')      // strip line:col
    .replace(/\d+/g, '#')          // collapse numbers
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return createHash('sha1').update(norm).digest('hex').slice(0, 16);
}

async function handleFunctionUrl(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '' };
  }
  if (method !== 'POST') {
    return httpReply(405, { ok: false, error: 'Method not allowed' });
  }

  if (!ERRORS_TABLE) {
    console.error('newsClientErrors misconfigured: CLIENT_ERRORS_TABLE env var missing');
    return httpReply(500, { ok: false, error: 'Server misconfiguration' });
  }

  const raw = typeof event.body === 'string' ? event.body : JSON.stringify(event.body || {});
  if (raw && Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return httpReply(413, { ok: false, error: 'Payload too large' });
  }

  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return httpReply(400, { ok: false, error: 'Invalid JSON body' });
  }

  const message = clamp(body.message, MAX_MESSAGE);
  if (!message) return httpReply(400, { ok: false, error: 'message is required' });

  const stack = clamp(body.stack, MAX_STACK);
  const url = clamp(body.url, MAX_URL);
  const userAgent = clamp(body.userAgent, MAX_UA);
  const kind = clamp(body.kind, 40) || 'error';

  const day = new Date().toISOString().slice(0, 10);
  const hash = fingerprint(message, stack);
  const errKey = `${day}#${hash}`;
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;

  try {
    await getDynamoClient().send(new UpdateCommand({
      TableName: ERRORS_TABLE,
      Key: { errKey },
      UpdateExpression:
        'SET #day = :day, #hash = :hash, #kind = :kind, #msg = :msg, ' +
        'firstSeen = if_not_exists(firstSeen, :now), lastSeen = :now, ' +
        'sampleStack = if_not_exists(sampleStack, :stack), ' +
        'sampleUrl = if_not_exists(sampleUrl, :url), ' +
        'sampleUa = if_not_exists(sampleUa, :ua), #ttl = :ttl ' +
        'ADD #count :one',
      ExpressionAttributeNames: {
        '#day': 'day', '#hash': 'hashId', '#kind': 'kind', '#msg': 'message',
        '#count': 'count', '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':day': day, ':hash': hash, ':kind': kind, ':msg': message,
        ':now': now, ':stack': stack, ':url': url, ':ua': userAgent,
        ':ttl': ttl, ':one': 1,
      },
    }));
    return httpReply(202, { ok: true });
  } catch (err) {
    console.error('newsClientErrors write failed', err);
    return httpReply(500, { ok: false, error: 'Write failed' });
  }
}

exports.handler = async (event) => {
  try {
    return await handleFunctionUrl(event);
  } catch (err) {
    console.error('newsClientErrors unhandled error', err);
    return httpReply(502, { ok: false, error: String(err.message || err) });
  }
};
