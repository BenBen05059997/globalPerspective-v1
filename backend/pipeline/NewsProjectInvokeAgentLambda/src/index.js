'use strict';

const crypto = require('crypto');
const lib = require('./lib');
const threading = require('./threading');
const draw = require('./forecast-draw');
const { staleReason, staleProcessedRun } = require('./run-guard');
const { slugify } = threading;
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  BatchWriteCommand,
  BatchGetCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const PREDICTION_MODEL = process.env.PREDICTION_MODEL || ''; // forecast (single grounded call); '' = same as GROK_MODEL
const GROK_MODEL = process.env.GROK_MODEL || 'deepseek-flash'; // fallback only; the env sets the live model (v4-flash name retired 2026-08-18)
const GROK_ENDPOINT = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
const GROK_KEY = process.env.XAI_API_KEY || '';
const DEFAULT_MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '600', 10);
const PREDICTION_MAX_TOKENS = parseInt(process.env.PREDICTION_MAX_TOKENS || '2500', 10);
const DEFAULT_TEMPERATURE = Number(process.env.TEMPERATURE || '0.2');
const DEFAULT_TOP_P = Number(process.env.TOP_P || '0.9');

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const STAGING_ITEM_ID = 'staging';
const ACTIVE_ITEM_ID = 'latest';

const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const PK_PREFIX = process.env.SUMMARY_PREDICT_PK_PREFIX || 'TOPIC#';
const SUMMARY_SK = process.env.SUMMARY_SORT_KEY || 'SUMMARY';
const PREDICTION_SK = process.env.PREDICTION_SORT_KEY || 'PREDICTION';
const SUMMARY_TTL_SECONDS = parseInt(process.env.SUMMARY_PREDICT_TTL_SECONDS || '259200', 10);
const PREDICTION_TTL_SECONDS = parseInt(process.env.PREDICTION_TTL_SECONDS || '259200', 10);
const PREDICTION_LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
// v1 (methodology-v1) generation inputs — see PREDICTION_METHODOLOGY_V1_PLAN.md §3.
const FACTS_PK_PREFIX = 'FACTS#';
const FACTS_SK = 'COUNTRY_FACTS';
const ARC_DIGEST_DAYS = parseInt(process.env.ARC_DIGEST_DAYS || '7', 10);
const ARC_DIGEST_MAX = parseInt(process.env.ARC_DIGEST_MAX || '12', 10);
const CACHE_CLEANUP_ENABLED = String(process.env.CACHE_CLEANUP_ENABLED || 'true').toLowerCase() !== 'false';
const { mergeArchiveDay, inboxLines } = require('./_shared/entriesInbox');
const forecastsInbox = require('./_shared/forecastsInbox');
const ARCHIVE_ITEM_ID = 'today-archive';
const ARCHIVE_TTL_HOURS = 24;
const DAILY_ARCHIVE_TTL_DAYS = 90;
const DAILY_ARCHIVE_MAX_SOURCES = 10;

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

const LLM_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '4', 10);

