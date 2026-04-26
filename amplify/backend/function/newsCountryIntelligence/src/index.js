'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

let EDITORIAL_FACTS = {};
try {
  EDITORIAL_FACTS = require('./country_facts.json');
} catch (err) {
  console.warn('country_facts.json not found — editorial context disabled');
}

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-1-fast-non-reasoning';
const GROK_ENDPOINT = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
const GROK_KEY = process.env.XAI_API_KEY || '';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '5000', 10);
const TEMPERATURE = Number(process.env.TEMPERATURE || '0.3');
const TOP_P = Number(process.env.TOP_P || '0.9');

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const BRAVE_NEWS_ENDPOINT = 'https://api.search.brave.com/res/v1/news/search';

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;

const COUNTRY_PK_PREFIX = 'COUNTRY#';
const COUNTRY_SK = 'COUNTRY_INTELLIGENCE';
const THREAD_PK_PREFIX = 'THREAD#';
const THREAD_SK = 'THREAD_ANALYSIS';
const COUNTRY_TTL_DAYS = 90;
const MAX_COUNTRIES = 20;
const ARCHIVE_DAYS = 30;

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

// ─── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async () => {
  console.log('Country intelligence started');

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

  const threadAnalyses = await loadThreadAnalyses(entries);
  console.log(`Loaded ${Object.keys(threadAnalyses).length} thread analyses`);

  const countries = groupByCountry(entries, threadAnalyses);
  console.log(`Found ${countries.length} countries with 2+ articles`);

  const top = countries.slice(0, MAX_COUNTRIES);
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const country of top) {
    try {
      const existing = await readExisting(country.countryName);
      if (existing && existing.totalArticles === country.totalArticles) {
        skipped++;
        continue;
      }

      const analysis = await generateCountryIntelligence(country);
      await writeAnalysis(country.countryName, analysis, country);
      generated++;
      console.log(`Generated intelligence for ${country.countryName} (${country.totalArticles} articles, ${country.threads.length} threads)`);
    } catch (err) {
      failed++;
      console.error(`Failed to analyze ${country.countryName}:`, err.message);
    }
  }

  const summary = `Country intelligence complete: ${generated} generated, ${skipped} skipped (unchanged), ${failed} failed`;
  console.log(summary);
  return { statusCode: 200, body: summary };
};

