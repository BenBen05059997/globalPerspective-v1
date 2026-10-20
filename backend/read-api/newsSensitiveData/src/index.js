'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand, QueryCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { countryKeys, briefWithIso3, weeklyWithIso3, webWithIso3, triggerVerdict, isoWeekOfDay, questionSampleState, questionOutcomeState, latestVerdictRow, capForTier, dedupeByAsOf, latestDayLabel, dedupeTopicDate, lightEntry, unionByTopicId, pickLatestBrief, briefKeys, shapeCountryFacts } = require('./lib');
const { iso3List } = require('./_shared/resolveIso3');
const { storyHref, absoluteUrl } = require('./_shared/links');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';

// S8·T3: the /track-record aggregate is precomputed to S3 by newsPredictionsSnapshot every 30 min,
// so this proxy serves a cached object instead of Scanning ~5.5k PredictionLog items per page load.
const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const TRACK_RECORD_KEY = process.env.TRACK_RECORD_KEY || 'predictions/track_record.json';
let _s3;
async function getTrackRecordCache() {
  if (!_s3) _s3 = new S3Client({ region: REGION });
  const r = await _s3.send(new GetObjectCommand({ Bucket: WORLD_BUCKET, Key: TRACK_RECORD_KEY }));
  const doc = JSON.parse(await r.Body.transformToString());
  return doc && doc.data ? doc.data : null;
}

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const TOPICS_ITEM_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';
const TOPICS_MAX_AGE_SECONDS = Number(process.env.TOPICS_CACHE_MAX_AGE_SECONDS || '9000');

const SUMMARIZE_PREDICT_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const PREDICTION_LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const PK_PREFIX = process.env.SUMMARY_PREDICT_PK_PREFIX || 'TOPIC#';
const SUMMARY_SK = process.env.SUMMARY_SORT_KEY || 'SUMMARY';
const PREDICTION_SK = process.env.PREDICTION_SORT_KEY || 'PREDICTION';

const ENTERPRISE_MAX_DAYS = 90;

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

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
  } catch {
    return null;
  }
}

let dynamoDocClient = null;

