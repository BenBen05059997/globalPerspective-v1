'use strict';

// newsSignals — the horizontal Signal API (see SIGNAL_API_PLAN.md).
//
// One Lambda, two modes:
//   • BUILD (direct invoke `{ action:'build' }`, or scheduled): reads the analysis records
//     we already produce (ECONOMIC_IMPACT, prediction log, COUNTRY_INTELLIGENCE, confirmed
//     breaking alerts), maps each into the stable v1 envelope via signalAdapter, and upserts
//     them into the dedicated GlobalPerspectiveSignals table. Idempotent — signal_id is a
//     deterministic dedupe key, so re-running overwrites in place.
//   • SERVE (HTTP, Function URL): API-key-gated read API —
//        GET  /v1/signals?since=&type=&country=&min_severity=&limit=
//        GET  /v1/signals/{signal_id}
//        GET  /v1/track-record
//     Free keys are rate-limited and (when configured) see signals on a delay; paid keys
//     get real-time + higher limits.
//
// Why a separate Lambda/table and not the public newsSensitiveData proxy: different auth
// (API keys, not public), different SLA posture, and a clean one-way-door contract. See
// [[feedback-clean-architecture]].

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const adapter = require('./signalAdapter');
const { extractKey, verifyKey } = require('./apiKeys');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const SUMMARIZE_PREDICT_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const PREDICTION_LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const BREAKING_ALERTS_TABLE = process.env.BREAKING_ALERTS_TABLE || 'GlobalPerspectiveBreakingAlerts';
const SIGNALS_TABLE = process.env.SIGNALS_TABLE || 'GlobalPerspectiveSignals';
const API_KEYS_TABLE = process.env.API_KEYS_TABLE || 'GlobalPerspectiveApiKeys';
const SITE_URL = (process.env.SITE_URL || 'https://globalperspective.net').replace(/\/$/, '');
const SIGNAL_TTL_DAYS = Number(process.env.SIGNAL_TTL_DAYS) || 120;
const FREE_DELAY_HOURS = Number(process.env.FREE_DELAY_HOURS) || 24; // free tier sees signals delayed
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

