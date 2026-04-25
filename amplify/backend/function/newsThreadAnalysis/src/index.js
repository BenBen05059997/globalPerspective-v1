'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-1-fast-non-reasoning';
const GROK_ENDPOINT = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
const GROK_KEY = process.env.XAI_API_KEY || '';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '3000', 10);
const TEMPERATURE = Number(process.env.TEMPERATURE || '0.2');
const TOP_P = Number(process.env.TOP_P || '0.9');

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const BRAVE_NEWS_ENDPOINT = 'https://api.search.brave.com/res/v1/news/search';
const BRAVE_WEB_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const SEARCH_RESULTS_PER_THREAD = 6;

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;

const THREAD_PK_PREFIX = 'THREAD#';
const THREAD_SK = 'THREAD_ANALYSIS';
const THREAD_TTL_DAYS = 90;
const MAX_THREADS = 10;
const ARCHIVE_DAYS = 30;

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

exports.handler = async () => {
  console.log('Thread analysis started');

  if (!TOPICS_TABLE || !SUMMARY_TABLE) {
    console.error('Missing table configuration: TOPICS_DDB_TABLE or SUMMARIZE_PREDICT_TABLE');
    return { statusCode: 500, body: 'Missing table config' };
  }

  if (!GROK_KEY) {
    console.error('Missing XAI_API_KEY');
    return { statusCode: 500, body: 'Missing API key' };
  }

  const entries = await readArchiveEntries(ARCHIVE_DAYS);
  console.log(`Loaded ${entries.length} archive entries across ${ARCHIVE_DAYS} days`);

  const threads = groupByThread(entries);
  console.log(`Found ${threads.length} threads with 2+ entries`);

  const top = threads.slice(0, MAX_THREADS);
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const thread of top) {
    try {
      const existing = await readExistingAnalysis(thread.threadId);
      if (existing && existing.entryCount === thread.entries.length) {
        skipped++;
        continue;
      }

      const analysis = await generateThreadAnalysis(thread);
      await writeAnalysis(thread.threadId, analysis, thread.entries.length);
      generated++;
      console.log(`Generated analysis for ${thread.threadId} (${thread.entries.length} entries, ${analysis.searchResultsCount} web refs)`);
    } catch (err) {
      failed++;
      console.error(`Failed to analyze ${thread.threadId}:`, err.message);
    }
  }

  const summary = `Thread analysis complete: ${generated} generated, ${skipped} skipped (unchanged), ${failed} failed`;
  console.log(summary);
  return { statusCode: 200, body: summary };
};

function formatDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `archive#${y}-${m}-${d}`;
}

