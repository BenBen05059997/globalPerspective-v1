'use strict';

const crypto = require('crypto');
const lib = require('./lib');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  BatchWriteCommand,
} = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-1-fast-non-reasoning';
const GROK_ENDPOINT = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
const GROK_KEY = process.env.XAI_API_KEY || '';
const DEFAULT_MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '600', 10);
const PREDICTION_MAX_TOKENS = parseInt(process.env.PREDICTION_MAX_TOKENS || '1500', 10);
const DEFAULT_TEMPERATURE = Number(process.env.TEMPERATURE || '0.2');
const DEFAULT_TOP_P = Number(process.env.TOP_P || '0.9');

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const STAGING_ITEM_ID = 'staging';
const ACTIVE_ITEM_ID = 'latest';

const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const PK_PREFIX = process.env.SUMMARY_PREDICT_PK_PREFIX || 'TOPIC#';
const SUMMARY_SK = process.env.SUMMARY_SORT_KEY || 'SUMMARY';
const PREDICTION_SK = process.env.PREDICTION_SORT_KEY || 'PREDICTION';
const RESEARCH_BRIEFING_SK = 'RESEARCH_BRIEFING';
const SUMMARY_TTL_SECONDS = parseInt(process.env.SUMMARY_PREDICT_TTL_SECONDS || '3600', 10);
const PREDICTION_TTL_SECONDS = parseInt(process.env.PREDICTION_TTL_SECONDS || '3600', 10);
const PREDICTION_LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
// v1 (methodology-v1) generation inputs — see PREDICTION_METHODOLOGY_V1_PLAN.md §3.
const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const FACTS_PK_PREFIX = 'FACTS#';
const FACTS_SK = 'COUNTRY_FACTS';
const ARC_DIGEST_DAYS = parseInt(process.env.ARC_DIGEST_DAYS || '7', 10);
const ARC_DIGEST_MAX = parseInt(process.env.ARC_DIGEST_MAX || '12', 10);
const CACHE_CLEANUP_ENABLED = String(process.env.CACHE_CLEANUP_ENABLED || 'true').toLowerCase() !== 'false';
const ARCHIVE_ITEM_ID = 'today-archive';
const ARCHIVE_TTL_HOURS = 24;
const DAILY_ARCHIVE_TTL_DAYS = 90;
const DAILY_ARCHIVE_MAX_SOURCES = 10;

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

const LLM_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '4', 10);

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

exports.handler = async (event) => {
  try {
    const payload = parseEvent(event);
    const { action, topicId, readOnly } = normalizeAction(payload);

    const { topics, generationId, generatedDate, generatedYear, item: stagingItem } = await loadTopics();

    if (!topics.length) {
      return http(503, { error: 'Topics cache empty or stale' });
    }

    const filteredTopics = topicId ? topics.filter(t => topicMatches(t, topicId)) : topics;
    if (!filteredTopics.length) {
      return http(404, { error: `No topic found for "${topicId}"` });
    }

    if (readOnly) {
      const results = await Promise.all(filteredTopics.map(topic => readCache(topic, action)));
      return http(200, { cached: true, results });
    }

    console.log(`Starting generation for ${filteredTopics.length} topics (generationId: ${generationId})`);

    // v1 shared context, loaded ONCE per invocation (reused by every topic + by the later
    // threadId assignment): the recent dated archive (for the arc digest + threading) and
    // verified FACTS# leaders for every region in play (for the premise block + G5 gate).
    const needsPrediction = action === 'prediction' || action === 'both';
    const pastEntries = await readPastArchiveEntries(7);
    const factsByCountry = needsPrediction
      ? await loadFactsForRegions(collectRegions(filteredTopics))
      : {};
    // generatedDate here is a HUMAN string ("July 4, 2026") — never slice it for a date.
    // The gates need a real ISO day; use UTC today (matches the log snapshot's `day`).
    const genCtx = { pastEntries, factsByCountry, generatedAtDay: new Date().toISOString().slice(0, 10) };

    const outputs = [];
    let failed = 0;
    await mapWithConcurrency(filteredTopics, LLM_CONCURRENCY, async (topic) => {
      try {
        if (action === 'summary' || action === 'both') {
          const summary = await generateAndStore(topic, 'summary', generationId, generatedDate, generatedYear, genCtx);
          outputs.push(summary);
        }
        if (action === 'trace_cause' || action === 'both') {
          const traceCause = await generateAndStore(topic, 'trace_cause', generationId, generatedDate, generatedYear, genCtx);
          outputs.push(traceCause);
        }
        if (action === 'prediction' || action === 'both') {
          const prediction = await generateAndStore(topic, 'prediction', generationId, generatedDate, generatedYear, genCtx);
          outputs.push(prediction);
        }
      } catch (topicErr) {
        failed++;
        console.error(`Generation failed for topic "${topic.title?.substring(0, 50)}":`, topicErr.message);
      }
    });

    console.log(`Generation complete: ${outputs.length} items, ${failed} failed (generationId: ${generationId})`);

    // Assign threadIds from the RAW staging topics (which retain continues_topic,
    // category, and search_keywords — fields buildTopic() drops) and stamp them
    // onto the topics that become `latest`, so the served topics carry threadId
    // for narrative links (the lede band + Home story-arc/economic badges). The
    // same map is reused by the archive write so latest and archive stay in sync.
    let threadIdById = {};
    if (outputs.length > 0 && stagingItem && Array.isArray(stagingItem.topics)) {
      try {
        stagingItem.topics.forEach((raw, idx) => {
          const id = buildStableTopicId(raw, idx);
          const tid = assignThreadId(raw, pastEntries);
          raw.threadId = tid;
          threadIdById[id] = tid;
        });
        console.log(`Assigned threadIds to ${stagingItem.topics.length} latest topics`);
      } catch (threadErr) {
        console.warn('threadId assignment for latest failed:', threadErr.message);
      }
    }

    const swapped = outputs.length > 0
      ? await swapStagingToActive(stagingItem, generationId)
      : false;

    if (!readOnly && swapped) {
      try {
        await buildAndWriteArchive(filteredTopics, generationId, threadIdById);
      } catch (archiveErr) {
        console.warn('Archive write encountered an issue:', archiveErr);
      }
    }

    if (!readOnly && CACHE_CLEANUP_ENABLED && swapped) {
      try {
        await pruneObsoleteEntries(generationId);
      } catch (cleanupErr) {
        console.warn('Cache cleanup encountered an issue:', cleanupErr);
      }
    }

    return http(200, {
      success: true,
      generated: outputs.length,
      generationId,
      swapped,
      items: outputs,
    });
  } catch (err) {
    console.error('NewsProjectInvokeAgentLambda error:', err);
    return http(500, { error: err.message || String(err) });
  }
};