let _ddb = null;
function ddb() {
  if (!_ddb) {
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _ddb;
}

const nowIso = () => new Date().toISOString();

// ── BUILD MODE ───────────────────────────────────────────────────────────────────────

async function scanAll(params) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb().send(new ScanCommand({ ...params, ExclusiveStartKey }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// Recompute the public calibration summary (Brier + sample size) the same way the
// /track-record proxy does, so the figure stamped onto forecast signals matches the site.
function computeCalibration(predictionItems) {
  let brierSum = 0, scored = 0, fired = 0, pending = 0, totalTriggers = 0;
  for (const it of predictionItems) {
    for (const s of it.scenarios || []) {
      const p = typeof s.probability === 'number' ? s.probability : null;
      for (const t of s.triggers || []) {
        if (!t.deadline) continue;
        totalTriggers++;
        const v = t.finalVerdict;
        if (v !== 'fired' && v !== 'not_fired') { if (!v) pending++; continue; }
        const outcome = v === 'fired' ? 1 : 0;
        if (v === 'fired') fired++;
        if (p != null) { brierSum += (p - outcome) ** 2; scored++; }
      }
    }
  }
  return {
    model_brier_score: scored ? Math.round((brierSum / scored) * 1000) / 1000 : null,
    sample_size: scored,
    fired_triggers: fired,
    pending_triggers: pending,
    total_dated_triggers: totalTriggers,
  };
}

async function upsertSignal(env) {
  const ttl = Math.floor(Date.now() / 1000) + SIGNAL_TTL_DAYS * 86400;
  // Top-level projections so the read path filters/sorts without unpacking every item.
  // Recency is keyed on `event_time` (when the event actually happened), NOT emitted_at:
  // a daily rebuild restamps emitted_at on everything, so it can't order or delay-gate.
  // `first_emitted_at` is preserved across rebuilds (first time we ever published it).
  await ddb().send(new PutCommand({
    TableName: SIGNALS_TABLE,
    Item: {
      signal_id: env.signal_id,
      type: env.type,
      emitted_at: env.emitted_at,
      event_time: env.event_time,
      event_day: (env.event_time || '').slice(0, 10),
      severity: env.severity,
      country_isos: env.entities.countries.map((c) => c.iso).filter(Boolean),
      country_names: env.entities.countries.map((c) => c.name),
      envelope: env,
      ttl,
    },
  }));
}

async function build() {
  const emittedAt = nowIso();
  const summary = { economic_impact: 0, forecast: 0, geopolitical_risk: 0, breaking: 0, skipped: 0 };

  // 1. Economic impact (real records only, tombstones skipped by the adapter)
  const econ = await scanAll({
    TableName: SUMMARIZE_PREDICT_TABLE,
    FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND hasImpact = :hi',
    ExpressionAttributeValues: { ':prefix': 'ECON#THREAD#', ':sk': 'ECONOMIC_IMPACT', ':hi': true },
  });
  for (const rec of econ) {
    const env = adapter.fromEconomicImpact(rec, { emittedAt });
    if (env) { await upsertSignal(env); summary.economic_impact++; } else summary.skipped++;
  }

  // 2. Forecasts — newest snapshot per prediction, with the global calibration stamp.
  const predItems = await scanAll({ TableName: PREDICTION_LOG_TABLE });
  const calibration = computeCalibration(predItems);
  const latestByTopic = new Map();
  for (const it of predItems) {
    const prev = latestByTopic.get(it.topicId);
    if (!prev || String(it.SK || '') > String(prev.SK || '')) latestByTopic.set(it.topicId, it);
  }
  for (const it of latestByTopic.values()) {
    const env = adapter.fromPredictionLog(it, {
      emittedAt, calibration, trackRecordUrl: `${SITE_URL}/track-record`,
    });
    if (env) { await upsertSignal(env); summary.forecast++; } else summary.skipped++;
  }

  // 3. Country intelligence (current standing record per country)
  const countries = await scanAll({
    TableName: SUMMARIZE_PREDICT_TABLE,
    FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk',
    ExpressionAttributeValues: { ':prefix': 'COUNTRY#', ':sk': 'COUNTRY_INTELLIGENCE' },
  });
  for (const rec of countries) {
    const env = adapter.fromCountryIntelligence(rec, { emittedAt });
    if (env) { await upsertSignal(env); summary.geopolitical_risk++; } else summary.skipped++;
  }

  // 4. Confirmed/sent breaking alerts
  let breaking = [];
  try {
    breaking = await scanAll({
      TableName: BREAKING_ALERTS_TABLE,
      FilterExpression: '#s = :c OR #s = :sent',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':c': 'confirmed', ':sent': 'sent' },
    });
  } catch (err) { console.warn('breaking scan skipped:', err.message); }
  for (const rec of breaking) {
    const env = adapter.fromBreakingAlert(rec, { emittedAt });
    if (env) { await upsertSignal(env); summary.breaking++; } else summary.skipped++;
  }

  console.info('signals build complete', summary, { calibration });
  return { ok: true, builtAt: emittedAt, summary, calibration };
}

// ── SERVE MODE ───────────────────────────────────────────────────────────────────────

function reply(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  };
}

async function getApiKeyRecord(keyHash) {
  const out = await ddb().send(new GetCommand({ TableName: API_KEYS_TABLE, Key: { keyHash } }));
  return out.Item || null;
}

// Best-effort fixed-window rate limit: one atomic counter per key per UTC minute, TTL'd.
// Fails open (never blocks a paying customer because the limiter itself errored).
async function rateLimit(keyHash, perMin) {
  const minute = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const pk = `RL#${keyHash}#${minute}`;
  try {
    const out = await ddb().send(new UpdateCommand({
      TableName: API_KEYS_TABLE,
      Key: { keyHash: pk },
      UpdateExpression: 'ADD #c :one SET #ttl = :ttl',
      ExpressionAttributeNames: { '#c': 'count', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':one': 1, ':ttl': Math.floor(Date.now() / 1000) + 120 },
      ReturnValues: 'UPDATED_NEW',
    }));
    const count = out.Attributes?.count || 1;
    return { allowed: count <= perMin, count, limit: perMin };
  } catch (err) {
    console.warn('rateLimit failed (fail-open):', err.message);
    return { allowed: true, count: 0, limit: perMin };
  }
}

// Filter helper shared by list. A free key only sees signals older than FREE_DELAY_HOURS.
function passesFilters(item, { type, country, minSeverity, before }) {
  if (type && item.type !== type) return false;
  if (minSeverity != null && !(Number(item.severity) >= minSeverity)) return false;
  if (before && (item.event_time || '') > before) return false;
  if (country) {
    const c = country.toUpperCase();
    const isos = (item.country_isos || []).map((x) => String(x).toUpperCase());
    const names = (item.country_names || []).map((x) => String(x).toUpperCase());
    if (!isos.includes(c) && !names.includes(country.toUpperCase())) return false;
  }
  return true;
}

async function serveList(qs, keyCtx) {
  const type = qs.type || null;
  const country = qs.country || null;
  const minSeverity = qs.min_severity != null ? Number(qs.min_severity) : null;
  const since = qs.since || null;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(qs.limit) || DEFAULT_LIMIT));
  const before = keyCtx.tier === 'free'
    ? new Date(Date.now() - FREE_DELAY_HOURS * 3600 * 1000).toISOString()
    : null;

  // v1: scan + in-Lambda filter/sort. A GSI on (type, emitted_at) is the next step once
  // volume warrants it (SIGNAL_API_PLAN.md §7) — kept simple + correct for the thin slice.
  const items = await scanAll({ TableName: SIGNALS_TABLE });
  const filtered = items
    .filter((it) => (since ? (it.event_time || '') >= since : true))
    .filter((it) => passesFilters(it, { type, country, minSeverity, before }))
    .sort((a, b) => String(b.event_time || '').localeCompare(String(a.event_time || '')))
    .slice(0, limit)
    .map((it) => it.envelope);

  return reply(200, {
    ok: true,
    count: filtered.length,
    tier: keyCtx.tier,
    delayed_hours: keyCtx.tier === 'free' ? FREE_DELAY_HOURS : 0,
    signals: filtered,
  });
}