// ── Event-registry matcher (Phase 1 "the bridge", MATCHER_SPEC) — additive, fully isolated ──
// Links map stories (S3 stories/state) to editorial threads via URL-exact (Tier 1) + R3 fingerprint
// (Tier 2, gated). Writes threads/story-map.json; the tracker reads it and stamps situation.threadId.
const { buildStoryMap } = require('./matcher');
const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
// Entry notes (decision 0042): each summary, cause chain and forecast this run stored is also written to
// <NOTES_PREFIX>notes/entry/ through shared notes.js; record/shadow/ until the switch is checked.
const NOTES_PREFIX = process.env.NOTES_PREFIX || 'record/shadow/';
// Entries inbox (decision 0051): <ENTRIES_INBOX_PREFIX>inbox/entries/DAY.jsonl, one line per archived entry. Unset = nothing is written;
// the coordinator sets record/shadow/ first, then record/.
const ENTRIES_INBOX_PREFIX = process.env.ENTRIES_INBOX_PREFIX || '';
// Forecasts inbox (decision 0052): <FORECASTS_INBOX_PREFIX>inbox/forecasts/DAY.jsonl, a line for each PRED# row put and for each thread reconcile. Unset = nothing
// is written. The lines of a run wait here and are appended once, after the reconcile (flushForecastsInbox).
const FORECASTS_INBOX_PREFIX = process.env.FORECASTS_INBOX_PREFIX || '';
let pendingForecastLines = [];
const STORY_MAP_KEY = 'threads/story-map.json';
const ENABLE_R3_TIER = String(process.env.ENABLE_R3_TIER || 'false').toLowerCase() === 'true'; // gated until real-tag re-measurement
let _s3;
function s3() {
  if (!_s3) { const { S3Client } = require('@aws-sdk/client-s3'); _s3 = new S3Client({ region: REGION }); }
  return _s3;
}
// Read every stories/state/*.json (the full registry, per Phase 0's measured surface — NOT the
// 80-cap stories/index.json). Best-effort: any failure returns [] so the matcher no-ops safely.
async function readStoryStates() {
  const { ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
  const keys = [];
  let token;
  do {
    const r = await s3().send(new ListObjectsV2Command({ Bucket: WORLD_BUCKET, Prefix: 'stories/state/', ContinuationToken: token }));
    for (const o of r.Contents || []) if (o.Key.endsWith('.json')) keys.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  const stories = await mapWithConcurrency(keys, 16, async (key) => {
    try { const r = await s3().send(new GetObjectCommand({ Bucket: WORLD_BUCKET, Key: key })); return JSON.parse(await r.Body.transformToString()); }
    catch { return null; }
  });
  return stories.filter(Boolean);
}
async function writeStoryMap(mapObj) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await s3().send(new PutObjectCommand({ Bucket: WORLD_BUCKET, Key: STORY_MAP_KEY, Body: JSON.stringify(mapObj), ContentType: 'application/json' }));
}
// Runs once per generation cycle from the raw staging topics (which now carry threadId + Phase 1b
// tags). Fully non-fatal: a failure here must never affect topic generation, the swap, or the archive.
async function runStoryMatcher(rawTopics) {
  const topics = (rawTopics || []).map((t, idx) => ({
    id: buildStableTopicId(t, idx), threadId: t.threadId,
    sources: Array.isArray(t.sources) ? t.sources : [],
    iso3: Array.isArray(t.iso3) ? t.iso3 : [],
    actors: Array.isArray(t.actors) ? t.actors : [],
  }));
  const stories = await readStoryStates();
  const map = buildStoryMap(topics, stories, { enableR3: ENABLE_R3_TIER });
  await writeStoryMap(map);
  console.log(`[matcher] wrote ${STORY_MAP_KEY}: ${Object.keys(map.pairs).length} pairs (${JSON.stringify(map.counts)}, r3=${ENABLE_R3_TIER})`);
  return map;
}

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
    const force = Boolean(payload.force);
    const dryRun = Boolean(payload.dryRun);

    const { topics, generationId, generatedDate, generatedYear, item: stagingItem } = await loadTopics();

    if (!topics.length) {
      return failedRun('topics-empty', generationId);
    }

    const filteredTopics = topicId ? topics.filter(t => topicMatches(t, topicId)) : topics;
    if (!filteredTopics.length) {
      return http(404, { error: `No topic found for "${topicId}"` });
    }

    // R2 run guard: this staging was already fully processed (agentProcessedAt is set only when every
    // story succeeded; Gemini rewrites `staging` with a full Put, so a new staging clears it).
    if (!force && !topicId && !readOnly && !dryRun && stagingItem?.agentProcessedAt) {
      // Processed but generated before this slot: gemini produced nothing new, so today's archive is
      // never written. Fail loudly (rethrown below) so Errors fires lambda-errors-*.
      const stale = staleProcessedRun(stagingItem, new Date());
      if (stale) {
        console.error(`[pipeline-status] ${JSON.stringify({ status: 'failed', reason: 'stale-processed-staging', ...stale, agentProcessedAt: stagingItem.agentProcessedAt })}`);
        const e = new Error(`stale-processed-staging: no fresh gemini output (generationId ${stale.generationId}, age ${stale.ageMinutes}m, slot ${stale.slotStart})`);
        e.rethrow = true;
        throw e;
      }
      console.log(`Skipping run: staging ${generationId} already processed at ${stagingItem.agentProcessedAt}`);
      return http(200, { success: true, skipped: 'staging-already-processed', generationId });
    }

    if (readOnly) {
      const results = await Promise.all(filteredTopics.map(topic => readCache(topic, action)));
      return http(200, { cached: true, results });
    }

    if (!dryRun) {
      const archives = await readFreshnessArchives();
      const reason = staleReason(stagingItem, archives);
      if (reason) return failedRun('stale-staging', generationId, { staleReason: reason });
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
    // P3: threadIds are computed BEFORE generation (the later swap/archive reuse this same map) so a
    // forecast already made today for the same thread can be copied instead of regenerated, and
    // every per-story row (summary, cause chain, forecast, PRED#) carries its threadId.
    const threadIdById = {};
    if (Array.isArray(stagingItem?.topics)) {
      const rawTopics = stagingItem.topics.map((raw, idx) => ({ ...raw, id: buildStableTopicId(raw, idx) }));
      for (const rec of threading.joinRun(rawTopics, pastEntries)) {
        threadIdById[rec.topicId] = rec.threadId;
        console.log(`[join] ${JSON.stringify(rec)}`);
      }
    }
    const generatedAtDay = new Date().toISOString().slice(0, 10);
    const todayArchiveEntries = needsPrediction && !force ? pastEntries.filter(e => e.date === generatedAtDay) : [];
    const genCtx = { pastEntries, factsByCountry, threadIdById, todayArchiveEntries, generatedAtDay, force, dryRun, plan: [] };

    const outputs = [];
    const reused = [];
    let failed = 0;
    await mapWithConcurrency(filteredTopics, LLM_CONCURRENCY, async (topic) => {
      try {
        if (action === 'summary' || action === 'both') {
          const summary = await ensureStored(topic, 'summary', generationId, generatedDate, generatedYear, genCtx);
          if (summary) (summary.reused ? reused : outputs).push(summary.item);
        }
        if (action === 'trace_cause' || action === 'both') {
          const traceCause = await ensureStored(topic, 'trace_cause', generationId, generatedDate, generatedYear, genCtx);
          if (traceCause) (traceCause.reused ? reused : outputs).push(traceCause.item);
        }
        if (action === 'prediction' || action === 'both') {
          const prediction = await ensureStored(topic, 'prediction', generationId, generatedDate, generatedYear, genCtx);
          if (prediction) (prediction.reused ? reused : outputs).push(prediction.item);
        }
      } catch (topicErr) {
        failed++;
        console.error(`Generation failed for topic "${topic.title?.substring(0, 50)}":`, topicErr.message);
      }
    });

    if (dryRun) {
      const tally = {};
      for (const p of genCtx.plan) tally[`${p.decision}:${p.reason}`] = (tally[`${p.decision}:${p.reason}`] || 0) + 1;
      const models = {};
      for (const p of genCtx.plan) { const k = `${p.kind}=${p.model}`; models[k] = (models[k] || 0) + 1; }
      console.log(`DRY RUN (no LLM, no writes): ${filteredTopics.length} topics`, JSON.stringify(tally));
      return http(200, { dryRun: true, generationId, topics: filteredTopics.length, tally, models, predictionModel: modelFor('prediction'), plan: genCtx.plan });
    }

    const { usable, swap } = lib.runOutcome({ generated: outputs.length, reused: reused.length });
    console.log(`Generation complete: ${outputs.length} generated, ${reused.length} reused, ${failed} failed (generationId: ${generationId})`);

    // Zero generated is a failed generation, including cache-only retries after a provider
    // outage. Do not publish or re-archive an old generation as today's fresh content.
    if (outputs.length === 0) return failedRun('zero-generated', generationId, { generated: 0, reused: reused.length, failed });
    const publicationReason = staleReason(stagingItem, await readFreshnessArchives());
    if (publicationReason) return failedRun('stale-staging', generationId, { staleReason: publicationReason, generated: outputs.length, reused: reused.length, failed });

    // Assign threadIds from the RAW staging topics (which retain continues_topic,
    // category, and search_keywords — fields buildTopic() drops) and stamp them
    // onto the topics that become `latest`, so the served topics carry threadId
    // for narrative links (the lede band + Home story-arc/economic badges). The
    // same map is reused by the archive write so latest and archive stay in sync.
    if (usable > 0 && stagingItem && Array.isArray(stagingItem.topics)) {
      try {
        stagingItem.topics.forEach((raw, idx) => {
          const id = buildStableTopicId(raw, idx);
          const tid = threadIdById[id] || assignThreadId(raw, pastEntries);
          raw.threadId = tid;
          threadIdById[id] = tid;
        });
        console.log(`Assigned threadIds to ${stagingItem.topics.length} latest topics`);
      } catch (threadErr) {
        console.warn('threadId assignment for latest failed:', threadErr.message);
      }
      // Event-registry matcher: link stories→threads via the just-assigned threadIds + Phase 1b tags.
      // Separate try/catch from threadId assignment so a matcher fault can't disturb it, the swap,
      // or the archive write (all of which run unconditionally below).
      if (!readOnly) {
        try {
          await runStoryMatcher(stagingItem.topics);
        } catch (matchErr) {
          console.warn('[matcher] story-map build failed (non-fatal):', matchErr.message);
        }
      }
    }

    const swapped = swap
      ? await swapStagingToActive(stagingItem, generationId)
      : false;

    if (!readOnly && swapped) {
      try {
        const archived = await buildAndWriteArchive(filteredTopics, generationId, threadIdById);
        if (archived) await writeEntryNotes([...outputs, ...reused], archived, generationId);
        if (archived) await writeEntriesInbox(archived, stagingItem, generationId);
      } catch (archiveErr) {
        console.warn('Archive write encountered an issue:', archiveErr);
      }
      await writeThreadPointers(filteredTopics, threadIdById, generationId);
      await reconcilePredictionThreads(filteredTopics, threadIdById, generatedAtDay);
    }
    await flushForecastsInbox();

    if (!readOnly && CACHE_CLEANUP_ENABLED && swapped) {
      try {
        await pruneObsoleteEntries(generationId);
      } catch (cleanupErr) {
        console.warn('Cache cleanup encountered an issue:', cleanupErr);
      }
    }

    if (failed === 0 && !topicId && !readOnly && swapped && stagingItem?.id) {
      try {
        await ddb.send(new UpdateCommand({
          TableName: TOPICS_TABLE,
          Key: { id: stagingItem.id },
          UpdateExpression: 'SET agentProcessedAt = :n',
          ExpressionAttributeValues: { ':n': new Date().toISOString(), ':g': generationId },
          ConditionExpression: 'generationId = :g',
        }));
      } catch (markErr) {
        console.warn('Could not mark staging processed:', markErr.message);
      }
    }

    return http(200, {
      success: true,
      generated: outputs.length,
      reused: reused.length,
      generationId,
      swapped,
      items: outputs,
    });
  } catch (err) {
    console.error('NewsProjectInvokeAgentLambda error:', err);
    if (err.rethrow) throw err;
    return http(500, { error: err.message || String(err) });
  }
};