const getDynamoClient = () => {
  if (!dynamoDocClient) {
    const ddb = new DynamoDBClient({ region: REGION });
    dynamoDocClient = DynamoDBDocumentClient.from(ddb, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return dynamoDocClient;
};

// Membership tier for the *self-correction depth* gate (MEMBER_GATING_PLAN.md). The users
// table (written by newsPolarBilling on payment) holds tier='member'|'free'. This Lambda's
// role already has DynamoDBFullAccess, so no IAM change — only USERS_DDB_TABLE.
const USERS_DDB_TABLE = process.env.USERS_DDB_TABLE || 'GlobalPerspectiveUserTable';

// Best-effort tier from the request's Firebase JWT → 'member' | 'free'. NEVER throws and
// NEVER blocks: no/invalid token or any DDB hiccup ⇒ 'free', so anonymous/free callers always
// still get a 200 with capped (not withheld) data. This is a depth cap, not an auth gate —
// deliberately avoids the 2026-04-22 anon-guard regression (feedback_auth_guard_hooks).
async function resolveTier(event) {
  try {
    const authHeader = event?.headers?.authorization || event?.headers?.Authorization;
    if (!authHeader) return 'free';
    const claims = await verifyFirebaseToken(authHeader);
    const uid = claims && (claims.user_id || claims.sub);
    if (!uid) return 'free';
    const { Item } = await getDynamoClient().send(new GetCommand({
      TableName: USERS_DDB_TABLE,
      Key: { uid },
      ProjectionExpression: 'tier',
    }));
    return Item?.tier === 'member' ? 'member' : 'free';
  } catch (err) {
    console.warn('resolveTier failed (defaulting free):', err.message);
    return 'free';
  }
}

const allowedOrigins = [
  'https://benben05059997.github.io',
  'https://benben05059997.github.io/GlobalPerspective',
  'https://globalperspective.net',
  'https://www.globalperspective.net',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];
const allowedOriginsLower = allowedOrigins.map((o) => o.toLowerCase());

exports.handler = async (event) => {
  const originHeader = event.headers?.origin || '';
  const originLower = typeof originHeader === 'string' ? originHeader.toLowerCase() : '';
  const matchedIndex = allowedOriginsLower.indexOf(originLower);
  const corsOrigin = matchedIndex >= 0 ? originHeader : allowedOrigins[0];

  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-api-key',
      },
      body: '',
    };
  }

  // Support GET query params (for RSS readers) and POST body
  const qs = event.queryStringParameters || {};
  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
  const action = qs.action || body?.action;
  const payload = body?.payload || {};

  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Content-Type': 'application/json',
  };

  console.info('newsSensitiveData received event', {
    action,
    payloadKeys: payload ? Object.keys(payload) : [],
    origin: corsOrigin,
    requestId: event.requestContext?.requestId || event.requestContext?.awsRequestId,
    httpMethod: event.requestContext?.http?.method || event.httpMethod || 'POST',
  });

  try {
    if (action === 'topics') {
      const response = await readTopicsCache();
      console.info('newsSensitiveData topics response', {
        statusCode: response.statusCode,
        success: response.body?.success,
        cached: response.body?.cached,
        error: response.body?.error,
      });
      return {
        statusCode: response.statusCode,
        headers,
        body: JSON.stringify(response.body),
      };
    }

    if (action === 'summary' || action === 'prediction' || action === 'trace_cause') {
      const topicId = payload?.topicId || payload?.topic_id;
      if (!topicId || typeof topicId !== 'string') {
        console.warn('newsSensitiveData summary/prediction missing topicId', {
          action,
          payloadSample: payload,
        });
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing topicId' }),
        };
      }

      const response = await readSummaryPredictionCache(action, topicId);

      console.info('newsSensitiveData summary/prediction response', {
        action,
        topicId,
        statusCode: response.statusCode,
        success: response.body?.success,
        cached: response.body?.cached,
        error: response.body?.error,
        reason: response.body?.reason,
      });
      return {
        statusCode: response.statusCode,
        headers,
        body: JSON.stringify(response.body),
      };
    }

    if (action === 'today') {
      const response = await readTodayArchive();
      console.info('newsSensitiveData today archive response', {
        statusCode: response.statusCode,
        entryCount: response.body?.data?.entries?.length ?? 0,
      });
      return {
        statusCode: response.statusCode,
        headers,
        body: JSON.stringify(response.body),
      };
    }

    if (action === 'rss') {
      const rssXml = await generateRssFeed(event);
      console.info('newsSensitiveData rss feed served');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=1800',
        },
        body: rssXml,
      };
    }

    if (action === 'daily_brief') {
      const now = new Date();
      const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
      const dateKey = payload?.dateKey || todayKey;

      try {
        const { Item } = await getDynamoClient().send(new GetCommand({
          TableName: SUMMARIZE_PREDICT_TABLE,
          Key: { PK: `DAILY_BRIEF#${dateKey}`, SK: 'DAILY_BRIEF' },
        }));
        if (!Item) {
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
        }
        const { PK, SK, ttl, ...rest } = Item;
        console.info('newsSensitiveData daily_brief response', { dateKey, found: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: briefWithIso3(rest) }) };
      } catch (err) {
        console.error('daily_brief read error:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
      }
    }

    if (action === 'latest_daily_brief') {
      // Newest published daily brief in one round trip (replaces the client's day-by-day lookback).
      // BatchGetItem over the last `lookbackDays` DAILY_BRIEF# keys; the newest existing one wins.
      try {
        const keys = briefKeys(Date.now(), payload?.lookbackDays).map((d) => ({ PK: `DAILY_BRIEF#${d}`, SK: 'DAILY_BRIEF' }));
        const client = getDynamoClient();
        let pending = { [SUMMARIZE_PREDICT_TABLE]: { Keys: keys } };
        const found = [];
        for (let attempt = 0; attempt < 2 && pending && Object.keys(pending).length; attempt++) {
          const out = await client.send(new BatchGetCommand({ RequestItems: pending }));
          found.push(...((out.Responses || {})[SUMMARIZE_PREDICT_TABLE] || []));
          pending = out.UnprocessedKeys && Object.keys(out.UnprocessedKeys).length ? out.UnprocessedKeys : null;
        }
        const { item, editions } = pickLatestBrief(found);
        console.info('newsSensitiveData latest_daily_brief response', { keys: keys.length, found: found.length, dateKey: item?.dateKey || null });
        if (!item) return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null, dateKey: null, editions: [] }) };
        const { PK, SK, ttl, ...rest } = item;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: briefWithIso3(rest), dateKey: rest.dateKey, editions }) };
      } catch (err) {
        console.error('latest_daily_brief read error:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null, dateKey: null, editions: [] }) };
      }
    }

    if (action === 'weekly_brief') {
      // Latest PUBLISHED weekly intelligence brief (human-approved via weekly/review.js), or the published
      // brief of one past week with {week: 'YYYY-MM-DD'} (its weekOf, the WEEKLY_BRIEF#<weekOf> key).
      try {
        const week = payload?.week || qs?.week;
        if (week !== undefined) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(week))) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'week must be YYYY-MM-DD' }) };
          const { Item } = await getDynamoClient().send(new GetCommand({
            TableName: SUMMARIZE_PREDICT_TABLE, Key: { PK: `WEEKLY_BRIEF#${week}`, SK: 'WEEKLY_BRIEF' },
          }));
          console.info('newsSensitiveData weekly_brief response', { week, found: Boolean(Item && Item.status === 'published') });
          if (!Item || Item.status !== 'published') return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
          const { PK, SK, ttl, ...rest } = Item;
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: weeklyWithIso3(rest) }) };
        }
        // Paginate — the table outgrew the 1MB scan page, so a single-page scan
        // misses published briefs that sit past the first page (bit us 2026-07-03).
        const Items = [];
        let ExclusiveStartKey;
        let pages = 0;
        do {
          const resp = await getDynamoClient().send(new ScanCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            FilterExpression: 'SK = :sk AND #s = :pub',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':sk': 'WEEKLY_BRIEF', ':pub': 'published' },
            ExclusiveStartKey,
          }));
          Items.push(...(resp.Items || []));
          ExclusiveStartKey = resp.LastEvaluatedKey;
          pages += 1;
        } while (ExclusiveStartKey && pages < 25);
        if (!Items.length) {
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
        }
        const latest = Items.sort((a, b) => String(b.weekOf).localeCompare(String(a.weekOf)))[0];
        const { PK, SK, ttl, ...rest } = latest;
        console.info('newsSensitiveData weekly_brief response', { weekOf: rest.weekOf });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: weeklyWithIso3(rest) }) };
      } catch (err) {
        console.error('weekly_brief read error:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
      }
    }

    if (action === 'weekly_markets') {
      // Latest PUBLISHED weekly markets report (human-approved via weekly-markets/review.js).
      // Honest null-when-none-published, exactly like the weekly_brief action above.
      try {
        // Paginate — same 1MB-page miss as weekly_brief (this one only worked by
        // luck of where its published row sat in the table).
        const Items = [];
        let ExclusiveStartKey;
        let pages = 0;
        do {
          const resp = await getDynamoClient().send(new ScanCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            FilterExpression: 'SK = :sk AND #s = :pub',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':sk': 'WEEKLY_MARKETS', ':pub': 'published' },
            ExclusiveStartKey,
          }));
          Items.push(...(resp.Items || []));
          ExclusiveStartKey = resp.LastEvaluatedKey;
          pages += 1;
        } while (ExclusiveStartKey && pages < 25);
        if (!Items.length) {
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
        }
        const latest = Items.sort((a, b) => String(b.weekOf).localeCompare(String(a.weekOf)))[0];
        const { PK, SK, ttl, ...rest } = latest;
        console.info('newsSensitiveData weekly_markets response', { weekOf: rest.weekOf });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: rest }) };
      } catch (err) {
        console.error('weekly_markets read error:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
      }
    }

    if (action === 'narrative_thread') {
      const threadId = payload?.threadId;
      if (!threadId || typeof threadId !== 'string') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing threadId' }),
        };
      }
      const maxDays = ENTERPRISE_MAX_DAYS;
      const response = await readNarrativeThread(threadId, maxDays);
      console.info('newsSensitiveData narrative_thread response', {
        threadId, statusCode: response.statusCode, entryCount: response.body?.data?.length ?? 0,
      });
      return { statusCode: response.statusCode, headers, body: JSON.stringify(response.body) };
    }

    if (action === 'archive_range') {
      const requestedDays = Math.max(1, Math.min(ENTERPRISE_MAX_DAYS, parseInt(payload?.days || ENTERPRISE_MAX_DAYS, 10)));

      const response = await readArchiveRange(requestedDays);
      console.info('newsSensitiveData archive_range response', {
        requestedDays,
        statusCode: response.statusCode,
        dayCount: Object.keys(response.body?.data || {}).length,
      });
      return {
        statusCode: response.statusCode,
        headers,
        body: JSON.stringify(response.body),
      };
    }

    if (action === 'thread_analysis') {
      const threadIds = Array.isArray(payload?.threadIds) ? payload.threadIds.slice(0, 20) : [];
      const data = {};
      const client = getDynamoClient();
      await Promise.all(threadIds.map(async (tid) => {
        try {
          const [analysisOut, driftOut] = await Promise.all([
            client.send(new GetCommand({
              TableName: SUMMARIZE_PREDICT_TABLE,
              Key: { PK: `THREAD#${tid}`, SK: 'THREAD_ANALYSIS' },
            })),
            // Living-analysis Phase 3: the latest grounded "what changed" note for this thread.
            client.send(new QueryCommand({
              TableName: SUMMARIZE_PREDICT_TABLE,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :d)',
              ExpressionAttributeValues: { ':pk': `THREAD#${tid}`, ':d': 'DRIFT#' },
              ScanIndexForward: false,
              Limit: 1,
            })),
          ]);
          if (analysisOut.Item) {
            const { PK, SK, ttl, ...rest } = analysisOut.Item;
            const driftItem = (driftOut.Items || [])[0];
            if (driftItem) { const { PK: _p, SK: _s, ttl: _t, ...dn } = driftItem; rest.driftNote = dn; }
            data[tid] = rest;
          }
        } catch {}
      }));
      console.info('newsSensitiveData thread_analysis response', {
        requested: threadIds.length, found: Object.values(data).filter(Boolean).length,
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data }),
      };
    }

    if (action === 'country_intelligence') {
      const countryNames = Array.isArray(payload?.countryNames) ? payload.countryNames.slice(0, 15) : [];
      const data = {};
      const client = getDynamoClient();
      await Promise.all(countryNames.map(async (name) => {
        try {
          for (const key of countryKeys(name)) { // canonical record first, then the requested spelling
            const { Item } = await client.send(new GetCommand({
              TableName: SUMMARIZE_PREDICT_TABLE,
              Key: { PK: `COUNTRY#${key}`, SK: 'COUNTRY_INTELLIGENCE' },
            }));
            if (Item) {
              const { PK, SK, ttl, ...rest } = Item;
              data[name] = rest;
              break;
            }
          }
        } catch {}
      }));
      console.info('newsSensitiveData country_intelligence response', {
        requested: countryNames.length, found: Object.values(data).filter(Boolean).length,
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data }),
      };
    }

    if (action === 'country_facts') {
      // Public read of the stored country facts (leader / capital / population), each with its
      // source and as-of date; rows or parts without both are omitted (never an undated value).
      const countryNames = Array.isArray(payload?.countryNames) ? payload.countryNames.slice(0, 15).map(String) : [];
      const data = {};
      const client = getDynamoClient();
      await Promise.all(countryNames.map(async (name) => {
        try {
          for (const key of countryKeys(name)) { // canonical record first, then the requested spelling
            const { Item } = await client.send(new GetCommand({
              TableName: SUMMARIZE_PREDICT_TABLE,
              Key: { PK: `FACTS#${key}`, SK: 'COUNTRY_FACTS' },
            }));
            const shaped = shapeCountryFacts(Item);
            if (shaped) { data[name] = shaped; break; }
          }
        } catch {}
      }));
      console.info('newsSensitiveData country_facts response', { requested: countryNames.length, found: Object.keys(data).length });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
    }

    if (action === 'country_history') {
      const countryName = payload?.countryName || qs?.countryName;
      if (!countryName) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing countryName' }) };
      }
      const client = getDynamoClient();
      try {
        const readCountry = (key) => Promise.all([
          client.send(new QueryCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
            ExpressionAttributeValues: { ':pk': `COUNTRY#${key}`, ':prefix': 'HISTORY#' },
            ScanIndexForward: false,
            Limit: 90,
          })),
          // Live drift notes (60d TTL) — grounded "what changed & why". Newest first, few.
          client.send(new QueryCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
            ExpressionAttributeValues: { ':pk': `COUNTRY#${key}`, ':prefix': 'DRIFT#' },
            ScanIndexForward: false,
            Limit: 10,
          })),
          // Permanent archive (no TTL) — the full correction history members unlock (P3). Empty
          // until newsDriftCorrector runs post-deploy; unioned below so the live band is unaffected.
          client.send(new QueryCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
            ExpressionAttributeValues: { ':pk': `COUNTRY#${key}`, ':prefix': 'DRIFTLOG#' },
            ScanIndexForward: false,
            Limit: 90,
          })),
        ]);
        // canonical record first, then the requested spelling (records not yet merged)
        let histOut, driftOut, archiveOut;
        for (const key of countryKeys(countryName)) {
          [histOut, driftOut, archiveOut] = await readCountry(key);
          if ([histOut, driftOut, archiveOut].some((o) => (o.Items || []).length)) break;
        }
        const snapshots = (histOut.Items || []).map(({ PK, SK, ttl, ...rest }) => rest);
        // Correction-history DEPTH is the member perk (MEMBER_GATING_PLAN.md): non-members get the
        // latest note free + an honest count of how many more; members get the full chain. The
        // snapshots (the analysis itself) are always fully public — only the drift depth caps.
        // Union archive (DRIFTLOG#, superset) + live (DRIFT#), dedup by asOf, newest first.
        const strip = ({ PK, SK, ttl, ...rest }) => rest;
        const allDriftNotes = dedupeByAsOf([
          ...(archiveOut.Items || []).map(strip),
          ...(driftOut.Items || []).map(strip),
        ]);
        const tier = await resolveTier(event);
        const capped = capForTier(allDriftNotes, tier, 1);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, countryName, snapshots,
          driftNotes: capped.items, driftNotesTotal: capped.total, driftNotesGated: capped.gated }) };
      } catch (err) {
        console.error('country_history error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Query failed' }) };
      }
    }

    // Site-wide corrections ledger — the living-analysis loop's aggregate view. Recent grounded
    // drift notes across ALL countries + threads ("<name>: elevated → high · Because: <event>").
    // Scans DRIFT# rows (60d-TTL, bounded; same Scan pattern as economic_impact_list). Cached 30min
    // on the client. (Future optimization: have newsDriftCorrector append to one CORRECTIONS_FEED
    // row so the serve is a single GetItem — see PREDICTION_METHODOLOGY_V1_PLAN.md §5.)
    if (action === 'corrections_feed') {
      const client = getDynamoClient();
      try {
        const limit = Math.min(Number(payload?.limit || qs?.limit || 40), 100);
        const items = [];
        let ExclusiveStartKey;
        do {
          const res = await client.send(new ScanCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            FilterExpression: 'begins_with(SK, :d)',
            ExpressionAttributeValues: { ':d': 'DRIFT#' },
            ProjectionExpression: 'PK, SK, threadId, asOf, changeLevel, changeScore, changeDimensions, triggerEvent, whyChanged, noSingleDriver, directionFlag',
            ExclusiveStartKey,
          }));
          items.push(...(res.Items || []));
          ExclusiveStartKey = res.LastEvaluatedKey;
        } while (ExclusiveStartKey);

        const notes = items.map((it) => {
          const pk = String(it.PK || '');
          const scope = pk.startsWith('COUNTRY#') ? 'country' : pk.startsWith('THREAD#') ? 'thread' : 'other';
          const name = pk.replace(/^(COUNTRY#|THREAD#)/, '');
          return {
            scope,
            name,
            // links: a country note's iso3 (resolver over its name), the thread (a thread note's own, else the
            // trigger event's thread)
            iso3: scope === 'country' ? iso3List([name]) : [],
            threadId: it.threadId || it.triggerEvent?.threadId || null,
            asOf: it.asOf || String(it.SK || '').replace(/^DRIFT#/, ''),
            changeLevel: it.changeLevel || null,
            changeScore: it.changeScore || null,
            changeDimensions: it.changeDimensions || null,
            triggerEvent: it.triggerEvent || null,
            whyChanged: it.whyChanged || null,
            noSingleDriver: !!it.noSingleDriver,
            directionFlag: it.directionFlag || null, // D9: the client shows numbers only for a flagged note
          };
        }).filter(n => n.asOf && n.scope !== 'other');
        notes.sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)));
        // Ledger DEPTH is the member perk: non-members see the newest few + the honest total;
        // members see the full history. The total is always the real full count (feeds the
        // "Showing n of N — members see all" affordance). See MEMBER_GATING_PLAN.md.
        const tier = await resolveTier(event);
        const CORRECTIONS_TEASER = 5;
        const visible = tier === 'member' ? notes.slice(0, limit) : notes.slice(0, CORRECTIONS_TEASER);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, notes: visible, total: notes.length, gated: tier !== 'member' && notes.length > visible.length }) };
      } catch (err) {
        console.error('corrections_feed error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Query failed' }) };
      }
    }

    // Phase 4 — per-thread "Living forecast" board. Given the thread's topicIds, returns the
    // single NEWEST methodologyVersion>=1 prediction snapshot among them (scenarios + dated
    // triggers with their verdicts). v1-only: legacy snapshots (retrodiction-prone) never surface.
    // Triggers render pending today and strike/check as verdicts land (Phase 2 resolution loop).
    if (action === 'prediction_snapshot') {
      const client = getDynamoClient();
      try {
        let topicIds = payload?.topicIds ?? qs?.topicIds ?? payload?.topicId ?? qs?.topicId;
        if (typeof topicIds === 'string') topicIds = topicIds.split(',').map(s => s.trim()).filter(Boolean);
        if (!Array.isArray(topicIds)) topicIds = topicIds ? [topicIds] : [];
        // Batch 4 / C: a story can be asked for by threadId (briefings only know the thread); its
        // topic ids come from the same narrative_thread read the story page uses (14 days).
        const askedThreadId = payload?.threadId ?? qs?.threadId;
        if (!topicIds.length && typeof askedThreadId === 'string' && askedThreadId) {
          const tr = await readNarrativeThread(askedThreadId, 14);
          topicIds = tr?.body?.success ? (tr.body.data || []).map(e => e.topicId).filter(Boolean) : [];
        }
        topicIds = [...new Set(topicIds.filter(Boolean))].slice(0, 25);
        if (!topicIds.length) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'topicIds required' }) };

        // Newest snapshot per topic (SK = date, newest first). Best-effort per topic.
        const latest = await Promise.all(topicIds.map(tid =>
          client.send(new QueryCommand({
            TableName: PREDICTION_LOG_TABLE,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: { ':pk': `PRED#${tid}` },
            ScanIndexForward: false,
            Limit: 1,
          })).then(r => (r.Items || [])[0] || null).catch(() => null)
        ));

        const v1 = latest.filter(Boolean).filter(it => Number(it.methodologyVersion || 0) >= 1);
        if (!v1.length) return { statusCode: 200, headers, body: JSON.stringify({ success: true, snapshot: null }) };
        v1.sort((a, b) => String(b.generatedAt || b.SK || '').localeCompare(String(a.generatedAt || a.SK || '')));
        const it = v1[0];

        // Batch 4 / C: per-question facts. Legacy triggers (no `question` field) are returned exactly as before.
        const issueDay = String(it.SK || it.generatedAt || '').slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const qTriggers = (it.scenarios || []).flatMap(s => (s.triggers || []).filter(t => t && t.question === true && t.qid));
        const qInfo = new Map();
        if (qTriggers.length) {
          let commitExists = false;
          let drawExists = false;
          try {
            const wk = isoWeekOfDay(issueDay);
            const [c, d] = await Promise.all([
              client.send(new GetCommand({ TableName: PREDICTION_LOG_TABLE, Key: { PK: `SEED#${wk}`, SK: 'COMMIT' } })),
              client.send(new GetCommand({ TableName: PREDICTION_LOG_TABLE, Key: { PK: `SAMPLE#${wk}`, SK: 'DRAW' } })),
            ]);
            commitExists = Boolean(c.Item); drawExists = Boolean(d.Item);
          } catch (e) { console.warn('prediction_snapshot week lookup failed', e.message); }
          await Promise.all(qTriggers.map(async (t) => {
            try {
              // SAMPLED and VERDICT rows only: 'SAMPLED' <= SK sorts after every DRAFT# row (operator-only, never read here)
              const r = await client.send(new QueryCommand({
                TableName: PREDICTION_LOG_TABLE, KeyConditionExpression: 'PK = :pk AND SK >= :s',
                ExpressionAttributeValues: { ':pk': `Q#${t.qid}`, ':s': 'SAMPLED' },
              }));
              const rows = r.Items || [];
              const sampled = rows.some(x => x.SK === 'SAMPLED');
              const verdictRows = rows.filter(x => String(x.SK).startsWith('VERDICT'));
              const v = latestVerdictRow(verdictRows);
              qInfo.set(t.qid, {
                scoring: questionSampleState({ issueDay, deadline: t.deadline, sampled, commitExists, drawExists }),
                state: questionOutcomeState({ sampled, verdictRows, deadline: t.deadline, today }),
                verdictUrl: v?.evidence?.url || null, verdictQuote: v?.evidence?.quote || null, voidReason: v?.voidReason || null,
              });
            } catch (e) { console.warn('prediction_snapshot question lookup failed', e.message); }
          }));
        }

        const scenarios = (it.scenarios || []).map(s => ({
          label: s.label,
          probability: typeof s.probability === 'number' ? s.probability : null,
          triggers: (s.triggers || []).filter(t => t.deadline).map(t => ({
            id: t.id,
            text: t.text,
            deadline: t.deadline,
            verdict: triggerVerdict(t.finalVerdict, t.question === true && t.qid ? qInfo.get(t.qid)?.state : null),
            confirmedBy: t.confirmedBy || null,
            citation: t.agentVerdict?.evidence?.[0]?.url || t.agentVerdict?.evidence?.[0]?.title || null,
            ...(t.question === false ? { question: false } : {}),
            ...(t.question === true && t.qid ? {
              question: true, qid: t.qid, p: typeof t.p === 'number' ? t.p : null, source: t.resolutionSource || null,
              ...(qInfo.get(t.qid) || { scoring: null, state: null }),
            } : {}),
          })),
        })).filter(s => s.triggers.length);

        const snapshot = scenarios.length ? {
          topicId: it.topicId,
          threadId: it.threadId || (typeof askedThreadId === 'string' && askedThreadId) || null,
          title: it.title || null,
          generatedAt: it.generatedAt || it.SK || null,
          status: it.status || 'open',
          questionSchema: it.questionSchema || null,
          scenarios,
        } : null;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, snapshot }) };
      } catch (err) {
        console.error('prediction_snapshot error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Query failed' }) };
      }
    }

    if (action === 'systems_analysis') {
      const countryName = payload?.countryName || qs?.countryName;
      if (!countryName) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing countryName' }) };
      }
      const client = getDynamoClient();
      try {
        let Item;
        for (const key of countryKeys(countryName)) { // canonical record first, then the requested spelling
          ({ Item } = await client.send(new GetCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            Key: { PK: `SYSTEMS#${key}`, SK: 'SYSTEMS_ANALYSIS' },
          })));
          if (Item) break;
        }
        if (!Item) {
          return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Systems analysis not found for this country' }) };
        }
        const { PK, SK, ttl, ...rest } = Item;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: rest }) };
      } catch (err) {
        console.error('systems_analysis error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Lookup failed' }) };
      }
    }

    // Batch 4 / E: the story web in one read. {} -> the whole index (links, shared-actor links, per-story state,
    // coverage, which countries were analysed). {threadId} -> that story's record (only if it belongs to the
    // CURRENT run, so a story that dropped out of the webs never shows old links) plus its state; the page
    // words the empty state from `state` + `targets`. Public, no auth guard. TTL is disabled on the table,
    // so freshness is judged by the client from each link's `generatedAt`.
    if (action === 'web_index') {
      const client = getDynamoClient();
      try {
        const { Item: idx } = await client.send(new GetCommand({ TableName: SUMMARIZE_PREDICT_TABLE, Key: { PK: 'WEB#INDEX', SK: 'LATEST' } }));
        if (!idx) return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
        const { PK, SK, ...stored } = idx; // eslint-disable-line no-unused-vars
        const index = webWithIso3(stored);
        const threadId = payload?.threadId || qs?.threadId;
        if (!threadId) return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: index }) };
        const meta = (index.threads && index.threads[threadId]) || null;
        const { Item: rec } = await client.send(new GetCommand({ TableName: SUMMARIZE_PREDICT_TABLE, Key: { PK: `THREAD#${threadId}`, SK: 'WEB' } }));
        let record = null;
        if (rec && rec.runId === index.runId) { const { PK: _p, SK: _s, ...rest } = rec; record = webWithIso3(rest); } // eslint-disable-line no-unused-vars
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {
          threadId, runId: index.runId, generatedAt: index.generatedAt, targets: index.targets, maxAgeDays: index.maxAgeDays,
          state: record ? record.state : (meta ? meta.state : null), meta, record,
        } }) };
      } catch (err) {
        console.error('web_index error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Lookup failed' }) };
      }
    }

    if (action === 'prediction_track_record') {
      // S8·T3: serve the precomputed aggregate from S3 (newsPredictionsSnapshot writes it every
      // 30 min). Only if the cache is missing/unreadable do we fall through to the live Scan below,
      // so correctness is preserved even if the builder hasn't run yet.
      try {
        const cached = await getTrackRecordCache();
        if (cached) {
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: cached }) };
        }
      } catch (e) {
        console.warn('prediction_track_record cache miss, falling back to scan:', e.message);
      }

      const client = getDynamoClient();
      try {
        const items = [];
        let ExclusiveStartKey;
        do {
          const res = await client.send(new ScanCommand({
            TableName: PREDICTION_LOG_TABLE,
            ProjectionExpression: 'PK, topicId, threadId, title, category, generatedAt, scenarios, methodologyVersion',
            ExclusiveStartKey,
          }));
          items.push(...(res.Items || []));
          ExclusiveStartKey = res.LastEvaluatedKey;
        } while (ExclusiveStartKey);

        // Methodology-v1 era cut (2026-07-04): only records written by the rebuilt,
        // gated capture (methodologyVersion >= 1) are scored. The legacy backlog is kept
        // immutable but excluded — it carries the trigger-generation defects the pilot
        // found (retrodictions, false premises). See PREDICTION_METHODOLOGY_V1_PLAN.md.
        const ERA_CUT_FROM = '2026-07-04';
        const v1Items = items.filter(it => Number(it.methodologyVersion || 0) >= 1);
        const legacyExcluded = items.length - v1Items.length;

        // A "resolved" trigger is one confirmed as fired/not_fired (unclear is excluded from
        // scoring). Score each against its parent scenario's probability midpoint:
        // Brier = mean((p - outcome)^2).
        const buckets = [0, 0.2, 0.4, 0.6, 0.8, 1.0001];
        const cal = buckets.slice(0, -1).map((lo, i) => ({ lo, hi: buckets[i + 1], n: 0, predicted: 0, fired: 0 }));
        const resolved = [];
        let totalTriggers = 0;
        let pendingCount = 0;
        let brierSum = 0;
        let scored = 0;
        let firedCount = 0;

        for (const it of v1Items) {
          for (const s of it.scenarios || []) {
            const p = typeof s.probability === 'number' ? s.probability : null;
            for (const t of s.triggers || []) {
              if (t.question === true) continue; // scored by the question board (newsPredictionsSnapshot), as in trackRecord.js
              if (!t.deadline) continue;
              totalTriggers++;
              const v = t.finalVerdict;
              if (v !== 'fired' && v !== 'not_fired') {
                if (!v) pendingCount++;
                continue;
              }
              const outcome = v === 'fired' ? 1 : 0;
              if (v === 'fired') firedCount++;
              if (p != null) {
                brierSum += (p - outcome) ** 2;
                scored++;
                const b = cal.find(c => p >= c.lo && p < c.hi);
                if (b) { b.n++; b.predicted += p; b.fired += outcome; }
              }
              // v1 verdicts carry the agent's cited evidence; fall back to a legacy proposal citation.
              const citation = t.agentVerdict?.evidence?.[0]?.url
                || t.agentVerdict?.evidence?.[0]?.title
                || t.proposal?.citation
                || null;
              resolved.push({
                title: it.title,
                category: it.category || null,
                scenario: s.label,
                probability: p,
                trigger: t.text,
                deadline: t.deadline,
                verdict: v,
                citation,
                confirmedBy: t.confirmedBy || null,
                confirmedAt: t.confirmedAt || null,
                qid: t.qid || null,
                clusterKey: it.threadId || it.topicId || it.PK || null,
              });
            }
          }
        }

        resolved.sort((a, b) => (b.confirmedAt || '').localeCompare(a.confirmedAt || ''));
        const calibration = cal
          .filter(c => c.n > 0)
          .map(c => ({
            bucket: `${Math.round(c.lo * 100)}-${Math.round(c.hi * 100)}%`,
            n: c.n,
            meanPredicted: Math.round((c.predicted / c.n) * 1000) / 1000,
            actualFiredRate: Math.round((c.fired / c.n) * 1000) / 1000,
          }));

        const data = {
          methodologyVersion: 1,
          eraCutFrom: ERA_CUT_FROM,
          totalPredictionsLogged: v1Items.length,
          legacyPredictionsExcluded: legacyExcluded,
          totalDatedTriggers: totalTriggers,
          resolvedTriggers: scored,
          pendingTriggers: pendingCount,
          firedTriggers: firedCount,
          brierScore: scored ? Math.round((brierSum / scored) * 1000) / 1000 : null,
          calibration,
          recent: resolved.slice(0, 30),
        };
        console.info('prediction_track_record', { v1Logged: data.totalPredictionsLogged, legacyExcluded, resolved: data.resolvedTriggers });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
      } catch (e) {
        console.error('prediction_track_record error', e);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Internal error' }) };
      }
    }

    if (action === 'economic_impact') {
      const threadId = payload?.threadId || qs?.threadId;
      if (!threadId) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing threadId' }) };
      }
      const client = getDynamoClient();
      try {
        const { Item } = await client.send(new GetCommand({
          TableName: SUMMARIZE_PREDICT_TABLE,
          Key: { PK: `ECON#THREAD#${threadId}`, SK: 'ECONOMIC_IMPACT' },
        }));
        if (!Item) {
          return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Economic impact not found' }) };
        }
        const { PK, SK, ttl, ...rest } = Item;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: rest }) };
      } catch (err) {
        console.error('economic_impact error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Lookup failed' }) };
      }
    }

    if (action === 'economic_impact_list') {
      const minSeverity = payload?.minSeverity || qs?.minSeverity || null;
      const country = payload?.country || qs?.country || null;
      const limit = Math.min(parseInt(payload?.limit || qs?.limit || '50', 10), 200);
      const client = getDynamoClient();
      const severityRank = { severe: 3, moderate: 2, minor: 1 };
      const minRank = minSeverity ? (severityRank[minSeverity] || 0) : 0;
      try {
        // Paginate the scan — DDB returns at most 1MB per page; matching items may span pages.
        const allItems = [];
        let lastKey;
        do {
          const resp = await client.send(new ScanCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND hasImpact = :hi',
            ExpressionAttributeValues: { ':prefix': 'ECON#THREAD#', ':sk': 'ECONOMIC_IMPACT', ':hi': true },
            ExclusiveStartKey: lastKey,
          }));
          allItems.push(...(resp.Items || []));
          lastKey = resp.LastEvaluatedKey;
        } while (lastKey);
        const Items = allItems;
        const list = Items
          .filter(item => (severityRank[item.severity] || 0) >= minRank)
          .filter(item => {
            if (!country) return true;
            // Match when country appears in winners or losers
            const inWinners = Array.isArray(item.winners) && item.winners.some(w => w.name === country);
            const inLosers = Array.isArray(item.losers) && item.losers.some(l => l.name === country);
            return inWinners || inLosers;
          })
          .map(item => {
            const { PK, SK, ttl, ...rest } = item;
            return rest;
          })
          .sort((a, b) => (b.severityScore || 0) - (a.severityScore || 0))
          .slice(0, limit);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: list }) };
      } catch (err) {
        console.error('economic_impact_list error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Lookup failed' }) };
      }
    }

    if (action === 'economic_top_movers') {
      const limit = Math.min(parseInt(payload?.limit || qs?.limit || '10', 10), 30);
      const client = getDynamoClient();
      try {
        // Paginate the scan — see economic_impact_list for rationale.
        const Items = [];
        let lastKey;
        do {
          const resp = await client.send(new ScanCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND hasImpact = :hi',
            ExpressionAttributeValues: { ':prefix': 'ECON#THREAD#', ':sk': 'ECONOMIC_IMPACT', ':hi': true },
            ProjectionExpression: 'instruments, severity, severityScore, headline, scopeId',
            ExclusiveStartKey: lastKey,
          }));
          Items.push(...(resp.Items || []));
          lastKey = resp.LastEvaluatedKey;
        } while (lastKey);

        // Aggregate: for each instrument, count citations + tally directions
        const agg = {};
        for (const item of Items) {
          for (const inst of (item.instruments || [])) {
            if (!inst.instrumentId) continue;
            const id = inst.instrumentId;
            if (!agg[id]) {
              agg[id] = { instrumentId: id, citations: 0, directions: { up: 0, down: 0, mixed: 0 }, examples: [] };
            }
            agg[id].citations++;
            if (inst.direction && agg[id].directions[inst.direction] != null) {
              agg[id].directions[inst.direction]++;
            }
            if (agg[id].examples.length < 3) {
              agg[id].examples.push({
                threadId: item.scopeId,
                headline: item.headline,
                severity: item.severity,
              });
            }
          }
        }

        // Compute consensus direction + sort by citation count
        const movers = Object.values(agg)
          .map(m => {
            const counts = m.directions;
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            const total = counts.up + counts.down + counts.mixed;
            const consensus = top && top[1] > 0 ? top[0] : 'mixed';
            const consensusStrength = total > 0 ? Math.round((top[1] / total) * 100) : 0;
            return { ...m, consensus, consensusStrength };
          })
          .sort((a, b) => b.citations - a.citations)
          .slice(0, limit);

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: movers }) };
      } catch (err) {
        console.error('economic_top_movers error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Lookup failed' }) };
      }
    }

    // ── Public preview endpoints (no auth, limited fields for SEO) ──
    if (action === 'country_preview') {
      const name = payload?.countryName;
      if (!name) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing countryName' }) };
      try {
        const { Item } = await getDynamoClient().send(new GetCommand({
          TableName: SUMMARIZE_PREDICT_TABLE,
          Key: { PK: `COUNTRY#${name}`, SK: 'COUNTRY_INTELLIGENCE' },
        }));
        if (!Item) return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, data: {
            headline: Item.headline || null,
            bluf: Item.bluf || null,
            keyDevelopments: Item.keyDevelopments || [],
            riskLevel: Item.riskLevel || null,
            trajectory: Item.trajectory || null,
            totalArticles: Item.totalArticles || 0,
            dayCount: Item.dayCount || 0,
            generatedAt: Item.generatedAt || null,
          }}),
        };
      } catch { return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) }; }
    }

    if (action === 'thread_preview') {
      const tid = payload?.threadId;
      if (!tid) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing threadId' }) };
      try {
        const { Item } = await getDynamoClient().send(new GetCommand({
          TableName: SUMMARIZE_PREDICT_TABLE,
          Key: { PK: `THREAD#${tid}`, SK: 'THREAD_ANALYSIS' },
        }));
        if (!Item) return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, data: {
            threadTitle: Item.threadTitle || null,
            entryShortTitles: Item.entryShortTitles || [],
            generatedAt: Item.generatedAt || null,
          }}),
        };
      } catch { return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) }; }
    }

    // ── Markets data (public — GlobalPerspectiveMarkets table) ───────────────
    if (action === 'markets_global') {
      try {
        const mClient = getDynamoClient();
        const mGet = (pk) => mClient.send(new GetCommand({ TableName: 'GlobalPerspectiveMarkets', Key: { pk, sk: 'LATEST' } }));
        const [fx, rates, comms, eq, cr] = await Promise.all([
          mGet('FX#USD'), mGet('RATES#GLOBAL'), mGet('COMMODITIES#GLOBAL'), mGet('EQUITIES#GLOBAL'), mGet('CRYPTO#GLOBAL'),
        ]);
        const stripMeta = (it) => { if (!it) return null; const { pk, sk, ttl, updatedAt, ...rest } = it; return rest; };

        // ── Watchlist series (additive): per-instrument daily-close spark + day-over-day change ──
        // Scan each category's HISTORY# rows once, transpose into per-instrument series.
        // Commodities are stored lowercase → map up to the frontend's UPPERCASE instrument ids.
        const COMMODITY_UP = { brent: 'BRENT', wti: 'WTI', gold: 'GOLD', copper: 'COPPER', dxy: 'DXY', vix: 'VIX', natgas: 'NATGAS' };
        const META_FIELDS = new Set(['pk', 'sk', 'ttl', 'updatedAt', 'asOf']);
        const histScanG = (pk) => mClient.send(new ScanCommand({
          TableName: 'GlobalPerspectiveMarkets',
          FilterExpression: 'pk = :pk AND begins_with(sk, :prefix)',
          ExpressionAttributeValues: { ':pk': pk, ':prefix': 'HISTORY#' },
        }));
        const series = {};
        const buildSeries = (items, idFor) => {
          const sorted = (items || []).slice().sort((a, b) => String(a.sk).localeCompare(String(b.sk)));
          const cols = {}; // instrumentId → [values oldest→newest]
          for (const row of sorted) {
            for (const field of Object.keys(row)) {
              if (META_FIELDS.has(field)) continue;
              const id = idFor(field);
              if (!id) continue;
              const v = row[field];
              if (v == null || typeof v !== 'number' || Number.isNaN(v)) continue;
              (cols[id] = cols[id] || []).push(v);
            }
          }
          for (const [id, vals] of Object.entries(cols)) {
            if (!vals.length) continue;
            const spark = vals.slice(-20);
            let change = null;
            if (vals.length >= 2) {
              const last = vals[vals.length - 1];
              const prev = vals[vals.length - 2];
              // A real price series can't move by 100%+ day-over-day; a magnitude
              // that large means the "series" isn't a price (e.g. a *_24h_change
              // field mistakenly transposed as an instrument) — drop the change.
              if (prev) {
                const pct = Math.round(((last - prev) / prev) * 100 * 100) / 100;
                if (Math.abs(pct) < 100) change = pct;
              }
            }
            series[id] = { spark, change };
          }
        };
        try {
          const [hComm, hRates, hEq, hCr] = await Promise.all([
            histScanG('COMMODITIES#GLOBAL'), histScanG('RATES#GLOBAL'),
            histScanG('EQUITIES#GLOBAL'), histScanG('CRYPTO#GLOBAL'),
          ]);
          buildSeries(hComm.Items, (f) => COMMODITY_UP[f] || null);   // commodities: lowercase → UPPER
          buildSeries(hRates.Items, (f) => f.toUpperCase());          // rates/equities: already uppercase ids
          buildSeries(hEq.Items, (f) => f.toUpperCase());
          // Crypto rows carry both price fields (BTC, ETH) AND 24h-change fields
          // (BTC_24h_change, ETH_24h_change). Only the prices are real instruments;
          // the *_24h_change fields are not price series and must NOT become series ids.
          const CRYPTO_PRICE = new Set(['BTC', 'ETH']);
          buildSeries(hCr.Items, (f) => CRYPTO_PRICE.has(f) ? f : null);
        } catch { /* series is best-effort — never block the LATEST snapshot */ }

        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, data: {
            fx:          fx.Item   ? { rates: fx.Item.rates,   base: fx.Item.base, asOf: fx.Item.asOf } : null,
            yields:      rates.Item ? { US10Y: rates.Item.US10Y, US2Y: rates.Item.US2Y, UK10Y: rates.Item.UK10Y, DE10Y: rates.Item.DE10Y, JP10Y: rates.Item.JP10Y, asOf: rates.Item.asOf } : null,
            commodities: comms.Item ? { brent: comms.Item.brent, wti: comms.Item.wti, gold: comms.Item.gold, copper: comms.Item.copper, dxy: comms.Item.dxy, vix: comms.Item.vix, natgas: comms.Item.natgas, asOf: comms.Item.asOf } : null,
            equities:    stripMeta(eq.Item),
            crypto:      stripMeta(cr.Item),
            series,
          }}),
        };
      } catch (e) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null, error: e.message }) };
      }
    }

    if (action === 'markets_country') {
      const countryName = payload?.country;
      if (!countryName) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing country' }) };
      try {
        const mClient = getDynamoClient();
        const [macro, fx] = await Promise.all([
          mClient.send(new GetCommand({ TableName: 'GlobalPerspectiveMarkets', Key: { pk: `MACRO#${countryName}`, sk: 'LATEST' } })),
          mClient.send(new GetCommand({ TableName: 'GlobalPerspectiveMarkets', Key: { pk: 'FX#USD', sk: 'LATEST' } })),
        ]);
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, data: {
            macro: macro.Item ? {
              gdp_usd:         macro.Item.gdp_usd,
              cpi_yoy:         macro.Item.cpi_yoy,
              reserves_usd:    macro.Item.reserves_usd,
              debt_to_gdp:     macro.Item.debt_to_gdp,
              current_account: macro.Item.current_account,
              unemployment:    macro.Item.unemployment,
              asOf:            macro.Item.asOf,
            } : null,
            fx: fx.Item ? { rates: fx.Item.rates, base: fx.Item.base, asOf: fx.Item.asOf } : null,
          }}),
        };
      } catch (e) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null, error: e.message }) };
      }
    }

    if (action === 'markets_history') {
      const { symbol, days = 30 } = payload || {};
      if (!symbol) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing symbol' }) };
      const SYM = String(symbol).toUpperCase();
      const COMMODITY_KEY = { BRENT: 'brent', WTI: 'wti', GOLD: 'gold', COPPER: 'copper', DXY: 'dxy', VIX: 'vix' };
      const histScan = (pk) => getDynamoClient().send(new ScanCommand({
        TableName: 'GlobalPerspectiveMarkets',
        FilterExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': pk, ':prefix': 'HISTORY#' },
      }));
      const seriesFrom = (items, valueOf) => (items || [])
        .sort((a, b) => a.sk.localeCompare(b.sk))
        .map(i => ({ date: i.sk.replace('HISTORY#', ''), value: valueOf(i) }))
        .filter(p => p.value != null)
        .slice(-(days));
      try {
        // Per-instrument categories — each HISTORY row holds many tickers as top-level fields.
        const cats = [
          ['COMMODITIES#GLOBAL', COMMODITY_KEY[SYM] || SYM.toLowerCase()],
          ['RATES#GLOBAL', SYM],
          ['EQUITIES#GLOBAL', SYM],
          ['CRYPTO#GLOBAL', SYM],
        ];
        for (const [pk, field] of cats) {
          const { Items } = await histScan(pk);
          const s = seriesFrom(Items, (i) => i[field]);
          if (s.length) return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: s }) };
        }
        // FX: FX#USD HISTORY rows carry a `rates` object keyed by currency code.
        const { Items: fxItems } = await histScan('FX#USD');
        const fx = seriesFrom(fxItems, (i) => i.rates?.[SYM]);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: fx }) };
      } catch (e) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: [], error: e.message }) };
      }
    }
    // ── End markets actions ──────────────────────────────────────────────────

    console.warn('newsSensitiveData received unsupported action', {
      action,
      payloadSample: payload,
    });

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Unsupported action' }),
    };
  } catch (err) {
    console.error('newsSensitiveData error:', err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ success: false, error: String(err.message || err) }),
    };
  }
};