/* ------------ helpers ------------ */

function parseEvent(event) {
  if (event && typeof event === 'object' && 'body' in event) {
    try {
      return typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    } catch {
      return {};
    }
  }
  return event || {};
}

function normalizeAction(payload = {}) {
  const ordered = ['summary', 'prediction', 'trace_cause', 'both'];
  const rawAction = (payload.action || payload.mode || 'both').toString().toLowerCase();
  const action = ordered.includes(rawAction) ? rawAction : 'both';

  return {
    action,
    topicId: payload.topicId || payload.topic_id || null,
    readOnly: Boolean(payload.readOnly),
  };
}

function topicMatches(topic, topicId) {
  if (!topicId) return false;

  const normalizedTarget = slugify(topicId, topicId);
  const candidates = [
    topic.id,
    topic.topicId,
    slugify(topic.id, topic.id),
    slugify(topic.topicId, topic.topicId),
    slugify(topic.title, topic.title),
  ].filter(Boolean);

  return candidates.some((candidate) => {
    if (!candidate) return false;
    return candidate === topicId || slugify(candidate, candidate) === normalizedTarget;
  });
}

async function loadTopics() {
  if (!TOPICS_TABLE) {
    throw new Error('TOPICS_DDB_TABLE env var not set');
  }

  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { id: STAGING_ITEM_ID },
    }),
  );

  const now = new Date();
  const fallbackDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const fallbackYear = now.getFullYear();

  if (!Item || !Array.isArray(Item.topics)) {
    console.warn('No staging topics found, checking active...');
    const { Item: activeItem } = await ddb.send(
      new GetCommand({
        TableName: TOPICS_TABLE,
        Key: { id: ACTIVE_ITEM_ID },
      }),
    );
    if (!activeItem || !Array.isArray(activeItem.topics)) {
      return { topics: [], generationId: null, generatedDate: null, generatedYear: null, item: null };
    }
    return {
      topics: activeItem.topics.map((t, idx) => buildTopic(t, idx)),
      generationId: activeItem.generationId || null,
      generatedDate: activeItem.generatedDate || fallbackDate,
      generatedYear: activeItem.generatedYear || fallbackYear,
      item: activeItem,
    };
  }

  return {
    topics: Item.topics.map((t, idx) => buildTopic(t, idx)),
    generationId: Item.generationId || `gen-${Date.now()}`,
    generatedDate: Item.generatedDate || fallbackDate,
    generatedYear: Item.generatedYear || fallbackYear,
    item: Item,
  };
}

function buildTopic(t, idx) {
  const stableId = buildStableTopicId(t, idx);
  const categories = Array.isArray(t.categories)
    ? t.categories
    : t.category
      ? [t.category]
      : [];

  return {
    id: stableId,
    topicId: stableId,
    title: t.title,
    description: t.description || '',
    categories,
    regions: Array.isArray(t.regions) ? t.regions : [],
    primary_location: t.primary_location,
    location_context: t.location_context,
    sources: t.sources || [],
    // Carried through so archive entries retain the fields next-day narrative
    // threading reads (Jaccard keyword overlap + continues_topic inheritance).
    // Without these, past archive entries had empty search_keywords and the
    // Jaccard threading fallback was effectively blind.
    search_keywords: Array.isArray(t.search_keywords) ? t.search_keywords : [],
    ...(t.continues_topic ? { continues_topic: t.continues_topic } : {}),
  };
}

function buildSummaryPrompt(topic, generatedDate) {
  // Ground the summary in the ACTUAL article snippets — not just the headline. Summarizing
  // from title alone made the model confabulate (e.g. asserting a vote "rejected" before it
  // happened, stapling the run-date into the text). The snippets are the only material.
  const snippets = topic.sources && topic.sources.length
    ? topic.sources.map((s) => `- (${s.source || 'source'}) ${s.snippet || ''}`).filter((l) => l.trim().length > 6).join('\n')
    : '';

  return [
    'You are an analyst summarizing a news story. Write directly — no preface, meta-commentary, or restatement of these instructions.',
    'Summarize, in 3-4 bullet points, ONLY what the source snippets below actually report.',
    'Strict rules — accuracy over richness:',
    '1) Use ONLY facts present in the snippets. Do NOT add outside knowledge, history, or framing the snippets do not contain.',
    '2) Preserve hedges exactly: if a source says "could", "may", "is expected to", "is voting on", or "reportedly", keep it hedged — never turn it into a settled fact or a result.',
    '3) Do NOT state an outcome, verdict, vote result, casualty figure, or number the snippets do not report.',
    '4) Do NOT invent or infer dates. Include a date ONLY if it appears in a snippet; otherwise omit it. Do not add today\'s date.',
    '5) If the snippets are thin or the event is unresolved, say so plainly (e.g. "the vote is pending; no result reported") rather than filling the gap.',
    `Title: ${topic.title || 'Untitled Topic'}`,
    snippets ? `Source article snippets (your ONLY material):\n${snippets}` : 'No source snippets were provided — summarize only what the title states, and say the material is limited.',
    'Also note the main countries or regions involved if the snippets mention them.',
  ].join('\n\n');
}

