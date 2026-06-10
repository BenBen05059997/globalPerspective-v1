'use strict';

// newsWeeklyBrief — generates a professional, analyst-grade WEEKLY INTELLIGENCE BRIEF
// by synthesizing the week's already-generated, already-cited analysis (THREAD_ANALYSIS,
// COUNTRY_INTELLIGENCE, ECONOMIC_IMPACT). The LLM connects + elevates grounded analysis;
// it never mints new facts. Writes a `status:'draft'` record for one-click human approval
// (weekly/review.js) before publish/send. See WEEKLY_DIGEST_PLAN.md.
//
// Manual-invoke first (no EventBridge schedule) until output quality is trusted —
// mirrors the breaking-detector dry-run approach.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
// Legacy GROK_* names hold DeepSeek values in production (see feedback-misleading-grok-naming).
const LLM_MODEL = process.env.GROK_MODEL || 'deepseek-chat';
const LLM_ENDPOINT = process.env.GROK_API_URL || 'https://api.deepseek.com/chat/completions';
const LLM_KEY = process.env.XAI_API_KEY || '';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '3500', 10);
const TEMPERATURE = Number(process.env.TEMPERATURE || '0.3');

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;

const WEEK_DAYS = 7;
const TOP_THREADS = parseInt(process.env.WEEKLY_TOP_THREADS || '6', 10);
const TOP_COUNTRIES = parseInt(process.env.WEEKLY_TOP_COUNTRIES || '6', 10);
const BRIEF_TTL_DAYS = 180;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

exports.handler = async (event = {}) => {
  if (!TOPICS_TABLE || !SUMMARY_TABLE) return fail('Missing table config');
  if (!LLM_KEY) return fail('Missing LLM key (XAI_API_KEY)');

  const weekKey = (event.weekKey || new Date().toISOString().slice(0, 10));
  console.log(`[weekly] generating brief for week ending ${weekKey}`);

  const entries = await readArchiveEntries(WEEK_DAYS);
  console.log(`[weekly] ${entries.length} archive entries over ${WEEK_DAYS}d`);
  if (entries.length === 0) return fail('No archive entries this week — failing empty (honest).');

  // Top threads this week (by entry count = a coverage/significance proxy).
  const threads = groupByThread(entries).slice(0, TOP_THREADS);
  const threadCtx = [];
  for (const t of threads) {
    const ta = await getRecord(`THREAD#${t.threadId}`, 'THREAD_ANALYSIS');
    const econ = await getRecord(`ECON#THREAD#${t.threadId}`, 'ECONOMIC_IMPACT');
    threadCtx.push({ ...t, analysis: ta, econ: econ && econ.hasImpact !== false ? econ : null });
  }

  // Top countries this week (by article volume), enriched with country intelligence.
  const countryCtx = [];
  for (const name of topCountries(entries, TOP_COUNTRIES)) {
    const ci = await getRecord(`COUNTRY#${name}`, 'COUNTRY_INTELLIGENCE');
    if (ci) countryCtx.push({ name, ...ci });
  }

  const prompt = buildPrompt(weekKey, threadCtx, countryCtx);
  const { content, modelId } = await invokeLLM(prompt);
  const brief = parseBrief(content);

  if (!brief.bluf || !Array.isArray(brief.keyDevelopments) || brief.keyDevelopments.length === 0) {
    return fail(`Model returned an unusable brief (keys: ${Object.keys(brief).join(', ')})`);
  }

  const item = {
    PK: `WEEKLY_BRIEF#${weekKey}`,
    SK: 'WEEKLY_BRIEF',
    weekOf: weekKey,
    status: 'draft', // draft → published (human approves via weekly/review.js)
    bluf: brief.bluf,
    keyDevelopments: (brief.keyDevelopments || []).slice(0, 6),
    crossCurrents: brief.crossCurrents || '',
    marketsRead: brief.marketsRead || '',
    watchNext: Array.isArray(brief.watchNext) ? brief.watchNext.slice(0, 6) : [],
    threadIds: threads.map((t) => t.threadId),
    generatedAt: new Date().toISOString(),
    model: modelId || LLM_MODEL,
    ttl: Math.floor(Date.now() / 1000) + BRIEF_TTL_DAYS * 86400,
  };
  await ddb.send(new PutCommand({ TableName: SUMMARY_TABLE, Item: item }));

  console.log(`[weekly] draft stored: WEEKLY_BRIEF#${weekKey} (${item.keyDevelopments.length} developments). Approve via weekly/review.js.`);
  return { ok: true, weekKey, status: 'draft', developments: item.keyDevelopments.length };
};

function fail(msg) {
  console.error('[weekly] ' + msg);
  return { ok: false, error: msg };
}