/* ------------ helpers ------------ */

function failedRun(reason, generationId, detail = {}) {
  const marker = { status: 'failed', reason, generationId, generated: 0, ...detail };
  console.error(`[pipeline-status] ${JSON.stringify(marker)}`);
  return http(503, { success: false, ...marker });
}

async function readFreshnessArchives() {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return Promise.all([ARCHIVE_ITEM_ID, formatDateKey(today), formatDateKey(yesterday)].map(async id => {
    const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id }, ConsistentRead: true }));
    return Item;
  }));
}

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
    // Phase 1b — carry the event fingerprint through so active + archive retain it
    // (the map↔editorial linking tier reads these; without carry-through they'd be dropped here).
    iso3: Array.isArray(t.iso3) ? t.iso3 : [],
    actors: Array.isArray(t.actors) ? t.actors : [],
    event_type: typeof t.event_type === 'string' ? t.event_type : 'other',
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

// ── Grounded single-call forecast (2026-10-17, replaces the research briefing + forecast pair) ──

const KIND_SK = (kind) => (kind === 'prediction' ? PREDICTION_SK : kind === 'trace_cause' ? 'TRACE_CAUSE' : SUMMARY_SK);

// R2: reuse a stored item when the story's article set is unchanged (see lib.decideReuse), else generate.
async function ensureStored(topic, kind, generationId, generatedDate, generatedYear, ctx = {}) {
  const pk = `${PK_PREFIX}${topic.id}`;
  const fingerprint = lib.sourceFingerprint(topic);
  const today = new Date().toISOString().slice(0, 10);
  let existing = null;
  let fromTopicId = null; // set when the stored item belongs to the same story under another topic id
  let predictionLoggedToday = false;
  if (!ctx.force) {
    const got = await ddb.send(new GetCommand({ TableName: SUMMARY_TABLE, Key: { PK: pk, SK: KIND_SK(kind) } }));
    existing = got.Item || null;
    // P3: for a forecast, same-title siblings AND today's items on the same story thread (archive
    // threadIds, whatever the headline wording or position) are copy candidates; a forecast made
    // today wins over an older own item, so there is one forecast per thread per UTC day.
    const wantToday = kind === 'prediction' && !lib.forecastedOn(existing, today);
    if (!existing || wantToday) {
      const threadIds = kind === 'prediction' ? lib.threadSiblingsToday(ctx.todayArchiveEntries, (ctx.threadIdById || {})[topic.id]) : [];
      const sib = await findSiblingItem(topic.id, KIND_SK(kind), threadIds);
      if (sib && (!existing || lib.forecastedOn(sib, today))) {
        existing = sib;
        fromTopicId = sib.topicId || sib.PK.slice(PK_PREFIX.length);
        if (fromTopicId === topic.id) fromTopicId = null;
      }
    }
    if (kind === 'prediction' && existing) {
      const logged = await ddb.send(new GetCommand({
        TableName: PREDICTION_LOG_TABLE,
        Key: { PK: `PRED#${fromTopicId || topic.id}`, SK: today },
      }));
      // PRED# gap fix: a copy / fingerprint-reuse writes no PRED# row, but the stored item keeps its
      // original generatedAt, so "forecast made today" is also read off the item itself.
      predictionLoggedToday = Boolean(logged.Item) || lib.forecastedOn(existing, today);
    }
  }
  let decision = lib.decideReuse({ kind, existing, fingerprint, predictionLoggedToday, force: ctx.force });
  const threadAttr = lib.threadAttr((ctx.threadIdById || {})[topic.id]);
  let forks;
  if (kind === 'prediction') {
    // Draw cadence (decision 0038): a forecast is drawn only when the story moved (decideReuse says
    // generate) and its thread has no fork in the last 7 days; otherwise keep the stored forecast, if any.
    if (!decision.reuse && !ctx.force) forks = await readThreadForks(topic, threadAttr.threadId, today);
    const d = draw.drawDecision({ decision, existing, lastForkDay: forks ? draw.latestForkDay(forks) : null, today, force: ctx.force });
    if (!d.draw) {
      decision = d.reuse ? { reuse: true, reason: d.reason } : { reuse: false, skip: true, reason: d.reason };
    }
  }
  if (ctx.plan) ctx.plan.push({ topicId: topic.id, kind, decision: decision.skip ? 'skip' : decision.reuse ? 'reuse' : 'generate', reason: decision.reason, model: modelFor(kind), threadId: threadAttr.threadId || null });
  if (ctx.dryRun || decision.skip) return null;
  if (!decision.reuse) {
    const item = await generateAndStore(topic, kind, generationId, generatedDate, generatedYear, { ...ctx, fingerprint, forks });
    return { item, reused: false };
  }
  const ttlSeconds = kind === 'prediction' ? PREDICTION_TTL_SECONDS : SUMMARY_TTL_SECONDS;
  if (fromTopicId) {
    // Copy the sibling's item under this run's id (pages read TOPIC#<current id>). No new
    // PRED# row: the forecast was logged once under the sibling id, which the story's thread
    // lookup (prediction_snapshot by threadId/topicIds) still finds.
    const item = { ...lib.restampFields(existing, generationId, ttlSeconds), PK: pk, topicId: topic.id, title: topic.title, reusedFromTopicId: fromTopicId, ...threadAttr };
    await ddb.send(new PutCommand({ TableName: SUMMARY_TABLE, Item: item }));
    console.log(`Reused ${kind} for ${topic.id} from sibling ${fromTopicId} (${decision.reason})`);
    return { item, reused: true };
  }
  await touchItem(pk, KIND_SK(kind), generationId, ttlSeconds, threadAttr.threadId);
  return { item: { ...lib.restampFields(existing, generationId, ttlSeconds), ...threadAttr }, reused: true };
}

