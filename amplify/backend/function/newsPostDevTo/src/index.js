'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');
const { buildDailySummary, buildAiOverviewPrompt, formatDisplayDate } = require('./buildDailySummary');

const REGION        = process.env.AWS_REGION || 'ap-northeast-1';
const TOPICS_TABLE  = process.env.TOPICS_DDB_TABLE;
const POSTS_TABLE   = process.env.SOCIAL_POSTS_TABLE;
const DEVTO_API_KEY = process.env.DEVTO_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const SITE_URL           = process.env.SITE_URL || 'https://globalperspective.net';
const PLATFORM           = 'DEVTO';
const POST_TTL_DAYS      = 90;
const AI_MODEL           = 'deepseek/deepseek-r1:free';
const AI_ENDPOINT        = 'https://openrouter.ai/api/v1/chat/completions';

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

exports.handler = async (event) => {
  console.log('newsPostDevTo invoked', JSON.stringify(event).substring(0, 200));

  try {
    if (!TOPICS_TABLE || !POSTS_TABLE || !DEVTO_API_KEY) {
      const missing = [];
      if (!TOPICS_TABLE)  missing.push('TOPICS_DDB_TABLE');
      if (!POSTS_TABLE)   missing.push('SOCIAL_POSTS_TABLE');
      if (!DEVTO_API_KEY) missing.push('DEVTO_API_KEY');
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }

    const dateKey = todayDateKey();
    const dedupPK = `POSTED#${PLATFORM}#date:${dateKey}`;

    const alreadyPosted = await checkAlreadyPosted(dedupPK);
    if (alreadyPosted) {
      console.log(`[DEVTO] Already posted for ${dateKey}, skipping`);
      return resp(200, { status: 'skipped', reason: 'already posted today', dateKey });
    }

    const archive = await loadTodayArchive();
    if (!archive || !archive.entries || archive.entries.length === 0) {
      console.log(`[DEVTO] No archive entries, skipping`);
      return resp(200, { status: 'skipped', reason: 'no archive entries' });
    }

    console.log(`[DEVTO] Building article from ${archive.entries.length} entries for ${dateKey}`);

    const displayDate = formatDisplayDate(dateKey);
    let aiOverview = '';

    if (OPENROUTER_API_KEY) {
      try {
        const prompt = buildAiOverviewPrompt(archive.entries, displayDate);
        aiOverview = await callAi(prompt);
        console.log(`[DEVTO] AI overview generated (${aiOverview.length} chars)`);
      } catch (aiErr) {
        console.warn('[DEVTO] AI overview failed, continuing without it:', aiErr.message);
      }
    } else {
      console.log('[DEVTO] OPENROUTER_API_KEY not set, skipping AI overview');
    }

    const { title, body_markdown, description, stats } = buildDailySummary(
      archive.entries,
      dateKey,
      { siteUrl: SITE_URL, aiOverview, format: 'devto' },
    );

    console.log(`[DEVTO] Article: "${title}" (${body_markdown.length} chars, ${stats.totalEntries} entries)`);

    const result = await postToDevTo({ title, body_markdown, description });
    console.log(`[DEVTO] Published: ${result.url} (id: ${result.id})`);

    await recordPosted(dedupPK, dateKey, result.id, result.url, stats.totalEntries);

    return resp(200, {
      status: 'ok',
      articleId: result.id,
      articleUrl: result.url,
      dateKey,
      stats,
    });
  } catch (err) {
    console.error('newsPostDevTo error:', err);
    return resp(500, { status: 'error', error: err.message });
  }
};

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

async function loadTodayArchive() {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TOPICS_TABLE,
    Key: { id: 'today-archive' },
  }));
  if (!Item || !Array.isArray(Item.entries)) return null;
  return Item;
}

async function checkAlreadyPosted(dedupPK) {
  const { Item } = await ddb.send(new GetCommand({
    TableName: POSTS_TABLE,
    Key: { PK: dedupPK },
  }));
  return !!Item;
}

async function recordPosted(dedupPK, dateKey, articleId, articleUrl, entryCount) {
  const ttl = Math.floor(Date.now() / 1000) + POST_TTL_DAYS * 24 * 60 * 60;
  await ddb.send(new PutCommand({
    TableName: POSTS_TABLE,
    Item: {
      PK: dedupPK,
      platform: PLATFORM,
      dateKey,
      articleId: articleId || null,
      articleUrl: articleUrl || null,
      entryCount,
      postedAt: new Date().toISOString(),
      ttl,
    },
  }));
}

async function callAi(prompt) {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function postToDevTo({ title, body_markdown, description }) {
  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: {
      'api-key': DEVTO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      article: {
        title,
        body_markdown,
        description,
        published: true,
        tags: ['news', 'ai', 'worldnews', 'globalperspectives'],
        series: 'Global Perspectives Daily',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dev.to API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return { id: data.id, url: data.url };
}

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