async function readArchiveEntries(days) {
  const entries = [];
  const now = new Date();

  for (let i = 0; i <= days; i++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);

    const key = i === 0 ? 'today-archive' : formatDateKey(date);
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

    try {
      const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: key } }));
      if (Item && Array.isArray(Item.entries)) {
        for (const e of Item.entries) {
          if (e.threadId) {
            entries.push({
              topicId: e.topicId,
              threadId: e.threadId,
              title: e.title,
              date: dateStr,
              regions: e.regions || [],
              category: e.category || '',
              sources: e.sources || [],
              ai: e.ai || {},
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to read ${key}:`, err.message);
    }
  }

  return entries;
}

function groupByThread(entries) {
  const map = {};
  for (const e of entries) {
    if (!map[e.threadId]) map[e.threadId] = [];
    map[e.threadId].push(e);
  }

  return Object.entries(map)
    .filter(([, arr]) => arr.length >= 2)
    .map(([threadId, arr]) => {
      arr.sort((a, b) => a.date.localeCompare(b.date));
      return { threadId, entries: arr };
    })
    .sort((a, b) => b.entries.length - a.entries.length);
}

async function readExistingAnalysis(threadId) {
  try {
    const { Item } = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: `${THREAD_PK_PREFIX}${threadId}`, SK: THREAD_SK },
    }));
    return Item || null;
  } catch {
    return null;
  }
}

async function searchForContext(query) {
  if (!BRAVE_API_KEY) return [];
  const results = [];

  // 1. Recent news about this specific topic (freshness: past week)
  try {
    const newsUrl = `${BRAVE_NEWS_ENDPOINT}?q=${encodeURIComponent(query)}&count=4&search_lang=en&freshness=pw`;
    const newsResp = await fetch(newsUrl, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY },
    });
    if (newsResp.ok) {
      const data = await newsResp.json();
      for (const r of (data?.results || []).slice(0, 4)) {
        const source = r.meta_url?.hostname || r.url?.split('/')[2] || 'unknown';
        results.push({
          title: r.title || '',
          snippet: r.description || '',
          source,
          age: r.age || '',
          type: 'news',
        });
      }
    }
  } catch (err) {
    console.warn('Brave news search failed:', err.message);
  }

  // 2. Broader web context (background, analysis, Wikipedia) — no freshness filter
  try {
    const webUrl = `${BRAVE_WEB_ENDPOINT}?q=${encodeURIComponent(query + ' analysis background')}&count=4&search_lang=en&text_decorations=false`;
    const webResp = await fetch(webUrl, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY },
    });
    if (webResp.ok) {
      const data = await webResp.json();
      for (const r of (data?.web?.results || []).slice(0, 2)) {
        const source = r.meta_url?.hostname || r.url?.split('/')[2] || 'unknown';
        // Skip if we already have this source
        if (results.some(x => x.source === source)) continue;
        results.push({
          title: r.title || '',
          snippet: r.description || (r.extra_snippets || [])[0] || '',
          source,
          age: '',
          type: 'web',
        });
      }
    }
  } catch (err) {
    console.warn('Brave web search failed:', err.message);
  }

  return results.slice(0, SEARCH_RESULTS_PER_THREAD);
}

async function generateThreadAnalysis(thread) {
  // Build rich entry context: full summaries, individual AI insights, source outlets
  const entryLines = thread.entries.map((e, i) => {
    const regions = (e.regions || []).join(', ') || 'Unknown';
    const outlets = (e.sources || [])
      .map(s => s.source || s.title || '').filter(Boolean).slice(0, 5).join(', ');
    const summary = e.ai?.summary
      ? `\n  Summary: ${e.ai.summary}`
      : '';
    const prediction = e.ai?.prediction
      ? `\n  Initial prediction: ${e.ai.prediction.slice(0, 250)}`
      : '';
    const trace = e.ai?.trace_cause
      ? `\n  Root cause note: ${e.ai.trace_cause.slice(0, 200)}`
      : '';
    const sourceStr = outlets ? `\n  Covered by: ${outlets}` : '';
    return `Entry ${i + 1} (${e.date}):\n  Title: ${e.title}\n  Regions: ${regions}${sourceStr}${summary}${prediction}${trace}`;
  }).join('\n\n');

  // Search for external grounding using the most recent entry title as the query
  const searchQuery = thread.entries[thread.entries.length - 1].title;
  const searchResults = await searchForContext(searchQuery);

  const referenceBlock = searchResults.length > 0
    ? `\n=== EXTERNAL REFERENCES (web search: "${searchQuery}") ===\n` +
      searchResults.map((r, i) => {
        const age = r.age ? ` · ${r.age}` : '';
        return `[${i + 1}] "${r.title}" — ${r.snippet} (${r.source}${age})`;
      }).join('\n') +
      '\n\nCite these as [1], [2] etc. where they support your analysis.\n'
    : '';

  const prompt = `You are a narrative intelligence analyst writing for a sophisticated global news platform. Below are entries from a multi-day news thread, listed chronologically, followed by external references from a live web search.

=== THREAD ENTRIES ===
${entryLines}
${referenceBlock}
Generate a JSON object with exactly these fields:

1. "threadTitle": A sharp, journalistic title for the overall thread (6-10 words, no clickbait, no colons).

2. "entryShortTitles": Array of objects {topicId, shortTitle} where shortTitle is a 6-10 word micro-headline capturing each day's specific new development in sequence. Use these topicIds: ${thread.entries.map(e => `"${e.topicId}"`).join(', ')}

3. "storyArc": 2-3 paragraphs in analytical journalism style explaining how this story evolved. Include specific dates, key turning points, and the progression from the initial trigger to the latest development. Show the arc — how intensity, scope, or actors changed over time. Write in past tense like a coherent story, not a bullet list. Cite external references where relevant.

4. "trajectory": 2 paragraphs on where this story is concretely heading. Name specific actors, institutions, or regions to watch next. Identify 2-3 scenarios (most likely first) with rough timeframes (days/weeks/months). Ground predictions in the entry pattern and external references — avoid vague language like "tensions may rise."

5. "rootCauseChain": 2 paragraphs tracing the story back through three layers: (a) the immediate trigger in the first entry, (b) the medium-term political/economic/social condition that enabled it, and (c) the deeper structural or historical factor. Name specific actors, policies, or events at each layer. Use external references to verify claims.

6. "watchQuestions": Array of exactly 3 strings — specific, actionable questions a reader should watch for in the coming days or weeks. Name specific actors, countries, institutions, or upcoming deadlines. Avoid vague questions like "Will tensions rise?". Good example: "Will the ECB raise rates at its June meeting given this inflation data?" Each string must end with "?".

Return ONLY valid JSON. No markdown fences, no commentary, no extra keys.`;

  const { content, modelId, latencyMs } = await invokeGrok(prompt);
  const cleaned = stripCodeFence(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Grok response as JSON: ${err.message}\nRaw: ${cleaned.slice(0, 200)}`);
  }

  if (!parsed.threadTitle || !parsed.storyArc) {
    throw new Error(`Missing required fields in response: ${Object.keys(parsed).join(', ')}`);
  }

  const groundingSources = searchResults.map(r => ({
    title: r.title,
    snippet: r.snippet,
    source: r.source,
    type: r.type,
    ...(r.age && { age: r.age }),
    queryUsed: searchQuery,
  }));

  return { ...parsed, modelId, latencyMs, searchResultsCount: searchResults.length, groundingSources };
}

async function writeAnalysis(threadId, analysis, entryCount) {
  const ttl = Math.floor(Date.now() / 1000) + THREAD_TTL_DAYS * 86400;

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: `${THREAD_PK_PREFIX}${threadId}`,
      SK: THREAD_SK,
      threadId,
      threadTitle: analysis.threadTitle,
      entryShortTitles: analysis.entryShortTitles || [],
      storyArc: analysis.storyArc,
      trajectory: analysis.trajectory || null,
      rootCauseChain: analysis.rootCauseChain || null,
      watchQuestions: Array.isArray(analysis.watchQuestions) ? analysis.watchQuestions.slice(0, 3) : [],
      groundingSources: Array.isArray(analysis.groundingSources) ? analysis.groundingSources : [],
      entryCount,
      generatedAt: new Date().toISOString(),
      model: analysis.modelId || GROK_MODEL,
      latencyMs: analysis.latencyMs || 0,
      searchResultsCount: analysis.searchResultsCount || 0,
      ttl,
    },
  }));
}

async function invokeGrok(prompt) {
  const started = Date.now();
  const response = await fetch(GROK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      top_p: TOP_P,
    }),
  });

  const rawText = await response.text();
  const latencyMs = Date.now() - started;

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = rawText;
  }

  if (!response.ok) {
    const message = parsed?.error?.message || rawText || `status ${response.status}`;
    throw new Error(`Grok API error: ${message}`);
  }

  const content = extractContent(parsed);
  return { modelId: parsed?.model || GROK_MODEL, content, latencyMs };
}

function extractContent(payload) {
  if (!payload) return '';
  const msg = payload?.choices?.[0]?.message?.content;
  if (typeof msg === 'string') return stripCodeFence(msg);
  if (typeof payload === 'string') return payload.trim();
  return JSON.stringify(payload);
}

function stripCodeFence(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}
