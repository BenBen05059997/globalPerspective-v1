'use strict';

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const DEFAULT_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'qwen.qwen3-32b-v1:0';
const DEFAULT_MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '600', 10);
const DEFAULT_TEMPERATURE = Number(process.env.TEMPERATURE || '0.2');
const DEFAULT_TOP_P = Number(process.env.TOP_P || '0.9');

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_ENDPOINT = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

const AI_PROVIDER = (() => {
  const explicit = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (OPENAI_KEY) return 'openai';
  return 'bedrock';
})();

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const TOPICS_ITEM_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';

const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const PK_PREFIX = process.env.SUMMARY_PREDICT_PK_PREFIX || 'TOPIC#';
const SUMMARY_SK = process.env.SUMMARY_SORT_KEY || 'SUMMARY';
const PREDICTION_SK = process.env.PREDICTION_SORT_KEY || 'PREDICTION';
const SUMMARY_TTL_SECONDS = parseInt(process.env.SUMMARY_PREDICT_TTL_SECONDS || '3600', 10);
const PREDICTION_TTL_SECONDS = parseInt(process.env.PREDICTION_TTL_SECONDS || '3600', 10);

const bedrockClient =
  AI_PROVIDER === 'bedrock'
    ? new BedrockRuntimeClient({ region: REGION })
    : null;

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

    const filteredTopics = topicId
      ? topics.filter(t => topicMatches(t, topicId))
      : topics;

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
    readOnly: Boolean(payload.readOnly)
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
  const { Item } = await ddb.send(new GetCommand({
    TableName: TOPICS_TABLE,
    Key: { id: TOPICS_ITEM_ID }
  }));
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
    'Also highlight the main countries or regions involved if present.'
  ].join('\n\n');
}

function buildPredictionPrompt(topic) {
  return [
    'You are an analyst forecasting impacts for the given topic.',
    `Title: ${topic.title || 'Untitled Topic'}`,
    `Description: ${topic.description || 'No description provided.'}`,
    'Respond with:',
    '1. Potential societal impact',
    '2. Economic implications',
    '3. Political ramifications',
    '4. Estimated timeline of effects (short / medium / long term).',
    'Keep the answer concise (<= 150 words) but informative.'
  ].join('\n\n');
}

async function generateAndStore(topic, kind) {
  const prompt = kind === 'summary' ? buildSummaryPrompt(topic) : buildPredictionPrompt(topic);
  const response = await invokeModel(prompt);
  const ttlSeconds = kind === 'summary' ? SUMMARY_TTL_SECONDS : PREDICTION_TTL_SECONDS;
  const item = await writeCache(topic, kind, response, ttlSeconds);
  return item;
}

async function invokeModel(prompt) {
  if (AI_PROVIDER === 'openai') {
    return invokeOpenAI(prompt);
  }
  return invokeBedrock(prompt);
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
      Authorization: `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      top_p: DEFAULT_TOP_P
    })
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

async function invokeBedrock(prompt) {
  if (!bedrockClient) {
    throw new Error('Bedrock client is not configured');
  }

  const modelId = DEFAULT_MODEL_ID;
  const cmd = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      top_p: DEFAULT_TOP_P
    }))
  });

  const started = Date.now();
  const res = await bedrockClient.send(cmd);
  const latencyMs = Date.now() - started;

  const raw = await readBody(res.body);
  const parsed = tryParseJSON(raw);
  const content = extractContent(parsed);

  return { modelId, content, latencyMs };
}

async function readBody(body) {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf-8');
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf-8');
  if (typeof body.on === 'function') {
    return await new Promise((resolve, reject) => {
      const chunks = [];
      body.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      body.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      body.on('error', reject);
    });
  }
  if (typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
  try { return JSON.stringify(body); } catch { return String(body); }
}

function tryParseJSON(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
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

  const bedrockText = payload?.output?.message?.content?.find?.(c => typeof c?.text === 'string')?.text;
  if (bedrockText) return stripCodeFence(bedrockText);

  if (typeof payload === 'string') return payload.trim();
  return JSON.stringify(payload);
}

async function readCache(topic, action) {
  if (!SUMMARY_TABLE) {
    throw new Error('SUMMARIZE_PREDICT_TABLE env var not set');
  }
  const pk = `${PK_PREFIX}${topic.id}`;
  const sks = action === 'prediction' ? [PREDICTION_SK] : action === 'summary' ? [SUMMARY_SK] : [SUMMARY_SK, PREDICTION_SK];

  const results = [];
  for (const sk of sks) {
    const { Item } = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: pk, SK: sk }
    }));
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
    generatedAt: new Date().toISOString(),
    ttl,
    latencyMs: response.latencyMs,
    provider: AI_PROVIDER
  };

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: item
  }));

  console.log(`Cached ${kind} for ${topic.id} via ${AI_PROVIDER}`);
  return item;
}

function http(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  };
}
