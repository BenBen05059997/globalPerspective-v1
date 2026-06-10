'use strict';

const crypto = require('crypto');
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

    const outputs = [];
    let failed = 0;
    await mapWithConcurrency(filteredTopics, LLM_CONCURRENCY, async (topic) => {
      try {
        if (action === 'summary' || action === 'both') {
          const summary = await generateAndStore(topic, 'summary', generationId, generatedDate, generatedYear);
          outputs.push(summary);
        }
        if (action === 'trace_cause' || action === 'both') {
          const traceCause = await generateAndStore(topic, 'trace_cause', generationId, generatedDate, generatedYear);
          outputs.push(traceCause);
        }
        if (action === 'prediction' || action === 'both') {
          const prediction = await generateAndStore(topic, 'prediction', generationId, generatedDate, generatedYear);
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
        const pastEntries = await readPastArchiveEntries(7);
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
  };
}

function buildSummaryPrompt(topic, generatedDate) {
  return [
    `You are an analyst summarizing news from ${generatedDate}. Write directly — do not preface with any introduction, meta-commentary, or restatement of these instructions.`,
    'Summarize this topic in 3-4 bullet points.',
    `Title: ${topic.title || 'Untitled Topic'}`,
    `Description: ${topic.description || 'No description provided.'}`,
    'Also highlight the main countries or regions involved if present.',
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

function buildResearchPrompt(topic, generatedDate, generatedYear) {
  const snippets = topic.sources
    ? topic.sources.map(s => `Source (${s.source}): ${s.snippet || 'No snippet'}`).join('\n')
    : '';

  const snippetBlock = snippets
    ? `\nArticle Snippets:\n${snippets}\n`
    : '';

  return [
    `You are a geopolitical research analyst preparing a structured briefing. Today is ${generatedDate} (year ${generatedYear}).`,
    '',
    `Topic: ${topic.title}`,
    `Description: ${topic.description}`,
    `Regions: ${(topic.regions || []).join(', ') || 'Unknown'}`,
    snippetBlock,
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

function buildPredictionPrompt(topic, generatedDate, generatedYear, researchContext) {
  const snippets = topic.sources
    ? topic.sources.map(s => `Source (${s.source}): ${s.snippet || 'No snippet'}`).join('\n')
    : '';

  const snippetBlock = snippets
    ? `\nArticle Snippets:\n${snippets}\n`
    : '';

  return [
    `You are a geopolitical forecasting analyst. Today is ${generatedDate} (year ${generatedYear}). Respond with ONLY valid JSON — no markdown, no code fences, no commentary before or after.`,
    '',
    `Topic: ${topic.title}`,
    `Description: ${topic.description}`,
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
      "triggers": ["string — specific falsifiable event with date/deadline", "string", "string"]
    },
    {
      "label": "Optimistic",
      "probability_range": "string",
      "horizon": "string",
      "rationale": "string — name which actors from the briefing would need to act differently",
      "triggers": ["string", "string"]
    },
    {
      "label": "Pessimistic",
      "probability_range": "string",
      "horizon": "string",
      "rationale": "string — name the specific miscalculation or trigger from the briefing",
      "triggers": ["string", "string"]
    }
  ],
  "winners": ["string — country, industry, or leader name"],
  "losers": ["string — population, economy, or alliance name"]
}`,
    '',
    `probability_range: must be a range string like "55-65%". All three probability_range values must sum to ~100%. triggers: each must reference a specific date, deadline, or named event from ${generatedYear}. Output only the JSON object.`,
  ].join('\n');
}

async function generateAndStore(topic, kind, generationId, generatedDate, generatedYear) {
  let prompt;
  let maxTokens = DEFAULT_MAX_TOKENS;
  if (kind === 'summary') {
    prompt = buildSummaryPrompt(topic, generatedDate);
  } else if (kind === 'trace_cause') {
    prompt = buildTraceCausePrompt(topic, generatedDate);
  } else {
    // Two-pass prediction: Research Agent → Prediction Agent
    const researchPrompt = buildResearchPrompt(topic, generatedDate, generatedYear);
    const researchResponse = await invokeGrok(researchPrompt, RESEARCH_MAX_TOKENS);
    console.log(`Research pass complete for "${topic.title?.substring(0, 40)}" (${researchResponse.latencyMs}ms)`);
    await writeCache(topic, 'research_briefing', researchResponse, PREDICTION_TTL_SECONDS, generationId);

    prompt = buildPredictionPrompt(topic, generatedDate, generatedYear, researchResponse.content);
    maxTokens = PREDICTION_MAX_TOKENS;
  }

  const response = await invokeGrok(prompt, maxTokens);

  if (kind === 'prediction' || kind === 'trace_cause') {
    response.content = normalizeJsonResponse(response.content, kind);
  }

  const ttlSeconds = kind === 'prediction' ? PREDICTION_TTL_SECONDS : SUMMARY_TTL_SECONDS;
  const item = await writeCache(topic, kind, response, ttlSeconds, generationId);

  if (kind === 'prediction') {
    await logPredictionSnapshot(topic, response.content, response, generationId, generatedYear);
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

// "55-65%" → 0.60 (midpoint, 0-1). "60%" → 0.60. Returns null if unparseable.
function probabilityMidpoint(range) {
  if (!range || typeof range !== 'string') return null;
  const nums = (range.match(/\d{1,3}(?:\.\d+)?/g) || []).map(Number).filter(n => n >= 0 && n <= 100);
  if (!nums.length) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.round((avg / 100) * 1000) / 1000;
}

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function lastDayOfMonth(year, monthIdx) {
  return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
}

function isoDate(year, monthIdx, day) {
  if (!year || monthIdx == null) return null;
  const d = String(day).padStart(2, '0');
  const m = String(monthIdx + 1).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

// Best-effort: pull a deadline date out of a free-text trigger.
// Handles ISO, "Month D, YYYY", "D Month YYYY", "end of Month YYYY", "Month YYYY", "QN YYYY".
function parseTriggerDeadline(text, fallbackYear) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();

  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const monthNames = Object.keys(MONTHS).join('|');

  // "june 9, 2026" / "june 9 2026"
  m = t.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`));
  if (m) return isoDate(Number(m[3]), MONTHS[m[1]], Number(m[2]));

  // "9 june 2026"
  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})\\s+(\\d{4})`));
  if (m) return isoDate(Number(m[3]), MONTHS[m[2]], Number(m[1]));

  // "end of june 2026" / "late june 2026" → last day of month
  m = t.match(new RegExp(`\\b(?:end of|late)\\s+(${monthNames})\\s+(\\d{4})`));
  if (m) { const y = Number(m[2]); const mi = MONTHS[m[1]]; return isoDate(y, mi, lastDayOfMonth(y, mi)); }

  // "qN 2026" → quarter end
  m = t.match(/\bq([1-4])\s+(\d{4})/);
  if (m) { const q = Number(m[1]); const y = Number(m[2]); const mi = q * 3 - 1; return isoDate(y, mi, lastDayOfMonth(y, mi)); }

  // bare "june 2026" → last day of month (loosest, keep last so dated forms win)
  m = t.match(new RegExp(`\\b(${monthNames})\\s+(\\d{4})`));
  if (m) { const y = Number(m[2]); const mi = MONTHS[m[1]]; return isoDate(y, mi, lastDayOfMonth(y, mi)); }

  return null;
}

// Immutable daily snapshot of a prediction so it survives its 1h cache TTL and
// can be scored once its dated triggers come due. Best-effort: never throws into
// the pipeline (logging a forecast must not break generating one).
async function logPredictionSnapshot(topic, contentStr, response, generationId, generatedYear) {
  try {
    let parsed;
    try { parsed = JSON.parse(contentStr); } catch { return; }
    if (!parsed || !Array.isArray(parsed.scenarios)) return;

    const day = new Date().toISOString().slice(0, 10);
    const scenarios = parsed.scenarios.map((s, si) => {
      const prob = probabilityMidpoint(s.probability_range);
      const triggers = (Array.isArray(s.triggers) ? s.triggers : []).map((text, ti) => ({
        id: `${si}-${ti}`,
        text: String(text),
        deadline: parseTriggerDeadline(String(text), generatedYear),
        status: 'pending',
      }));
      return {
        label: s.label || `Scenario ${si + 1}`,
        probabilityRange: s.probability_range || null,
        probability: prob,
        horizon: s.horizon || null,
        rationale: s.rationale || null,
        triggers,
      };
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
      scenarios,
      winners: Array.isArray(parsed.winners) ? parsed.winners : [],
      losers: Array.isArray(parsed.losers) ? parsed.losers : [],
      status: 'open',
    };

    await ddb.send(new PutCommand({ TableName: PREDICTION_LOG_TABLE, Item: item }));
    const dated = scenarios.reduce((n, s) => n + s.triggers.filter(t => t.deadline).length, 0);
    console.log(`Logged prediction snapshot ${item.PK}/${day} (${dated} dated triggers)`);
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
