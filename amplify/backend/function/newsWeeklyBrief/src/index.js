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

  // Free-form: the analysis is `brief` (Markdown prose); headline/dek are metadata for
  // the email subject + on-site preview. Require a substantive body.
  if (!brief.brief || brief.brief.trim().length < 200) {
    return fail(`Model returned an unusable brief (keys: ${Object.keys(brief).join(', ')})`);
  }

  const item = {
    PK: `WEEKLY_BRIEF#${weekKey}`,
    SK: 'WEEKLY_BRIEF',
    weekOf: weekKey,
    status: 'draft', // draft → published (human approves via weekly/review.js)
    headline: brief.headline || `Weekly Intelligence Brief — week of ${weekKey}`,
    dek: brief.dek || '',
    brief: brief.brief.trim(), // Markdown analytical prose
    threadIds: threads.map((t) => t.threadId),
    generatedAt: new Date().toISOString(),
    model: modelId || LLM_MODEL,
    ttl: Math.floor(Date.now() / 1000) + BRIEF_TTL_DAYS * 86400,
  };
  await ddb.send(new PutCommand({ TableName: SUMMARY_TABLE, Item: item }));

  console.log(`[weekly] draft stored: WEEKLY_BRIEF#${weekKey} (${item.brief.length} chars). Approve via weekly/review.js.`);
  return { ok: true, weekKey, status: 'draft', chars: item.brief.length };
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

// ── Prompt — free-form, tradecraft-grounded analysis ───────────────────────────
// Composition + rules distilled from IC analytic tradecraft (ICD 203), Sherman Kent's
// estimative-probability ladder, Heuer's bias traps, and analytical-journalism craft
// (nut graf / BLUF / Economist leader). The model writes free-form Markdown prose — NOT a
// rigid field schema — because forcing fixed fields produces formulaic, summary-like output.
function buildPrompt(weekKey, threadCtx, countryCtx) {
  const threadBlock = threadCtx.map((t, i) => {
    const a = t.analysis || {};
    const econ = t.econ
      ? `\n  Economic read: ${(t.econ.instruments || []).map((x) => `${x.instrumentId} ${x.direction}/${x.magnitude}`).slice(0, 4).join(', ') || 'flagged'}`
      : '';
    return [
      `THREAD ${i + 1} [${t.threadId}] — ${a.threadTitle || t.latestTitle} (${t.entries.length} entries, ${t.category || 'n/a'})`,
      a.storyArc ? `  Story arc: ${a.storyArc}` : `  Latest: ${t.latestTitle}`,
      a.trajectory ? `  Trajectory: ${a.trajectory}` : '',
      a.riskScore != null ? `  Risk: ${a.riskScore}/100` : '',
      econ,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const countryBlock = countryCtx.map((c) =>
    `COUNTRY: ${c.name} — ${c.headline || ''} (risk: ${c.riskLevel || 'n/a'}${c.riskScore != null ? ` ${c.riskScore}/100` : ''})\n  ${(c.situationSummary || '').slice(0, 400)}`
  ).join('\n\n');

  return `You are the lead analyst at a global-intelligence desk writing this week's INTELLIGENCE BRIEF for the week ending ${weekKey}. Your readers are professionals (analysts, investors, policymakers). Write a genuine analytical brief in Markdown — prose, not a list of headline summaries.

=== HARD GROUNDING RULE ===
Use ONLY the analysis provided below. Never introduce an event, number, name, or date that is not present in this material. Your value is CONNECTING and JUDGING what's here, not adding facts. If the week's material is thin, say so plainly — do not pad or invent.

=== WHAT MAKES THIS ANALYSIS, NOT SUMMARY ===
A summary says what happened; analysis says what it MEANS, why it matters, and what comes next. If a sentence merely restates an event without a judgment or implication, cut it. Compose the brief by moving through these functions (free-form — use your own subheads, don't label them mechanically):
1. BLUF: open with the single most important JUDGMENT of the week in the first sentence — the conclusion, before the evidence. No throat-clearing ("it's been a busy week").
2. The nut: why this matters now, the through-line tying the week together.
3. Stand back: the structural context — how this developed, the larger pattern, what changed versus the prior trend.
4. The evidence, one argument per paragraph, naming specific actors, institutions, places.
5. Cross-currents: how the threads CONNECT — second-order effects, contagion, how one domain (conflict / energy / politics / markets / health) feeds another. This systems view is the point.
6. The strongest ALTERNATIVE reading: state the most credible competing interpretation, then adjudicate it honestly (don't strawman, don't false-balance).
7. Forward view: calibrated forecasts + concrete, falsifiable indicators to watch next week.

=== CALIBRATION (use these exact probability words, consistently) ===
almost certain (~95%+) · very likely (~80–95%) · likely (~55–80%) · roughly even chance (~45–55%) · unlikely (~20–45%) · very unlikely (~5–20%) · almost no chance (<5%). Keep each word's meaning fixed. Separate LIKELIHOOD from CONFIDENCE (high/moderate/low) when the evidence is uneven — e.g. "very likely, but low confidence given a single source." Never invent a precise percentage you didn't reason to.

=== DON'Ts ===
No throat-clearing intros. No vague hedging ("tensions may rise," "time will tell," "remains to be seen," "could go either way"). No listicle-without-synthesis. No false balance. No false precision. Don't let the most dramatic event crowd out the most important one. Don't blend sourced fact with your own inference — make clear which is which. Being boring is a failure.

=== THIS WEEK'S ANALYZED THREADS ===
${threadBlock || '(none)'}

=== COUNTRY INTELLIGENCE ===
${countryBlock || '(none)'}

Return ONLY valid JSON, no markdown code fences, with exactly these fields:
{
  "headline": "6-12 word title capturing the week's single defining judgment (not a topic label)",
  "dek": "one-sentence standfirst that sharpens the headline",
  "brief": "the full analytical brief as Markdown prose, ~700-1000 words. Use ## subheads as you see fit. This is free-form — write it like a real analyst, following the composition and rules above."
}`;
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
