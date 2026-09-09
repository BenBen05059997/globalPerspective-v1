'use strict';

// newsSignals — the horizontal Signal API (see SIGNAL_API_PLAN.md).
//
// One Lambda, two modes:
//   • BUILD (direct invoke `{ action:'build' }`, or scheduled): reads the analysis records
//     we already produce (ECONOMIC_IMPACT, prediction log, COUNTRY_INTELLIGENCE, confirmed
//     breaking alerts), maps each into the stable v1 envelope via signalAdapter, and writes
//     them as a single `signals/latest.json` document in S3 (+ a dated `signals/snapshots/`
//     copy). Idempotent — signal_id is a deterministic dedupe key, so re-running overwrites.
//     (S8·T1, 2026-09-09: migrated off the GlobalPerspectiveSignals DDB table — the table was
//     write-only, ~5.8k PutItems/day with zero reads; DATA_STRATEGY.md "S3 for the world".)
//   • SERVE (HTTP, Function URL): API-key-gated read API —
//        GET  /v1/signals?since=&type=&country=&min_severity=&limit=
//        GET  /v1/signals/{signal_id}
//        GET  /v1/track-record
//     Free keys are rate-limited and (when configured) see signals on a delay; paid keys
//     get real-time + higher limits. The list/get paths read `signals/latest.json` (cached in
//     module scope by ETag); track-record still scans the prediction log (until S8·T3).
//     signals/ is deliberately NOT exposed via the Cloudflare Worker /data/* route — this is
//     the paid, key-gated product and stays behind the Function URL only.
//
// Why a separate Lambda/store and not the public newsSensitiveData proxy: different auth
// (API keys, not public), different SLA posture, and a clean one-way-door contract. See
// [[feedback-clean-architecture]].

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const adapter = require('./signalAdapter');
const store = require('./signalStore');
const { extractKey, verifyKey } = require('./apiKeys');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const SUMMARIZE_PREDICT_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const PREDICTION_LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const BREAKING_ALERTS_TABLE = process.env.BREAKING_ALERTS_TABLE || 'GlobalPerspectiveBreakingAlerts';
const API_KEYS_TABLE = process.env.API_KEYS_TABLE || 'GlobalPerspectiveApiKeys';
const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const SIGNALS_PREFIX = (process.env.SIGNALS_PREFIX || 'signals').replace(/\/$/, '');
const LATEST_KEY = `${SIGNALS_PREFIX}/latest.json`;
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

let _s3 = null;
function s3() {
  if (!_s3) _s3 = new S3Client({ region: REGION });
  return _s3;
}

async function s3GetJson(key) {
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: WORLD_BUCKET, Key: key }));
    return { doc: JSON.parse(await r.Body.transformToString()), etag: r.ETag };
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return { doc: null, etag: null };
    throw err;
  }
}

