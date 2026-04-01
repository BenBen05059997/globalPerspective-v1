'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const POSTS_TABLE = process.env.SOCIAL_POSTS_TABLE;
const SITE_URL = process.env.SITE_URL || 'https://globalperspective.net';

const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || '';
const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID || '';
const LINKEDIN_API_VERSION = '202601';

const DEDUP_DAYS = 3;
const REPOST_MIN_NEW_ARTICLES = 3;
const POST_TTL_DAYS = 30;
const PLATFORM = 'LINKEDIN_AUTO';

const THREAD_PK_PREFIX = 'THREAD#';
const THREAD_SK = 'THREAD_ANALYSIS';
const COUNTRY_PK_PREFIX = 'COUNTRY#';
const COUNTRY_SK = 'COUNTRY_INTELLIGENCE';

const RISK_MULTIPLIER = { critical: 3, elevated: 2, moderate: 1, low: 0.5 };
const TREND_MULTIPLIER = { rising: 1.5, new: 1.3, stable: 1.0, fading: 0.5 };

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  console.log('linkedInAutoPost invoked', JSON.stringify(event).substring(0, 200));

  if (!SUMMARY_TABLE || !POSTS_TABLE) {
    throw new Error(`Missing env vars: SUMMARIZE_PREDICT_TABLE=${!!SUMMARY_TABLE}, SOCIAL_POSTS_TABLE=${!!POSTS_TABLE}`);
  }
  if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_PERSON_ID) {
    console.log('LinkedIn credentials not configured, skipping');
    return response(200, { status: 'skipped', reason: 'no LinkedIn credentials' });
  }

  const [threads, countries, recentPosts] = await Promise.all([
    loadAllThreadAnalyses(),
    loadAllCountryIntelligence(),
    loadRecentPosts(),
  ]);

  console.log(`Loaded ${threads.length} threads, ${countries.length} countries, ${recentPosts.length} recent posts`);

  const scoredThreads = scoreThreads(threads, recentPosts);
  const scoredCountries = scoreCountries(countries, recentPosts);

  console.log('Top threads:', scoredThreads.slice(0, 3).map(t => `${t.threadTitle} (${t.score.toFixed(1)})`));
  console.log('Top countries:', scoredCountries.slice(0, 3).map(c => `${c.countryName} (${c.score.toFixed(1)})`));

  const pickedThread = pickThread(scoredThreads, null);
  const pickedCountry = pickCountry(scoredCountries, pickedThread);

  if (!pickedThread && !pickedCountry) {
    console.log('Nothing to post');
    return response(200, { status: 'skipped', reason: 'no eligible content' });
  }

  const results = [];

  if (pickedThread) {
    const text = formatThreadPost(pickedThread);
    console.log(`Posting thread: "${pickedThread.threadTitle}" (${text.length} chars)`);
    try {
      const res = await postToLinkedIn(text);
      await recordPost('thread', pickedThread.threadId, pickedThread.threadTitle, pickedThread.entryCount, res.postUrn);
      results.push({ type: 'thread', title: pickedThread.threadTitle, postUrn: res.postUrn });
      console.log('Thread posted successfully');
    } catch (err) {
      console.error('Thread post failed:', err.message);
      results.push({ type: 'thread', title: pickedThread.threadTitle, error: err.message });
    }
  }

  if (pickedCountry) {
    const text = formatCountryPost(pickedCountry);
    console.log(`Posting country: "${pickedCountry.countryName}" (${text.length} chars)`);
    try {
      const res = await postToLinkedIn(text);
      await recordPost('country', pickedCountry.countryName, pickedCountry.headline, pickedCountry.totalArticles, res.postUrn);
      results.push({ type: 'country', name: pickedCountry.countryName, postUrn: res.postUrn });
      console.log('Country posted successfully');
    } catch (err) {
      console.error('Country post failed:', err.message);
      results.push({ type: 'country', name: pickedCountry.countryName, error: err.message });
    }
  }

  return response(200, { status: 'ok', results });
};

// ---------------------------------------------------------------------------
// Load from DynamoDB
// ---------------------------------------------------------------------------

async function loadAllThreadAnalyses() {
  const items = await scanByPrefix(THREAD_PK_PREFIX, THREAD_SK);
  return items.filter(i => i.threadTitle && i.storyArc);
}

async function loadAllCountryIntelligence() {
  const items = await scanByPrefix(COUNTRY_PK_PREFIX, COUNTRY_SK);
  return items.filter(i => i.countryName && i.bluf);
}