// The archive entry's threadId is final; today's PRED# row (written during generation, first of the
// day stands) follows it, so the forecast and the entry never sit under different threads.
async function reconcilePredictionThreads(topics, threadIdById, day) {
  let fixed = 0;
  await mapWithConcurrency(topics, 8, async (topic) => {
    try {
      const { Item } = await ddb.send(new GetCommand({ TableName: PREDICTION_LOG_TABLE, Key: { PK: `PRED#${topic.id}`, SK: day } }));
      const fix = lib.predThreadFix(Item, threadIdById[topic.id]);
      if (!fix) return;
      await ddb.send(new UpdateCommand({ TableName: PREDICTION_LOG_TABLE, ...fix }));
      fixed++;
      noteForecastLine(() => forecastsInbox.threadLine({ PK: Item.PK, SK: Item.SK, threadId: threadIdById[topic.id], was: Item.threadId, at: new Date().toISOString() }));
      console.log(`[pred-thread] ${topic.id} ${Item.threadId} -> ${threadIdById[topic.id]}`);
    } catch (e) { console.warn(`PRED# thread reconcile failed for ${topic.id}: ${e.message}`); }
  });
  if (fixed) console.log(`PRED# rows moved to the archive thread: ${fixed}`);
}

// threadId -> topic lookup: one `THREAD#<threadId>` / `TOPICS` row per thread (lib.threadPointerUpdate)
// holding the current topicId (its TOPIC# summary / cause chain / forecast rows) and every topicId
// the thread has had (its PRED# rows). Best-effort: a failed pointer never fails the run.
async function writeThreadPointers(topics, threadIdById, generationId) {
  if (!SUMMARY_TABLE) return;
  const nowIso = new Date().toISOString();
  const byThread = new Map();
  for (const topic of topics) {
    const threadId = threadIdById[topic.id];
    if (threadId) byThread.set(threadId, [...(byThread.get(threadId) || []), topic]);
  }
  let written = 0;
  await mapWithConcurrency([...byThread], 8, async ([threadId, threadTopics]) => {
    try {
      await ddb.send(new UpdateCommand({ TableName: SUMMARY_TABLE, ...lib.threadPointerUpdate(threadId, threadTopics, generationId, nowIso) }));
      written++;
    } catch (e) {
      console.warn(`thread pointer failed for ${threadId}: ${e.message}`);
    }
  });
  console.log(`Thread pointers written: ${written}/${byThread.size}`);
}

