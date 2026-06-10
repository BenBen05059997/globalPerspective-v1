'use strict';

// newsRecommend — content-based recommendation engine (no ML).
//
// One job: rank the current topic pool for a user. Personalized when a valid Firebase
// JWT is supplied (interest profile derived from the user's saved items); otherwise
// returns a "Trending" ranking (popularity × recency). The scoring lives in scoring.js
// and is shared verbatim with the email digest sender — see
// RECOMMENDATIONS_AND_DIGEST_PLAN.md.
//
// Invocation: HTTP (Function URL or proxy passthrough) with optional
// `Authorization: Bearer <token>`; body `{ limit? }`. Also callable directly with
// `{ uid?, limit? }` for the digest cron.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { buildInterestProfile, isColdStart, rankRecommendations } = require('./scoring');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SAVED_ITEMS_TABLE = process.env.SAVED_ITEMS_TABLE;
const USER_PREFS_TABLE = process.env.USER_PREFS_TABLE;
const BREAKING_ALERTS_TABLE = process.env.BREAKING_ALERTS_TABLE || 'GlobalPerspectiveBreakingAlerts';
const SITE_URL = (process.env.SITE_URL || 'https://globalperspective.net').replace(/\/$/, '');
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 24;

let _ddb = null;
function ddb() {
  if (!_ddb) {
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _ddb;
}

// ── Firebase JWT verify (lightweight, mirrors newsSavedItems) ────────────────
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
    return verifier.verify(cert, parts[2], 'base64url') ? payload : null;
  } catch (err) {
    console.warn('verifyFirebaseToken failed', err.message);
    return null;
  }
}

// ── Data loaders ─────────────────────────────────────────────────────────────
async function loadTopics() {
  const out = await ddb().send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: 'latest' } }));
  const topics = out.Item?.topics;
  return Array.isArray(topics) ? topics : [];
}

async function loadSavedItems(uid) {
  const out = await ddb().send(new QueryCommand({
    TableName: SAVED_ITEMS_TABLE,
    KeyConditionExpression: 'uid = :u',
    ExpressionAttributeValues: { ':u': uid },
  }));
  return out.Items || [];
}

// Map threadId → { category, regions } from the current topic pool, so a saved thread
// contributes its tags to the interest profile.
function buildThreadTagIndex(topics) {
  const idx = {};
  for (const t of topics) {
    if (t.threadId && !idx[t.threadId]) idx[t.threadId] = { category: t.category, regions: t.regions || [] };
  }
  return idx;
}

// Best-effort cache of the freshly computed profile (the digest cron reads this instead
// of re-scanning every user's saves at send time). Never blocks the response.
async function cacheProfile(uid, email, profile) {
  if (!USER_PREFS_TABLE) return;
  try {
    await ddb().send(new UpdateCommand({
      TableName: USER_PREFS_TABLE,
      Key: { uid },
      UpdateExpression: 'SET interestProfile = :p, updatedAt = :now' + (email ? ', email = if_not_exists(email, :e)' : ''),
      ExpressionAttributeValues: {
        ':p': profile,
        ':now': new Date().toISOString(),
        ...(email ? { ':e': email } : {}),
      },
    }));
  } catch (err) {
    console.warn('cacheProfile failed (non-fatal)', err.message);
  }
}

function trim(topic, score, personalized) {
  return {
    topicId: topic.topicId || topic.id,
    threadId: topic.threadId || null,
    title: topic.title || '',
    category: topic.category || null,
    regions: topic.regions || [],
    sourceCount: Array.isArray(topic.sources) ? topic.sources.length : (topic.sourceCount || 0),
    score: Math.round(score * 1000) / 1000,
    personalized,
  };
}

// ── Core ─────────────────────────────────────────────────────────────────────
async function recommend({ uid, email, limit }) {
  const lim = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  const topics = await loadTopics();

  let profile = { categories: {}, countries: {}, threads: [] };
  if (uid) {
    const saved = await loadSavedItems(uid);
    profile = buildInterestProfile(saved, buildThreadTagIndex(topics));
    cacheProfile(uid, email, profile); // fire-and-forget
  }

  const ranked = rankRecommendations(topics, profile, { limit: lim });
  return {
    ok: true,
    personalized: !isColdStart(profile),
    count: ranked.length,
    items: ranked.map((r) => trim(r.topic, r.score, r.personalized)),
  };
}

// ── Notification preferences (per-user, JWT-gated) ─────────────────────────────
// Read/write the user's email-notification opt-ins on the same GlobalPerspectiveUserPrefs
// row that already caches their interestProfile. Defaults are OFF (opt-in, GDPR). The
// *Verified / unsubToken / consentAt fields are written here but only enforced once email
// delivery is live (the sender checks breakingOptIn && breakingVerified).
const DEFAULT_PREFS = Object.freeze({ breakingOptIn: false, digestOptIn: false, digestCadence: 'weekly' });