async function s3PutJson(key, obj) {
  await s3().send(new PutObjectCommand({
    Bucket: WORLD_BUCKET, Key: key, Body: JSON.stringify(obj), ContentType: 'application/json',
  }));
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

async function build() {
  const emittedAt = nowIso();
  const nowMs = Date.parse(emittedAt);
  const summary = { economic_impact: 0, forecast: 0, geopolitical_risk: 0, breaking: 0, skipped: 0, dropped_stale: 0 };

  // Carry first_emitted_at (the first build that ever published a signal_id) across rebuilds.
  const prev = (await s3GetJson(LATEST_KEY)).doc;
  const firstSeen = new Map();
  if (prev && Array.isArray(prev.signals)) {
    for (const s of prev.signals) firstSeen.set(s.signal_id, s.first_emitted_at || s.emitted_at);
  }

  const projections = [];
  const collect = (env, bucket) => {
    if (!env) { summary.skipped++; return; }
    if (!store.withinRetention(env, nowMs, SIGNAL_TTL_DAYS)) { summary.dropped_stale++; return; }
    projections.push(store.toProjection(env, firstSeen.get(env.signal_id)));
    summary[bucket]++;
  };

  // 1. Economic impact (real records only, tombstones skipped by the adapter)
  const econ = await scanAll({
    TableName: SUMMARIZE_PREDICT_TABLE,
    FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND hasImpact = :hi',
    ExpressionAttributeValues: { ':prefix': 'ECON#THREAD#', ':sk': 'ECONOMIC_IMPACT', ':hi': true },
  });
  for (const rec of econ) collect(adapter.fromEconomicImpact(rec, { emittedAt }), 'economic_impact');

  // 2. Forecasts — newest snapshot per prediction, with the global calibration stamp.
  const predItems = await scanAll({ TableName: PREDICTION_LOG_TABLE });
  const calibration = computeCalibration(predItems);
  const latestByTopic = new Map();
  for (const it of predItems) {
    const p = latestByTopic.get(it.topicId);
    if (!p || String(it.SK || '') > String(p.SK || '')) latestByTopic.set(it.topicId, it);
  }
  for (const it of latestByTopic.values()) {
    collect(adapter.fromPredictionLog(it, { emittedAt, calibration, trackRecordUrl: `${SITE_URL}/track-record` }), 'forecast');
  }

  // 3. Country intelligence (current standing record per country)
  const countries = await scanAll({
    TableName: SUMMARIZE_PREDICT_TABLE,
    FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk',
    ExpressionAttributeValues: { ':prefix': 'COUNTRY#', ':sk': 'COUNTRY_INTELLIGENCE' },
  });
  for (const rec of countries) collect(adapter.fromCountryIntelligence(rec, { emittedAt }), 'geopolitical_risk');

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
  for (const rec of breaking) collect(adapter.fromBreakingAlert(rec, { emittedAt }), 'breaking');

  // One document for the world, plus an immutable dated snapshot (versioned history).
  const doc = store.buildLatestDoc(projections, emittedAt);
  await s3PutJson(LATEST_KEY, doc);
  await s3PutJson(`${SIGNALS_PREFIX}/snapshots/${emittedAt.slice(0, 10)}.json`, doc);

  console.info('signals build complete', summary, { calibration, count: doc.count });
  return { ok: true, builtAt: emittedAt, summary, calibration, count: doc.count };
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

// Load signals/latest.json, cached in module scope. Warm invokes send If-None-Match and take
// the 304 short-circuit, so a burst of reads costs one small GET per new build, not per request.
let _cache = { etag: null, signals: null };
async function loadSignals() {
  try {
    const r = await s3().send(new GetObjectCommand({
      Bucket: WORLD_BUCKET,
      Key: LATEST_KEY,
      ...(_cache.etag ? { IfNoneMatch: _cache.etag } : {}),
    }));
    const doc = JSON.parse(await r.Body.transformToString());
    _cache = { etag: r.ETag, signals: Array.isArray(doc.signals) ? doc.signals : [] };
    return _cache.signals;
  } catch (err) {
    if ((err.name === 'NotModified' || err.$metadata?.httpStatusCode === 304) && _cache.signals) return _cache.signals;
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) { _cache = { etag: null, signals: [] }; return []; }
    throw err;
  }
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

  const items = await loadSignals();
  const filtered = store
    .filterList(items, { since, type, country, minSeverity, before, limit })
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
  const items = await loadSignals();
  const item = items.find((it) => it.signal_id === signalId);
  if (!item) return reply(404, { ok: false, error: 'not_found' });
  if (keyCtx.tier === 'free') {
    const cutoff = new Date(Date.now() - FREE_DELAY_HOURS * 3600 * 1000).toISOString();
    if ((item.event_time || '') > cutoff) {
      return reply(402, { ok: false, error: 'upgrade_required', reason: 'recent signals require a paid key' });
    }
  }
  return reply(200, { ok: true, signal: item.envelope });
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
