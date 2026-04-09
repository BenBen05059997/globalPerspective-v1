'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { buildDailySummary, buildAiOverviewPrompt, formatDisplayDate, CATEGORY_LABEL } = require('./buildDailySummary');

const REGION        = process.env.AWS_REGION || 'ap-northeast-1';
const TOPICS_TABLE  = process.env.TOPICS_DDB_TABLE;
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const POSTS_TABLE   = process.env.SOCIAL_POSTS_TABLE;
const DEVTO_API_KEY = process.env.DEVTO_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const XAI_API_KEY   = process.env.XAI_API_KEY || '';
const GROK_MODEL    = process.env.GROK_MODEL || 'grok-4-1-fast-non-reasoning';
const GROK_ENDPOINT = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
const SITE_URL           = process.env.SITE_URL || 'https://globalperspective.net';
const PLATFORM           = 'DEVTO';
const POST_TTL_DAYS      = 90;
const BRIEF_TTL_DAYS     = 90;
const AI_MODEL           = 'deepseek/deepseek-r1:free';
const AI_ENDPOINT        = 'https://openrouter.ai/api/v1/chat/completions';

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// ── Daily Brief: load enrichment data ───────────────────────────────────────

async function loadThreadAnalyses(entries) {
  if (!SUMMARY_TABLE) return {};
  const threadIds = [...new Set(entries.map(e => e.threadId).filter(Boolean))];
  const analyses = {};
  await Promise.all(threadIds.slice(0, 20).map(async (tid) => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `THREAD#${tid}`, SK: 'THREAD_ANALYSIS' },
      }));
      if (Item) analyses[tid] = Item;
    } catch {}
  }));
  return analyses;
}

async function loadCountryIntelligence(entries) {
  if (!SUMMARY_TABLE) return {};
  const countries = [...new Set(entries.flatMap(e => e.regions || []))];
  const intel = {};
  await Promise.all(countries.slice(0, 15).map(async (name) => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `COUNTRY#${name}`, SK: 'COUNTRY_INTELLIGENCE' },
      }));
      if (Item) intel[name] = Item;
    } catch {}
  }));
  return intel;
}

function buildBriefPrompt(entries, threadAnalyses, countryIntel, displayDate, dateKey) {
  const headlineBlock = entries
    .filter(e => e && e.title)
    .slice(0, 20)
    .map((e, i) => {
      const cat = CATEGORY_LABEL[e.category] || 'General';
      const regions = (e.regions || []).slice(0, 3).join(', ') || 'Global';
      const srcCount = (e.sources || []).length;
      const summarySnippet = e.ai?.summary ? ` | ${e.ai.summary.substring(0, 120)}` : '';
      return `${i + 1}. [${cat}] ${e.title} (${regions}, ${srcCount} sources)${summarySnippet}`;
    })
    .join('\n');

  const threadEntries = Object.entries(threadAnalyses);
  const threadBlock = threadEntries.length > 0
    ? threadEntries.slice(0, 5).map(([tid, t]) => {
        const arc = t.storyArc ? t.storyArc.substring(0, 200) : '';
        return `- "${t.threadTitle}" [${t.entryCount} articles]: ${arc}`;
      }).join('\n')
    : 'No thread analyses available today.';

  const countryEntries = Object.entries(countryIntel)
    .sort((a, b) => {
      const riskOrder = { high: 0, elevated: 1, moderate: 2, low: 3 };
      return (riskOrder[a[1].riskLevel] ?? 3) - (riskOrder[b[1].riskLevel] ?? 3);
    });
  const countryBlock = countryEntries.length > 0
    ? countryEntries.slice(0, 5).map(([name, c]) =>
        `- ${name} [${(c.riskLevel || 'moderate').toUpperCase()}]: ${c.headline || c.bluf || 'No headline'}`
      ).join('\n')
    : 'No country intelligence available today.';

  return `You are a senior intelligence analyst writing a daily brief for a global news platform. Today is ${displayDate} (${dateKey}).

=== TODAY'S HEADLINES (${entries.length} stories) ===
${headlineBlock}

=== ACTIVE STORY ARCS ===
${threadBlock}

=== COUNTRY INTELLIGENCE ===
${countryBlock}

Generate a JSON object with exactly these fields:

1. "headline": The single most important story of the day as a crisp, journalistic headline (8-15 words). No clickbait.

2. "summary": A 3-4 paragraph global overview (250-350 words) that synthesizes today's major themes, identifies interconnections between stories, and notes emerging patterns. Write in analytical journalism style — flowing paragraphs, no bullet points, no headers. Reference specific countries and actors by name. Use **double asterisks** around the 3-5 most critical phrases.

3. "topStories": Array of the 5-8 most significant stories, each with:
   - "title": Story headline (from the headlines above)
   - "category": One of politics/economy/conflict/military/technology/health/disaster
   - "regions": Array of 1-3 country/region names
   - "prediction": One sentence on what most likely happens next (specific, with timeframe)
   - "sourceCount": Number of sources covering this story

4. "risingThread": Object for the fastest-growing or most important story arc:
   - "threadId": The thread ID (from the story arcs above, or null if none)
   - "title": Thread title
   - "articleCount": Number of articles
   - "dayCount": Number of days the thread spans
   - "trajectory": One of "escalating", "stable", "de-escalating"
   - "oneLiner": One sentence on why this thread matters right now

5. "countryToWatch": Object for the highest-risk country today:
   - "countryName": Country name
   - "riskLevel": One of "low", "moderate", "elevated", "high"
   - "headline": One sentence on what's happening
   - "trajectory": One of "escalating", "stable", "de-escalating"

6. "categoryBreakdown": Object mapping each active category to its story count (e.g. {"politics": 5, "economy": 3})

Return ONLY valid JSON. No markdown fences, no commentary, no extra keys.`;
}