async function readTopicsCache() {
  if (!TOPICS_TABLE) {
    console.error('newsSensitiveData topics misconfiguration: missing TOPICS_DDB_TABLE');
    return {
      statusCode: 500,
      body: { success: false, error: 'Topics table not configured' },
    };
  }

  try {
    const client = getDynamoClient();
    const { Item } = await client.send(new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { id: TOPICS_ITEM_ID },
    }));
    if (!Item) {
      console.warn('newsSensitiveData topics cache miss', {
        table: TOPICS_TABLE,
        itemId: TOPICS_ITEM_ID,
      });
      return {
        statusCode: 503,
        body: { success: false, error: 'Topics cache miss' },
      };
    }

    const isFresh = cacheEntryFresh(Item.updatedAt, TOPICS_MAX_AGE_SECONDS);
    if (!isFresh) {
      console.warn('newsSensitiveData topics cache stale (serving anyway)', {
        table: TOPICS_TABLE,
        itemId: TOPICS_ITEM_ID,
        updatedAt: Item.updatedAt,
        maxAgeSeconds: TOPICS_MAX_AGE_SECONDS,
      });
      return {
        statusCode: 200,
        body: { success: true, cached: true, stale: true, asOf: Item.updatedAt, data: Item },
      };
    }

    console.info('newsSensitiveData topics cache hit', {
      table: TOPICS_TABLE,
      itemId: TOPICS_ITEM_ID,
      updatedAt: Item.updatedAt,
    });

    return {
      statusCode: 200,
      body: { success: true, cached: true, stale: false, asOf: Item.updatedAt, data: Item },
    };
  } catch (err) {
    console.error('Topics cache error:', err);
    return {
      statusCode: 500,
      body: { success: false, error: 'Failed to read topics cache' },
    };
  }
}

