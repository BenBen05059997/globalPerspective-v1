'use strict';

const OpenAI = require('openai');

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

const MODEL_NAME = process.env.GROK_MODEL || 'grok-4-1-fast-non-reasoning';
const DEFAULT_LIMIT = 13;

// Allowed categories for topic filtering
const VALID_CATEGORIES = ['politics', 'economy', 'military', 'conflict', 'disaster', 'technology', 'health'];
const CACHE_TABLE = process.env.TOPICS_DDB_TABLE;
const CACHE_ID = process.env.TOPICS_CACHE_ITEM_ID || 'staging';
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const BRAVE_NEWS_ENDPOINT = 'https://api.search.brave.com/res/v1/news/search';

// ============================================================
// SEEN TOPICS - 24h soft dedup
// ============================================================

const SEEN_TOPICS_ID = 'seen-today';
const SEEN_TOPICS_TTL_HOURS = 24;

function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

async function readSeenTopics() {
  if (!ddbDoc || !CACHE_TABLE) return [];
  try {
    let result;
    if (usingAwsSdkV3) {
      const { GetCommand } = require('@aws-sdk/lib-dynamodb');
      result = await ddbDoc.send(new GetCommand({ TableName: CACHE_TABLE, Key: { id: SEEN_TOPICS_ID } }));
    } else {
      result = await ddbDoc.get({ TableName: CACHE_TABLE, Key: { id: SEEN_TOPICS_ID } }).promise();
    }
    const item = result?.Item;
    if (!item || !Array.isArray(item.entries)) return [];
    const cutoff = Date.now() - (SEEN_TOPICS_TTL_HOURS * 60 * 60 * 1000);
    return item.entries.filter(e => e.seenAt > cutoff);
  } catch (err) {
    console.warn('Failed to read seen topics:', err.message);
    return [];
  }
}

async function writeSeenTopics(entries) {
  if (!ddbDoc || !CACHE_TABLE) return;
  try {
    const item = {
      id: SEEN_TOPICS_ID,
      entries,
      updatedAt: new Date().toISOString(),
    };
    if (usingAwsSdkV3) {
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      await ddbDoc.send(new PutCommand({ TableName: CACHE_TABLE, Item: item }));
    } else {
      await ddbDoc.put({ TableName: CACHE_TABLE, Item: item }).promise();
    }
    console.log(`Wrote ${entries.length} seen topic fingerprints`);
  } catch (err) {
    console.warn('Failed to write seen topics:', err.message);
  }
}

