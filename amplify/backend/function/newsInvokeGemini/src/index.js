'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Optional DynamoDB: prefer AWS SDK v3; fallback to v2 if available
let ddbDoc = null;
let usingAwsSdkV3 = false;
try {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
  const ddb = new DynamoDBClient({});
  ddbDoc = DynamoDBDocumentClient.from(ddb);
  usingAwsSdkV3 = true;
} catch (_) {
  try {
    const AWS = require('aws-sdk');
    ddbDoc = new AWS.DynamoDB.DocumentClient();
  } catch (_ignored) {
    // No AWS SDK available; writes will be skipped gracefully
  }
}

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DEFAULT_LIMIT = 5;
const CACHE_TABLE = process.env.TOPICS_DDB_TABLE; // e.g., GeminiTopicsCache
const CACHE_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';

// Try to parse JSON even if the model adds extra text or code fences
function extractJson(text) {
  try { return JSON.parse(text); } catch (_) {}
  const fenceMatch = text.match(/```json([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try { return JSON.parse(inner); } catch (_) {}
  }
  const startArr = text.indexOf('[');
  const endArr = text.lastIndexOf(']');
  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    const arrStr = text.slice(startArr, endArr + 1);
    try { return JSON.parse(arrStr); } catch (_) {}
  }
  const startObj = text.indexOf('{');
  const endObj = text.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
    const objStr = text.slice(startObj, endObj + 1);
    try { return JSON.parse(objStr); } catch (_) {}
  }
  throw new Error('Failed to parse JSON from model output');
}

function isScheduledEvent(event) {
  return (
    event?.source === 'aws.events' ||
    event?.detailType === 'Scheduled Event' ||
    event?.['detail-type'] === 'Scheduled Event'
  );
}

async function writeCache({ topics, model, limit }) {
  if (!ddbDoc || !CACHE_TABLE) {
    const reason = !ddbDoc ? 'No DynamoDB client' : 'No TOPICS_DDB_TABLE env';
    console.log(`Skipping cache write: ${reason}`);
    return { cached: false, reason };
  }

  const updatedAt = new Date().toISOString();
  const item = { id: CACHE_ID, topics, model, limit, updatedAt };

  try {
    console.log(`Attempting DynamoDB cache write: table=${CACHE_TABLE}, id=${CACHE_ID}`);
    if (usingAwsSdkV3) {
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      await ddbDoc.send(new PutCommand({ TableName: CACHE_TABLE, Item: item }));
    } else {
      await ddbDoc.put({ TableName: CACHE_TABLE, Item: item }).promise();
    }
    console.log(`DynamoDB cache write OK: id=${CACHE_ID}, updatedAt=${updatedAt}`);
    return { cached: true, updatedAt };
  } catch (e) {
    console.error('DynamoDB put error:', e);
    return { cached: false, reason: e.message };
  }
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      const msg = 'Missing GOOGLE_GEMINI_API_KEY environment variable';
      if (isScheduledEvent(event)) {
        console.error(msg);
        return { status: 'error', error: msg };
      }
      return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
    }

    const qs = event?.queryStringParameters || {};
    const configuredLimit = parseInt(process.env.TOPICS_LIMIT || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT;
    const limit = isScheduledEvent(event)
      ? Math.max(1, Math.min(20, configuredLimit))
      : Math.max(1, Math.min(20, parseInt(qs.limit || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT));

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = [
      'You are an AI assistant discovering trending global news topics for today.',
      'Return only a JSON array with no commentary.',
      'Each item must be an object with fields:',
      '- title: string (concise topic title)',
      '- category: string (e.g., politics, economy, technology, environment, security, health, culture)',
      '- search_keywords: array of 3-6 short keywords users would search',
      '- regions: array of affected regions or countries (strings)',
      `Limit to ${limit} items.`,
    ].join('\n');

    const result = await model.generateContent(prompt);
    const text =
      (typeof result?.response?.text === 'function' ? result?.response?.text() : null) ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';

    if (!text) {
      const msg = 'Empty response from Gemini model';
      if (isScheduledEvent(event)) {
        console.error(msg);
        return { status: 'error', error: msg };
      }
      return { statusCode: 502, headers, body: JSON.stringify({ error: msg }) };
    }

    const topics = extractJson(text);

    const normalized = Array.isArray(topics)
      ? topics.map((t) => ({
          title: String(t?.title || '').trim(),
          category: String(t?.category || '').trim(),
          search_keywords: Array.isArray(t?.search_keywords) ? t.search_keywords.map((k) => String(k)) : [],
          regions: Array.isArray(t?.regions) ? t.regions.map((r) => String(r)) : [],
        }))
      : [];

    const cacheResult = await writeCache({ topics: normalized, model: MODEL_NAME, limit });

    if (isScheduledEvent(event)) {
      return {
        status: 'ok',
        count: normalized.length,
        cached: cacheResult.cached,
        updatedAt: cacheResult.updatedAt || null,
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        topics: normalized,
        ai_powered: true,
        model: MODEL_NAME,
        limit,
        cached: cacheResult.cached,
        updatedAt: cacheResult.updatedAt || null,
      }),
    };
  } catch (err) {
    console.error('Gemini Lambda error:', err);
    if (isScheduledEvent(event)) {
      return { status: 'error', error: err?.message || 'Unexpected error' };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: err?.message || 'Unexpected error' }) };
  }
};