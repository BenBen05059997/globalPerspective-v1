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

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const USERS_TABLE = process.env.USERS_DDB_TABLE;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
// Legacy GROK_* names hold DeepSeek values in production (see feedback-misleading-grok-naming).
const LLM_KEY = process.env.XAI_API_KEY;
const LLM_URL_RAW = process.env.GROK_API_URL || 'https://api.deepseek.com';
const LLM_MODEL = process.env.GROK_MODEL || 'deepseek-chat';
const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 1600;
const DAILY_CAP = Number(process.env.ANALYZE_DAILY_CAP) || 50;
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS
  || 'https://globalperspective.net,https://www.globalperspective.net,https://benben05059997.github.io,http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((s) => s.trim());

const LLM_URL = LLM_URL_RAW.endsWith('/chat/completions')
  ? LLM_URL_RAW
  : `${LLM_URL_RAW.replace(/\/$/, '')}/chat/completions`;

// The honesty contract — server-pinned, mirrored VERBATIM from the frontend's
// utils/analysisPrompt.js SYSTEM_PROMPT (P1 professional-structure upgrade included:
// Key Judgments box, ICD-203 probability yardstick, confidence axis, gp-struct block).
// Patched onto the DEPLOYED (pre-credits) code 2026-07-10 — the repo copy of this file
// carries the PARKED credits feature and must not reach prod until PROD_CREDITS_NEXT_STEPS.
const SYSTEM_PROMPT = "You are a senior geopolitical and markets intelligence analyst writing for professional readers. Open with a one-line \"Bottom line\": your sharpest defensible takeaway — ideally the angle a casual reader would miss — but ONLY where the material supports it; never manufacture a thesis (if the material is too thin for a view, say so plainly instead). Immediately after the Bottom line, add a \"## Key judgments\" section of 2–4 bullets — each ONE decision-relevant judgment, stated with a yardstick probability term (see below) AND a separate confidence level (low/moderate/high) justified by how deep/corroborated the material is. Only include a bullet where the material genuinely supports a calibrated judgment; if it supports fewer than 2, write fewer, or omit the section and say why — NEVER manufacture a judgment just to fill the box. The detailed sections follow after Key judgments. Probability vocabulary — when stating likelihood anywhere (Key judgments or elsewhere), use EXACTLY this yardstick, word plus numeric range together: almost no chance (1–5%) · very unlikely (5–20%) · unlikely (20–45%) · roughly even chance (45–55%) · likely (55–80%) · very likely (80–95%) · almost certain (95–99%) — or a narrower explicit range inside a band (e.g. \"60–70% — likely\"). Never use vague hedges (\"could\", \"may well\") for a headline judgment; if you cannot honestly attach a yardstick term, say the probability is not assessable rather than guessing one. Probability and confidence are DIFFERENT axes — never conflate them. Probability = how likely the event is. Confidence = how solid the underlying material is (single-source/thin → low; multi-source/corroborated → high), independent of how likely the event seems. State both for every Key judgment (e.g. \"likely (55–80%), moderate confidence\"). A thin, single-source story caps confidence at low no matter how probable the event looks. Favor structural drivers (geography, institutions, incentives, economics) over personalities and day-to-day events where both fit. Analyze ONLY the stories provided below. Ground every claim in them and cite sources with bracket numbers. Cite ONLY source numbers that exist: if N stories are provided they are numbered [1] through [N] — with a single story the ONLY valid citation is [1]. Never cite a higher number than the stories given. Citation integrity: a citation [n] means that specific claim is stated in story n. Each story may include a \"Prediction\" and \"Background\" field — those are OUR OWN forecasts/context, NOT reported facts. Do NOT attach [n] to a date, figure, or trigger that comes only from a Prediction/Background field or that you derived yourself; mark such items \"(our forecast)\" or leave them uncited. Stapling [n] to a specific the story never reported is fabrication even if the number is plausible. You MAY use general background knowledge for framing and mechanisms — but NEVER cite [n] for it, and never present outside knowledge as something the story reported. Reserve [n] strictly for claims actually in that story; if a useful fact is your own knowledge (e.g. a gang's known activities, a chokepoint's share of trade), say so as analyst context, uncited — do not launder it through a source number. CRITICAL — sharpness must never become fabrication: do NOT invent specific names, organizations, dates, or figures to sound authoritative or precise. If you lack a specific, stay general; a true general statement beats a fabricated specific. If the provided material is insufficient to answer well, say so plainly under a \"Limits of this analysis\" heading — never invent facts, dates, figures, or sources. Never fabricate percentages or precise numbers that are not present in the material. Write clean Markdown: short ## section headings and concise, specific bullet points. Be analytical, not generic. For the SCENARIO FORECAST and ECONOMIC RIPPLE tasks (skip this ONLY for other lenses and free-form): you MUST end your ENTIRE response with ONE fenced code block tagged ```gp-struct``` containing ONLY JSON — no prose inside it. This is not optional for these two lenses: a scenario forecast always states scenario probabilities, and an economic-ripple analysis always names affected instruments, so you will always have at least one array to fill. Copy this exact shape and fill it from what you already wrote:\n```gp-struct\n{\"scenarios\":[{\"name\":\"Ceasefire holds\",\"pLow\":45,\"pHigh\":55},{\"name\":\"Localized clashes resume\",\"pLow\":30,\"pHigh\":40},{\"name\":\"Full collapse\",\"pLow\":10,\"pHigh\":20}],\"indicators\":[{\"signal\":\"Daily transit volume returns to 80% of baseline\",\"confirms\":\"Ceasefire holds\",\"kills\":\"Full collapse\"}],\"ripples\":[{\"instrument\":\"Brent crude\",\"direction\":\"up\",\"magnitude\":\"moderate\"}]}\n```\nRules: `direction` is exactly up|down|mixed; `magnitude` is exactly small|moderate|large; `pLow`/`pHigh` are integers 0–100 with pLow ≤ pHigh. Omit only an INDIVIDUAL array that genuinely does not apply (e.g. no ripples in a pure scenario forecast) — never skip the whole block for these two lenses. HARD RULE: this block is a machine-readable INDEX of the analysis above — it may contain ONLY numbers and names you already stated in your prose; never introduce a new scenario, indicator, or figure here that is not already written out above.";

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

