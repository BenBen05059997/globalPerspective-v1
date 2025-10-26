'use strict';

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
  const rawAction = (payload.action || payload.mode || 'both').toString().toLowerCase();
  const allowed = ['summary', 'prediction', 'both'];
  const action = allowed.includes(rawAction) ? rawAction : 'both';

  return {
    action,
    topicId: payload.topicId || payload.topic_id || null,
    readOnly: Boolean(payload.readOnly),
  };
}

function topicMatches(topic, topicId) {
  const safeId = topicId.replace(/\s+/g, '-').toLowerCase();
  const titleSlug = String(topic.title || '').trim().replace(/\s+/g, '-').toLowerCase();
  return titleSlug === safeId || (topic.id && topic.id === topicId);
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
  return Item.topics.map((t, idx) => ({
    id: t.id || `${String(t.title || '').trim()}-${idx}`,
    title: t.title,
    description: t.description || '',
    categories: t.categories || t.category || [],
    regions: t.regions || [],
  }));
}

function buildSummaryPrompt(topic) {
  return [
    'You are an analyst. Summarize this topic in 3-4 bullet points.',
    `Title: ${topic.title || 'Untitled Topic'}`,
    `Description: ${topic.description || 'No description provided.'}`,
    'Also highlight the main countries or regions involved if present.',
  ].join('\n\n');
}

function buildPredictionPrompt(topic) {
  return [
    'You are an international affairs analyst creating a forward-looking brief for newsroom editors.',
    `Headline: ${topic.title || 'Untitled Topic'}`,
    `Context from discovery pipeline: ${topic.description || 'No description provided.'}`,
    'Tasks:',
    '1. Summarize the real-world backdrop from current reporting (reference specific regions, key actors, or events tied to this headline).',
    '2. Provide THREE forecast scenarios (Optimistic, Base Case, Risk Case). For each include:',
    '   • Likelihood (High/Medium/Low)',
    '   • Key triggers to watch (named actors, dates, negotiations, sanctions, etc.)',
    '   • Expected societal, economic, and political outcomes for the directly affected region and any global spillover.',
    '3. Conclude with a “Watchlist” of 2-3 concrete signals (e.g., UN votes, ceasefire compliance metrics, commodity price levels) reporters should monitor over the next 30/90 days.',
    'Guardrails:',
    '- Ground every statement in plausible world conditions; name relevant countries, blocs, alliances, or institutions when discussing impacts.',
    '- Avoid generic textbook language—tie predictions to the headline and present-day dynamics.',
    '- Keep the full response under 220 words; use clear sub-headings for each section.',
  ].join('\n\n');
}

async function generateAndStore(topic, kind) {
  const prompt = kind === 'summary' ? buildSummaryPrompt(topic) : buildPredictionPrompt(topic);
  const response = await invokeOpenAI(prompt);
  const ttlSeconds = kind === 'summary' ? SUMMARY_TTL_SECONDS : PREDICTION_TTL_SECONDS;
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
    action === 'prediction' ? [PREDICTION_SK] : action === 'summary' ? [SUMMARY_SK] : [SUMMARY_SK, PREDICTION_SK];

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
  const sk = kind === 'prediction' ? PREDICTION_SK : SUMMARY_SK;
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

function http(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}
