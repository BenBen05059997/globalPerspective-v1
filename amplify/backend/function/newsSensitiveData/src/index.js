'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const TOPICS_ITEM_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';
const TOPICS_MAX_AGE_SECONDS = Number(process.env.TOPICS_CACHE_MAX_AGE_SECONDS || '9000');

const SUMMARIZE_PREDICT_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const PK_PREFIX = process.env.SUMMARY_PREDICT_PK_PREFIX || 'TOPIC#';
const SUMMARY_SK = process.env.SUMMARY_SORT_KEY || 'SUMMARY';
const PREDICTION_SK = process.env.PREDICTION_SORT_KEY || 'PREDICTION';
const SUMMARY_PREDICT_MAX_AGE_SECONDS = Number(process.env.SUMMARY_PREDICT_MAX_AGE_SECONDS || '5400');

const MEMBER_API_KEYS = new Set(
  (process.env.MEMBER_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean),
);
const ENTERPRISE_API_KEYS = new Set(
  (process.env.ENTERPRISE_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean),
);
const MEMBER_MAX_DAYS = 7;
const ENTERPRISE_MAX_DAYS = 30;

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
  'http://127.0.0.1:5173',
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

  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
  const action = body?.action;
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

    if (action === 'archive_range') {
      const apiKey = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key'] || '';
      const tier = resolveTier(apiKey);
      if (!tier) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Valid API key required for archive_range' }),
        };
      }
      const maxDays = tier === 'enterprise' ? ENTERPRISE_MAX_DAYS : MEMBER_MAX_DAYS;
      const requestedDays = Math.max(1, Math.min(maxDays, parseInt(payload?.days || maxDays, 10)));

      const response = await readArchiveRange(requestedDays);
      console.info('newsSensitiveData archive_range response', {
        tier,
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
      console.warn('newsSensitiveData topics cache stale', {
        table: TOPICS_TABLE,
        itemId: TOPICS_ITEM_ID,
        updatedAt: Item.updatedAt,
        maxAgeSeconds: TOPICS_MAX_AGE_SECONDS,
      });
      return {
        statusCode: 503,
        body: { success: false, error: 'Topics cache stale', data: Item },
      };
    }

    console.info('newsSensitiveData topics cache hit', {
      table: TOPICS_TABLE,
      itemId: TOPICS_ITEM_ID,
      updatedAt: Item.updatedAt,
    });

    return {
      statusCode: 200,
      body: { success: true, cached: true, data: Item },
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

function resolveTier(apiKey) {
  if (!apiKey) return null;
  if (ENTERPRISE_API_KEYS.has(apiKey)) return 'enterprise';
  if (MEMBER_API_KEYS.has(apiKey)) return 'member';
  return null;
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
        result[dateLabel] = {
          entries: Item.entries,
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