async function callGrok(prompt) {
  if (!XAI_API_KEY) return null;
  const res = await fetch(GROK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Grok API error ${res.status}: ${raw.substring(0, 200)}`);
  const parsed = JSON.parse(raw);
  const content = parsed?.choices?.[0]?.message?.content || '';
  return content.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}

async function generateAndStoreDailyBrief(entries, dateKey) {
  if (!SUMMARY_TABLE || !XAI_API_KEY) {
    console.log('[DAILY_BRIEF] Skipping: missing SUMMARIZE_PREDICT_TABLE or XAI_API_KEY');
    return null;
  }

  const displayDate = formatDisplayDate(dateKey);

  const [threadAnalyses, countryIntel] = await Promise.all([
    loadThreadAnalyses(entries),
    loadCountryIntelligence(entries),
  ]);
  console.log(`[DAILY_BRIEF] Enrichment loaded: ${Object.keys(threadAnalyses).length} threads, ${Object.keys(countryIntel).length} countries`);

  const prompt = buildBriefPrompt(entries, threadAnalyses, countryIntel, displayDate, dateKey);
  const content = await callGrok(prompt);
  if (!content) throw new Error('Empty Grok response');

  const brief = JSON.parse(content);
  if (!brief.headline || !brief.summary) {
    throw new Error(`Missing required fields: ${Object.keys(brief).join(', ')}`);
  }

  const uniqueCountries = new Set();
  const uniqueSources = new Set();
  for (const e of entries) {
    for (const r of (e.regions || [])) uniqueCountries.add(r);
    for (const s of (e.sources || [])) uniqueSources.add(s.source || s.title || '');
  }

  const item = {
    PK: `DAILY_BRIEF#${dateKey}`,
    SK: 'DAILY_BRIEF',
    dateKey,
    displayDate,
    headline: brief.headline,
    summary: brief.summary,
    topStories: Array.isArray(brief.topStories) ? brief.topStories.slice(0, 8) : [],
    risingThread: brief.risingThread || null,
    countryToWatch: brief.countryToWatch || null,
    categoryBreakdown: brief.categoryBreakdown || {},
    stats: {
      totalArticles: entries.length,
      sourceOutlets: uniqueSources.size,
      countriesCovered: uniqueCountries.size,
    },
    generatedAt: new Date().toISOString(),
    model: GROK_MODEL,
    ttl: Math.floor(Date.now() / 1000) + BRIEF_TTL_DAYS * 86400,
  };

  await ddb.send(new PutCommand({ TableName: SUMMARY_TABLE, Item: item }));
  console.log(`[DAILY_BRIEF] Stored for ${dateKey}: "${brief.headline}"`);
  return item;
}

// ── Handler ─────────────────────────────────────────────────────────────────

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

    // ── Generate and store daily brief (never blocks Dev.to publish) ──
    let dailyBrief = null;
    try {
      dailyBrief = await generateAndStoreDailyBrief(archive.entries, dateKey);
    } catch (briefErr) {
      console.warn('[DAILY_BRIEF] Generation failed, continuing with Dev.to:', briefErr.message);
    }

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
      dailyBrief: dailyBrief ? { headline: dailyBrief.headline, stored: true } : { stored: false },
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
