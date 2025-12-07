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
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_ENDPOINT = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '600', 10);
const DEFAULT_TEMPERATURE = Number(process.env.TEMPERATURE || '0.2');
const DEFAULT_TOP_P = Number(process.env.TOP_P || '0.9');

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const TOPICS_ITEM_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';

const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const PK_PREFIX = process.env.SUMMARY_PREDICT_PK_PREFIX || 'TOPIC#';
const SUMMARY_SK = process.env.SUMMARY_SORT_KEY || 'SUMMARY';
const PREDICTION_SK = process.env.PREDICTION_SORT_KEY || 'PREDICTION';
const SUMMARY_TTL_SECONDS = parseInt(process.env.SUMMARY_PREDICT_TTL_SECONDS || '3600', 10);
const PREDICTION_TTL_SECONDS = parseInt(process.env.PREDICTION_TTL_SECONDS || '3600', 10);
const CACHE_CLEANUP_ENABLED = String(process.env.CACHE_CLEANUP_ENABLED || 'true').toLowerCase() !== 'false';

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

exports.handler = async (event) => {
  try {
    const payload = parseEvent(event);
    const { action, topicId, readOnly } = normalizeAction(payload);
    const topics = await loadTopics();

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

    const outputs = [];
    for (const topic of filteredTopics) {
      if (action === 'summary' || action === 'both') {
        const summary = await generateAndStore(topic, 'summary');
        outputs.push(summary);
      }
      if (action === 'trace_cause') {
        const traceCause = await generateAndStore(topic, 'trace_cause');
        outputs.push(traceCause);
      }
      if (action === 'prediction' || action === 'both') {
        const prediction = await generateAndStore(topic, 'prediction');
        outputs.push(prediction);
      }
    }

    if (!readOnly && CACHE_CLEANUP_ENABLED) {
      try {
        await pruneObsoleteEntries(new Set(topics.map(t => t.id)));
      } catch (cleanupErr) {
        console.warn('Cache cleanup encountered an issue:', cleanupErr);
      }
    }

    return http(200, { success: true, generated: outputs.length, items: outputs });
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
      Key: { id: TOPICS_ITEM_ID },
    }),
  );
  if (!Item || !Array.isArray(Item.topics)) {
    return [];
  }
  return Item.topics.map((t, idx) => {
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
  });
}

function buildSummaryPrompt(topic) {
  return [
    'You are an analyst. Summarize this topic in 3-4 bullet points.',
    `Title: ${topic.title || 'Untitled Topic'}`,
    `Description: ${topic.description || 'No description provided.'}`,
    'Also highlight the main countries or regions involved if present.',
  ].join('\n\n');
}

function buildTraceCausePrompt(topic) {
  const snippets = topic.sources
    ? topic.sources.map(s => `Source (${s.source}): ${s.snippet || 'No snippet'}`).join('\n')
    : 'No article snippets available.';

  return [
    'You are a "Council of Experts" analyzing this news topic. Your goal is to provide deep context and balanced perspectives, filtering out noise.',
    `Topic: ${topic.title || 'Untitled'}`,
    `Description: ${topic.description || ''}`,
    '',
    'Refence these Article Snippets for your analysis:',
    snippets,
    '',
    'Structure your response in markdown:',
    '### 1. The Context (How We Got Here)',
    '- **Historical Analogy**: Briefly compare this to a similar historical event to explain the stakes.',
    '- **The Origin**: In 1 sentence, explain when/why this issue started (before today).',
    '- **Timeline**: Provide a very brief timeline of key events leading to this moment.',
    '',
    '### 2. Perspective Balancing (The "Echo Chamber" Breaker)',
    '- **Dominant Narrative**: What is the main angle reported by major global outlets?',
    '- **Local/Alternative Perspective**: Based on the snippets or your knowledge, what is the view from the affected region or opposing side? Identify the "Silent Perspective" if missing.',
    '- **Bias Note**: Explicitly label any clear geopolitical tilt in the sources.',
    '',
    '### 3. The "So What?" Verdict',
    '- **Impact Score (1/10)**: Rate specific Criteria: Human Impact, Economic Reach, Geopolitical Stability.',
    '- **Verdict**: Is this "True Signal" that shapes the world, or just "Noise"? Explain why in 1 sentence.',
  ].join('\n\n');
}