// ============================================================
// RSS FEEDS - Free, fast, no rate limits
// ============================================================
const RSS_FEEDS = [
  { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', source: 'bbc.com' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'aljazeera.com' },
  { name: 'France24', url: 'https://www.france24.com/en/rss', source: 'france24.com' },
  { name: 'SCMP', url: 'http://www.scmp.com/rss/91/feed/', source: 'scmp.com' },
  { name: 'Asia Times', url: 'https://asiatimes.com/feed/', source: 'asiatimes.com' },
  { name: 'The Diplomat', url: 'https://thediplomat.com/feed/', source: 'thediplomat.com' },
  { name: 'Dawn', url: 'https://www.dawn.com/feeds/home', source: 'dawn.com' },
  { name: 'Japan Times', url: 'https://www.japantimes.co.jp/feed/', source: 'japantimes.co.jp' },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function createStableTopicId(rawTitle, index) {
  const base =
    typeof rawTitle === 'string' && rawTitle.trim().length
      ? rawTitle.trim()
      : `Topic ${index + 1}`;
  const normalized = base.replace(/\s+/g, ' ').trim();
  return `${normalized}-${index}`;
}

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

function shouldFilterArticle(article) {
  const BLOCKED_DOMAINS = ['archive.is', 'archive.ph', 'web.archive.org', 'archive.org'];
  const MAX_AGE_HOURS = 48;
  const url = article.url || '';
  for (const domain of BLOCKED_DOMAINS) {
    if (url.includes(domain)) {
      return true;
    }
  }
  const ageHours = parseAgeToHours(article.age);
  if (ageHours !== null && ageHours > MAX_AGE_HOURS) {
    return true;
  }
  return false;
}

// ============================================================
// RSS FEED FETCHING
// ============================================================

function parseRssXml(xml, sourceName) {
  const articles = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];

    // Extract title (handle CDATA)
    const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : '';
    title = title.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim();

    // Extract link
    const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    let url = linkMatch ? linkMatch[1].trim() : '';
    url = url.replace(/<!\[CDATA\[|\]\]>/g, '').trim();

    // Extract description
    const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    let description = descMatch ? descMatch[1].trim() : '';
    description = description.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').substring(0, 300).trim();

    // Extract pubDate and calculate age
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    let age = '';
    if (pubDateMatch) {
      const pubTime = new Date(pubDateMatch[1].trim()).getTime();
      if (!isNaN(pubTime)) {
        const hoursAgo = Math.floor((Date.now() - pubTime) / (1000 * 60 * 60));
        if (hoursAgo < 1) age = 'Just now';
        else if (hoursAgo < 24) age = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
        else {
          const daysAgo = Math.floor(hoursAgo / 24);
          age = `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
        }
      }
    }

    if (title && url) {
      articles.push({ title, url, description, age, source: sourceName });
    }
  }
  return articles;
}

async function fetchRssFeeds() {
  console.log(`Fetching ${RSS_FEEDS.length} RSS feeds in parallel...`);

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(feed.url, {
          headers: {
            'Accept': 'application/rss+xml, application/xml, text/xml',
            'User-Agent': 'GlobalPerspectives/1.0'
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`RSS ${feed.name} failed: HTTP ${response.status}`);
          return [];
        }

        const xml = await response.text();
        const articles = parseRssXml(xml, feed.source);
        console.log(`RSS ${feed.name}: ${articles.length} articles`);
        return articles;
      } catch (err) {
        console.warn(`RSS ${feed.name} error: ${err.message}`);
        return [];
      }
    })
  );

  const allArticles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Filter old articles
  const freshArticles = allArticles.filter(a => !shouldFilterArticle(a));
  console.log(`RSS total: ${freshArticles.length} fresh articles (filtered ${allArticles.length - freshArticles.length} old)`);
  return freshArticles;
}

// ============================================================
// BRAVE SEARCH - Only for sources without working RSS
// ============================================================

async function fetchBraveNews(limit) {
  if (!BRAVE_API_KEY) {
    console.warn('BRAVE_SEARCH_API_KEY not configured, skipping Brave search');
    return [];
  }

  try {
    // Only query sources that don't have working RSS feeds
    const queries = [
      // Wire Services (no RSS or blocked)
      'site:reuters.com world news politics economy',
      'site:apnews.com world news politics economy',

      // Europe (no RSS or blocked)
      'site:theguardian.com world news politics',
      'site:dw.com Europe news politics economy',
      'site:euronews.com Europe EU news politics',

      // Asia (no RSS or blocked)
      'site:straitstimes.com Singapore Asia politics economy',
      'site:timesofindia.indiatimes.com India politics economy',
      'site:koreaherald.com Korea politics economy',

      // Specialized
      'site:kyivindependent.com Ukraine Russia war',
      'site:al-monitor.com Middle East politics',

      // Broader regional (coverage gaps)
      'Africa news politics economy conflict today',
      'Latin America Brazil Mexico Argentina news politics today',
    ];

    const articlesPerQuery = Math.max(10, Math.ceil((limit * 4) / queries.length));
    const allArticles = [];

    console.log(`Fetching ${queries.length} Brave queries (2s delay between)...`);

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];

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
          console.log(`Brave "${query.substring(0, 25)}...": ${articles.length} articles`);
        } else {
          console.warn(`Brave "${query.substring(0, 25)}..." failed: ${response.status}`);
        }
      } catch (queryError) {
        console.warn(`Brave query error: ${queryError.message}`);
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    const uniqueArticles = allArticles.filter(article => {
      if (!article.url || seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    });

    // Filter old articles
    const freshArticles = uniqueArticles.filter(a => !shouldFilterArticle(a));
    console.log(`Brave total: ${freshArticles.length} fresh articles (filtered ${uniqueArticles.length - freshArticles.length} old)`);

    return freshArticles.map((article) => ({
      title: article.title || '',
      url: article.url || '',
      description: article.description || '',
      age: article.age || '',
      source: article.meta_url?.hostname || article.source || '',
    }));
  } catch (error) {
    console.error('Brave Search API error:', error);
    return [];
  }
}

// ============================================================
// COMBINED FETCH - RSS + Brave
// ============================================================

async function fetchAllNews(limit) {
  // Fetch RSS and Brave in parallel where possible
  // RSS is instant, Brave takes ~24 seconds due to rate limiting
  const [rssArticles, braveArticles] = await Promise.all([
    fetchRssFeeds(),
    fetchBraveNews(limit),
  ]);

  // Combine all articles
  const allArticles = [...rssArticles, ...braveArticles];

  // Deduplicate by URL (in case of overlap)
  const seen = new Set();
  const uniqueArticles = allArticles.filter(article => {
    if (!article.url || seen.has(article.url)) return false;
    seen.add(article.url);
    return true;
  });

  console.log(`COMBINED: ${uniqueArticles.length} unique articles (${rssArticles.length} RSS + ${braveArticles.length} Brave)`);
  return uniqueArticles;
}

// ============================================================
// CACHE & UTILS
// ============================================================

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
    console.log(`DynamoDB write: table=${CACHE_TABLE}, id=${CACHE_ID}, generationId=${generationId}`);
    if (usingAwsSdkV3) {
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      await ddbDoc.send(new PutCommand({ TableName: CACHE_TABLE, Item: item }));
    } else {
      await ddbDoc.put({ TableName: CACHE_TABLE, Item: item }).promise();
    }
    console.log(`DynamoDB write OK: generationId=${generationId}`);
    return { cached: true, updatedAt, generationId };
  } catch (e) {
    console.error('DynamoDB put error:', e);
    return { cached: false, reason: e.message };
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      const msg = 'Missing XAI_API_KEY environment variable';
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

    // Fetch news from RSS feeds + Brave Search (hybrid approach)
    const allArticles = await fetchAllNews(limit);

    // Read previously-covered topics for soft dedup
    const seenEntries = await readSeenTopics();
    console.log(`Seen topics from last 24h: ${seenEntries.length}`);

    // Initialize Grok (xAI) client
    const openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1'
    });

    let prompt;
    if (allArticles && allArticles.length > 0) {
      const articlesText = allArticles
        .map((a, i) => `${i + 1}. ${a.title}\n   Source: ${a.source}\n   Published: ${a.age}\n   URL: ${a.url}\n   ${a.description}`)
        .join('\n\n');

      // Build soft dedup prompt section
      const seenTopicsPromptLines = [];
      if (seenEntries.length > 0) {
        seenTopicsPromptLines.push(
          'DEDUPLICATION - PREVIOUSLY COVERED TODAY:',
          'These topics were already covered in earlier runs today.',
          'PRIORITIZE genuinely NEW events not in this list.',
          'Only include a previously-covered topic if there are not enough new events to fill the limit,',
          'or if there is a significant new development with fresh sources.',
          ...seenEntries.map(e => `  - ${e.title}`),
          '',
        );
      }

      prompt = [
        'You are a news analyst with real-time access to X (Twitter) trends and discussions.',
        'Analyze the news articles below and identify significant global events.',
        '',
        '=== NEWS ARTICLES ===',
        articlesText,
        '=== END OF ARTICLES ===',
        '',
        `Task: Identify up to ${limit} SIGNIFICANT NEWS EVENTS that matter globally or regionally.`,
        'Return a JSON object with a single key "topics" containing an array of topic objects.',
        '',
        'ALLOWED CATEGORIES (use ONLY these):',
        '- politics (elections, policy changes, diplomatic relations, government actions)',
        '- economy (markets, trade deals, sanctions, major business news)',
        '- military (defense, troop movements, arms deals, military exercises)',
        '- conflict (wars, battles, peace talks, territorial disputes, violence)',
        '- disaster (natural disasters, accidents, emergencies, humanitarian crises)',
        '- technology (tech breakthroughs, AI, cybersecurity, major tech company news)',
        '- health (ONLY: disease outbreaks, epidemics, pandemics, health emergencies)',
        '',
        'REJECT these categories: entertainment, sports, celebrity, lifestyle, culture',
        '',
        'CRITICAL RULES:',
        '1. ONE EVENT PER TOPIC: Each topic = ONE specific newsworthy event',
        '2. BE SPECIFIC: Include key details (names, numbers, locations, actions)',
        '3. ONLY USE ARTICLES FROM ABOVE: Source URLs must match exactly',
        '4. DO NOT INVENT URLs: Do NOT fabricate any URLs',
        '5. GROUP CAREFULLY: Only group articles about the SAME specific event',
        '6. EXCLUSIVE SOURCES: Each source article URL must appear in exactly ONE topic. Never assign the same article to multiple topics.',
        '',
        'BAD EXAMPLES (too vague):',
        '- "East Asian Economy and Geopolitical Relations"',
        '- "Middle East Conflict Updates"',
        '',
        'GOOD EXAMPLES (specific events):',
        '- "Japan Raises Interest Rates to 0.25% Amid Inflation"',
        '- "Israel and Hamas Agree to 72-Hour Ceasefire in Gaza"',
        '',
        'REGIONAL DIVERSITY:',
        `- Generate ${limit} topics covering diverse regions`,
        '- Include: Americas, Europe, Asia, Middle East, Africa',
        '- Do NOT let one story dominate all topics',
        '',
        ...seenTopicsPromptLines,
        'Each topic object MUST have:',
        '- title: string (SPECIFIC event with key details)',
        '- category: string (politics/economy/military/conflict/disaster/technology/health)',
        '- search_keywords: array of 3-6 keywords',
        '- regions: array of country names involved',
        '- sources: array of source objects (each with {title, url, source, age, snippet})',
        '- x_trending: boolean (true if trending on X)',
        '- significance: string ("high", "medium", or "low")',
      ].join('\n');
    } else {
      console.warn('No articles available, falling back to Grok X-knowledge mode');
      prompt = [
        'You are a news analyst with real-time access to X (Twitter) trends.',
        'Since no news articles are available, use your knowledge of what is trending on X today.',
        '',
        'Return a JSON object with a single key "topics" containing an array of topic objects.',
        '',
        'ALLOWED CATEGORIES: politics, economy, military, conflict, disaster, technology, health',
        'REJECT: entertainment, sports, celebrity, lifestyle, culture',
        '',
        'Each topic must have: title, category, search_keywords, regions, x_trending, significance',
        '',
        `Limit to ${limit} items covering diverse global regions.`,
      ].join('\n');
    }

    console.log('Sending to Grok, article count:', allArticles?.length || 0);

    const result = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: 'You are a news analyst that returns only valid JSON. No commentary or markdown.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 8000,
    });
    const text = result?.choices?.[0]?.message?.content || '';

    console.log('Grok response preview:', text?.substring(0, 500));

    if (!text) {
      const msg = 'Empty response from Grok model';
      if (isScheduledEvent(event)) {
        console.error(msg);
        return { status: 'error', error: msg };
      }
      return { statusCode: 502, headers, body: JSON.stringify({ error: msg }) };
    }

    const parsed = extractJson(text);
    const topics = Array.isArray(parsed) ? parsed : (parsed?.topics || []);

    // SOURCE VALIDATION: Filter out hallucinated URLs
    const validUrls = new Set(allArticles.map(a => a.url));
    let totalSourcesBefore = 0;
    let totalSourcesAfter = 0;

    const normalized = topics.map((t, idx) => {
      const title = String(t?.title || '').trim();
      const topicId = createStableTopicId(title, idx);
      const rawSources = Array.isArray(t?.sources) ? t.sources : [];
      totalSourcesBefore += rawSources.length;

      const validatedSources = rawSources.filter(s => {
        if (!s?.url) return false;
        const isValid = validUrls.has(s.url);
        if (!isValid) {
          console.warn(`HALLUCINATION: Filtering fabricated URL: ${s.url?.substring(0, 60)}`);
        }
        return isValid;
      });
      totalSourcesAfter += validatedSources.length;

      return {
        id: topicId,
        topicId,
        title,
        category: String(t?.category || '').trim().toLowerCase(),
        search_keywords: Array.isArray(t?.search_keywords) ? t.search_keywords.map(k => String(k)) : [],
        regions: Array.isArray(t?.regions) ? t.regions.map(r => String(r)) : [],
        sources: validatedSources,
        x_trending: Boolean(t?.x_trending),
        significance: String(t?.significance || 'medium').toLowerCase(),
      };
    });

    const filteredOut = totalSourcesBefore - totalSourcesAfter;
    if (filteredOut > 0) {
      console.warn(`SOURCE VALIDATION: Filtered ${filteredOut} hallucinated sources`);
    }

    // TOPIC FILTERING: Category + source validation
    const filtered = normalized.filter(t => {
      const categoryValid = VALID_CATEGORIES.includes(t.category);
      if (!categoryValid) {
        console.warn(`FILTERED: Invalid category "${t.category}" for: ${t.title?.substring(0, 40)}`);
        return false;
      }
      const sourceCount = t.sources?.length || 0;
      if (sourceCount === 0) {
        console.warn(`FILTERED: No sources for: ${t.title?.substring(0, 40)}`);
        return false;
      }
      return true;
    });

    console.log(`TOPIC FILTER: ${filtered.length} topics passed (${normalized.length - filtered.length} filtered)`);

    // Log final summary
    console.log('Final topics:', JSON.stringify(filtered.map(t => ({
      title: t.title?.substring(0, 40),
      category: t.category,
      sources: t.sources?.length || 0,
    })), null, 2));

    const cacheResult = await writeCache({ topics: filtered, model: MODEL_NAME, limit });

    // Update seen topics for soft dedup
    const now = Date.now();
    const newEntries = filtered.map(t => ({
      fingerprint: slugifyTitle(t.title),
      title: t.title,
      seenAt: now,
    }));
    const newFingerprints = new Set(newEntries.map(e => e.fingerprint));
    const mergedEntries = [
      ...seenEntries.filter(e => !newFingerprints.has(e.fingerprint)),
      ...newEntries,
    ];
    await writeSeenTopics(mergedEntries);

    if (isScheduledEvent(event)) {
      return {
        status: 'ok',
        count: filtered.length,
        cached: cacheResult.cached,
        updatedAt: cacheResult.updatedAt || null,
        articleCount: allArticles.length,
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        topics: filtered,
        ai_powered: true,
        model: MODEL_NAME,
        limit,
        cached: cacheResult.cached,
        updatedAt: cacheResult.updatedAt || null,
      }),
    };
  } catch (err) {
    console.error('Lambda error:', err);
    if (isScheduledEvent(event)) {
      return { status: 'error', error: err?.message || 'Unexpected error' };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: err?.message || 'Unexpected error' }) };
  }
};