function buildTraceCausePrompt(topic, generatedDate) {
  const snippets = topic.sources
    ? topic.sources.map(s => `Source (${s.source}): ${s.snippet || 'No snippet'}`).join('\n')
    : 'No article snippets available.';

  return [
    `You are a "Council of Experts" analyzing news from ${generatedDate}. Respond with ONLY valid JSON — no markdown, no code fences, no commentary before or after.`,
    `Topic: ${topic.title || 'Untitled'}`,
    `Description: ${topic.description || ''}`,
    '',
    'Article Snippets:',
    snippets,
    '',
    'Grounding rule: the "proximate" event and ANY specific name, figure, or date must come from the Article Snippets — do not invent them or turn a hedge ("could") into a settled fact. The structural/contributing/alternativePerspective fields may use general background reasoning, but never fabricate a specific fact the snippets do not support; if unknown, keep it general.',
    'Return this exact JSON structure (all fields required):',
    `{
  "proximate": { "what": "string — the immediate trigger event in 1-2 sentences", "when": "string — approximate date or period" },
  "contributing": [
    { "factor": "string — a structural or proximate contributing factor", "evidence": "string — specific evidence from snippets or context" },
    { "factor": "...", "evidence": "..." }
  ],
  "structural": { "factor": "string — the deep root cause that predates recent events", "depth": "string — how long this root cause has been building (e.g. '30 years')" },
  "impactScores": { "humanImpact": <integer 1-10>, "economicReach": <integer 1-10>, "geopolitical": <integer 1-10> },
  "biasNote": "string — explicitly name any geopolitical or ideological tilt in the source coverage",
  "alternativePerspective": "string — the view from the affected region or opposing side that major outlets underreport",
  "signalVsNoise": { "verdict": "True Signal" | "Noise" | "Uncertain", "confidence": "High" | "Medium" | "Low" }
}`,
    '',
    'contributing array: include 2-4 items. impactScores: integer 1-10 each. Output only the JSON object.',
  ].join('\n');
}

// ── Two-Pass Prediction: Research Agent + Prediction Agent ──────────────────

const RESEARCH_MAX_TOKENS = 800;

function buildResearchPrompt(topic, generatedDate, generatedYear, v1 = {}) {
  const snippets = topic.sources
    ? topic.sources.map(s => `Source (${s.source}): ${s.snippet || 'No snippet'}`).join('\n')
    : '';

  const snippetBlock = snippets
    ? `\nArticle Snippets:\n${snippets}\n`
    : '';

  const { premiseBlock, arcDigest, webContext } = v1;

  return [
    `You are a geopolitical research analyst preparing a structured briefing. Today is ${generatedDate} (year ${generatedYear}).`,
    '',
    `Topic: ${topic.title}`,
    `Description: ${topic.description}`,
    `Regions: ${(topic.regions || []).join(', ') || 'Unknown'}`,
    premiseBlock || '',
    arcDigest ? `\nHow this story has evolved (our archive — use to ground trajectory, do not restate):\n${arcDigest}\n` : '',
    snippetBlock,
    webContext ? `\nLive web context (fresh search — treat as leads, cite the outlet, do not over-trust):\n${webContext}\n` : '',
    'Produce a concise research briefing with these sections. Be specific — name real people, institutions, treaties, and dates.',
    '',
    '**HISTORICAL PRECEDENTS**: List 2-3 similar historical events. For each: what happened, what was the outcome, and how long it took to resolve. This establishes the base rate.',
    '',
    '**KEY ACTORS & MOTIVATIONS**: Who are the 3-5 most important decision-makers or institutions? What does each one want? What constraints do they face?',
    '',
    `**UPCOMING DEADLINES**: List any scheduled events in the next 1-3 months (elections, summits, central bank meetings, UN sessions, treaty expirations, earnings dates, sanctions reviews) relevant to the regions involved. Include specific dates where known. Current year is ${generatedYear}.`,
    '',
    '**BALANCE OF FORCES**: In 2-3 sentences, what is the current balance of power, leverage, or momentum between the key actors? Who has the initiative?',
    '',
    'Be factual and concise. No predictions — that comes next.',
  ].join('\n');
}