function buildPredictionPrompt(topic) {
  return [
    'You are a Global Systems Analyst. Your job is to map the "Chain Reaction" of this event.',
    `Topic: ${topic.title}`,
    `Premise: ${topic.description}`,
    '',
    'Tasks:',
    '1. **Chain Reaction Map**: Visualize the consequences in a logical flow:',
    '   `Event ➔ Immediate Effect ➔ 2nd Order Effect ➔ Global Consequence`',
    '   (Example: "Drought in Panama ➔ Canal traffic slows ➔ Shipping costs rise ➔ Inflation in US/Asia markets")',
    '',
    '2. **Winners & Losers**: Who benefits from this connection? Who suffers?',
    '   - **Winners**: (Countries, Industries, or Leaders)',
    '   - **Losers**: (Populations, Economies, or Alliances)',
    '',
    '3. **Watchlist Signals**: List 2 concrete future events (with approx timeframe) that would confirm this chain reaction is happening.',
  ].join('\n');
}

async function generateAndStore(topic, kind) {
  let prompt;
  if (kind === 'summary') prompt = buildSummaryPrompt(topic);
  else if (kind === 'trace_cause') prompt = buildTraceCausePrompt(topic);
  else prompt = buildPredictionPrompt(topic);

  const response = await invokeOpenAI(prompt);
  const ttlSeconds = kind === 'prediction' ? PREDICTION_TTL_SECONDS : SUMMARY_TTL_SECONDS;
  const item = await writeCache(topic, kind, response, ttlSeconds);
  return item;
}

async function invokeOpenAI(prompt) {
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const started = Date.now();
  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: DEFAULT_MAX_TOKENS,
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
  return { modelId: parsed?.model || OPENAI_MODEL, content, latencyMs };
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

async function writeCache(topic, kind, response, ttlSeconds) {
  if (!SUMMARY_TABLE) {
    throw new Error('SUMMARIZE_PREDICT_TABLE env var not set');
  }

  const pk = `${PK_PREFIX}${topic.id}`;
  let sk = SUMMARY_SK;
  if (kind === 'prediction') sk = PREDICTION_SK;
  else if (kind === 'trace_cause') sk = 'TRACE_CAUSE';
  const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

  const item = {
    PK: pk,
    SK: sk,
    topicId: topic.id,
    title: topic.title,
    action: kind,
    content: response.content,
    model: response.modelId,
    provider: 'openai',
    generatedAt: new Date().toISOString(),
    ttl,
    latencyMs: response.latencyMs,
  };

  await ddb.send(
    new PutCommand({
      TableName: SUMMARY_TABLE,
      Item: item,
    }),
  );

  console.log(`Cached ${kind} for ${topic.id} via OpenAI`);
  return item;
}

async function pruneObsoleteEntries(validTopicIds) {
  if (!SUMMARY_TABLE || !validTopicIds || !validTopicIds.size) {
    return;
  }

  const validPkSet = new Set(Array.from(validTopicIds).map(id => `${PK_PREFIX}${id}`));
  let lastEvaluatedKey = undefined;
  const keysToDelete = [];

  do {
    const { Items, LastEvaluatedKey } = await ddb.send(
      new ScanCommand({
        TableName: SUMMARY_TABLE,
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    if (Array.isArray(Items)) {
      for (const item of Items) {
        const pk = item?.PK;
        if (typeof pk === 'string' && pk.startsWith(PK_PREFIX) && !validPkSet.has(pk)) {
          keysToDelete.push({ PK: pk, SK: item.SK });
        }
      }
    }

    lastEvaluatedKey = LastEvaluatedKey;
  } while (lastEvaluatedKey);

  if (!keysToDelete.length) {
    return;
  }

  console.info('Pruning obsolete summary/prediction entries', { count: keysToDelete.length });

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