// ── Data gather (mirrors newsThreadAnalysis) ───────────────────────────────────
function dateKey(date) {
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
    const key = i === 0 ? 'today-archive' : dateKey(date);
    const dateStr = date.toISOString().slice(0, 10);
    try {
      const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: key } }));
      if (Item && Array.isArray(Item.entries)) {
        for (const e of Item.entries) {
          if (e.threadId) {
            entries.push({
              topicId: e.topicId, threadId: e.threadId, title: e.title, date: dateStr,
              regions: e.regions || [], category: e.category || '', ai: e.ai || {},
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[weekly] read ${key} failed: ${err.message}`);
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
    .map(([threadId, arr]) => {
      arr.sort((a, b) => a.date.localeCompare(b.date));
      return { threadId, entries: arr, latestTitle: arr[arr.length - 1].title, category: arr[0].category };
    })
    .sort((a, b) => b.entries.length - a.entries.length);
}

function topCountries(entries, n) {
  const counts = {};
  for (const e of entries) for (const r of e.regions || []) counts[r] = (counts[r] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name]) => name);
}

async function getRecord(pk, sk) {
  try {
    const { Item } = await ddb.send(new GetCommand({ TableName: SUMMARY_TABLE, Key: { PK: pk, SK: sk } }));
    return Item || null;
  } catch { return null; }
}

// ── Prompt — grounded synthesis ────────────────────────────────────────────────
function buildPrompt(weekKey, threadCtx, countryCtx) {
  const threadBlock = threadCtx.map((t, i) => {
    const a = t.analysis || {};
    const econ = t.econ
      ? `\n  Economic read: ${(t.econ.instruments || []).map((x) => `${x.instrumentId} ${x.direction}/${x.magnitude}`).slice(0, 4).join(', ') || 'flagged'}`
      : '';
    return [
      `THREAD ${i + 1} [threadId: ${t.threadId}] — ${a.threadTitle || t.latestTitle} (${t.entries.length} entries, category: ${t.category || 'n/a'})`,
      a.storyArc ? `  Story arc: ${a.storyArc}` : `  Latest: ${t.latestTitle}`,
      a.trajectory ? `  Trajectory: ${a.trajectory}` : '',
      a.riskScore != null ? `  Risk: ${a.riskScore}/100` : '',
      econ,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const countryBlock = countryCtx.map((c) =>
    `COUNTRY: ${c.name} — ${c.headline || ''} (risk: ${c.riskLevel || 'n/a'}${c.riskScore != null ? ` ${c.riskScore}/100` : ''})\n  ${(c.situationSummary || '').slice(0, 400)}`
  ).join('\n\n');

  return `You are the lead analyst at a global-intelligence desk writing the WEEKLY INTELLIGENCE BRIEF for the week ending ${weekKey}. Your readers are professionals — write at analyst depth, no filler, no hedging clichés ("tensions may rise"). Name specific actors, institutions, dates.

CRITICAL GROUNDING RULE: synthesize ONLY from the analysis provided below. Do NOT introduce events, numbers, or claims not present here. Your job is to CONNECT and ELEVATE — find the through-line, the cross-currents, and the forward view across these threads. If the material is thin, say so plainly rather than inventing.

=== THIS WEEK'S STORY THREADS (already-analyzed) ===
${threadBlock || '(none)'}

=== COUNTRY INTELLIGENCE ===
${countryBlock || '(none)'}

Return ONLY valid JSON, no markdown fences, with exactly these fields:
{
  "bluf": "2-3 sentences: the single defining development of the week and the through-line connecting the rest. This is the executive summary a busy principal reads first.",
  "keyDevelopments": [
    { "title": "sharp 6-12 word headline", "whatHappened": "2-3 sentences, specific", "whyItMatters": "1-2 sentences on the stakes/implications", "trajectory": "1-2 sentences on where it's heading (escalating/easing + what to watch)", "threadId": "the threadId from above" }
  ],
  "crossCurrents": "1-2 paragraphs on how these threads CONNECT — second-order effects, contagion, how one domain (conflict/energy/politics/markets) feeds another. This is the systems view that distinguishes a brief from a headline list.",
  "marketsRead": "1 paragraph on the week's economic/market dimension grounded in the economic reads above. Use direction and magnitude qualitatively; never fabricate a percentage.",
  "watchNext": ["3-5 specific, forward-looking watch items for next week — name the actor, event, or deadline. Each is one sentence."]
}

keyDevelopments: include the ${Math.min(5, threadCtx.length)} most consequential threads, most important first. Every threadId MUST be one of those listed above. Output only the JSON object.`;
}

function parseBrief(content) {
  const cleaned = stripCodeFence(content);
  try { return JSON.parse(cleaned); }
  catch (err) { throw new Error(`Failed to parse brief JSON: ${err.message}\nRaw: ${cleaned.slice(0, 200)}`); }
}

// ── LLM call (OpenAI-compatible; mirrors newsThreadAnalysis) ────────────────────
async function invokeLLM(prompt) {
  const res = await fetch(LLM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      response_format: { type: 'json_object' },
    }),
  });
  const raw = await res.text();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  if (!res.ok) throw new Error(`LLM error: ${parsed?.error?.message || raw || res.status}`);
  return { modelId: parsed?.model || LLM_MODEL, content: extractContent(parsed) };
}

function extractContent(payload) {
  if (!payload) return '';
  const msg = payload?.choices?.[0]?.message?.content;
  if (typeof msg === 'string') return msg;
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload);
}

function stripCodeFence(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').replace(/,(\s*[\]}])/g, '$1').trim();
}