function buildPredictionPrompt(topic, generatedDate, generatedYear, researchContext, v1 = {}) {
  const snippets = topic.sources
    ? topic.sources.map(s => `Source (${s.source}): ${s.snippet || 'No snippet'}`).join('\n')
    : '';

  const snippetBlock = snippets
    ? `\nArticle Snippets:\n${snippets}\n`
    : '';

  // generatedDate is a human string ("July 4, 2026"); use UTC today for date math.
  const today = new Date().toISOString().slice(0, 10);
  const horizonEnd = lib.addDays(today, lib.HORIZON_DAYS);

  return [
    `You are a geopolitical forecasting analyst. Today is ${today} (year ${generatedYear}). Respond with ONLY valid JSON — no markdown, no code fences, no commentary before or after.`,
    '',
    `Topic: ${topic.title}`,
    `Description: ${topic.description}`,
    v1.premiseBlock || '',
    snippetBlock,
    '=== RESEARCH BRIEFING (prepared by research analyst) ===',
    researchContext,
    '=== END RESEARCH BRIEFING ===',
    '',
    'Using the research briefing above, return this exact JSON structure (all fields required):',
    `{
  "scenarios": [
    {
      "label": "Most Likely",
      "probability_range": "string — e.g. '55-65%'",
      "horizon": "string — e.g. '2-4 weeks'",
      "rationale": "string — 2-4 sentences grounded in the research briefing, naming specific actors and mechanisms",
      "triggers": [
        { "text": "specific falsifiable FUTURE event", "deadline": "YYYY-MM-DD" },
        { "text": "...", "deadline": "YYYY-MM-DD" }
      ]
    },
    {
      "label": "Optimistic",
      "probability_range": "string",
      "horizon": "string",
      "rationale": "string — name which actors from the briefing would need to act differently",
      "triggers": [ { "text": "...", "deadline": "YYYY-MM-DD" } ]
    },
    {
      "label": "Pessimistic",
      "probability_range": "string",
      "horizon": "string",
      "rationale": "string — name the specific miscalculation or trigger from the briefing",
      "triggers": [ { "text": "...", "deadline": "YYYY-MM-DD" } ]
    }
  ],
  "winners": ["string — country, industry, or leader name"],
  "losers": ["string — population, economy, or alliance name"]
}`,
    '',
    'TRIGGER RULES (a trigger we cannot score is worthless — follow exactly):',
    `- deadline MUST be an absolute date in YYYY-MM-DD form, strictly AFTER ${today} and on/before ${horizonEnd}.`,
    '- The trigger must describe a FUTURE event that has NOT happened yet — never restate something already reported in the briefing or snippets (that is not a prediction).',
    '- If a claim has a window ("within 2 weeks"), put the END of the window as the deadline — never a relative phrase, never a past "precedent" date.',
    '- text must be a single, concrete, checkable event (who does what) — not a vague mood ("tensions rise").',
    '- Only name a person in an office if the VERIFIED FACTS above (or the briefing) support it.',
    `probability_range: a range string like "55-65%"; all three must sum to ~100%. Output only the JSON object.`,
  ].join('\n');
}

async function generateAndStore(topic, kind, generationId, generatedDate, generatedYear, ctx = {}) {
  let prompt;
  let maxTokens = DEFAULT_MAX_TOKENS;
  if (kind === 'summary') {
    prompt = buildSummaryPrompt(topic, generatedDate);
  } else if (kind === 'trace_cause') {
    prompt = buildTraceCausePrompt(topic, generatedDate);
  } else {
    // Two-pass prediction: Research Agent → Prediction Agent.
    // v1: the research pass is grounded (verified FACTS# premises + the story's own arc digest
    // + optional live Brave web context) instead of relying on the model's parametric memory.
    const premiseBlock = buildPremiseBlock(topic, ctx.factsByCountry);
    const arcDigest = buildArcDigest(topic, ctx.pastEntries);
    const webContext = await braveGroundResearch(topic);
    const researchPrompt = buildResearchPrompt(topic, generatedDate, generatedYear, { premiseBlock, arcDigest, webContext });
    const researchResponse = await invokeGrok(researchPrompt, RESEARCH_MAX_TOKENS);
    console.log(`Research pass complete for "${topic.title?.substring(0, 40)}" (${researchResponse.latencyMs}ms)`);
    await writeCache(topic, 'research_briefing', researchResponse, PREDICTION_TTL_SECONDS, generationId);

    prompt = buildPredictionPrompt(topic, generatedDate, generatedYear, researchResponse.content, { premiseBlock });
    maxTokens = PREDICTION_MAX_TOKENS;
  }

  const response = await invokeGrok(prompt, maxTokens);

  if (kind === 'prediction' || kind === 'trace_cause') {
    response.content = normalizeJsonResponse(response.content, kind);
  }

  const ttlSeconds = kind === 'prediction' ? PREDICTION_TTL_SECONDS : SUMMARY_TTL_SECONDS;
  const item = await writeCache(topic, kind, response, ttlSeconds, generationId);

  if (kind === 'prediction') {
    await logPredictionSnapshot(topic, response.content, response, generationId, generatedYear, ctx);
  }

  return item;
}

function normalizeJsonResponse(raw, kind) {
  let text = (raw || '').trim();
  // Strip markdown code fences if model wrapped the JSON
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    JSON.parse(text);
    return text;
  } catch {
    console.warn(`${kind} response was not valid JSON — storing raw. First 200 chars: ${text.slice(0, 200)}`);
    return raw;
  }
}

async function invokeGrok(prompt, maxTokens) {
  if (!GROK_KEY) {
    throw new Error('XAI_API_KEY is not configured');
  }

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
      max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      top_p: DEFAULT_TOP_P,
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
    throw new Error(`OpenAI error: ${message}`);
  }

  const content = extractContent(parsed);
  return { modelId: parsed?.model || GROK_MODEL, content, latencyMs };
}

function stripCodeFence(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}