async function readSummaryPredictionCache(action, topicId) {
  if (!SUMMARIZE_PREDICT_TABLE) {
    console.error('newsSensitiveData summary/prediction misconfiguration: missing SUMMARIZE_PREDICT_TABLE');
    return {
      statusCode: 500,
      body: { success: false, error: 'Summarize/Prediction table not configured' },
    };
  }

  const client = getDynamoClient();
  const pk = `${PK_PREFIX}${topicId}`;
  const sk = action === 'prediction' ? PREDICTION_SK
           : action === 'trace_cause' ? 'TRACE_CAUSE'
           : SUMMARY_SK;

  try {
    console.info('newsSensitiveData summary/prediction lookup', {
      action,
      requestTopicId: topicId,
      pk,
      sk,
      table: SUMMARIZE_PREDICT_TABLE,
    });

    const { Item } = await client.send(new GetCommand({
      TableName: SUMMARIZE_PREDICT_TABLE,
      Key: { PK: pk, SK: sk },
      ConsistentRead: true,
    }));

    if (!Item) {
      console.warn('newsSensitiveData summary/prediction cache miss', {
        table: SUMMARIZE_PREDICT_TABLE,
        pk,
        sk,
        note: 'No DynamoDB item returned; verify the generator Lambda wrote this topic id.',
      });
      return {
        statusCode: 503,
        body: { success: false, error: 'Cache miss', reason: 'MISSING' },
      };
    }

    console.info('newsSensitiveData summary/prediction raw item', {
      pk,
      sk,
      storedTopicId: Item.topicId,
      storedTitle: Item.title,
      keys: Object.keys(Item || {}),
    });

    const normalized = normalizeSummaryPrediction(Item);

    console.info('newsSensitiveData summary/prediction cache hit', {
      action,
      table: SUMMARIZE_PREDICT_TABLE,
      pk,
      sk,
      generatedAt: Item.generatedAt,
      ttl: Item.ttl,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        cached: true,
        data: normalized,
        stale: summaryPredictionFresh(Item) ? false : true,
      },
    };
  } catch (err) {
    console.error('Summary/Prediction cache error:', err);
    return {
      statusCode: 500,
      body: { success: false, error: 'Failed to read summary/prediction cache' },
    };
  }
}

