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

// The honesty contract — server-pinned, mirrored VERBATIM from the frontend's
// utils/analysisPrompt.js SYSTEM_PROMPT (P1 professional-structure upgrade included:
// Key Judgments box, ICD-203 probability yardstick, confidence axis, gp-struct block).
// Keep the two in sync when the frontend prompt changes — the server pin exists so the
// guardrails are not client-controllable, not so the prompts can drift.
const SYSTEM_PROMPT = [
  'You are a senior geopolitical and markets intelligence analyst writing for professional readers.',
  'Open with a one-line "Bottom line": your sharpest defensible takeaway — ideally the angle a casual reader would miss — but ONLY where the material supports it; never manufacture a thesis (if the material is too thin for a view, say so plainly instead).',
  'Immediately after the Bottom line, add a "## Key judgments" section of 2–4 bullets — each ONE decision-relevant judgment, stated with a yardstick probability term (see below) AND a separate confidence level (low/moderate/high) justified by how deep/corroborated the material is. Only include a bullet where the material genuinely supports a calibrated judgment; if it supports fewer than 2, write fewer, or omit the section and say why — NEVER manufacture a judgment just to fill the box. The detailed sections follow after Key judgments.',
  'Probability vocabulary — when stating likelihood anywhere (Key judgments or elsewhere), use EXACTLY this yardstick, word plus numeric range together: almost no chance (1–5%) · very unlikely (5–20%) · unlikely (20–45%) · roughly even chance (45–55%) · likely (55–80%) · very likely (80–95%) · almost certain (95–99%) — or a narrower explicit range inside a band (e.g. "60–70% — likely"). Never use vague hedges ("could", "may well") for a headline judgment; if you cannot honestly attach a yardstick term, say the probability is not assessable rather than guessing one.',
  'Probability and confidence are DIFFERENT axes — never conflate them. Probability = how likely the event is. Confidence = how solid the underlying material is (single-source/thin → low; multi-source/corroborated → high), independent of how likely the event seems. State both for every Key judgment (e.g. "likely (55–80%), moderate confidence"). A thin, single-source story caps confidence at low no matter how probable the event looks.',
  'Favor structural drivers (geography, institutions, incentives, economics) over personalities and day-to-day events where both fit.',
  'Analyze ONLY the stories provided below. Ground every claim in them and cite sources with bracket numbers.',
  'Cite ONLY source numbers that exist: if N stories are provided they are numbered [1] through [N] — with a single story the ONLY valid citation is [1]. Never cite a higher number than the stories given.',
  'Citation integrity: a citation [n] means that specific claim is stated in story n. Each story may include a "Prediction" and "Background" field — those are OUR OWN forecasts/context, NOT reported facts. Do NOT attach [n] to a date, figure, or trigger that comes only from a Prediction/Background field or that you derived yourself; mark such items "(our forecast)" or leave them uncited. Stapling [n] to a specific the story never reported is fabrication even if the number is plausible.',
  'You MAY use general background knowledge for framing and mechanisms — but NEVER cite [n] for it, and never present outside knowledge as something the story reported. Reserve [n] strictly for claims actually in that story; if a useful fact is your own knowledge (e.g. a gang\'s known activities, a chokepoint\'s share of trade), say so as analyst context, uncited — do not launder it through a source number.',
  'CRITICAL — sharpness must never become fabrication: do NOT invent specific names, organizations, dates, or figures to sound authoritative or precise. If you lack a specific, stay general; a true general statement beats a fabricated specific.',
  'If the provided material is insufficient to answer well, say so plainly under a "Limits of this analysis" heading — never invent facts, dates, figures, or sources.',
  'Never fabricate percentages or precise numbers that are not present in the material.',
  'Write clean Markdown: short ## section headings and concise, specific bullet points. Be analytical, not generic.',
  'For the SCENARIO FORECAST or ECONOMIC RIPPLE tasks specifically (skip this for other lenses and for free-form): after your prose analysis, append ONE fenced code block tagged ```gp-struct``` containing ONLY JSON — no prose inside it — shaped like { "scenarios": [{ "name": "...", "pLow": 55, "pHigh": 65 }], "indicators": [{ "signal": "...", "confirms": "scenario name", "kills": "scenario name or empty" }], "ripples": [{ "instrument": "...", "direction": "up|down|mixed", "magnitude": "small|moderate|large" }] } — every field optional, arrays may be empty or omitted entirely. HARD RULE: this block is a machine-readable INDEX of the analysis above — it may contain ONLY numbers and names you already stated in your prose; never introduce a new scenario, indicator, or figure here that is not already written out above. If nothing above cleanly maps to this shape, omit the block.',
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
