'use strict';

/**
 * newsEconomicQuality — Layer 2 of the quality eval plan (LLM-as-judge).
 *
 * For each recent ECON#THREAD# record (hasImpact:true, not yet judged or judged >7d ago):
 *   1. Fetch the thread analysis + topic summaries from SummarizeAndPredict
 *   2. Build a judge prompt and call Gemini 2.5 Flash via OpenAI-compatible endpoint
 *   3. Parse 5-axis scores (coherence / citation_fidelity / analog_match /
 *      severity_calibration / no_bs)
 *   4. Mark record as low_quality if any axis ≤2
 *   5. Write qualityScores + is_low_quality + quality_judged_at back to record
 *
 * Different model family from the producer (DeepSeek produces, Gemini judges)
 * so judge errors are less correlated with producer errors.
 *
 * Env vars (same naming convention as newsThreadAnalysis):
 *   XAI_API_KEY — actually a Google Gemini API key (legacy naming)
 *   GROK_MODEL  — gemini-2.5-flash
 *   GROK_API_URL — https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
 *   INTER_CALL_DELAY_MS — 13000 (Gemini free-tier rate limit)
 *   QUALITY_MAX_RECORDS — default 15
 *   QUALITY_RECENT_DAYS — default 7 (don't re-judge if judged within this window)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const GEMINI_KEY = process.env.XAI_API_KEY || '';
const GEMINI_MODEL = process.env.GROK_MODEL || 'gemini-2.5-flash';
const GEMINI_ENDPOINT = process.env.GROK_API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const INTER_CALL_DELAY_MS = parseInt(process.env.INTER_CALL_DELAY_MS || '13000', 10);
const MAX_RECORDS = parseInt(process.env.QUALITY_MAX_RECORDS || '15', 10);
const RECENT_DAYS = parseInt(process.env.QUALITY_RECENT_DAYS || '7', 10);
// Gemini 2.5 Flash uses "thinking" tokens that count against max_tokens. Observed
// 2026-05-23: at max_tokens=4000, finish_reason=length with completion_tokens=147 —
// the model burns ~3800 tokens on hidden thinking before emitting JSON, truncating
// the visible output. Two-pronged fix: (1) disable thinking via Gemini's extra_body
// config (see judgeRecord), (2) leave a generous ceiling in case thinking_config
// is silently ignored on the OpenAI-compat endpoint.
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '16000', 10);

const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const ECON_PK_PREFIX = 'ECON#THREAD#';
const ECON_SK = 'ECONOMIC_IMPACT';
const THREAD_PK_PREFIX = 'THREAD#';
const THREAD_SK = 'THREAD_ANALYSIS';
const TOPIC_PK_PREFIX = 'TOPIC#';
const TOPIC_SUMMARY_SK = 'SUMMARY';

const QUALITY_AXES = ['coherence', 'citation_fidelity', 'analog_match', 'severity_calibration', 'no_bs'];
const LOW_QUALITY_THRESHOLD = 2; // any axis ≤ this → flagged

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async () => {
  console.log('Economic quality judge started');

  if (!SUMMARY_TABLE) return { statusCode: 500, body: 'Missing SUMMARIZE_PREDICT_TABLE' };
  if (!GEMINI_KEY) return { statusCode: 500, body: 'Missing XAI_API_KEY (Gemini)' };

  const candidates = await loadCandidates();
  console.log(`Candidates to judge: ${candidates.length} (cap ${MAX_RECORDS})`);

  if (candidates.length === 0) {
    return { statusCode: 200, body: 'No records need judging' };
  }

  let judged = 0;
  let lowQ = 0;
  let failed = 0;

  // Sequential with INTER_CALL_DELAY_MS pacing — Gemini free tier is rate-limited
  for (let i = 0; i < candidates.length; i++) {
    const record = candidates[i];
    try {
      const [threadAnalysis, topicSummaries] = await Promise.all([
        loadThreadAnalysis(record.threadId),
        loadTopicSummaries(record.citedTopicIds || []),
      ]);

      const judgment = await judgeRecord(record, threadAnalysis, topicSummaries);
      if (!judgment) { failed++; continue; }

      const isLowQuality = QUALITY_AXES.some(a => (judgment.scores[a] || 5) <= LOW_QUALITY_THRESHOLD);
      await persistJudgment(record, judgment, isLowQuality);

      judged++;
      if (isLowQuality) lowQ++;
      console.log(`  [${i + 1}/${candidates.length}] ${record.threadId.slice(0, 60)} → scores ${JSON.stringify(judgment.scores)} ${isLowQuality ? '(LOW)' : ''}`);
    } catch (e) {
      failed++;
      console.warn(`  [${i + 1}/${candidates.length}] ${record.threadId} FAILED: ${e.message}`);
    }

    if (i < candidates.length - 1) {
      await sleep(INTER_CALL_DELAY_MS);
    }
  }

  const summary = `Quality judge done: ${judged} judged, ${lowQ} low-quality, ${failed} failed`;
  console.log(summary);
  return { statusCode: 200, body: summary };
};

// ─── DDB helpers ──────────────────────────────────────────────────────────────

async function loadCandidates() {
  const recentCutoffMs = Date.now() - RECENT_DAYS * 86400 * 1000;
  const items = [];
  let lastKey;
  do {
    const resp = await ddb.send(new ScanCommand({
      TableName: SUMMARY_TABLE,
      FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND hasImpact = :hi',
      ExpressionAttributeValues: { ':prefix': ECON_PK_PREFIX, ':sk': ECON_SK, ':hi': true },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);

  // Filter: skip records judged recently
  const eligible = items.filter(item => {
    if (!item.quality_judged_at) return true;
    return new Date(item.quality_judged_at).getTime() < recentCutoffMs;
  });

  // Sort by severityScore desc — judge highest-severity records first
  eligible.sort((a, b) => (b.severityScore || 0) - (a.severityScore || 0));
  return eligible.slice(0, MAX_RECORDS);
}

async function loadThreadAnalysis(threadId) {
  try {
    const { Item } = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: `${THREAD_PK_PREFIX}${threadId}`, SK: THREAD_SK },
    }));
    return Item || null;
  } catch { return null; }
}

async function loadTopicSummaries(topicIds) {
  const map = {};
  const unique = [...new Set(topicIds)].slice(0, 8);
  await Promise.all(unique.map(async (topicId) => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `${TOPIC_PK_PREFIX}${topicId}`, SK: TOPIC_SUMMARY_SK },
      }));
      if (Item?.content) map[topicId] = Item.content;
    } catch {}
  }));
  return map;
}

async function persistJudgment(record, judgment, isLowQuality) {
  await ddb.send(new UpdateCommand({
    TableName: SUMMARY_TABLE,
    Key: { PK: record.PK, SK: record.SK },
    UpdateExpression: 'SET qualityScores = :scores, qualityReasons = :reasons, is_low_quality = :low, quality_judged_at = :ts, quality_judge_model = :model',
    ExpressionAttributeValues: {
      ':scores': judgment.scores,
      ':reasons': judgment.reasons || {},
      ':low': isLowQuality,
      ':ts': new Date().toISOString(),
      ':model': GEMINI_MODEL,
    },
  }));
}

// ─── Judge ────────────────────────────────────────────────────────────────────

function buildJudgePrompt(record, threadAnalysis, topicSummaries) {
  const ta = threadAnalysis || {};
  const topicLines = (record.citedTopicIds || []).slice(0, 6).map(id => {
    const summary = (topicSummaries[id] || '').slice(0, 160).replace(/\s+/g, ' ').trim();
    return `  [${id}]${summary ? ` — ${summary}` : ''}`;
  }).join('\n');

  // Compact view of the record being judged
  const recordView = {
    headline: record.headline,
    severity: record.severity,
    severityScore: record.severityScore,
    confidence: record.confidence,
    horizon: record.horizon,
    instruments: (record.instruments || []).map(i => ({
      id: i.instrumentId, dir: i.direction, mag: i.magnitude, rationale: i.rationale,
    })),
    winners: (record.winners || []).map(w => `${w.name} (${w.type})`),
    losers:  (record.losers  || []).map(l => `${l.name} (${l.type})`),
    mechanism: record.mechanism,
    analog: record.historicalAnalog ? `${record.historicalAnalog.event} (${record.historicalAnalog.year})` : null,
  };

  return `You are an independent reviewer of AI-generated economic disruption analysis. Score the AI output honestly on a 1-5 scale (5=excellent, 3=acceptable, 1=bad). You are NOT the author — your job is to catch problems.

=== ORIGINAL NEWS THREAD ===
Title: ${ta.threadTitle || '(no thread analysis)'}
Story arc: ${(ta.storyArc || '(none)').slice(0, 500)}
Trajectory: ${(ta.trajectory || '(none)').slice(0, 250)}

=== TOPIC CITATIONS THE AI CLAIMS TO USE ===
${topicLines || '  (no topic summaries available)'}

=== AI OUTPUT TO JUDGE ===
${JSON.stringify(recordView, null, 2)}

=== SCORE 5 AXES (integers 1-5) ===
1. coherence — does the mechanism logically follow from the articles? Is the story consistent?
2. citation_fidelity — do the cited topic IDs actually support the claims attached to them? Are claims tied to real evidence?
3. analog_match — is the historical analog actually structurally similar to this story, or superficially named? If no analog, score 3 (neutral).
4. severity_calibration — would a reasonable analyst assign this severity, or is it too aggressive / too cautious?
5. no_bs — does this read as honest analysis, or confident-sounding bullshit (vague reasoning, unfalsifiable claims)?

For ANY axis scored ≤3, give a one-sentence reason in the reasons object. For axes scored ≥4, omit from reasons.

Return ONLY this JSON (no markdown, no commentary):

{
  "scores": {
    "coherence": 4,
    "citation_fidelity": 5,
    "analog_match": 3,
    "severity_calibration": 4,
    "no_bs": 4
  },
  "reasons": {
    "analog_match": "Aramco 2019 is OK but Houthi 2024 is closer in mechanism"
  }
}`;
}

async function judgeRecord(record, threadAnalysis, topicSummaries) {
  const prompt = buildJudgePrompt(record, threadAnalysis, topicSummaries);

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GEMINI_KEY}`,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [
        { role: 'system', content: 'You are a strict independent reviewer. Return only valid JSON. Be willing to mark outputs as 1-2 when warranted. Score honestly, not generously.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      // Disable extended thinking — judgment is a simple 5-axis score, no reasoning
      // chain needed. Without this Gemini 2.5 Flash burns most of max_tokens on
      // hidden thinking and truncates the visible JSON.
      // NOTE: send ONLY thinking_config OR reasoning_effort, never both — Gemini
      // rejects having both with a 400 ("found both"). thinking_budget:0 is the
      // explicit disable for 2.5 Flash.
      extra_body: { google: { thinking_config: { thinking_budget: 0 } } },
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini API ${response.status}: ${rawText.slice(0, 200)}`);
  }

  let parsed;
  try { parsed = JSON.parse(rawText); } catch { throw new Error(`Gemini response not JSON: ${rawText.slice(0, 200)}`); }
  const content = parsed?.choices?.[0]?.message?.content || '';
  const finishReason = parsed?.choices?.[0]?.finish_reason || '(unknown)';
  const usage = parsed?.usage || null;
  const cleaned = stripCodeFence(content);

  let judgment;
  try { judgment = JSON.parse(cleaned); } catch {
    // Surface full diagnostic so we can tell truncation from format errors.
    throw new Error(`Judgment JSON parse failed (finish=${finishReason}, usage=${JSON.stringify(usage)}, len=${cleaned.length}): ${cleaned.slice(0, 600)}`);
  }

  return validateJudgment(judgment);
}

function validateJudgment(j) {
  if (!j || typeof j !== 'object') return null;
  const scores = {};
  for (const axis of QUALITY_AXES) {
    const v = parseInt(j.scores?.[axis], 10);
    if (isNaN(v) || v < 1 || v > 5) return null;
    scores[axis] = v;
  }
  const reasons = {};
  if (j.reasons && typeof j.reasons === 'object') {
    for (const [axis, reason] of Object.entries(j.reasons)) {
      if (QUALITY_AXES.includes(axis) && typeof reason === 'string') {
        reasons[axis] = reason.slice(0, 300);
      }
    }
  }
  return { scores, reasons };
}

function stripCodeFence(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