function normalizeMessageContent(content) {
  if (typeof content === 'string') {
    return stripCodeFence(content);
  }
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        if (part && typeof part.content === 'string') return part.content;
        return '';
      })
      .join('')
      .trim();
  }
  if (content && typeof content === 'object' && typeof content.text === 'string') {
    return stripCodeFence(content.text);
  }
  return '';
}

function extractContent(payload) {
  if (!payload) return '';

  const openAIMessage = payload?.choices?.[0]?.message?.content;
  const openAIString = normalizeMessageContent(openAIMessage);
  if (openAIString) return openAIString;

  if (typeof payload === 'string') return payload.trim();
  return JSON.stringify(payload);
}

async function readCache(topic, action) {
  if (!SUMMARY_TABLE) {
    throw new Error('SUMMARIZE_PREDICT_TABLE env var not set');
  }
  const pk = `${PK_PREFIX}${topic.id}`;
  const sks =
    action === 'prediction'
      ? [PREDICTION_SK]
      : action === 'trace_cause'
        ? ['TRACE_CAUSE']
        : action === 'summary'
          ? [SUMMARY_SK]
          : [SUMMARY_SK, PREDICTION_SK, 'TRACE_CAUSE'];

  const results = [];
  for (const sk of sks) {
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: pk, SK: sk },
      }),
    );
    if (Item) {
      results.push(Item);
    }
  }
  return { topicId: topic.id, items: results };
}

async function writeCache(topic, kind, response, ttlSeconds, generationId) {
  if (!SUMMARY_TABLE) {
    throw new Error('SUMMARIZE_PREDICT_TABLE env var not set');
  }

  const pk = `${PK_PREFIX}${topic.id}`;
  let sk = SUMMARY_SK;
  if (kind === 'prediction') sk = PREDICTION_SK;
  else if (kind === 'trace_cause') sk = 'TRACE_CAUSE';
  else if (kind === 'research_briefing') sk = RESEARCH_BRIEFING_SK;
  const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

  const isJson = (kind === 'prediction' || kind === 'trace_cause') && (() => {
    try { JSON.parse(response.content); return true; } catch { return false; }
  })();

  const item = {
    PK: pk,
    SK: sk,
    topicId: topic.id,
    title: topic.title,
    action: kind,
    content: response.content,
    contentFormat: isJson ? 'json' : 'markdown',
    model: response.modelId,
    provider: 'openai',
    generatedAt: new Date().toISOString(),
    generationId,
    ttl,
    latencyMs: response.latencyMs,
  };

  await ddb.send(
    new PutCommand({
      TableName: SUMMARY_TABLE,
      Item: item,
    }),
  );

  console.log(`Cached ${kind} for ${topic.id} (generationId: ${generationId})`);
  return item;
}

// Deadline parsing + probability midpoint now live in ./lib (single source, unit-tested) so the
// capture gates and the log write can't drift apart. See lib.parseTriggerDeadline / probabilityMidpoint.

/* ---- v1 grounded-generation helpers (PREDICTION_METHODOLOGY_V1_PLAN.md §3) ---- */

// De-duplicated list of every region named across the topics we're about to predict on.
function collectRegions(topics) {
  const set = new Set();
  for (const t of topics) for (const r of (t.regions || [])) if (r) set.add(String(r));
  return [...set];
}

// Load verified FACTS# leadership for a set of countries, once per invocation. Coverage-honest:
// countries with no FACTS row simply don't appear in the map (→ premise block + G5 skip them).
// Shape per country: { country, current:[names], stale:[] } — `stale` is empty until a source of
// FORMER office-holders exists (newsCountryFactsUpdater detects changes but doesn't yet record the
// outgoing name), so the G5 *gate* stays dormant while the premise *injection* does the real work.
const _factsCache = new Map();
async function loadFactsForRegions(regions) {
  const out = {};
  for (const country of regions) {
    if (!_factsCache.has(country)) {
      let rec = null;
      try {
        const { Item } = await ddb.send(new GetCommand({
          TableName: SUMMARY_TABLE,
          Key: { PK: `${FACTS_PK_PREFIX}${country}`, SK: FACTS_SK },
        }));
        if (Item) {
          const current = [Item.headOfState?.name, Item.headOfGovernment?.name].filter(Boolean);
          rec = { country, current, stale: [], leadershipString: Item.leadershipString || '' };
        }
      } catch (err) {
        console.warn(`FACTS load failed for ${country}: ${err.message}`);
      }
      _factsCache.set(country, rec);
    }
    const rec = _factsCache.get(country);
    if (rec) out[country] = rec;
  }
  return out;
}

// The facts rows relevant to one topic (its regions).
function factsForTopic(topic, factsByCountry = {}) {
  return (topic.regions || []).map(r => factsByCountry[r]).filter(Boolean);
}

// Verified-premise block injected into both prompts so the model builds on real, current
// office-holders instead of its (stale) parametric memory. Prevents the false-leader defect
// class (pilot #15: "Nyusi" vs verified Chapo) at the source.
function buildPremiseBlock(topic, factsByCountry = {}) {
  const facts = factsForTopic(topic, factsByCountry);
  if (!facts.length) return '';
  const lines = facts
    .map(f => f.leadershipString || (f.current.length ? `${f.country}: ${f.current.join('; ')}` : ''))
    .filter(Boolean);
  if (!lines.length) return '';
  return `\nVERIFIED FACTS (authoritative — override anything you recall; do NOT name a different office-holder):\n${lines.map(l => `- ${l}`).join('\n')}\n`;
}