// The PRED# rows of a story's thread from the last 90 days (every topicId the thread has had, from the
// THREAD# pointer, plus this topic): the draw cadence reads the newest fork day, the near-duplicate gate
// reads the open branches. Best-effort: a failed read returns [] (draw proceeds, gates see no prior).
async function readThreadForks(topic, threadId, today) {
  const ids = new Set([topic.id]);
  if (threadId && SUMMARY_TABLE) {
    try {
      const got = await ddb.send(new GetCommand({ TableName: SUMMARY_TABLE, Key: { PK: `THREAD#${threadId}`, SK: lib.THREAD_POINTER_SK } }));
      const set = got.Item && got.Item.topicIds;
      for (const id of set ? [...set] : []) ids.add(id);
    } catch (e) { console.warn(`thread pointer read failed for ${threadId}: ${e.message}`); }
  }
  const from = lib.addDays(today, -draw.OPEN_LOOKBACK_DAYS);
  const rows = [];
  for (const id of ids) {
    try {
      const r = await ddb.send(new QueryCommand({
        TableName: PREDICTION_LOG_TABLE,
        KeyConditionExpression: 'PK = :pk AND SK >= :from',
        ExpressionAttributeValues: { ':pk': `PRED#${id}`, ':from': from },
        ProjectionExpression: 'SK, scenarios',
      }));
      rows.push(...(r.Items || []));
    } catch (e) { console.warn(`thread forks read failed for ${id}: ${e.message}`); }
  }
  return rows;
}

// Newest stored item of this kind for the same title at another list position (see
// lib.siblingTopicIds). Best-effort: a read failure means "nothing to reuse", never a failed run.
async function findSiblingItem(topicId, sk, extraIds = []) {
  const keys = [...new Set([...lib.siblingTopicIds(topicId), ...extraIds.filter((id) => id !== topicId)])].map((id) => ({ PK: `${PK_PREFIX}${id}`, SK: sk }));
  if (!keys.length) return null;
  try {
    const r = await ddb.send(new BatchGetCommand({ RequestItems: { [SUMMARY_TABLE]: { Keys: keys } } }));
    return lib.newestItem((r.Responses && r.Responses[SUMMARY_TABLE]) || []);
  } catch (e) {
    console.warn(`sibling lookup failed for ${topicId}: ${e.message}`);
    return null;
  }
}

// Re-stamp a reused item so the generation prune keeps it; never creates an item (attribute_exists).
async function touchItem(pk, sk, generationId, ttlSeconds, threadId) {
  try {
    await ddb.send(new UpdateCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: pk, SK: sk },
      // `ttl` is a DynamoDB reserved word, so it must go through an attribute-name placeholder.
      UpdateExpression: `SET generationId = :g, #ttl = :t, lastVerifiedAt = :n${threadId ? ', threadId = :th' : ''}`,
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':g': generationId, ':t': Math.floor(Date.now() / 1000) + ttlSeconds, ':n': new Date().toISOString(), ...(threadId ? { ':th': threadId } : {}) },
    }));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
  }
}

