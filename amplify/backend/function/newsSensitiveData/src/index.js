'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { assembleDossier } = require('./dossier');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const TOPICS_ITEM_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';
const TOPICS_MAX_AGE_SECONDS = Number(process.env.TOPICS_CACHE_MAX_AGE_SECONDS || '9000');

const SUMMARIZE_PREDICT_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const PREDICTION_LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const PK_PREFIX = process.env.SUMMARY_PREDICT_PK_PREFIX || 'TOPIC#';
const SUMMARY_SK = process.env.SUMMARY_SORT_KEY || 'SUMMARY';
const PREDICTION_SK = process.env.PREDICTION_SORT_KEY || 'PREDICTION';
const SUMMARY_PREDICT_MAX_AGE_SECONDS = Number(process.env.SUMMARY_PREDICT_MAX_AGE_SECONDS || '5400');

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

const COUNTRY_NAMES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
  'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
  'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Bosnia', 'Botswana',
  'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic',
  'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Czechia',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia',
  'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada',
  'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary',
  'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein',
  'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
  'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Burma',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'North Korea', 'North Macedonia', 'Macedonia', 'Norway',
  'Oman',
  'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal',
  'Qatar',
  'Romania', 'Russia', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
  'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal',
  'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan',
  'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'East Timor',
  'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'UAE', 'United Kingdom', 'UK',
  'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland',
  'United States', 'USA', 'US', 'America', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen',
  'Zambia', 'Zimbabwe',
];

const COUNTRY_ALIAS_TO_CODE = new Map([
  ['united states', 'US'],
  ['usa', 'US'],
  ['us', 'US'],
  ['america', 'US'],
  ['united kingdom', 'GB'],
  ['uk', 'GB'],
  ['britain', 'GB'],
  ['uae', 'AE'],
  ['united arab emirates', 'AE'],
  ['south sudan', 'SS'],
  ['sudan', 'SD'],
]);

const COUNTRY_NAME_SET = new Set(
  COUNTRY_NAMES.map((name) => normalizeCountryKey(name)),
);

function normalizeCountryKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveCountryCode(address) {
  const trimmed = String(address || '').trim();
  if (/^[A-Z]{2}$/.test(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }
  const normalized = normalizeCountryKey(trimmed);
  return COUNTRY_ALIAS_TO_CODE.get(normalized) || null;
}

function isCountryQuery(address) {
  if (!address) return false;
  if (String(address).includes(',')) return false;
  const normalized = normalizeCountryKey(address);
  if (!normalized) return false;
  if (COUNTRY_NAME_SET.has(normalized)) return true;
  return COUNTRY_ALIAS_TO_CODE.has(normalized);
}

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

    if (action === 'summary' || action === 'prediction' || action === 'trace_cause' || action === 'research_briefing') {
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

    if (action === 'geocode') {
      const { address } = payload || {};
      if (!address) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing address for geocoding' }),
        };
      }

      const response = await geocodeWithMapbox(address);

      console.info('newsSensitiveData geocode response', {
        address,
        statusCode: response.statusCode,
        success: response.body?.success,
        error: response.body?.error,
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
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: rest }) };
      } catch (err) {
        console.error('daily_brief read error:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
      }
    }

    if (action === 'weekly_brief') {
      // Latest PUBLISHED weekly intelligence brief (human-approved via weekly/review.js).
      try {
        const { Items = [] } = await getDynamoClient().send(new ScanCommand({
          TableName: SUMMARIZE_PREDICT_TABLE,
          FilterExpression: 'SK = :sk AND #s = :pub',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':sk': 'WEEKLY_BRIEF', ':pub': 'published' },
        }));
        if (!Items.length) {
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
        }
        const latest = Items.sort((a, b) => String(b.weekOf).localeCompare(String(a.weekOf)))[0];
        const { PK, SK, ttl, ...rest } = latest;
        console.info('newsSensitiveData weekly_brief response', { weekOf: rest.weekOf });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: rest }) };
      } catch (err) {
        console.error('weekly_brief read error:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: null }) };
      }
    }

    if (action === 'weekly_markets') {
      // Latest PUBLISHED weekly markets report (human-approved via weekly-markets/review.js).
      // Honest null-when-none-published, exactly like the weekly_brief action above.
      try {
        const { Items = [] } = await getDynamoClient().send(new ScanCommand({
          TableName: SUMMARIZE_PREDICT_TABLE,
          FilterExpression: 'SK = :sk AND #s = :pub',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':sk': 'WEEKLY_MARKETS', ':pub': 'published' },
        }));
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
          const { Item } = await client.send(new GetCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            Key: { PK: `COUNTRY#${name}`, SK: 'COUNTRY_INTELLIGENCE' },
          }));
          if (Item) {
            const { PK, SK, ttl, ...rest } = Item;
            data[name] = rest;
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

    if (action === 'country_history') {
      const countryName = payload?.countryName || qs?.countryName;
      if (!countryName) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing countryName' }) };
      }
      const client = getDynamoClient();
      try {
        const [histOut, driftOut] = await Promise.all([
          client.send(new QueryCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
            ExpressionAttributeValues: { ':pk': `COUNTRY#${countryName}`, ':prefix': 'HISTORY#' },
            ScanIndexForward: false,
            Limit: 90,
          })),
          // Drift notes (living-analysis 1b: grounded "what changed & why"). Newest first, few.
          client.send(new QueryCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
            ExpressionAttributeValues: { ':pk': `COUNTRY#${countryName}`, ':prefix': 'DRIFT#' },
            ScanIndexForward: false,
            Limit: 10,
          })),
        ]);
        const snapshots = (histOut.Items || []).map(({ PK, SK, ttl, ...rest }) => rest);
        const driftNotes = (driftOut.Items || []).map(({ PK, SK, ttl, ...rest }) => rest);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, countryName, snapshots, driftNotes }) };
      } catch (err) {
        console.error('country_history error', err);
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
        const { Item } = await client.send(new GetCommand({
          TableName: SUMMARIZE_PREDICT_TABLE,
          Key: { PK: `SYSTEMS#${countryName}`, SK: 'SYSTEMS_ANALYSIS' },
        }));
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

    if (action === 'world_overview') {
      const client = getDynamoClient();
      try {
        // Paginate the scan — SYSTEMS# items are spread across the table's 1MB pages.
        const items = [];
        let ExclusiveStartKey;
        let pages = 0;
        do {
          const resp = await client.send(new ScanCommand({
            TableName: SUMMARIZE_PREDICT_TABLE,
            FilterExpression: 'begins_with(PK, :p) AND SK = :sk',
            ExpressionAttributeValues: { ':p': 'SYSTEMS#', ':sk': 'SYSTEMS_ANALYSIS' },
            ProjectionExpression: 'countryName, nodes, edges, backbone, generatedAt',
            ExclusiveStartKey,
          }));
          items.push(...(resp.Items || []));
          ExclusiveStartKey = resp.LastEvaluatedKey;
          pages += 1;
        } while (ExclusiveStartKey && pages < 25);

        const situations = items.map(it => {
          const nodes = Array.isArray(it.nodes) ? it.nodes : [];
          const dates = nodes.map(n => n.peakDate).filter(Boolean).sort();
          const cats = {};
          const dateCount = {};
          for (const n of nodes) {
            const c = n.category || 'other'; cats[c] = (cats[c] || 0) + 1;
            if (n.peakDate) dateCount[n.peakDate] = (dateCount[n.peakDate] || 0) + 1;
          }
          const topCategory = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
          const peak = Object.entries(dateCount).sort((a, b) => b[1] - a[1])[0]?.[0] || (dates[dates.length - 1] || null);
          return {
            country: it.countryName,
            threadCount: nodes.length,
            causalCount: Array.isArray(it.edges) ? it.edges.length : 0,
            backboneCount: Array.isArray(it.backbone) ? it.backbone.length : 0,
            topCategory,
            earliest: dates[0] || null,
            peak,
            latest: dates[dates.length - 1] || null,
            generatedAt: it.generatedAt || null,
          };
        }).filter(s => s.country && s.threadCount > 0);

        // Cross-country links: two countries connect if their graphs share SPECIFIC
        // actors. Exclude ambient actors (present in ≥40% of countries — Trump, G7,
        // big-power names) so it forms regional clusters, not a Trump/G7 hairball.
        const actorsByCountry = {};
        const disp = {};
        for (const it of items) {
          const set = new Set();
          for (const nd of (Array.isArray(it.nodes) ? it.nodes : [])) {
            for (const a of (Array.isArray(nd.actors) ? nd.actors : [])) {
              const raw = String(a).trim();
              const k = raw.toLowerCase();
              if (!k || k === String(it.countryName || '').toLowerCase()) continue;
              set.add(k);
              if (!disp[k]) disp[k] = raw;
            }
          }
          if (it.countryName) actorsByCountry[it.countryName] = set;
        }
        const df = {};
        Object.values(actorsByCountry).forEach(set => set.forEach(a => { df[a] = (df[a] || 0) + 1; }));
        const nCountries = Object.keys(actorsByCountry).length;
        const ambientThresh = Math.max(4, Math.ceil(0.4 * nCountries));
        const names = Object.keys(actorsByCountry);
        const links = [];
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            const A = actorsByCountry[names[i]];
            const B = actorsByCountry[names[j]];
            const shared = [];
            for (const a of A) if (B.has(a) && df[a] < ambientThresh) shared.push(a);
            if (shared.length >= 2) {
              shared.sort((x, y) => df[x] - df[y]); // most-specific first
              links.push({ from: names[i], to: names[j], weight: shared.length, sharedActors: shared.slice(0, 6).map(k => disp[k] || k) });
            }
          }
        }

        console.info('newsSensitiveData world_overview response', { situations: situations.length, links: links.length });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { situations, links } }) };
      } catch (err) {
        console.error('world_overview error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'World overview failed' }) };
      }
    }

    if (action === 'event_dossier' || action === 'dossier_analysis') {
      const countryName = payload?.countryName || qs?.countryName;
      const threadId = payload?.threadId || qs?.threadId;
      const hops = Math.max(1, Math.min(2, parseInt(payload?.hops || 1, 10)));
      if (!countryName || !threadId) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing countryName or threadId' }) };
      }
      try {
        const built = await buildEventDossier(countryName, threadId, hops);
        if (!built.dossier) {
          return { statusCode: built.statusCode || 500, headers, body: JSON.stringify({ success: false, error: built.error || 'Dossier build failed' }) };
        }
        const dossier = built.dossier;

        if (action === 'event_dossier') {
          console.info('newsSensitiveData event_dossier response', {
            countryName, threadId, hops, nodes: dossier.nodes.length, edges: dossier.edges.length, backbone: dossier.backbone.length,
          });
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: dossier }) };
        }

        // dossier_analysis: an AI reasons over the dossier under its own honesty contract.
        let analysis = null;
        let analysisError = null;
        try {
          analysis = await analyzeDossierWithLLM(dossier);
        } catch (err) {
          console.error('dossier_analysis LLM error', err.message);
          analysisError = 'analysis_unavailable';
        }
        console.info('newsSensitiveData dossier_analysis response', {
          countryName, threadId, hops, analyzed: !!analysis, err: analysisError,
        });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { dossier, analysis, analysisError } }) };
      } catch (err) {
        console.error('event_dossier/dossier_analysis error', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Dossier build failed' }) };
      }
    }

    if (action === 'pair_analysis') {
      const pairSlug = qs.pair || payload?.pair;
      if (!pairSlug) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing pair slug' }) };
      }
      const client = getDynamoClient();
      try {
        const { Item } = await client.send(new GetCommand({
          TableName: SUMMARIZE_PREDICT_TABLE,
          Key: { PK: `PAIR#${pairSlug}`, SK: 'PAIR_ANALYSIS' },
        }));
        if (!Item) {
          return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Pair analysis not found' }) };
        }
        const { PK, SK, ttl, ...rest } = Item;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: rest }) };
      } catch (e) {
        console.error('pair_analysis error', e);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Internal error' }) };
      }
    }

    if (action === 'pair_analyses_list') {
      const client = getDynamoClient();
      try {
        const { Items = [] } = await client.send(new ScanCommand({
          TableName: SUMMARIZE_PREDICT_TABLE,
          FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk',
          ExpressionAttributeValues: { ':prefix': 'PAIR#', ':sk': 'PAIR_ANALYSIS' },
          ProjectionExpression: 'PK, pairTitle, currentState, dataQuality, countries, generatedAt',
        }));
        const qualityOrder = { rich: 0, moderate: 1, sparse: 2, thin: 3 };
        const list = Items
          .map(item => {
            const slug = item.PK.replace('PAIR#', '');
            const leadSentence = typeof item.currentState === 'string'
              ? item.currentState.substring(0, 200)
              : '';
            return { slug, pairTitle: item.pairTitle, leadSentence, dataQuality: item.dataQuality, countries: item.countries, generatedAt: item.generatedAt };
          })
          .sort((a, b) => {
            const qa = qualityOrder[a.dataQuality] ?? 4;
            const qb = qualityOrder[b.dataQuality] ?? 4;
            if (qa !== qb) return qa - qb;
            return (b.generatedAt || '').localeCompare(a.generatedAt || '');
          });
        console.info('pair_analyses_list', { count: list.length });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: list }) };
      } catch (e) {
        console.error('pair_analyses_list error', e);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Internal error' }) };
      }
    }

    if (action === 'prediction_track_record') {
      const client = getDynamoClient();
      try {
        const items = [];
        let ExclusiveStartKey;
        do {
          const res = await client.send(new ScanCommand({
            TableName: PREDICTION_LOG_TABLE,
            ProjectionExpression: 'title, category, generatedAt, scenarios',
            ExclusiveStartKey,
          }));
          items.push(...(res.Items || []));
          ExclusiveStartKey = res.LastEvaluatedKey;
        } while (ExclusiveStartKey);

        // A "resolved" trigger is one a human confirmed as fired/not_fired
        // (unclear is excluded from scoring). Score each against its parent
        // scenario's probability midpoint: Brier = mean((p - outcome)^2).
        const buckets = [0, 0.2, 0.4, 0.6, 0.8, 1.0001];
        const cal = buckets.slice(0, -1).map((lo, i) => ({ lo, hi: buckets[i + 1], n: 0, predicted: 0, fired: 0 }));
        const resolved = [];
        let totalTriggers = 0;
        let pendingCount = 0;
        let brierSum = 0;
        let scored = 0;
        let firedCount = 0;

        for (const it of items) {
          for (const s of it.scenarios || []) {
            const p = typeof s.probability === 'number' ? s.probability : null;
            for (const t of s.triggers || []) {
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
              resolved.push({
                title: it.title,
                category: it.category || null,
                scenario: s.label,
                probability: p,
                trigger: t.text,
                deadline: t.deadline,
                verdict: v,
                citation: t.proposal?.citation || null,
                confirmedAt: t.confirmedAt || null,
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
          totalPredictionsLogged: items.length,
          totalDatedTriggers: totalTriggers,
          resolvedTriggers: scored,
          pendingTriggers: pendingCount,
          firedTriggers: firedCount,
          brierScore: scored ? Math.round((brierSum / scored) * 1000) / 1000 : null,
          calibration,
          recent: resolved.slice(0, 30),
        };
        console.info('prediction_track_record', { logged: data.totalPredictionsLogged, resolved: data.resolvedTriggers });
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
           : action === 'research_briefing' ? 'RESEARCH_BRIEFING'
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

    // Day 0 = today: serve from "latest"
    const todayLabel = formatDateLabel(now);
    const { Item: latestItem } = await client.send(new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { id: TOPICS_ITEM_ID },
    }));
    if (latestItem && Array.isArray(latestItem.topics)) {
      result[todayLabel] = {
        entries: latestItem.topics.map(t => ({
          topicId: t.topicId || t.id,
          title: t.title,
          category: Array.isArray(t.categories) ? t.categories[0] || '' : (t.category || ''),
          regions: t.regions || [],
          sources: t.sources || [],
          threadId: t.threadId || null,
        })),
        source: 'latest',
        updatedAt: latestItem.updatedAt || latestItem.activatedAt || null,
      };
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
          entries: Item.entries.map(e => ({
            topicId: e.topicId || e.id,
            title: e.title,
            category: Array.isArray(e.categories) ? e.categories[0] || '' : (e.category || ''),
            regions: e.regions || [],
            sources: e.sources || [],
            threadId: e.threadId || null,
          })),
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

// Build the event dossier for {countryName, threadId, hops}: fetch the stored
// systems graph, assemble the k-hop subgraph, attach per-node genesis (bounded).
// Shared by the event_dossier + dossier_analysis actions.
async function buildEventDossier(countryName, threadId, hops) {
  const client = getDynamoClient();
  const { Item } = await client.send(new GetCommand({
    TableName: SUMMARIZE_PREDICT_TABLE,
    Key: { PK: `SYSTEMS#${countryName}`, SK: 'SYSTEMS_ANALYSIS' },
  }));
  if (!Item) return { statusCode: 404, error: 'Systems analysis not found for this country' };
  const { PK, SK, ttl, ...graph } = Item;

  const base = assembleDossier(graph, threadId, { countryName, hops });
  if (!base) return { statusCode: 404, error: 'Focal thread not found in this graph' };

  const ids = base.nodes.map(n => n.id).slice(0, 10); // bound genesis reads
  const genesisByThread = {};
  await Promise.all(ids.map(async (id) => {
    try {
      const resp = await readNarrativeThread(id, ENTERPRISE_MAX_DAYS);
      const entries = resp?.body?.data;
      if (Array.isArray(entries) && entries.length) {
        genesisByThread[id] = entries.slice(0, 12).map(e => ({
          date: e.date || null,
          event: e.title || e.summary || e.headline || null,
          sources: e.sourceCount ?? (Array.isArray(e.sources) ? e.sources.length : (Array.isArray(e.sourceUrls) ? e.sourceUrls.length : null)),
        }));
      }
    } catch { /* genesis is best-effort */ }
  }));

  const dossier = assembleDossier(graph, threadId, { countryName, hops, genesisByThread });
  return { statusCode: 200, dossier };
}

// Reason over a dossier with the honesty contract (DeepSeek — public, ungated,
// bounded by token cap; same engine as newsAnalyze/newsSystemsAnalysis).
const DOSSIER_LLM_URL = process.env.GROK_API_URL || 'https://api.deepseek.com/chat/completions';
const DOSSIER_LLM_MODEL = process.env.GROK_MODEL || 'deepseek-chat';
async function analyzeDossierWithLLM(dossier) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('LLM key not configured');
  const contract = dossier.reasoning_contract?.instructions || '';
  const system = 'You are a geopolitical intelligence analyst. Reason ONLY over the event-dossier JSON provided. '
    + `Grounding rules: ${contract} Cite entry titles for factual claims; label interpretation as "💭 judgment"; never invent a connection not in the dossier.`;
  const user = `Here is an event dossier (JSON) — the neighborhood of a focal news event in a causal web, with provenance tags. Write a concise analyst read (max ~320 words) in three sections:
1. **What formed this** — from the focal node's genesis timeline.
2. **What it's connected to** — name the shared-actor backbone links (factual) and the causal links (model judgment), stating the mechanism for each causal link.
3. **What it may trigger next + one counter-scenario** — labeled "💭 judgment".
Treat any edge with flags.temporal_anomaly=true as CO-MOVEMENT, not proven causation.

DOSSIER:
${JSON.stringify(dossier)}`;

  const res = await fetch(DOSSIER_LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: DOSSIER_LLM_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 800,
      temperature: 0.4,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`LLM ${res.status}: ${JSON.stringify(data).slice(0, 180)}`);
  const text = (data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('empty LLM response');
  return text;
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
        const matched = (Item?.topics || []).filter(t => t.threadId === threadId);
        entries.push(...matched.map(t => ({ ...t, date: dateLabel, source: 'latest' })));
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
    entries.sort((a, b) => a.date.localeCompare(b.date));

    return {
      statusCode: 200,
      body: { success: true, threadId, data: entries },
    };
  } catch (err) {
    console.error('Narrative thread read error:', err);
    return { statusCode: 500, body: { success: false, error: 'Failed to read narrative thread' } };
  }
}

// Mapbox geocoding helper - NEW FUNCTION
async function geocodeWithMapbox(address) {
  const MAPBOX_KEY = process.env.MAPBOX_GEOCODING_KEY;

  if (!MAPBOX_KEY) {
    console.error('Mapbox API key not configured');
    return {
      statusCode: 502,
      body: { success: false, error: 'Mapbox API key not configured' },
    };
  }

  try {
    // Build Mapbox geocoding query
    const query = encodeURIComponent(address);
    const countryMatch = isCountryQuery(address);
    const countryCode = countryMatch ? resolveCountryCode(address) : null;
    const urlParams = new URLSearchParams({
      limit: '1',
      access_token: MAPBOX_KEY,
    });
    if (countryMatch) {
      urlParams.set('types', 'country');
      if (countryCode) {
        urlParams.set('country', countryCode.toLowerCase());
      }
      console.info('Mapbox geocoding: country-only lookup enforced', {
        address,
        countryCode,
      });
    }
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?${urlParams.toString()}`;

    console.info(`Mapbox geocoding request for: ${address}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Mapbox HTTP error (${response.status}):`, errorText);
      return {
        statusCode: response.status,
        body: { success: false, error: `Mapbox HTTP ${response.status}: ${errorText}` },
      };
    }

    const data = await response.json();

    if (!data || !data.features || data.features.length === 0) {
      console.warn('No results found for address:', address);
      return {
        statusCode: 404,
        body: { success: false, error: 'Location not found' },
      };
    }

    const feature = data.features[0];
    const coordinates = feature.center; // Mapbox returns [lng, lat]

    if (!coordinates || coordinates.length < 2) {
      console.error('Invalid coordinates in Mapbox response:', feature);
      return {
        statusCode: 502,
        body: { success: false, error: 'Invalid coordinates received' },
      };
    }

    // IMPORTANT: Mapbox returns coordinates in [lng, lat] order
    const [lng, lat] = coordinates;

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      console.error('Non-finite coordinates:', { lat, lng });
      return {
        statusCode: 502,
        body: { success: false, error: 'Invalid coordinate values' },
      };
    }

    // Extract additional location context from Mapbox response
    const context = feature.context || [];
    let country = 'UNKNOWN';
    let countryName = null;
    let placeName = feature.text || address;
    let regionName = null;

    context.forEach((item) => {
      if (item.id?.startsWith('country')) {
        country = item.short_code?.toUpperCase() || 'UNKNOWN';
        countryName = item.text;
      } else if (item.id?.startsWith('region')) {
        regionName = item.text;
      } else if (item.id?.startsWith('place')) {
        placeName = item.text;
      }
    });

    const result = {
      lat: latNum,
      lng: lngNum,
      country: country,
      countryName,
      cityName: placeName !== address ? placeName : null,
      provinceName: regionName,
      displayName: feature.place_name || `${placeName}, ${countryName || country}`,
    };

    console.info(`Mapbox geocoding success: ${address} -> ${country} (${latNum},${lngNum})`);

    return {
      statusCode: 200,
      body: { success: true, data: result },
    };

  } catch (error) {
    console.error('Mapbox geocoding error:', error);
    return {
      statusCode: 502,
      body: { success: false, error: error?.message || 'Geocoding failed' },
    };
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
      || (entry.threadId ? `${SITE_URL}/weekly/thread/${encodeURIComponent(entry.threadId)}` : SITE_URL);

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
