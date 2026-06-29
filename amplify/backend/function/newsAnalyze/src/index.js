'use strict';

// newsAnalyze — the member-side of the Analysis Studio (/analyze).
//
// Free users run the Studio with their OWN key (BYOK, browser → provider). MEMBERS run
// it on OUR compute (DeepSeek) with no key needed — that convenience IS the paid product
// (reading the site stays 100% free). See POLAR_BILLING_PLAN.md + ANALYSIS_STUDIO_PLAN.md.
//
// This Lambda: verify Firebase JWT → require tier=member (set by newsPolarBilling on
// payment) → enforce a daily fair-use cap → run the analysis on our key with a SERVER-side
// system prompt (the honesty guardrails are not client-controllable) → return the report.
// The `user` message (real story context + task) is assembled by the trusted frontend from
// our own public data; the server pins the system prompt + token cap + rate limit, so abuse
// is bounded (and DeepSeek costs a fraction of a cent per run).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { createVerify } = require('crypto');
const { decidePayment } = require('./lib');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const USERS_TABLE = process.env.USERS_DDB_TABLE;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
// Legacy GROK_* names hold DeepSeek values in production (see feedback-misleading-grok-naming).
const LLM_KEY = process.env.XAI_API_KEY;
const LLM_URL_RAW = process.env.GROK_API_URL || 'https://api.deepseek.com';
const LLM_MODEL = process.env.GROK_MODEL || 'deepseek-chat';
const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 1600;
// Members get MEMBER_MONTHLY_ALLOWANCE free runs per calendar month; beyond that (and for
// non-members) each run spends 1 credit (bought via newsPolarBilling credit packs).
const MONTHLY_ALLOWANCE = Number(process.env.MEMBER_MONTHLY_ALLOWANCE) || 100;
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS
  || 'https://globalperspective.net,https://www.globalperspective.net,https://benben05059997.github.io,http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((s) => s.trim());

const LLM_URL = LLM_URL_RAW.endsWith('/chat/completions')
  ? LLM_URL_RAW
  : `${LLM_URL_RAW.replace(/\/$/, '')}/chat/completions`;

// The honesty contract — server-pinned, identical in spirit to the frontend's BYOK prompt.
const SYSTEM_PROMPT = [
  'You are a senior geopolitical and markets intelligence analyst writing for professional readers.',
  'Analyze ONLY the stories provided below. Ground every claim in them and cite sources with bracket numbers like [1], [2].',
  'If the provided material is insufficient to answer well, say so plainly under a "Limits of this analysis" heading — never invent facts, dates, figures, or sources.',
  'Never fabricate percentages or precise numbers that are not present in the material.',
  'Write clean Markdown: short ## section headings and concise, specific bullet points. Be analytical, not generic.',
].join(' ');

let _ddb = null;
function ddb() {
  if (!_ddb) {
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _ddb;
}

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

async function getUser(uid) {
  const out = await ddb().send(new GetCommand({ TableName: USERS_TABLE, Key: { uid } }));
  return out.Item || {};
}

// Decide how this run is paid for, and consume it. Order:
//   1) Member within the monthly allowance → free run (bump the monthly counter; soft limit).
//   2) Otherwise (member over allowance, or any signed-in non-member) → spend 1 credit.
//      The decrement is ATOMIC and conditional (creditBalance >= 1), so concurrent runs can
//      never push the balance below zero — credits are real money, unlike the soft allowance.
// Returns { ok, source, ... } or { ok:false, reason:'out_of_credits' }.
async function consume(uid, user) {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const decision = decidePayment(user, month, MONTHLY_ALLOWANCE);

  if (decision.mode === 'allowance') {
    await ddb().send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { uid },
      UpdateExpression: 'SET analyzeMonth = :m, analyzeCount = :c, analyzeUpdatedAt = :now',
      ExpressionAttributeValues: { ':m': month, ':c': decision.nextCount, ':now': new Date().toISOString() },
    }));
    return { ok: true, source: 'allowance', allowanceUsed: decision.nextCount, allowanceLimit: MONTHLY_ALLOWANCE };
  }

  try {
    const out = await ddb().send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { uid },
      UpdateExpression: 'ADD creditBalance :neg SET analyzeUpdatedAt = :now',
      ConditionExpression: 'creditBalance >= :one',
      ExpressionAttributeValues: { ':neg': -1, ':one': 1, ':now': new Date().toISOString() },
      ReturnValues: 'UPDATED_NEW',
    }));
    return { ok: true, source: 'credit', creditBalance: Number(out.Attributes?.creditBalance) || 0 };
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return { ok: false, reason: 'out_of_credits' };
    throw err;
  }
}

async function runDeepSeek(userMessage) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || res.statusText;
    throw new Error(`llm ${res.status}: ${msg}`);
  }
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error('llm empty response');
  return text;
}

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };
}
function reply(statusCode, body, origin) {
  return { statusCode, headers: corsHeaders(origin), body: JSON.stringify(body) };
}

exports.handler = async (event = {}) => {
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;
  const origin = headers.origin;
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';
  if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(origin) };

  const claims = await verifyFirebaseToken(headers.authorization);
  const uid = claims ? (claims.user_id || claims.sub) : null;
  if (!uid) return reply(401, { error: 'sign_in_required' }, origin);

  const user = await getUser(uid);

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { /* tolerate */ }
  const userMessage = typeof body.user === 'string' ? body.user.slice(0, 24000) : '';
  if (!userMessage.trim()) return reply(400, { error: 'empty_request' }, origin);

  // Pay for the run: member monthly allowance first, then a purchased credit. No funds →
  // 402 Payment Required so the UI can prompt to subscribe or buy credits.
  const grant = await consume(uid, user);
  if (!grant.ok) {
    return reply(402, { error: 'out_of_credits', creditBalance: Number(user.creditBalance) || 0 }, origin);
  }

  try {
    const report = await runDeepSeek(userMessage);
    return reply(200, {
      report,
      source: grant.source,
      allowanceUsed: grant.allowanceUsed,
      allowanceLimit: grant.allowanceLimit,
      creditBalance: grant.creditBalance,
    }, origin);
  } catch (err) {
    console.error('analyze error', err.message);
    // The run failed after we already charged — refund a spent credit so the user isn't
    // billed for nothing. (The soft monthly allowance isn't worth a second write to restore.)
    if (grant.source === 'credit') {
      try {
        await ddb().send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { uid },
          UpdateExpression: 'ADD creditBalance :one SET analyzeUpdatedAt = :now',
          ExpressionAttributeValues: { ':one': 1, ':now': new Date().toISOString() },
        }));
      } catch (refundErr) { console.error('credit refund failed', refundErr.message); }
    }
    return reply(502, { error: 'analysis_failed' }, origin);
  }
};