async function scanByPrefix(pkPrefix, sk) {
  const all = [];
  let lastKey;
  do {
    const result = await ddb.send(new ScanCommand({
      TableName: SUMMARY_TABLE,
      FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk',
      ExpressionAttributeValues: { ':prefix': pkPrefix, ':sk': sk },
      ExclusiveStartKey: lastKey,
    }));
    if (result.Items) all.push(...result.Items);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return all;
}

async function loadRecentPosts() {
  const cutoff = new Date(Date.now() - DEDUP_DAYS * 86400000).toISOString();
  try {
    const { Items } = await ddb.send(new ScanCommand({
      TableName: POSTS_TABLE,
      FilterExpression: 'begins_with(PK, :prefix) AND postedAt > :since',
      ExpressionAttributeValues: {
        ':prefix': `POSTED#${PLATFORM}#`,
        ':since': cutoff,
      },
    }));
    return Items || [];
  } catch (err) {
    console.warn('Failed to load recent posts:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function getTrend(entryShortTitles, entryCount) {
  if (!entryShortTitles || entryShortTitles.length <= 1) return 'new';
  const total = entryCount || entryShortTitles.length;
  if (total <= 1) return 'new';
  const half = Math.ceil(total / 2);
  const recentHalf = total - half;
  const ratio = recentHalf / half;
  if (ratio > 1.3) return 'rising';
  if (ratio < 0.7) return 'fading';
  return 'stable';
}

function scoreThreads(threads, recentPosts) {
  const postMap = buildPostMap(recentPosts);

  return threads.map(t => {
    const trend = getTrend(t.entryShortTitles, t.entryCount);
    const baseScore = (t.entryCount || 1) * (TREND_MULTIPLIER[trend] || 1.0);
    const dedupPenalty = getDedupPenalty(postMap, 'thread', t.threadId, t.entryCount);
    return { ...t, score: baseScore * dedupPenalty, trend };
  }).sort((a, b) => b.score - a.score);
}

function scoreCountries(countries, recentPosts) {
  const postMap = buildPostMap(recentPosts);

  return countries.map(c => {
    const risk = (c.riskLevel || 'moderate').toLowerCase();
    const baseScore = (RISK_MULTIPLIER[risk] || 1) * (c.totalArticles || 1);
    const dedupPenalty = getDedupPenalty(postMap, 'country', c.countryName, c.totalArticles);
    return { ...c, score: baseScore * dedupPenalty };
  }).sort((a, b) => b.score - a.score);
}

function buildPostMap(recentPosts) {
  const map = {};
  for (const p of recentPosts) {
    const key = p.contentId || p.PK;
    map[key] = p;
  }
  return map;
}

function getDedupPenalty(postMap, type, id, currentArticleCount) {
  const key = `${type}:${id}`;
  const prev = postMap[key];
  if (!prev) return 1.0;

  const prevCount = prev.articleCountAtPost || 0;
  const newArticles = (currentArticleCount || 0) - prevCount;

  if (newArticles >= REPOST_MIN_NEW_ARTICLES) return 0.8;
  if (newArticles >= 2) return 0.5;
  return 0;
}

// ---------------------------------------------------------------------------
// Selection (avoid overlap)
// ---------------------------------------------------------------------------

function pickThread(scoredThreads, _pickedCountry) {
  return scoredThreads.find(t => t.score > 0) || null;
}

function pickCountry(scoredCountries, pickedThread) {
  if (!pickedThread) return scoredCountries.find(c => c.score > 0) || null;

  const threadRegions = extractRegions(pickedThread);

  for (const c of scoredCountries) {
    if (c.score <= 0) continue;
    if (threadRegions.has(c.countryName.toLowerCase())) continue;
    return c;
  }

  return scoredCountries.find(c => c.score > 0) || null;
}

function extractRegions(thread) {
  const regions = new Set();
  if (thread.entryShortTitles) {
    for (const e of thread.entryShortTitles) {
      const title = (e.shortTitle || '').toLowerCase();
      regions.add(title);
    }
  }
  const titleWords = (thread.threadTitle || '').toLowerCase();
  regions.add(titleWords);
  return regions;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatThreadPost(thread) {
  const MAX_CHARS = 3000;
  const lines = [];

  lines.push('📊 CONTINUING STORY BRIEFING');
  lines.push('');
  lines.push(`🧵 ${thread.threadTitle}`);
  const dayCount = thread.entryShortTitles ? thread.entryShortTitles.length : thread.entryCount || 0;
  const trendLabel = (thread.trend || 'stable').charAt(0).toUpperCase() + (thread.trend || 'stable').slice(1);
  lines.push(`${thread.entryCount || '—'} articles · ${dayCount} days · ${trendLabel}`);
  lines.push('');

  if (thread.storyArc) {
    lines.push('HOW IT EVOLVED');
    lines.push(truncateAtSentence(stripMarkdown(thread.storyArc), 400));
    lines.push('');
  }

  if (thread.trajectory) {
    lines.push("WHAT'S NEXT");
    lines.push(truncateAtSentence(stripMarkdown(thread.trajectory), 300));
    lines.push('');
  }

  if (thread.watchQuestions && thread.watchQuestions.length > 0) {
    lines.push('QUESTIONS TO WATCH');
    for (const q of thread.watchQuestions.slice(0, 2)) {
      lines.push(`• ${q}`);
    }
    lines.push('');
  }

  lines.push(`📊 Track this story: ${SITE_URL}/weekly`);
  lines.push('');
  lines.push('#GlobalPerspectives #Geopolitics #AI #WorldNews');

  let post = lines.join('\n');
  if (post.length > MAX_CHARS) {
    post = post.substring(0, MAX_CHARS - 3) + '...';
  }
  return post;
}

function formatCountryPost(country) {
  const MAX_CHARS = 3000;
  const lines = [];

  lines.push('📊 INTELLIGENCE BRIEFING');
  lines.push('');
  const RISK_EMOJI = { critical: '🔴', elevated: '🟠', moderate: '🟡', low: '🟢' };
  const riskKey = (country.riskLevel || '').toLowerCase();
  const riskLabel = country.riskLevel
    ? ` — ${RISK_EMOJI[riskKey] || '⚠️'} ${riskKey.charAt(0).toUpperCase() + riskKey.slice(1)} Risk`
    : '';
  lines.push(`🌍 ${country.countryName}${riskLabel}`);
  if (country.headline) lines.push(country.headline);
  lines.push('');

  if (country.bluf) {
    lines.push('BOTTOM LINE');
    lines.push(truncateAtSentence(stripMarkdown(country.bluf), 400));
    lines.push('');
  }

  if (country.keyDevelopments && country.keyDevelopments.length > 0) {
    lines.push('KEY DEVELOPMENTS');
    for (const d of country.keyDevelopments.slice(0, 3)) {
      lines.push(`${d.date || ''}  ${d.text || d}`);
    }
    lines.push('');
  }

  if (country.riskSignals && country.riskSignals.length > 0) {
    lines.push('WHAT TO WATCH');
    for (const s of country.riskSignals.slice(0, 3)) {
      lines.push(`⚡ ${s}`);
    }
    lines.push('');
  }

  lines.push(`📊 Full briefing: ${SITE_URL}/weekly/countries`);
  lines.push('');

  const countryTag = `#${country.countryName.replace(/[^a-zA-Z0-9]/g, '')}`;
  lines.push(`${countryTag} #GlobalPerspectives #CountryRisk #AI`);

  let post = lines.join('\n');
  if (post.length > MAX_CHARS) {
    post = post.substring(0, MAX_CHARS - 3) + '...';
  }
  return post;
}

// ---------------------------------------------------------------------------
// LinkedIn API
// ---------------------------------------------------------------------------

async function postToLinkedIn(commentary) {
  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Linkedin-Version': LINKEDIN_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      author: `urn:li:person:${LINKEDIN_PERSON_ID}`,
      commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LinkedIn API error ${res.status}: ${errorText}`);
  }

  const postUrn = res.headers.get('x-restli-id') || null;
  return { success: true, postUrn };
}

// ---------------------------------------------------------------------------
// Dedup record
// ---------------------------------------------------------------------------

async function recordPost(type, id, title, articleCount, postUrn) {
  const ttl = Math.floor(Date.now() / 1000) + POST_TTL_DAYS * 86400;

  await ddb.send(new PutCommand({
    TableName: POSTS_TABLE,
    Item: {
      PK: `POSTED#${PLATFORM}#${type}:${id}`,
      contentId: `${type}:${id}`,
      contentType: type,
      platform: PLATFORM,
      title: title || '',
      articleCountAtPost: articleCount || 0,
      postUrn: postUrn || null,
      postedAt: new Date().toISOString(),
      ttl,
    },
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripMarkdown(text) {
  return text
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateAtSentence(text, maxLen) {
  if (text.length <= maxLen) return text;
  const truncated = text.substring(0, maxLen);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);
  if (cutPoint > maxLen * 0.5) {
    return truncated.substring(0, cutPoint + 1).trim();
  }
  return truncated.trim() + '...';
}

function response(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}