// A compact dated digest of how THIS story has evolved, from our own archive — so the forecast
// builds on the arc, not just today's 48h snapshot. Matches past entries to the topic by the
// same continues_topic + Jaccard logic used for threading (threadId isn't assigned until after
// generation, so we can't key on it here). Returns "" when there's no real prior coverage.
function buildArcDigest(topic, pastEntries = []) {
  if (!pastEntries.length) return '';
  const related = pastEntries.filter(e =>
    (topic.continues_topic && e.title === topic.continues_topic) || computeJaccardScore(topic, e) >= 0.4,
  );
  const seen = new Set();
  const rows = [];
  for (const e of related) {
    const key = `${e.date || ''}|${e.title || ''}`;
    if (seen.has(key) || !e.title) continue;
    seen.add(key);
    rows.push({ date: e.date || '', title: e.title });
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!rows.length) return '';
  return rows.slice(-ARC_DIGEST_MAX).map(r => `- ${r.date || '(undated)'}: ${r.title}`).join('\n');
}

// Optional live web grounding for the research pass (1a). No-ops without BRAVE_SEARCH_API_KEY,
// and never throws into generation — a failed/absent search just yields no web context.
async function braveGroundResearch(topic) {
  if (!BRAVE_SEARCH_API_KEY) return '';
  const q = [topic.title, ...(topic.search_keywords || [])].filter(Boolean).join(' ').slice(0, 380);
  if (!q) return '';
  try {
    const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(q)}&count=5&freshness=pw`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': BRAVE_SEARCH_API_KEY } });
    if (!res.ok) return '';
    const data = await res.json();
    const items = (data?.results || []).slice(0, 5)
      .map(r => `- (${r.meta_url?.hostname || r.source || 'web'}) ${r.title}${r.age ? ` [${r.age}]` : ''}`);
    return items.join('\n');
  } catch (err) {
    console.warn(`Brave grounding failed for "${topic.title?.slice(0, 40)}": ${err.message}`);
    return '';
  }
}

// Immutable daily snapshot of a prediction so it survives its 1h cache TTL and
// can be scored once its dated triggers come due. Best-effort: never throws into
// the pipeline (logging a forecast must not break generating one).
async function logPredictionSnapshot(topic, contentStr, response, generationId, generatedYear, ctx = {}) {
  try {
    let parsed;
    try { parsed = JSON.parse(contentStr); } catch { return; }
    if (!parsed || !Array.isArray(parsed.scenarios)) return;

    const day = new Date().toISOString().slice(0, 10);
    // v1 capture gates: turn raw scenarios into structured, validated triggers. Malformed
    // triggers (retrodictions, relative windows, false premises, unparseable dates) are dropped
    // and recorded in `capture.dropped` — they never enter the scoreable record. See lib.js.
    const facts = factsForTopic(topic, ctx.factsByCountry);
    const { scenarios, capture } = lib.buildGatedScenarios(parsed.scenarios, {
      generatedAtDay: (ctx.generatedAtDay || day),
      fallbackYear: generatedYear,
      facts,
    });

    const item = {
      PK: `PRED#${topic.id}`,
      SK: day,
      topicId: topic.id,
      title: topic.title,
      category: topic.category || null,
      generatedAt: new Date().toISOString(),
      generationId,
      model: response.modelId,
      methodologyVersion: lib.METHODOLOGY_VERSION,
      scenarios,
      capture,
      winners: Array.isArray(parsed.winners) ? parsed.winners : [],
      losers: Array.isArray(parsed.losers) ? parsed.losers : [],
      status: 'open',
    };

    await ddb.send(new PutCommand({ TableName: PREDICTION_LOG_TABLE, Item: item }));
    console.log(`Logged prediction snapshot ${item.PK}/${day} v${lib.METHODOLOGY_VERSION} (${capture.kept} triggers kept, ${capture.dropped.length} gated out)`);
  } catch (err) {
    console.warn(`logPredictionSnapshot failed for ${topic.id}: ${err.message}`);
  }
}

async function swapStagingToActive(stagingItem, generationId) {
  if (!TOPICS_TABLE || !stagingItem) {
    console.warn('Cannot swap: missing table or staging item');
    return false;
  }

  try {
    const activeItem = {
      ...stagingItem,
      id: ACTIVE_ITEM_ID,
      status: 'active',
      activatedAt: new Date().toISOString(),
    };

    await ddb.send(
      new PutCommand({
        TableName: TOPICS_TABLE,
        Item: activeItem,
      }),
    );

    console.log(`Swapped staging -> active (generationId: ${generationId})`);
    return true;
  } catch (err) {
    console.error('Failed to swap staging to active:', err);
    return false;
  }
}

async function pruneObsoleteEntries(currentGenerationId) {
  if (!SUMMARY_TABLE || !currentGenerationId) {
    return;
  }

  let lastEvaluatedKey = undefined;
  const keysToDelete = [];

  do {
    const { Items, LastEvaluatedKey } = await ddb.send(
      new ScanCommand({
        TableName: SUMMARY_TABLE,
        ProjectionExpression: 'PK, SK, generationId',
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    if (Array.isArray(Items)) {
      for (const item of Items) {
        const pk = item?.PK;
        const itemGenId = item?.generationId;

        if (
          typeof pk === 'string' &&
          pk.startsWith(PK_PREFIX) &&
          (!itemGenId || itemGenId !== currentGenerationId)
        ) {
          keysToDelete.push({ PK: pk, SK: item.SK });
        }
      }
    }

    lastEvaluatedKey = LastEvaluatedKey;
  } while (lastEvaluatedKey);

  if (!keysToDelete.length) {
    console.info('No obsolete entries to prune');
    return;
  }

  console.info(`Pruning ${keysToDelete.length} entries from old generations`);

  const chunks = [];
  for (let i = 0; i < keysToDelete.length; i += 25) {
    chunks.push(keysToDelete.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [SUMMARY_TABLE]: chunk.map(key => ({
            DeleteRequest: { Key: key },
          })),
        },
      }),
    );
  }
}