async function generateAndStore(topic, kind, generationId, generatedDate, generatedYear, ctx = {}) {
  let prompt;
  let maxTokens = DEFAULT_MAX_TOKENS;
  let inputText = null;
  if (kind === 'summary') {
    prompt = buildSummaryPrompt(topic, generatedDate);
  } else if (kind === 'trace_cause') {
    prompt = buildTraceCausePrompt(topic, generatedDate);
  } else {
    // Single grounded forecast call (2026-10-17; was research briefing + forecast). Inputs are the
    // story's own snippets, verified FACTS# premises and the dated arc digest from our archive;
    // the prompt forbids any date / scheduled event not in them and
    // G13 (lib.buildGatedScenarios) enforces it on the output.
    const v1 = {
      premiseBlock: buildPremiseBlock(topic, ctx.factsByCountry),
      arcDigest: buildArcDigest(topic, ctx.pastEntries),
    };
    inputText = draw.forecastInputText(topic, v1);
    prompt = draw.buildPredictionPrompt(topic, generatedDate, generatedYear, v1);
    maxTokens = PREDICTION_MAX_TOKENS;
  }

  const response = await invokeGrok(prompt, maxTokens, modelFor(kind), kind === 'prediction' ? 'forecast' : kind, kind === 'prediction' || kind === 'trace_cause');

  if (kind === 'prediction' || kind === 'trace_cause') {
    response.content = normalizeJsonResponse(response.content, kind);
  }
  if (kind === 'prediction') {
    // Outcomes -> the stored scenario shape readers use (one outcome per scenario, label = the event).
    try { response.content = JSON.stringify(draw.outcomesToScenarios(JSON.parse(response.content))); } catch { /* non-JSON content is stored as-is */ }
  }

  // Ground once: rationale sentences carrying a date / scheduled event the model was never shown are
  // removed, and the same grounded copy is stored for readers and logged (G13 drops go to capture).
  let groundRemoved = [];
  if (kind === 'prediction') {
    try {
      const g = lib.groundForecastContent(JSON.parse(response.content), inputText, ctx.generatedAtDay || new Date().toISOString().slice(0, 10));
      response.content = JSON.stringify(g.parsed);
      groundRemoved = g.removed;
    } catch { /* non-JSON content is stored as-is (contentFormat markdown) */ }
  }

  const ttlSeconds = kind === 'prediction' ? PREDICTION_TTL_SECONDS : SUMMARY_TTL_SECONDS;
  const item = await writeCache(topic, kind, response, ttlSeconds, generationId, ctx.fingerprint, (ctx.threadIdById || {})[topic.id]);

  if (kind === 'prediction') {
    await logPredictionSnapshot(topic, response.content, response, generationId, generatedYear, { ...ctx, inputText, groundRemoved, forks: ctx.forks });
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

const modelFor = (kind) => lib.modelForKind(kind, { GROK_MODEL, PREDICTION_MODEL });

async function invokeGrok(prompt, maxTokens, model = GROK_MODEL, step = 'call', json = false) {
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
    body: JSON.stringify(lib.buildChatBody({
      model,
      prompt,
      maxTokens: maxTokens || DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      topP: DEFAULT_TOP_P,
      json,
    })),
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
  console.log('[usage] ' + JSON.stringify({ fn: process.env.AWS_LAMBDA_FUNCTION_NAME, step, model: parsed?.model || model, ...parsed?.usage }));
  return { modelId: parsed?.model || model, content, latencyMs, usage: parsed?.usage };
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

async function writeCache(topic, kind, response, ttlSeconds, generationId, fingerprint, threadId) {
  if (!SUMMARY_TABLE) {
    throw new Error('SUMMARIZE_PREDICT_TABLE env var not set');
  }

  const pk = `${PK_PREFIX}${topic.id}`;
  let sk = SUMMARY_SK;
  if (kind === 'prediction') sk = PREDICTION_SK;
  else if (kind === 'trace_cause') sk = 'TRACE_CAUSE';
  const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

  const isJson = (kind === 'prediction' || kind === 'trace_cause') && (() => {
    try { JSON.parse(response.content); return true; } catch { return false; }
  })();

  const item = {
    PK: pk,
    SK: sk,
    topicId: topic.id,
    ...lib.threadAttr(threadId),
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
    ...(kind === 'prediction' ? { promptVersion: lib.PROMPT_VERSION } : {}),
    ...(fingerprint ? { sourceFingerprint: fingerprint } : {}),
    lastVerifiedAt: new Date().toISOString(),
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
// same join rule as threading (threading.relatedEntries). Returns "" when there's no real prior coverage.
function buildArcDigest(topic, pastEntries = []) {
  if (!pastEntries.length) return '';
  const related = threading.relatedEntries(topic, pastEntries);
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
    // M2: per-question gates need the row key, the story's own reported text (a "question" that
    // restates it is already met) and this story's recent question texts (near-duplicates).
    const pk = `PRED#${topic.id}`;
    const snippets = [topic.title, topic.description, ...((topic.sources || []).map(s => s && s.snippet))].filter(Boolean).map(String);
    // Near-duplicates are checked against every OPEN branch of the story's thread, not just the last rows.
    const forks = ctx.forks || await readThreadForks(topic, (ctx.threadIdById || {})[topic.id], day);
    const priorTexts = draw.openBranchTexts(forks, day);
    // G15: this story's own archive entries dated on or before the draw (the digest's source, with summaries)
    const priorEntries = threading.relatedEntries(topic, ctx.pastEntries || []).filter((e) => e.title);
    const { scenarios, capture } = lib.buildGatedScenarios(parsed.scenarios, {
      generatedAtDay: (ctx.generatedAtDay || day),
      fallbackYear: generatedYear,
      facts,
      pk,
      sk: day,
      snippets,
      priorTexts,
      priorEntries,
      inputText: ctx.inputText, // G13 grounded-date gate (undefined => gate off)
      outcomeMode: parsed.unit === 'outcome',
    });
    // Same id the thread-reuse lookup and the archive use (computed once per run, before generation).
    capture.dropped.push(...(ctx.groundRemoved || []));
    let threadId = (ctx.threadIdById || {})[topic.id] || null;
    if (!threadId) { try { threadId = assignThreadId(topic, ctx.pastEntries || []) || null; } catch { /* deterministic founding id below remains available */ } }
    if (!threadId) threadId = threading.generateThreadId(topic);

    const item = {
      PK: `PRED#${topic.id}`,
      SK: day,
      topicId: topic.id,
      title: topic.title,
      category: (Array.isArray(topic.categories) ? topic.categories[0] : null) || topic.category || null,
      generatedAt: new Date().toISOString(),
      generationId,
      model: response.modelId,
      ...(response.usage ? { usage: response.usage } : {}),
      methodologyVersion: lib.METHODOLOGY_VERSION,
      promptVersion: lib.PROMPT_VERSION,
      questionSchema: 1,
      regions: Array.isArray(topic.regions) ? topic.regions : [],
      threadId,
      forkId: `${pk}|${day}`,
      scenarios: scenarios.map((scenario, scenarioIndex) => ({ ...scenario, scenarioIndex })),
      capture,
      winners: Array.isArray(parsed.winners) ? parsed.winners : [],
      losers: Array.isArray(parsed.losers) ? parsed.losers : [],
      status: 'open',
    };

    await ddb.send(new PutCommand({ TableName: PREDICTION_LOG_TABLE, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
    noteForecastLine(() => forecastsInbox.drawnLine(item));
    console.log(`Logged prediction snapshot ${item.PK}/${day} v${lib.METHODOLOGY_VERSION}/p${lib.PROMPT_VERSION} (${capture.kept} triggers kept, ${capture.dropped.length} gated out)`);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') { console.log(`Prediction snapshot for ${topic.id} already logged today; first of the day stands`); return; }
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

    keysToDelete.push(...lib.selectPruneKeys(Items, PK_PREFIX, currentGenerationId));

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
    threadId: threadId || threading.generateThreadId(topic),
    title: topic.title,
    category: Array.isArray(topic.categories) ? topic.categories[0] || '' : '',
    regions: topic.regions || [],
    search_keywords: topic.search_keywords || [],
    iso3: topic.iso3 || [],
    actors: topic.actors || [],
    event_type: topic.event_type || 'other',
    sources: (topic.sources || []).slice(0, sourceCap),
    archivedAt: new Date().toISOString(),
    generationId,
    ai,
    ...(topic.continues_topic && { continues_topic: topic.continues_topic }),
  };
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

// Every assignment logs one `[join] {topicId, threadId, via, score, kwScore}` line (threading.joinRecord).
function assignThreadId(topic, pastEntries) {
  const rec = threading.joinRecord(topic, pastEntries);
  console.log(`[join] ${JSON.stringify(rec)}`);
  return rec.threadId;
}

async function readPastArchiveEntries(days) {
  if (!TOPICS_TABLE) return [];
  try {
    const entries = [];
    const now = new Date();
    // i = 0 is today: earlier generations of the same day, so a same-day re-run of a story joins its
    // thread instead of forking. This run's own topics are archived only after assignment; a forced
    // re-run of the same generation finds its own rows and keeps their threadIds.
    for (let i = 0; i <= days; i++) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - i);
      const key = formatDateKey(date);
      try {
        const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: key } }));
        if (Item && Array.isArray(Item.entries)) {
          // A day's rows are stored oldest generation first; reversed, the whole list is newest first.
          entries.push(...Item.entries.slice().reverse().map(e => ({
            topicId: e.topicId,
            threadId: e.threadId,
            title: e.title,
            summary: e.summary || '',
            search_keywords: e.search_keywords || [],
            regions: e.regions || [],
            category: e.category || '',
            archivedAt: e.archivedAt,
            generationId: e.generationId,
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
    const cutoff = Date.now() - (ARCHIVE_TTL_HOURS * 60 * 60 * 1000);
    const mergedToday = mergeArchiveDay(existingEntries, todayEntries, { keep: e => new Date(e.archivedAt).getTime() > cutoff });

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
    const mergedDaily = mergeArchiveDay(existingDailyEntries, dailyEntries);

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

    // the entries as archived (sources capped), so an entry note's subject is the eventId newsStoryRecord computes from them
    return { dailyEntries, archiveDate: dailyKey.slice('archive#'.length), batch: now.toISOString() };
  } catch (err) {
    console.error('Failed to write archive:', err);
    return false;
  }
}

// The run's stored TOPIC# items -> entry notes in the record (decision 0042). Best-effort while DynamoDB stays the
// primary copy: a failure is logged as [notes] and never fails the run.
async function writeEntryNotes(items, { dailyEntries, archiveDate }, generationId) {
  try {
    const notes = require('./_shared/notes');
    const { makeS3Json } = require('./_shared/s3json');
    const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
    const entryByTopic = new Map(dailyEntries.map((e) => [e.topicId, e]));
    const producer = { lambda: 'NewsProjectInvokeAgentLambda', runId: generationId };
    const built = items.map((item) => notes.entryNote({ item, topic: entryByTopic.get(item.topicId), archiveDate, producer })).filter(Boolean);
    const writer = notes.makeNoteWriter({ s3json: makeS3Json({ client: s3(), GetObjectCommand, PutObjectCommand, bucket: WORLD_BUCKET }), prefix: NOTES_PREFIX });
    const r = await writer.write('entry', built);
    console.log(`[notes] entry: ${built.length} built from ${items.length} items, ${r.appended} appended, ${r.skipped} already stored (${NOTES_PREFIX})`);
  } catch (e) {
    console.error(`[notes] entry notes not written: ${e.message}`);
  }
}

// The run's archived entries -> record/inbox/entries/DAY.jsonl (decision 0051), so the record needs no `archive#DAY` row. One line per entry with the
// fields of `latest` an archive entry lacks (urgency, x_trending, primaryCountry...). Off unless ENTRIES_INBOX_PREFIX is set. Best-effort while DynamoDB
// stays the primary copy: a failure is logged as [inbox] and never fails the run.
async function writeEntriesInbox({ dailyEntries, archiveDate, batch }, stagingItem, generationId) {
  if (!ENTRIES_INBOX_PREFIX) return;
  try {
    const { makeS3Json } = require('./_shared/s3json');
    const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
    const raw = Array.isArray(stagingItem?.topics) ? stagingItem.topics : [];
    const topics = {};
    raw.forEach((t, idx) => { topics[buildStableTopicId(t, idx)] = t; });
    const run = {
      of: raw.length, model: stagingItem?.model ?? null, limit: stagingItem?.limit ?? null, updatedAt: stagingItem?.updatedAt ?? null,
      generatedDate: stagingItem?.generatedDate ?? null, generatedYear: stagingItem?.generatedYear ?? null, generationId,
    };
    const lines = inboxLines(dailyEntries, { batch, selection: { topics, run } });
    const s3json = makeS3Json({ client: s3(), GetObjectCommand, PutObjectCommand, bucket: WORLD_BUCKET });
    const r = await s3json.appendLines(`${ENTRIES_INBOX_PREFIX}inbox/entries/${archiveDate}.jsonl`, lines, { idKey: 'inboxId' });
    console.log(`[inbox] entries: ${lines.length} lines, ${r.appended} appended, ${r.skipped} already stored (${ENTRIES_INBOX_PREFIX})`);
  } catch (e) {
    console.error(`[inbox] entries not written: ${e.message}`);
  }
}

// Forecasts inbox (decision 0052): a line is queued when the DynamoDB write it mirrors has succeeded, and a line that cannot be built is logged, never thrown.
function noteForecastLine(build) {
  if (!FORECASTS_INBOX_PREFIX) return;
  try { pendingForecastLines.push(build()); } catch (e) { console.error(`[inbox] forecast line not built: ${e.message}`); }
}

// Appends the queued lines (a run's drawn lines, then its thread reconciles, in that order) to record/inbox/forecasts/DAY.jsonl, one file per row day.
// Off unless FORECASTS_INBOX_PREFIX is set. Best-effort while DynamoDB stays the primary copy: a failure is logged as [inbox] and never fails the run.
async function flushForecastsInbox() {
  const lines = pendingForecastLines;
  pendingForecastLines = [];
  if (!FORECASTS_INBOX_PREFIX || !lines.length) return;
  try {
    const { makeS3Json } = require('./_shared/s3json');
    const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3json = makeS3Json({ client: s3(), GetObjectCommand, PutObjectCommand, bucket: WORLD_BUCKET });
    const byDay = new Map();
    for (const l of lines) (byDay.get(l.day) || byDay.set(l.day, []).get(l.day)).push(l);
    for (const [day, dayLines] of byDay) {
      const r = await s3json.appendLines(`${FORECASTS_INBOX_PREFIX}inbox/forecasts/${day}.jsonl`, dayLines, { idKey: 'inboxId' });
      console.log(`[inbox] forecasts: ${dayLines.length} lines for ${day}, ${r.appended} appended, ${r.skipped} already stored (${FORECASTS_INBOX_PREFIX})`);
    }
  } catch (e) {
    console.error(`[inbox] forecasts not written: ${e.message}`);
  }
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

exports._internal = { buildArchiveEntry, logPredictionSnapshot, writeEntriesInbox, flushForecastsInbox, reconcilePredictionThreads };
