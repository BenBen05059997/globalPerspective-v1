'use strict';

// The story agent's text rules, apart from the handler: the topic and archive-entry shapes, the summary and cause-chain prompts, the call options
// and the stored item. No AWS client and no env of its own, so the handler (index.js) and the one-off recovery script
// (backend/record/cli/recover-late-slots.mjs, decision 0061) run the same code.

const crypto = require('crypto');
const lib = require('./lib');
const threading = require('./threading');
const { stripCodeFence } = require('./_shared/llm');
const { slugify } = threading;

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
    '5) If the event is unresolved or a detail is not reported, say it about the event itself (e.g. "the vote is pending; no result has been reported"). Never mention the snippets, the headline, the sources or their completeness, and never write "the snippet/source does not report…". If a source has no usable text, ignore it. A fact that appears only in the title is stated plainly, never as "per the title" or "the title states". A snippet that breaks off mid-sentence is left out without comment.',
    '6) To attribute a claim, name the outlet given in brackets on its source line (e.g. "per Al Jazeera"); never write "the snippets", "the sources" or "the report" instead of the outlet.',
    `Title: ${topic.title || 'Untitled Topic'}`,
    snippets ? `Source article snippets (your ONLY material):\n${snippets}` : 'No source snippets were provided — summarize only what the title states, in one or two bullets, without commenting on the material.',
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
    'Grounding rule: the "proximate" event and ANY specific name, figure, or date must come from the Article Snippets — do not invent them or turn a hedge ("could") into a settled fact. The structural/contributing/alternativePerspective fields may use general background reasoning, but never fabricate a specific fact the snippets do not support; if unknown, keep it general. The same holds for every "evidence" text: say about a snippet only what it says. If a snippet is just a headline, add no actor, place, cause or quote it does not name, and do not finish a sentence that is cut off. Background reasoning stays general: no names, dates or figures from memory.',
    'Talk about the event, never about the material: do not write that a snippet is cut off, empty or silent on something, and do not write "not stated in the snippet" or "not stated in the source". Where a detail is unknown, leave it out or keep the sentence general. In "when", name a weekday or a date only if a snippet states it; otherwise give the period in general words, for example "mid-November 2026".',
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

function buildArchiveEntry(topic, ai, generationId, sourceCap, threadId, archivedAt) {
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
    archivedAt,
    generationId,
    ai,
    ...(topic.continues_topic && { continues_topic: topic.continues_topic }),
  };
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



// ============================================================
// THE TEXT STEPS of one story (summary, cause chain), as functions of their inputs: the handler (index.js) and the one-off recovery
// script (backend/record/cli/recover-late-slots.mjs, decision 0061) both build their prompts, call options and stored items here.
// The forecast is not here: it has its own path in index.js and the script has no way to reach it.
// ============================================================

const TEXT_KINDS = ['summary', 'trace_cause'];

/** The cause-chain prompt's version, stamped on its stored item (and so on the entry note). 2 = the rule against talking about the source text and against invented weekdays (decision 0061). The forecast's own lib.PROMPT_VERSION is a different number and is not touched. */
const TRACE_CAUSE_PROMPT_VERSION = 2;

/** The caps and sampling of the agent's text calls from its env (MAX_TOKENS, TEMPERATURE, TOP_P; the live MAX_TOKENS is 1500, decision 0060). */
function storyDefaults(env) {
  return { maxTokens: parseInt(env.MAX_TOKENS || '600', 10), temperature: Number(env.TEMPERATURE || '0.2'), topP: Number(env.TOP_P || '0.9') };
}

/** The prompt of a summary or cause-chain call. Throws for any other kind. */
function textPrompt(kind, topic, generatedDate) {
  if (kind === 'summary') return buildSummaryPrompt(topic, generatedDate);
  if (kind === 'trace_cause') return buildTraceCausePrompt(topic, generatedDate);
  throw new Error(`story-text: no text prompt for kind ${kind}`);
}

/** The options of a model call of the agent: the shared llm.js `chat` (thinking off). The Lambda timeout is 900 s, so one call is capped at 2 tries x 180 s. */
function storyChatOptions({ prompt, maxTokens, model, step, json, temperature, topP }) {
  return { step, model, user: prompt, maxTokens, temperature, topP, json, timeoutMs: 180000, retries: 1 };
}

/** `chat`'s answer -> the agent's response ({modelId, content, latencyMs, usage}); an empty answer throws. */
function storyAnswer(r) {
  const content = stripCodeFence(r.content);
  if (!content) throw new Error(`Empty response from ${r.model}`);
  return { modelId: r.model, content, latencyMs: r.latencyMs, usage: r.usage };
}

/** A cause chain and a forecast are stored as JSON text (fences stripped); a summary as it came. */
function finishText(kind, response) {
  return kind === 'prediction' || kind === 'trace_cause' ? { ...response, content: normalizeJsonResponse(response.content, kind) } : response;
}

/** The SUMMARIZE_PREDICT item of one generated text (the row writeCache puts). `nowMs` is the write time. */
function buildCacheItem({ pk, sk, topic, kind, response, ttlSeconds, generationId, fingerprint, threadId, nowMs }) {
  const isJson = (kind === 'prediction' || kind === 'trace_cause') && (() => {
    try { JSON.parse(response.content); return true; } catch { return false; }
  })();
  return {
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
    generatedAt: new Date(nowMs).toISOString(),
    generationId,
    ttl: Math.floor(nowMs / 1000) + ttlSeconds,
    latencyMs: response.latencyMs,
    ...(kind === 'prediction' ? { promptVersion: lib.PROMPT_VERSION } : {}),
    ...(kind === 'trace_cause' ? { promptVersion: TRACE_CAUSE_PROMPT_VERSION } : {}),
    ...(fingerprint ? { sourceFingerprint: fingerprint } : {}),
    lastVerifiedAt: new Date(nowMs).toISOString(),
  };
}

module.exports = {
  TEXT_KINDS, TRACE_CAUSE_PROMPT_VERSION, storyDefaults, buildTopic, buildStableTopicId, normalizeList, buildSummaryPrompt, buildTraceCausePrompt, normalizeJsonResponse, buildArchiveEntry,
  textPrompt, storyChatOptions, storyAnswer, finishText, buildCacheItem,
};