async function serveGet(signalId, keyCtx) {
  const out = await ddb().send(new GetCommand({ TableName: SIGNALS_TABLE, Key: { signal_id: signalId } }));
  if (!out.Item) return reply(404, { ok: false, error: 'not_found' });
  if (keyCtx.tier === 'free') {
    const cutoff = new Date(Date.now() - FREE_DELAY_HOURS * 3600 * 1000).toISOString();
    if ((out.Item.event_time || '') > cutoff) {
      return reply(402, { ok: false, error: 'upgrade_required', reason: 'recent signals require a paid key' });
    }
  }
  return reply(200, { ok: true, signal: out.Item.envelope });
}

async function serveTrackRecord() {
  const predItems = await scanAll({ TableName: PREDICTION_LOG_TABLE });
  const cal = computeCalibration(predItems);
  return reply(200, { ok: true, track_record: { ...cal, track_record_url: `${SITE_URL}/track-record` } });
}

// Map an HTTP event (Function URL / API Gateway) to { method, path, qs, headers }.
function parseHttp(event) {
  const headers = event.headers || {};
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const rawPath = event.requestContext?.http?.path || event.rawPath || event.path || '/';
  const qs = event.queryStringParameters || {};
  return { method, path: rawPath, qs, headers };
}

async function serve(event) {
  const { method, path, qs, headers } = parseHttp(event);
  if (method !== 'GET') return reply(405, { ok: false, error: 'method_not_allowed' });

  const rawKey = extractKey(headers);
  const keyCtx = await verifyKey(rawKey, getApiKeyRecord);
  if (!keyCtx) return reply(401, { ok: false, error: 'invalid_api_key' });

  const rl = await rateLimit(keyCtx.keyHash, keyCtx.rateLimitPerMin);
  const rlHeaders = { 'X-RateLimit-Limit': String(rl.limit), 'X-RateLimit-Remaining': String(Math.max(0, rl.limit - rl.count)) };
  if (!rl.allowed) return reply(429, { ok: false, error: 'rate_limited' }, rlHeaders);

  // Route on the path tail so it works under Function URL or any API Gateway stage prefix.
  const norm = path.replace(/\/+$/, '');
  const m = norm.match(/\/v1\/signals\/([^/]+)$/);
  try {
    if (m) return withHeaders(await serveGet(decodeURIComponent(m[1]), keyCtx), rlHeaders);
    if (/\/v1\/signals$/.test(norm)) return withHeaders(await serveList(qs, keyCtx), rlHeaders);
    if (/\/v1\/track-record$/.test(norm)) return withHeaders(await serveTrackRecord(), rlHeaders);
    return reply(404, { ok: false, error: 'unknown_route' }, rlHeaders);
  } catch (err) {
    console.error('serve error', err);
    return reply(500, { ok: false, error: 'internal_error' }, rlHeaders);
  }
}

function withHeaders(res, extra) {
  return { ...res, headers: { ...res.headers, ...extra } };
}

// ── Entry ──────────────────────────────────────────────────────────────────────────
exports.handler = async (event = {}) => {
  // Direct invoke for the build cron: { action: 'build' }
  const isHttp = typeof event.body === 'string' || event.requestContext || event.rawPath || event.httpMethod;
  if (!isHttp && event.action === 'build') return build();
  if (!isHttp) return reply(400, { ok: false, error: 'unknown_invoke', hint: "use { action: 'build' } or HTTP GET /v1/*" });
  return serve(event);
};

// exported for tests / operator scripts
module.exports._build = build;
module.exports._computeCalibration = computeCalibration;