async function fetchAiContent(topicId) {
  const pk = `${PK_PREFIX}${topicId}`;
  const [summaryResult, predictionResult, traceResult] = await Promise.all([
    ddb.send(new GetCommand({ TableName: SUMMARY_TABLE, Key: { PK: pk, SK: SUMMARY_SK } })),
    ddb.send(new GetCommand({ TableName: SUMMARY_TABLE, Key: { PK: pk, SK: PREDICTION_SK } })),
    ddb.send(new GetCommand({ TableName: SUMMARY_TABLE, Key: { PK: pk, SK: 'TRACE_CAUSE' } })),
  ]);
  return {
    summary: summaryResult.Item?.content || null,
    prediction: predictionResult.Item?.content || null,
    trace_cause: traceResult.Item?.content || null,
  };
}

function buildArchiveEntry(topic, ai, generationId, sourceCap, threadId) {
  return {
    topicId: topic.id,
    threadId: threadId || generateThreadId(topic),
    title: topic.title,
    category: Array.isArray(topic.categories) ? topic.categories[0] || '' : '',
    regions: topic.regions || [],
    search_keywords: topic.search_keywords || [],
    sources: (topic.sources || []).slice(0, sourceCap),
    archivedAt: new Date().toISOString(),
    generationId,
    ai,
    ...(topic.continues_topic && { continues_topic: topic.continues_topic }),
  };
}

const MAX_ARCHIVE_ENTRIES = 50;
const MAX_AI_CHARS = 1500;

function trimAi(entry) {
  if (!entry.ai) return entry;
  const trimmed = {};
  for (const [k, v] of Object.entries(entry.ai)) {
    trimmed[k] = typeof v === 'string' && v.length > MAX_AI_CHARS
      ? v.slice(0, MAX_AI_CHARS) + '...'
      : v;
  }
  return { ...entry, ai: trimmed };
}

function formatDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `archive#${y}-${m}-${d}`;
}

// ============================================================
// NARRATIVE THREADING - threadId assignment
// ============================================================

const THREAD_STOP_WORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
  'is', 'are', 'was', 'were', 'as', 'by', 'its', 'be', 'with', 'from',
]);

function topicSignature(topic) {
  const titleWords = String(topic.title || '')
    .toLowerCase().split(/\W+/)
    .filter(w => w.length > 2 && !THREAD_STOP_WORDS.has(w));
  const keywords = (topic.search_keywords || []).map(k => String(k).toLowerCase());
  return new Set([...titleWords, ...keywords]);
}

function jaccard(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const item of setA) { if (setB.has(item)) intersection++; }
  return intersection / (setA.size + setB.size - intersection);
}

function computeJaccardScore(topic, pastEntry) {
  const keywordScore = jaccard(topicSignature(topic), topicSignature(pastEntry));
  const regionsA = new Set((topic.regions || []).map(r => String(r).toLowerCase()));
  const regionsB = new Set((pastEntry.regions || []).map(r => String(r).toLowerCase()));
  const regionScore = jaccard(regionsA, regionsB);
  const categoryScore = (topic.category || '') === (pastEntry.category || '') ? 1 : 0;
  return (0.5 * keywordScore) + (0.3 * regionScore) + (0.2 * categoryScore);
}

function generateThreadId(topic) {
  const slug = slugify(topic.title || 'topic', 'topic').slice(0, 30);
  const hash = crypto.createHash('sha1').update(topic.title || '').digest('hex').slice(0, 6);
  return `thread-${slug}-${hash}`;
}

function assignThreadId(topic, pastEntries) {
  // 1. Grok detected a continuation — look up that topic's threadId
  if (topic.continues_topic) {
    const match = pastEntries.find(e => e.title === topic.continues_topic && e.threadId);
    if (match) {
      console.log(`Thread inherited via continues_topic: "${topic.title}" -> ${match.threadId}`);
      return match.threadId;
    }
  }

  // 2. Jaccard keyword similarity fallback
  let bestScore = 0;
  let bestEntry = null;
  for (const entry of pastEntries) {
    const score = computeJaccardScore(topic, entry);
    if (score > bestScore) { bestScore = score; bestEntry = entry; }
  }
  if (bestScore >= 0.4 && bestEntry?.threadId) {
    console.log(`Thread inherited via Jaccard (${bestScore.toFixed(2)}): "${topic.title}" -> ${bestEntry.threadId}`);
    return bestEntry.threadId;
  }

  // 3. New thread
  const newId = generateThreadId(topic);
  console.log(`New thread created: "${topic.title}" -> ${newId}`);
  return newId;
}

async function readPastArchiveEntries(days) {
  if (!TOPICS_TABLE) return [];
  try {
    const entries = [];
    const now = new Date();
    for (let i = 1; i <= days; i++) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - i);
      const key = formatDateKey(date);
      try {
        const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: key } }));
        if (Item && Array.isArray(Item.entries)) {
          entries.push(...Item.entries.map(e => ({
            topicId: e.topicId,
            threadId: e.threadId,
            title: e.title,
            search_keywords: e.search_keywords || [],
            regions: e.regions || [],
            category: e.category || '',
            date: key.replace(/^archive#/, ''), // for the v1 arc digest (buildArcDigest)
          })));
        }
      } catch (_) {}
    }
    console.log(`Past archive entries for threading: ${entries.length} across ${days} days`);
    return entries;
  } catch (err) {
    console.warn('Failed to read past archive entries:', err.message);
    return [];
  }
}