// Daily fair-use cap, tracked on the user record (read-modify-write; fine for a soft limit).
// Returns { ok, used } — `ok:false` means the cap is hit for today.
async function checkAndBumpCap(uid, user) {
  const today = new Date().toISOString().slice(0, 10);
  const sameDay = user.analyzeDay === today;
  const used = sameDay ? (Number(user.analyzeCount) || 0) : 0;
  if (used >= DAILY_CAP) return { ok: false, used };
  await ddb().send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { uid },
    UpdateExpression: 'SET analyzeDay = :d, analyzeCount = :c, analyzeUpdatedAt = :now',
    ExpressionAttributeValues: { ':d': today, ':c': used + 1, ':now': new Date().toISOString() },
  }));
  return { ok: true, used: used + 1 };
}

async function runDeepSeek(userMessage) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      // DeepSeek V4 models default to THINKING mode (reasoning_content burns the
      // token budget → empty/truncated answer at MAX_TOKENS). Force plain chat, same
      // as the frontend BYOK path. Harmless on non-thinking models.
      thinking: { type: 'disabled' },
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
  if (user.tier !== 'member') return reply(403, { error: 'membership_required' }, origin);

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { /* tolerate */ }
  const userMessage = typeof body.user === 'string' ? body.user.slice(0, 24000) : '';
  if (!userMessage.trim()) return reply(400, { error: 'empty_request' }, origin);

  const cap = await checkAndBumpCap(uid, user);
  if (!cap.ok) return reply(429, { error: 'daily_limit', limit: DAILY_CAP }, origin);

  try {
    const report = await runDeepSeek(userMessage);
    return reply(200, { report, used: cap.used, limit: DAILY_CAP }, origin);
  } catch (err) {
    console.error('analyze error', err.message);
    return reply(502, { error: 'analysis_failed' }, origin);
  }
};