async function readTodayArchive() {
  if (!TOPICS_TABLE) {
    return {
      statusCode: 500,
      body: { success: false, error: 'Topics table not configured' },
    };
  }

  try {
    const client = getDynamoClient();
    const { Item } = await client.send(new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { id: 'today-archive' },
    }));

    if (!Item || !Array.isArray(Item.entries) || Item.entries.length === 0) {
      return {
        statusCode: 200,
        body: { success: true, data: { entries: [], updatedAt: null } },
      };
    }

    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    const freshEntries = Item.entries.filter(e =>
      new Date(e.archivedAt).getTime() > cutoff
    );

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          entries: freshEntries,
          updatedAt: Item.updatedAt,
        },
      },
    };
  } catch (err) {
    console.error('Today archive read error:', err);
    return {
      statusCode: 500,
      body: { success: false, error: 'Failed to read today archive' },
    };
  }
}

function cacheEntryFresh(updatedAt, maxAgeSeconds) {
  if (!updatedAt) return false;
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(updated)) return false;
  const ageSeconds = (Date.now() - updated) / 1000;
  return ageSeconds <= maxAgeSeconds;
}

function summaryPredictionFresh(item) {
  return true;
}

function normalizeSummaryPrediction(item) {
  const { PK, SK, ttl, ...rest } = item;
  const remainingTtlSeconds = typeof ttl === 'number'
    ? Math.max(0, Math.floor(ttl - Date.now() / 1000))
    : null;

  let content = rest.content;
  if (typeof content === 'object' && content !== null) {
    try {
      content = JSON.stringify(content, null, 2);
    } catch {
      content = String(content);
    }
  }
  if (typeof content !== 'string') {
    content = content == null ? '' : String(content);
  }

  const topicId = typeof PK === 'string' && PK.startsWith(PK_PREFIX)
    ? PK.slice(PK_PREFIX.length)
    : PK;

  return {
    ...rest,
    topicId,
    kind: SK,
    remainingTtlSeconds,
    content: content.trim(),
  };
}

function formatArchiveDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `archive#${y}-${m}-${d}`;
}

function formatDateLabel(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function readArchiveRange(days) {
  if (!TOPICS_TABLE) {
    return {
      statusCode: 500,
      body: { success: false, error: 'Topics table not configured' },
    };
  }

  try {
    const client = getDynamoClient();
    const now = new Date();
    const result = {};

    // Day 0: serve from "latest", labelled with the date `latest` really belongs to (its own
    // updatedAt), NOT today — a stalled pipeline used to re-date an old generation as today.
    const { Item: latestItem } = await client.send(new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { id: TOPICS_ITEM_ID },
    }));
    const latestLabel = latestDayLabel(latestItem);
    const latestEntries = latestLabel && latestItem && Array.isArray(latestItem.topics) ? latestItem.topics.map(lightEntry) : [];
    // `latest` is only the NEWEST generation; today's archive row holds every run of the day, so a story from an
    // earlier run today is served too (union by topicId, `latest` first).
    const todayDate = formatDateLabel(now);
    const { Item: todayRow } = await client.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: formatArchiveDateKey(now) } }));
    const todayEntries = Array.isArray(todayRow?.entries) ? todayRow.entries.map(lightEntry) : [];
    if (latestEntries.length) {
      const merged = latestLabel === todayDate ? unionByTopicId(latestEntries, todayEntries) : latestEntries;
      result[latestLabel] = { entries: merged, source: 'latest', updatedAt: latestItem.updatedAt || latestItem.activatedAt || null };
    }
    if (todayEntries.length && !result[todayDate]) {
      // `latest` is stale (or absent): today's entries still come from today's own row, under today's date
      result[todayDate] = { entries: todayEntries, source: 'archive', updatedAt: todayRow.updatedAt || null };
    }

    // Days 1..N: serve from archive#YYYY-MM-DD
    for (let i = 1; i < days; i++) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - i);
      const dateLabel = formatDateLabel(date);
      const archiveKey = formatArchiveDateKey(date);

      const { Item } = await client.send(new GetCommand({
        TableName: TOPICS_TABLE,
        Key: { id: archiveKey },
      }));

      if (Item && Array.isArray(Item.entries) && Item.entries.length > 0) {
        // Strip heavy AI fields to keep response under 6MB Lambda payload limit
        result[dateLabel] = {
          entries: Item.entries.map(lightEntry),
          source: 'archive',
          updatedAt: Item.updatedAt || null,
        };
      }
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data: result,
        days,
      },
    };
  } catch (err) {
    console.error('Archive range read error:', err);
    return {
      statusCode: 500,
      body: { success: false, error: 'Failed to read archive range' },
    };
  }
}