// ─── Data loading ────────────────────────────────────────────────────────────

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
          entries.push({
            topicId: e.topicId,
            threadId: e.threadId || null,
            title: e.title,
            date: dateStr,
            regions: e.regions || [],
            category: e.category || '',
            sources: e.sources || [],
            ai: e.ai || {},
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to read ${key}:`, err.message);
    }
  }

  return entries;
}

async function loadThreadAnalyses(entries) {
  const threadIds = [...new Set(entries.map(e => e.threadId).filter(Boolean))];
  const analyses = {};

  await Promise.all(threadIds.map(async (threadId) => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `${THREAD_PK_PREFIX}${threadId}`, SK: THREAD_SK },
      }));
      if (Item) analyses[threadId] = Item;
    } catch {}
  }));

  return analyses;
}

// ─── Country grouping ────────────────────────────────────────────────────────

function groupByCountry(entries, threadAnalyses) {
  const countryMap = {};

  for (const entry of entries) {
    for (const region of (entry.regions || [])) {
      if (!countryMap[region]) {
        countryMap[region] = {
          countryName: region,
          entries: [],
          threadIds: new Set(),
          categories: {},
          dates: new Set(),
        };
      }
      const c = countryMap[region];
      c.entries.push(entry);
      c.dates.add(entry.date);
      if (entry.threadId) c.threadIds.add(entry.threadId);

      const cat = (entry.category || 'other').toLowerCase();
      c.categories[cat] = (c.categories[cat] || 0) + 1;
    }
  }

  return Object.values(countryMap)
    .filter(c => c.entries.length >= 2)
    .map(c => {
      const threadIds = [...c.threadIds];
      const threads = threadIds.map(tid => {
        const threadEntries = c.entries.filter(e => e.threadId === tid);
        const analysis = threadAnalyses[tid] || null;
        return {
          threadId: tid,
          title: analysis?.threadTitle || threadEntries[threadEntries.length - 1]?.title || 'Unknown',
          category: threadEntries[0]?.category || 'other',
          articleCount: threadEntries.length,
          trajectory: analysis?.trajectory || null,
          storyArc: analysis?.storyArc || null,
        };
      });

      const singleEntries = c.entries.filter(e => !e.threadId || !c.threadIds.has(e.threadId) || threads.find(t => t.threadId === e.threadId)?.articleCount === 1);

      const sortedDates = [...c.dates].sort();
      const dominantCategory = Object.entries(c.categories)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

      return {
        countryName: c.countryName,
        totalArticles: c.entries.length,
        threads: threads.filter(t => t.articleCount >= 2).sort((a, b) => b.articleCount - a.articleCount),
        singleEntries: singleEntries.slice(0, 10),
        dominantCategory,
        categories: c.categories,
        dateRange: { from: sortedDates[0], to: sortedDates[sortedDates.length - 1] },
        dayCount: sortedDates.length,
      };
    })
    .sort((a, b) => b.totalArticles - a.totalArticles);
}

// ─── Existing analysis check ─────────────────────────────────────────────────

async function readExisting(countryName) {
  try {
    const { Item } = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: `${COUNTRY_PK_PREFIX}${countryName}`, SK: COUNTRY_SK },
    }));
    return Item || null;
  } catch {
    return null;
  }
}

// ─── AI generation ───────────────────────────────────────────────────────────

async function searchCountryNews(countryName) {
  if (!BRAVE_API_KEY) return [];
  try {
    const url = `${BRAVE_NEWS_ENDPOINT}?q=${encodeURIComponent(countryName + ' news')}&count=5&search_lang=en&freshness=pw`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?.results || []).slice(0, 5).map(r => ({
      title: r.title || '',
      snippet: r.description || '',
      source: r.meta_url?.hostname || r.url?.split('/')[2] || 'unknown',
      age: r.age || '',
    }));
  } catch (err) {
    console.warn(`Brave search failed for ${countryName}:`, err.message);
    return [];
  }
}

// Load automated facts from DDB (written by newsCountryFactsUpdater) and merge into
// EDITORIAL_FACTS. JSON operator entries always take precedence over DDB auto-entries.
async function loadAndMergeDDBFacts(countryName) {
  try {
    const res = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: `FACTS#${countryName}`, SK: 'COUNTRY_FACTS' },
    }));
    const record = res.Item;
    if (!record) return;
    const existing = EDITORIAL_FACTS[countryName] || {};
    EDITORIAL_FACTS[countryName] = {
      currentLeadership: record.leadershipString,
      _autoSource: 'wikidata',
      _autoUpdatedAt: record.lastUpdatedAt,
      ...existing, // JSON fields win if set
    };
    if (record.acledData && !existing.activeConflicts?.length) {
      const acled = record.acledData;
      EDITORIAL_FACTS[countryName]._acledSummary =
        `${acled.eventCount30d} conflict events in past 30 days (ACLED, as of ${acled.retrievedAt?.slice(0, 10) || '?'}). Latest: ${acled.latestEventSummary}`;
    }
  } catch (e) {
    console.warn(`DDB facts load failed for ${countryName}:`, e.message);
  }
}

// Operator-verified facts — highest authority. Supplemented by Wikidata auto-facts from DDB.
function buildEditorialBlock(countryName) {
  const facts = EDITORIAL_FACTS[countryName];
  if (!facts || typeof facts !== 'object') return '';
  if (!facts.currentLeadership && !Array.isArray(facts.activeConflicts)) return '';

  const lines = [];
  if (facts.currentLeadership) lines.push(`▸ Current leadership: ${facts.currentLeadership}`);
  if (facts.government) lines.push(`▸ Government: ${facts.government}`);
  if (Array.isArray(facts.activeConflicts) && facts.activeConflicts.length) {
    lines.push(`▸ Active conflicts:`);
    facts.activeConflicts.forEach(c => {
      lines.push(`    - ${c.name} (started ${c.startDate})`);
      if (c.trigger) lines.push(`      Trigger: ${c.trigger}`);
      if (c.currentStatus) lines.push(`      Current status: ${c.currentStatus}`);
    });
  }
  if (facts._acledSummary) lines.push(`▸ Conflict activity (auto): ${facts._acledSummary}`);

  if (!lines.length) return '';

  const stamp = facts.lastUpdated ? ` (last reviewed ${facts.lastUpdated} by operator)` : '';
  return `\n=== EDITORIAL CONTEXT for ${countryName}${stamp} — OPERATOR-VERIFIED, HIGHEST AUTHORITY ===
These are facts verified by the platform operator. They override the archive and override web search if contradicted. Use the names, dates, and triggers below as the canonical reference.

${lines.join('\n')}
`;
}

