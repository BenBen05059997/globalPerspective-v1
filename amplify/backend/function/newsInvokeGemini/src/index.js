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
const DEFAULT_LIMIT = 10;
const CACHE_TABLE = process.env.TOPICS_DDB_TABLE; // e.g., GeminiTopicsCache
const CACHE_ID = process.env.TOPICS_CACHE_ITEM_ID || 'staging';
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const BRAVE_NEWS_ENDPOINT = 'https://api.search.brave.com/res/v1/news/search';

function createStableTopicId(rawTitle, index) {
  const base =
    typeof rawTitle === 'string' && rawTitle.trim().length
      ? rawTitle.trim()
      : `Topic ${index + 1}`;
  const normalized = base.replace(/\s+/g, ' ').trim();
  return `${normalized}-${index}`;
}

// Try to parse JSON even if the model adds extra text or code fences
function extractJson(text) {
  try { return JSON.parse(text); } catch (_) { }
  const fenceMatch = text.match(/```json([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try { return JSON.parse(inner); } catch (_) { }
  }
  const startArr = text.indexOf('[');
  const endArr = text.lastIndexOf(']');
  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    const arrStr = text.slice(startArr, endArr + 1);
    try { return JSON.parse(arrStr); } catch (_) { }
  }
  const startObj = text.indexOf('{');
  const endObj = text.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
    const objStr = text.slice(startObj, endObj + 1);
    try { return JSON.parse(objStr); } catch (_) { }
  }
  throw new Error('Failed to parse JSON from model output');
}

async function fetchBraveNews(limit) {
  if (!BRAVE_API_KEY) {
    console.warn('BRAVE_SEARCH_API_KEY not configured, skipping Brave search');
    return null;
  }

  try {
    // Multi-query strategy for global news diversity (industry best practice)
    // Instead of one generic query, use multiple targeted queries to get impactful stories worldwide
    const queries = [
      'breaking news global (conflict OR war OR politics OR economy OR disaster)',
      'breaking news North America USA Canada Mexico (conflict OR war OR politics OR economy OR disaster)',
      'breaking news South America Brazil Argentina (conflict OR war OR politics OR economy OR disaster)',
      'breaking news Western Europe UK France Germany (conflict OR war OR politics OR economy OR disaster)',
      'breaking news Eastern Europe Russia Ukraine (conflict OR war OR politics OR economy OR disaster)',
      'breaking news East Asia China Japan Korea (conflict OR war OR politics OR economy OR disaster)',
      'breaking news Southeast Asia (conflict OR war OR politics OR economy OR disaster)',
      'breaking news Middle East (conflict OR war OR politics OR economy OR disaster)',
      'breaking news Africa (conflict OR war OR politics OR economy OR disaster)',
      'breaking news Oceania (conflict OR war OR politics OR economy OR disaster)',
    ];

    const articlesPerQuery = Math.max(5, Math.ceil((limit * 4) / queries.length));
    const allArticles = [];

    // Fetch from each query to ensure topic diversity
    for (const query of queries) {
      try {
        const url = `${BRAVE_NEWS_ENDPOINT}?q=${encodeURIComponent(query)}&count=${articlesPerQuery}&freshness=pd&search_lang=en`;

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': BRAVE_API_KEY,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const articles = data?.results || [];
          allArticles.push(...articles);
          console.log(`Brave Search query "${query.substring(0, 30)}..." returned ${articles.length} articles`);
        }
      } catch (queryError) {
        console.warn(`Failed to fetch for query "${query.substring(0, 30)}...":`, queryError.message);
        // Continue with other queries even if one fails
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    const uniqueArticles = allArticles.filter(article => {
      if (!article.url || seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    });

    console.log(`Brave Search returned ${uniqueArticles.length} unique articles from ${queries.length} queries`);

    return uniqueArticles.map((article) => ({
      title: article.title || '',
      url: article.url || '',
      description: article.description || '',
      age: article.age || '',
      source: article.meta_url?.hostname || article.source || '',
    }));
  } catch (error) {
    console.error('Brave Search API error:', error);
    return null;
  }
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

  const now = new Date();
  const updatedAt = now.toISOString();
  const generationId = `gen-${Date.now()}`;
  const generatedDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const generatedYear = now.getFullYear();

  const item = {
    id: CACHE_ID,
    topics,
    model,
    limit,
    updatedAt,
    generatedDate,
    generatedYear,
    generationId,
    status: 'pending',
  };

  try {
    console.log(`Attempting DynamoDB cache write: table=${CACHE_TABLE}, id=${CACHE_ID}, generationId=${generationId}`);
    if (usingAwsSdkV3) {
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      await ddbDoc.send(new PutCommand({ TableName: CACHE_TABLE, Item: item }));
    } else {
      await ddbDoc.put({ TableName: CACHE_TABLE, Item: item }).promise();
    }
    console.log(`DynamoDB cache write OK: id=${CACHE_ID}, generationId=${generationId}`);
    return { cached: true, updatedAt, generationId };
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

    // Fetch real news from Brave Search API
    const braveArticles = await fetchBraveNews(limit);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    let prompt;
    if (braveArticles && braveArticles.length > 0) {
      // Gemini analyzes real news articles from Brave
      const articlesText = braveArticles
        .map((a, i) => `${i + 1}. ${a.title}\n   Source: ${a.source}\n   Published: ${a.age}\n   URL: ${a.url}\n   ${a.description}`)
        .join('\n\n');

      prompt = [
        'You are analyzing real news articles from today.',
        'Below are actual news articles with verified sources and URLs.',
        '',
        articlesText,
        '',
        `Task: Select exactly ${limit} distinct global news topics.`,
        'Return only a JSON array with no commentary.',
        '',
        'CRITICAL SELECTION PRIORITIES:',
        '1. **IMPACT FIRST**: Prioritize major "Conflict", "Disaster", or "Economic Crisis" events over minor political updates.',
        '2. **REGIONAL QUOTAS**: You MUST attempt to select at least one significant topic from EACH of these 10 regions if available:',
        '   - **North America**',
        '   - **South America**',
        '   - **Western Europe**',
        '   - **Eastern Europe** (incl. Russia/Ukraine)',
        '   - **East Asia**',
        '   - **Southeast Asia**',
        '   - **Middle East**',
        '   - **Africa**',
        '   - **Oceania**',
        '   - **Global Headline** (The single biggest story)',
        '',
        'If a region has no major breaking news, select its most significant developing story.',
        '',
        'Each item must be an object with fields:',
        '- title: string (concise topic title summarizing related articles)',
        '- category: string (e.g., politics, economy, technology, environment, security, health, culture)',
        '- search_keywords: array of 3-6 short keywords',
        '- regions: array of specific country names (NEVER use regional terms like "Middle East", "Asia", "Europe". Always use actual country names like "Israel", "Iran", "China", "Japan", "France", "Germany")',
        '- sources: array of objects with {title, url, source, age, snippet} from the articles above.',
        '',
        'Group related articles into the same topic. Include all relevant source articles for each topic.',
      ].join('\n');
    } else {
      // Fallback to original Gemini-only approach if Brave fails
      console.warn('No Brave articles available, falling back to Gemini-only mode');
      prompt = [
        'You are an AI assistant discovering trending global news topics for today.',
        'Return only a JSON array with no commentary.',
        'Each item must be an object with fields:',
        '- title: string (concise topic title)',
        '- category: string (e.g., politics, economy, technology, environment, security, health, culture)',
        '- search_keywords: array of 3-6 short keywords users would search',
        '- regions: array of affected regions or countries (strings)',
        `Limit to ${limit} items.`,
      ].join('\n');
    }

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
      ? topics.map((t, idx) => {
        const title = String(t?.title || '').trim();
        const topicId = createStableTopicId(title, idx);
        return {
          id: topicId,
          topicId,
          title,
          category: String(t?.category || '').trim(),
          search_keywords: Array.isArray(t?.search_keywords) ? t.search_keywords.map((k) => String(k)) : [],
          regions: Array.isArray(t?.regions) ? t.regions.map((r) => String(r)) : [],
          sources: Array.isArray(t?.sources) ? t.sources : [],  // NEW: Save Brave article sources
        };
      })
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