async function buildAndWriteArchive(topics, generationId, threadIdByTopicArg = {}) {
  if (!TOPICS_TABLE || !SUMMARY_TABLE) {
    console.warn('Cannot write archive: missing table config');
    return false;
  }

  try {
    const now = new Date();

    // Fetch AI content + past archive entries in parallel
    const [aiByTopic, pastEntries] = await Promise.all([
      (async () => {
        const result = {};
        for (const topic of topics) {
          result[topic.id] = await fetchAiContent(topic.id);
        }
        return result;
      })(),
      readPastArchiveEntries(7),
    ]);

    // Reuse the threadIds computed from the raw topics for `latest` so the
    // archive stays in sync; fall back to local assignment for any topic the
    // map is missing (e.g. single-topic manual invokes).
    const threadIdByTopic = {};
    for (const topic of topics) {
      threadIdByTopic[topic.id] = threadIdByTopicArg[topic.id] || assignThreadId(topic, pastEntries);
    }

    // --- Today archive (free tier, 24h TTL, 3 sources) ---
    const { Item: existingArchive } = await ddb.send(
      new GetCommand({ TableName: TOPICS_TABLE, Key: { id: ARCHIVE_ITEM_ID } }),
    );
    const existingEntries = Array.isArray(existingArchive?.entries)
      ? existingArchive.entries
      : [];

    const todayEntries = topics.map(t => buildArchiveEntry(t, aiByTopic[t.id], generationId, 3, threadIdByTopic[t.id]));
    const newTopicIds = new Set(todayEntries.map(e => e.topicId));
    const cutoff = Date.now() - (ARCHIVE_TTL_HOURS * 60 * 60 * 1000);
    const mergedToday = [
      ...existingEntries.filter(e =>
        !newTopicIds.has(e.topicId) &&
        new Date(e.archivedAt).getTime() > cutoff
      ),
      ...todayEntries,
    ].map(trimAi).slice(-MAX_ARCHIVE_ENTRIES);

    const todayTtl = Math.floor(now.getTime() / 1000) + (ARCHIVE_TTL_HOURS * 3600);
    await ddb.send(
      new PutCommand({
        TableName: TOPICS_TABLE,
        Item: {
          id: ARCHIVE_ITEM_ID,
          entries: mergedToday,
          updatedAt: now.toISOString(),
          ttl: todayTtl,
        },
      }),
    );
    console.log(`Today archive written: ${todayEntries.length} new + ${mergedToday.length - todayEntries.length} existing = ${mergedToday.length} total`);

    // --- Daily archive (paid tiers, 7-day TTL, 10 sources) ---
    const dailyKey = formatDateKey(now);
    const { Item: existingDaily } = await ddb.send(
      new GetCommand({ TableName: TOPICS_TABLE, Key: { id: dailyKey } }),
    );
    const existingDailyEntries = Array.isArray(existingDaily?.entries)
      ? existingDaily.entries
      : [];

    const dailyEntries = topics.map(t => buildArchiveEntry(t, aiByTopic[t.id], generationId, DAILY_ARCHIVE_MAX_SOURCES, threadIdByTopic[t.id]));
    const dailyTopicIds = new Set(dailyEntries.map(e => e.topicId));
    const mergedDaily = [
      ...existingDailyEntries.filter(e => !dailyTopicIds.has(e.topicId)),
      ...dailyEntries,
    ].map(trimAi).slice(-MAX_ARCHIVE_ENTRIES);

    const dailyTtl = Math.floor(now.getTime() / 1000) + (DAILY_ARCHIVE_TTL_DAYS * 24 * 3600);
    await ddb.send(
      new PutCommand({
        TableName: TOPICS_TABLE,
        Item: {
          id: dailyKey,
          entries: mergedDaily,
          updatedAt: now.toISOString(),
          ttl: dailyTtl,
        },
      }),
    );
    console.log(`Daily archive written (${dailyKey}): ${dailyEntries.length} new + ${mergedDaily.length - dailyEntries.length} existing = ${mergedDaily.length} total`);

    return true;
  } catch (err) {
    console.error('Failed to write archive:', err);
    return false;
  }
}

function slugify(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80) || fallback;
}

function normalizeList(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function buildStableTopicId(topic, idx = 0) {
  if (topic?.id) {
    return String(topic.id);
  }
  if (topic?.topicId) {
    return String(topic.topicId);
  }

  const title = String(topic?.title || '').trim();
  const category = String(
    Array.isArray(topic?.categories) && topic.categories.length ? topic.categories[0] : topic?.category || '',
  ).trim();
  const primaryLocation = String(topic?.primary_location || '').trim();
  const regions = normalizeList(topic?.regions);
  const keywords = normalizeList(topic?.search_keywords);

  const payload = JSON.stringify({
    title: title.toLowerCase(),
    category: category.toLowerCase(),
    primaryLocation: primaryLocation.toLowerCase(),
    regions,
    keywords,
  });

  const hash = crypto.createHash('sha1').update(payload || `${idx}`).digest('hex').slice(0, 10);
  const slugBase = slugify(title || primaryLocation || `topic-${idx}`, `topic-${idx}`);
  return `${slugBase}-${hash}`;
}

function http(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}