// Targeted grounding search: verify current leadership, regime changes, conflict status.
// Returns a formatted text block to inject into the prompt as verified facts.
async function gatherCountryGrounding(countryName) {
  if (!BRAVE_API_KEY) return '';
  const year = new Date().getUTCFullYear();

  const queries = [
    { label: `Current head of state / government`, q: `${countryName} current leader president prime minister ${year}` },
    { label: `Recent leadership changes / deaths`, q: `${countryName} leader killed assassinated resigned appointed ${year}` },
    { label: `Current regime / government status`, q: `${countryName} government status regime change election ${year}` },
  ];

  const results = await Promise.all(queries.map(async ({ label, q }) => {
    try {
      const url = `${BRAVE_NEWS_ENDPOINT}?q=${encodeURIComponent(q)}&count=3&search_lang=en&freshness=pm`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY },
      });
      if (!resp.ok) return { label, hits: [] };
      const data = await resp.json();
      const hits = (data?.results || []).slice(0, 3).map(r => ({
        title: r.title || '',
        snippet: r.description || '',
        source: r.meta_url?.hostname || 'unknown',
        age: r.age || '',
      }));
      return { label, hits };
    } catch (err) {
      console.warn(`Grounding search failed for "${countryName}" / "${label}":`, err.message);
      return { label, hits: [] };
    }
  }));

  const lines = [];
  for (const { label, hits } of results) {
    if (!hits.length) continue;
    lines.push(`▸ ${label}:`);
    hits.forEach(h => {
      const age = h.age ? ` · ${h.age}` : '';
      lines.push(`    - "${h.title}" — ${h.snippet} (${h.source}${age})`);
    });
  }

  if (!lines.length) return '';

  return `\n=== VERIFIED GROUNDING FACTS for ${countryName} (live web search — treat as authoritative) ===
These are current web-search results about ${countryName}'s leadership and regime status. If the archive entries below reference a leader as active but these grounding facts say they have been killed, succeeded, resigned, or replaced, defer to the grounding facts. The archive entries may be weeks old or reference events before the data window — always use the current leader's name in your analysis.

${lines.join('\n')}
`;
}