async function readNarrativeThread(threadId, days) {
  if (!TOPICS_TABLE) {
    return { statusCode: 500, body: { success: false, error: 'Topics table not configured' } };
  }

  try {
    const client = getDynamoClient();
    const now = new Date();
    const entries = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - i);
      const dateLabel = formatDateLabel(date);

      if (i === 0) {
        // Today: read from latest topics
        const { Item } = await client.send(new GetCommand({
          TableName: TOPICS_TABLE,
          Key: { id: TOPICS_ITEM_ID },
        }));
        // Label with the date `latest` really belongs to (not today); the archive row of that date
        // holds the same entries, so de-duplicate by topicId + date after the loop.
        const latestLabel = latestDayLabel(Item);
        const matched = latestLabel ? (Item?.topics || []).filter(t => t.threadId === threadId) : [];
        entries.push(...matched.map(t => ({ ...t, date: latestLabel, source: 'latest' })));
        // Today's archive row holds EVERY run of today (`latest` only the newest generation), so a story
        // from an earlier run today stays reachable until midnight (post-deploy fix, 2026-09-30).
        const { Item: todayRow } = await client.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: formatArchiveDateKey(date) } }));
        const fromToday = (todayRow?.entries || []).filter(e => e.threadId === threadId);
        entries.push(...fromToday.map(e => ({ ...e, date: dateLabel, source: 'archive' })));
      } else {
        // Past days: read from archive#YYYY-MM-DD
        const archiveKey = formatArchiveDateKey(date);
        const { Item } = await client.send(new GetCommand({
          TableName: TOPICS_TABLE,
          Key: { id: archiveKey },
        }));
        const matched = (Item?.entries || []).filter(e => e.threadId === threadId);
        entries.push(...matched.map(e => ({ ...e, date: dateLabel, source: 'archive' })));
      }
    }

    // Sort chronologically (oldest first — narrative flows forward in time)
    const unique = dedupeTopicDate(entries);
    unique.sort((a, b) => a.date.localeCompare(b.date));

    return {
      statusCode: 200,
      body: { success: true, threadId, data: unique },
    };
  } catch (err) {
    console.error('Narrative thread read error:', err);
    return { statusCode: 500, body: { success: false, error: 'Failed to read narrative thread' } };
  }
}

