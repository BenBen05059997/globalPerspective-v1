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

// Parse age string (e.g., "2 hours ago", "1 day ago") and return hours
function parseAgeToHours(ageStr) {
  if (!ageStr || typeof ageStr !== 'string') return null;
  const lower = ageStr.toLowerCase().trim();

  const hourMatch = lower.match(/(\d+)\s*hour/);
  if (hourMatch) return parseInt(hourMatch[1], 10);

  const dayMatch = lower.match(/(\d+)\s*day/);
  if (dayMatch) return parseInt(dayMatch[1], 10) * 24;

  const minMatch = lower.match(/(\d+)\s*min/);
  if (minMatch) return parseInt(minMatch[1], 10) / 60;

  return null;
}

// Filter out articles that are too old or from blocked domains
function shouldFilterArticle(article) {
  const BLOCKED_DOMAINS = ['archive.is', 'archive.ph', 'web.archive.org', 'archive.org'];
  const MAX_AGE_HOURS = 48; // 2 days

  // Check domain blacklist
  const url = article.url || '';
  for (const domain of BLOCKED_DOMAINS) {
    if (url.includes(domain)) {
      console.warn(`FILTERED: Blocked archive domain: ${url}`);
      return true;
    }
  }

  // Check age
  const ageHours = parseAgeToHours(article.age);
  if (ageHours !== null && ageHours > MAX_AGE_HOURS) {
    console.warn(`FILTERED: Article too old (${article.age}): ${article.title?.substring(0, 60)}`);
    return true;
  }

  return false;
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
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];

      // Add delay between queries to avoid rate limiting (429)
      // 2000ms ensures all 10 regional queries succeed reliably
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

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
        } else {
          console.warn(`Brave Search query "${query.substring(0, 30)}..." failed with status ${response.status}`);
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

    // Filter out old articles and blocked domains
    const filteredArticles = uniqueArticles.filter(article => !shouldFilterArticle(article));
    const filteredCount = uniqueArticles.length - filteredArticles.length;
    if (filteredCount > 0) {
      console.log(`FILTER: Removed ${filteredCount} articles (old or blocked domains). ${filteredArticles.length} remain.`);
    }

    // DEBUG: Log sample of fetched articles
    console.log('DEBUG: Sample Brave articles:', JSON.stringify(filteredArticles.slice(0, 5).map(a => ({
      title: a.title?.substring(0, 60),
      source: a.meta_url?.hostname || a.source,
      age: a.age
    })), null, 2));

    return filteredArticles.map((article) => ({
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
        'Below are the ONLY articles available. You must work exclusively with these.',
        '',
        '=== START OF AVAILABLE ARTICLES ===',
        articlesText,
        '=== END OF AVAILABLE ARTICLES ===',
        '',
        `Task: Create up to ${limit} news topics by grouping the articles above.`,
        'Return only a JSON array with no commentary.',
        '',
        '⚠️ CRITICAL RULES - VIOLATION WILL CAUSE SYSTEM FAILURE:',
        '1. **ONLY USE ARTICLES FROM ABOVE**: Every source in your response MUST be copied EXACTLY from the list above.',
        '2. **DO NOT INVENT**: Do NOT create, fabricate, or hallucinate any URLs, titles, or sources.',
        '3. **DO NOT ADD EXTERNAL KNOWLEDGE**: Only use information from the provided articles.',
        '4. **COPY URLs EXACTLY**: Source URLs must match exactly - do not modify or guess URLs.',
        '5. **SKIP MISSING REGIONS**: If a region has no articles above, do NOT create a topic for it.',
        '',
        'SELECTION PRIORITIES (only from available articles):',
        '- Prioritize major "Conflict", "Disaster", or "Economic Crisis" events',
        '- Try to cover different regions IF articles exist for them',
        '- Group related articles into the same topic',
        '',
        'Each item must be an object with fields:',
        '- title: string (concise topic title summarizing the grouped articles)',
        '- category: string (politics, economy, technology, environment, security, health, culture)',
        '- search_keywords: array of 3-6 short keywords from the articles',
        '- regions: array of country names mentioned in the articles (use specific countries, not regions)',
        '- sources: array copied from articles above with {title, url, source, age, snippet}',
        '',
        'REMEMBER: Only use sources that appear in the article list above. Do not invent any sources.',
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

    console.log('DEBUG: Sending prompt to Gemini, article count:', braveArticles?.length || 0);

    const result = await model.generateContent(prompt);
    const text =
      (typeof result?.response?.text === 'function' ? result?.response?.text() : null) ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';

    // DEBUG: Log Gemini raw response (first 1000 chars)
    console.log('DEBUG: Gemini response preview:', text?.substring(0, 1000));

    if (!text) {
      const msg = 'Empty response from Gemini model';
      if (isScheduledEvent(event)) {
        console.error(msg);
        return { status: 'error', error: msg };
      }
      return { statusCode: 502, headers, body: JSON.stringify({ error: msg }) };
    }

    const topics = extractJson(text);

    // SOURCE VALIDATION: Filter out hallucinated URLs not in original Brave results
    const validUrls = new Set(braveArticles ? braveArticles.map(a => a.url) : []);
    let totalSourcesBefore = 0;
    let totalSourcesAfter = 0;

    const normalized = Array.isArray(topics)
      ? topics.map((t, idx) => {
        const title = String(t?.title || '').trim();
        const topicId = createStableTopicId(title, idx);
        const rawSources = Array.isArray(t?.sources) ? t.sources : [];
        totalSourcesBefore += rawSources.length;

        // Only keep sources whose URLs exist in the original Brave results
        const validatedSources = rawSources.filter(s => {
          if (!s?.url) return false;
          const isValid = validUrls.has(s.url);
          if (!isValid) {
            console.warn(`HALLUCINATION DETECTED: Filtering out fabricated URL: ${s.url}`);
          }
          return isValid;
        });
        totalSourcesAfter += validatedSources.length;

        return {
          id: topicId,
          topicId,
          title,
          category: String(t?.category || '').trim(),
          search_keywords: Array.isArray(t?.search_keywords) ? t.search_keywords.map((k) => String(k)) : [],
          regions: Array.isArray(t?.regions) ? t.regions.map((r) => String(r)) : [],
          sources: validatedSources,
        };
      })
      : [];

    // Log source validation results
    const filteredOut = totalSourcesBefore - totalSourcesAfter;
    if (filteredOut > 0) {
      console.warn(`SOURCE VALIDATION: Filtered out ${filteredOut} hallucinated sources (${totalSourcesBefore} -> ${totalSourcesAfter})`);
    } else {
      console.log(`SOURCE VALIDATION: All ${totalSourcesAfter} sources validated successfully`);
    }

    // DEBUG: Log final topics with source counts
    console.log('DEBUG: Final topics summary:', JSON.stringify(normalized.map(t => ({
      title: t.title?.substring(0, 50),
      category: t.category,
      regions: t.regions,
      sourceCount: t.sources?.length || 0,
      sampleSource: t.sources?.[0]?.title?.substring(0, 40) || 'NO SOURCES'
    })), null, 2));

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