async function getPrefs(uid) {
  if (!USER_PREFS_TABLE) return { ...DEFAULT_PREFS };
  const out = await ddb().send(new GetCommand({ TableName: USER_PREFS_TABLE, Key: { uid } }));
  const it = out.Item || {};
  return {
    breakingOptIn: !!it.breakingOptIn,
    digestOptIn: !!it.digestOptIn,
    digestCadence: it.digestCadence === 'daily' ? 'daily' : 'weekly',
  };
}

async function setPrefs(uid, email, patch = {}) {
  if (!USER_PREFS_TABLE) throw new Error('USER_PREFS_TABLE not configured');
  const sets = ['updatedAt = :now'];
  const vals = { ':now': new Date().toISOString() };

  if (typeof patch.breakingOptIn === 'boolean') { sets.push('breakingOptIn = :b'); vals[':b'] = patch.breakingOptIn; }
  if (typeof patch.digestOptIn === 'boolean') { sets.push('digestOptIn = :d'); vals[':d'] = patch.digestOptIn; }
  if (patch.digestCadence === 'daily' || patch.digestCadence === 'weekly') { sets.push('digestCadence = :c'); vals[':c'] = patch.digestCadence; }
  if (email) { sets.push('email = if_not_exists(email, :e)'); vals[':e'] = email; }

  // First time the user turns anything on, stamp consent + mint a stable unsubscribe token.
  if (patch.breakingOptIn === true || patch.digestOptIn === true) {
    sets.push('consentAt = if_not_exists(consentAt, :now)');
    sets.push('unsubToken = if_not_exists(unsubToken, :tok)');
    vals[':tok'] = require('crypto').randomUUID();
  }

  await ddb().send(new UpdateCommand({
    TableName: USER_PREFS_TABLE,
    Key: { uid },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeValues: vals,
  }));
  return getPrefs(uid);
}

// ── In-app notification feed (the bell) ────────────────────────────────────────
// PUBLIC, no auth — the breaking-alert feed is a broadcast (the same global, already-
// public stories for everyone). Returns confirmed/sent alerts, newest first. Read-state
// (unread badge) is client-side (localStorage), so no per-user write is needed here.
// Returns [] honestly if the table is absent/empty (it stays empty until the breaking
// pipeline starts producing confirmed alerts).
async function listAlerts() {
  try {
    const out = await ddb().send(new ScanCommand({
      TableName: BREAKING_ALERTS_TABLE,
      FilterExpression: '#s = :confirmed OR #s = :sent',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':confirmed': 'confirmed', ':sent': 'sent' },
    }));
    return (out.Items || [])
      .map((it) => ({
        threadId: it.alertKey,
        title: it.title || 'Breaking story',
        url: `${SITE_URL}/weekly/thread/${it.alertKey}`,
        at: it.confirmedAt || it.alertedAt || it.cycle || null,
      }))
      .filter((a) => a.at)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 30);
  } catch (err) {
    // Missing table / access issue → honest empty feed, never an error in the UI.
    console.warn('listAlerts failed (returning empty):', err.message);
    return [];
  }
}

function httpReply(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async (event = {}) => {
  // Direct invoke (e.g. digest cron): { uid?, limit? }
  const isHttp = typeof event.body === 'string' || event.requestContext || event.headers;
  if (!isHttp) {
    return recommend({ uid: event.uid, email: event.email, limit: event.limit });
  }

  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { /* tolerate empty */ }

  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization;
  let uid = null;
  let email = null;
  if (authHeader) {
    const claims = await verifyFirebaseToken(authHeader);
    if (claims) { uid = claims.user_id || claims.sub; email = claims.email || null; }
  }

  const action = body.action || 'recommend';

  // Public in-app notification feed (the bell) — no auth.
  if (action === 'list_alerts') {
    return httpReply(200, { ok: true, alerts: await listAlerts() });
  }

  // Notification-preference actions require a signed-in user.
  if (action === 'get_prefs' || action === 'set_prefs') {
    if (!uid) return httpReply(401, { ok: false, error: 'sign_in_required' });
    try {
      const prefs = action === 'get_prefs'
        ? await getPrefs(uid)
        : await setPrefs(uid, email, body.payload || {});
      return httpReply(200, { ok: true, prefs });
    } catch (err) {
      console.error('prefs error', err);
      return httpReply(500, { ok: false, error: 'internal_error' });
    }
  }

  try {
    const result = await recommend({ uid, email, limit: body.limit });
    return httpReply(200, result);
  } catch (err) {
    console.error('recommend error', err);
    return httpReply(500, { ok: false, error: 'internal_error' });
  }
};