// ── RSS Feed Generator ───────────────────────────────────────────────────────

const SITE_URL = 'https://globalperspective.net';
const RSS_TITLE = 'Global Perspectives — AI-Powered World News Intelligence';
const RSS_DESCRIPTION = 'Daily AI-curated global news topics with summaries, predictions, and root cause analysis. Covering politics, economy, conflict, technology, and more across every region.';
const CATEGORY_LABEL = {
  politics: 'Politics', economy: 'Economy', military: 'Military',
  conflict: 'Conflict', disaster: 'Disaster', technology: 'Technology', health: 'Health',
  business: 'Business', society: 'Society', energy: 'Energy', climate: 'Climate', science: 'Science',
};

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc2822(isoDate) {
  try {
    return new Date(isoDate).toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

function buildItemDescription(entry) {
  const parts = [];
  const regions = (entry.regions || []).join(', ');
  if (regions) parts.push(`<strong>Regions:</strong> ${escapeXml(regions)}`);

  if (entry.ai?.summary) {
    const summary = entry.ai.summary
      .replace(/^#{1,4}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .substring(0, 600);
    parts.push(`<p>${escapeXml(summary)}</p>`);
  }

  const sources = (entry.sources || []).slice(0, 5);
  if (sources.length > 0) {
    const sourceList = sources
      .map(s => s.source || s.title || '')
      .filter(Boolean)
      .join(', ');
    if (sourceList) parts.push(`<strong>Sources:</strong> ${escapeXml(sourceList)}`);
  }

  return parts.join('<br/>') || escapeXml(entry.title);
}

async function generateRssFeed(event) {
  const client = getDynamoClient();

  // Read today-archive (has AI summaries) with fallback to latest
  let entries = [];
  let lastUpdated = new Date().toISOString();

  try {
    const { Item } = await client.send(new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { id: 'today-archive' },
    }));
    if (Item && Array.isArray(Item.entries) && Item.entries.length > 0) {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      entries = Item.entries.filter(e => new Date(e.archivedAt).getTime() > cutoff);
      lastUpdated = Item.updatedAt || lastUpdated;
    }
  } catch (err) {
    console.warn('RSS: today-archive read failed:', err.message);
  }

  // Fallback to latest if no archive entries
  if (entries.length === 0) {
    try {
      const { Item } = await client.send(new GetCommand({
        TableName: TOPICS_TABLE,
        Key: { id: TOPICS_ITEM_ID },
      }));
      if (Item && Array.isArray(Item.topics)) {
        entries = Item.topics.map(t => ({
          topicId: t.topicId || t.id,
          title: t.title,
          category: Array.isArray(t.categories) ? t.categories[0] || '' : (t.category || ''),
          regions: t.regions || [],
          sources: t.sources || [],
          archivedAt: Item.updatedAt || Item.activatedAt || new Date().toISOString(),
        }));
        lastUpdated = Item.updatedAt || Item.activatedAt || lastUpdated;
      }
    } catch (err) {
      console.warn('RSS: latest read failed:', err.message);
    }
  }

  // Build self URL from request context
  const domainName = event.requestContext?.domainName || '';
  const stage = event.requestContext?.stage || '';
  const selfUrl = domainName
    ? `https://${domainName}${stage ? '/' + stage : ''}?action=rss`
    : `${SITE_URL}/rss.xml`;

  const items = entries.map(entry => {
    const category = CATEGORY_LABEL[(entry.category || '').toLowerCase()] || 'World';
    const pubDate = toRfc2822(entry.archivedAt || lastUpdated);
    const guid = entry.topicId || entry.title;
    const description = buildItemDescription(entry);
    // Prefer the first source article URL; fall back to thread page, then site root
    const firstSourceUrl = Array.isArray(entry.sources) && entry.sources[0]?.url
      ? entry.sources[0].url
      : null;
    const link = firstSourceUrl
      || (entry.threadId ? absoluteUrl(storyHref(entry.threadId), SITE_URL) : SITE_URL);

    return `    <item>
      <title>${escapeXml(entry.title)}</title>
      <description><![CDATA[${description}]]></description>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(category)}</category>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(RSS_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(RSS_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${toRfc2822(lastUpdated)}</lastBuildDate>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/favicon.ico</url>
      <title>${escapeXml(RSS_TITLE)}</title>
      <link>${SITE_URL}</link>
    </image>
${items}
  </channel>
</rss>`;
}