async function generateCountryIntelligence(country) {
  const threadBlock = country.threads.map((t, i) => {
    const arcSnippet = t.storyArc ? `\n  Story arc: ${t.storyArc.slice(0, 300)}` : '';
    const trajSnippet = t.trajectory ? `\n  Trajectory: ${t.trajectory.slice(0, 250)}` : '';
    return `Thread ${i + 1}: "${t.title}" [${t.category}] — ${t.articleCount} articles${arcSnippet}${trajSnippet}`;
  }).join('\n\n');

  const singleBlock = country.singleEntries.length > 0
    ? '\n\n=== SINGLE ARTICLES (no multi-day thread yet) ===\n' +
      country.singleEntries.map(e => `- ${e.date}: "${e.title}" [${e.category}] (topicId: ${e.topicId || 'unknown'})`).join('\n')
    : '';

  const catBreakdown = Object.entries(country.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(', ');

  await loadAndMergeDDBFacts(country.countryName);
  const editorialBlock = buildEditorialBlock(country.countryName);

  const [searchResults, groundingBlock] = await Promise.all([
    searchCountryNews(country.countryName),
    gatherCountryGrounding(country.countryName),
  ]);
  const referenceBlock = searchResults.length > 0
    ? '\n\n=== EXTERNAL REFERENCES (live web search) ===\n' +
      searchResults.map((r, i) => {
        const age = r.age ? ` · ${r.age}` : '';
        return `[${i + 1}] "${r.title}" — ${r.snippet} (${r.source}${age})`;
      }).join('\n') +
      '\n\nCite these as [1], [2] etc. where they support your analysis.\n'
    : '';

  const prompt = `You are a geopolitical intelligence analyst writing a country briefing for a sophisticated news intelligence platform. Below is all tracked coverage for ${country.countryName} over the past ${country.dayCount} days (${country.dateRange.from} to ${country.dateRange.to}).

AUTHORITY HIERARCHY (apply in order when facts conflict):
  1. EDITORIAL CONTEXT (operator-verified) — highest authority
  2. VERIFIED GROUNDING FACTS (live web search)
  3. ARCHIVE ENTRIES + THREAD ANALYSES
  4. EXTERNAL REFERENCES (Brave News)
${editorialBlock || ''}${groundingBlock || ''}
=== OVERVIEW ===
Country: ${country.countryName}
Total articles: ${country.totalArticles} across ${country.dayCount} days
Active story arcs: ${country.threads.length}
Category breakdown: ${catBreakdown}

=== MULTI-DAY STORY ARCS ===
${threadBlock || 'None'}
${singleBlock}
${referenceBlock}
Generate a JSON object with exactly these fields:

=== HARD CONSTRAINTS ===
- The EDITORIAL CONTEXT (if present) is the canonical source of truth. If it names a current leader, use that name. If it provides a conflict startDate or trigger, cite that as the actual beginning of the crisis even if earlier archive entries only reference ongoing events.
- If the VERIFIED GROUNDING FACTS or archive entries contradict EDITORIAL CONTEXT, defer to editorial context. Do not cite deceased or succeeded leaders as active decision-makers.
- When leadership has changed, note the transition once (e.g., "following the succession of X by Y on {date}") then proceed with the current leader throughout.
- The bluf and headline must reflect current leadership, not leadership from any stale archive window.
- When a conflict's start date from editorial context predates the archive window, use the editorial trigger as the causal anchor in backgroundTimeline (as the earliest entry) rather than treating the first archive entry as the start of the crisis.

1. "headline": A sharp 8-12 word headline capturing the country's overall situation right now. Journalistic tone, no clickbait. Must reflect current leadership if a succession occurred.

2. "bluf": ONE sentence — the bottom-line-up-front assessment. This is the single most important thing a reader needs to know. Be direct and specific.

3. "keyDevelopments": Array of 5-7 objects, each with "date" (YYYY-MM-DD) and "text" (one sentence describing what happened). Most recent first. Reference specific events, actors, and numbers. These form a visual timeline.

4. "whyItMatters": 2-3 sentences explaining the broader significance. Use **double asterisks** around the 3-5 most critical phrases so the frontend can bold them for scanners. Example: "**Oil supply disruption** threatens **European energy security** as winter approaches."

5. "backgroundTimeline": Array of 10-15 objects representing ALL significant events chronologically (oldest first). Each object has:
   - "date" (YYYY-MM-DD)
   - "event" (1 sentence describing what happened — specific actors, numbers, outcomes)
   - "category" (one of: "conflict", "politics", "economy", "diplomacy", "security", "society")
   - "topicId" (if a matching article exists in the provided data, include its topicId; otherwise null)
   This forms a visual horizontal timeline. Be comprehensive — cover the full date range.

6. "crossThreadInsight": 1-2 paragraphs identifying connections between different story arcs. How does the political situation affect the economic outlook? Name specific actors and institutions. Use **double asterisks** on key phrases.

7. "trajectory": One of "escalating", "stable", "de-escalating" — the overall direction.

8. "trajectoryDetail": 2 paragraphs on where ${country.countryName} is heading in the next 1-4 weeks. Name the 2-3 most likely scenarios (most likely first), with specific triggers or dates. Use **double asterisks** on key phrases.

9. "riskSignals": Array of 3-4 strings — specific, concrete events or thresholds to watch in the NEXT 1-2 weeks from today (${new Date().toISOString().slice(0, 10)}). All dates must be in the future. Name institutions, actors, and approximate dates. Example: "Congressional vote on defense spending expected by April 1" — NOT references to past events or vague statements.

10. "riskLevel": One of "low", "moderate", "elevated", "high" — based on the interaction of active story arcs and trajectory.

11. "riskScore": Integer 0-100 on a continuous scale. Calibration: 0-24 = low (stable democracy, no active conflict, ordinary policy friction), 25-49 = moderate (meaningful political or economic stress, limited violence), 50-74 = elevated (active conflict, major sanctions, political crisis, or systemic economic instability), 75-100 = high (open war, state failure, mass atrocity, or imminent systemic collapse). Must be consistent with riskLevel: low→0-24, moderate→25-49, elevated→50-74, high→75-100.

Return ONLY valid JSON. No markdown fences, no commentary, no extra keys.`;

  const { content, modelId, latencyMs } = await invokeGrok(prompt);
  const cleaned = stripCodeFence(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Grok response as JSON: ${err.message}\nRaw: ${cleaned.slice(0, 200)}`);
  }

  if (!parsed.bluf || !parsed.keyDevelopments) {
    throw new Error(`Missing required fields in response: ${Object.keys(parsed).join(', ')}`);
  }

  const groundingSources = searchResults.map(r => ({
    title: r.title,
    snippet: r.snippet,
    source: r.source,
    ...(r.age && { age: r.age }),
    queryUsed: `${country.countryName} news`,
  }));

  return { ...parsed, modelId, latencyMs, searchResultsCount: searchResults.length, groundingSources };
}

// ─── Write to DynamoDB ───────────────────────────────────────────────────────

async function writeAnalysis(countryName, analysis, country) {
  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + COUNTRY_TTL_DAYS * 86400;
  const generatedAt = now.toISOString();
  const dateKey = generatedAt.slice(0, 10);

  const riskScore = typeof analysis.riskScore === 'number'
    ? Math.max(0, Math.min(100, Math.round(analysis.riskScore)))
    : null;

  const coreItem = {
    countryName,
    headline: analysis.headline || null,
    bluf: analysis.bluf || null,
    keyDevelopments: Array.isArray(analysis.keyDevelopments) ? analysis.keyDevelopments.slice(0, 7) : [],
    whyItMatters: analysis.whyItMatters || null,
    situationSummary: analysis.situationSummary || null,
    backgroundTimeline: Array.isArray(analysis.backgroundTimeline) ? analysis.backgroundTimeline.slice(0, 15) : [],
    crossThreadInsight: analysis.crossThreadInsight || null,
    trajectory: analysis.trajectory || 'stable',
    trajectoryDetail: analysis.trajectoryDetail || null,
    riskSignals: Array.isArray(analysis.riskSignals) ? analysis.riskSignals.slice(0, 4) : [],
    riskLevel: analysis.riskLevel || 'moderate',
    riskScore,
    groundingSources: Array.isArray(analysis.groundingSources) ? analysis.groundingSources : [],
    dominantCategory: country.dominantCategory,
    categories: country.categories,
    totalArticles: country.totalArticles,
    activeArcCount: country.threads.length,
    dateRange: country.dateRange,
    dayCount: country.dayCount,
    generatedAt,
    model: analysis.modelId || GROK_MODEL,
    latencyMs: analysis.latencyMs || 0,
    searchResultsCount: analysis.searchResultsCount || 0,
    ttl,
  };

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: { PK: `${COUNTRY_PK_PREFIX}${countryName}`, SK: COUNTRY_SK, ...coreItem },
  }));

  // Write daily snapshot for sparkline / riskDelta
  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: `${COUNTRY_PK_PREFIX}${countryName}`,
      SK: `HISTORY#${dateKey}`,
      countryName,
      dateKey,
      riskLevel: coreItem.riskLevel,
      riskScore,
      trajectory: coreItem.trajectory,
      headline: coreItem.headline,
      generatedAt,
      ttl,
    },
  }));

  console.log(`Wrote COUNTRY_INTELLIGENCE + HISTORY#${dateKey} for ${countryName} (riskScore: ${riskScore})`);
}

// ─── Grok API ────────────────────────────────────────────────────────────────

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
