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
  // Default is FREE (richer analysis); the mandatory human review (weekly/review.js) is the
  // grounding/verification layer before publish. Pass {mode:'grounded'} to force strict.
  const mode = event.mode === 'grounded' ? 'grounded' : 'free';
  const SK = 'WEEKLY_BRIEF'; // canonical record the serving layer reads (mode stored as an attr)
  console.log(`[weekly] generating ${mode} brief for week ending ${weekKey}`);

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

  // Deterministic risk per thread: thread analysis risk, else max risk of its regions.
  const countryRisk = {};
  for (const c of countryCtx) if (Number.isFinite(Number(c.riskScore))) countryRisk[c.name] = Number(c.riskScore);
  for (const t of threadCtx) {
    const a = t.analysis || {};
    const regionMax = Math.max(0, ...t.regions.map((r) => countryRisk[r] || 0));
    const score = Number.isFinite(Number(a.riskScore)) ? Number(a.riskScore) : (regionMax > 0 ? regionMax : null);
    t.riskScore = score;
    t.riskLevel = riskLevelFromScore(score);
  }

  const prompt = buildSignalsPrompt(weekKey, threadCtx);
  const { content, modelId } = await invokeLLM(prompt);
  const parsed = parseJson(content);

  // Join the LLM's per-signal TEXT with the DETERMINISTIC data (risk, region, sources,
  // as-of). The model never supplies risk levels, sources, or dates — those are our data.
  const byId = {};
  for (const s of (parsed.signals || [])) if (s && s.threadId) byId[s.threadId] = s;
  const signals = threadCtx
    .map((t) => {
      const s = byId[t.threadId];
      if (!s || !s.lede || !s.fact) return null;
      return {
        threadId: t.threadId,
        kind: s.kind === 'development' ? 'development' : 'threat', // default threat (shows risk chip)
        lede: String(s.lede).trim(),
        fact: String(s.fact).trim(),
        soWhat: s.soWhat ? String(s.soWhat).trim() : '',
        related: s.related ? String(s.related).trim() : null,
        riskLevel: t.riskLevel,        // deterministic
        riskScore: t.riskScore,        // deterministic
        region: t.regions.slice(0, 3).join(' · '),
        asOf: t.latestDate,            // deterministic
        sources: t.sources,            // real article links, deterministic
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)); // most significant first

  if (signals.length === 0) return fail('No usable signals produced — failing empty (honest).');

  const watch = Array.isArray(parsed.watch)
    ? parsed.watch.filter((w) => w && w.event).map((w) => ({
        event: String(w.event).trim(),
        date: w.date ? String(w.date).trim() : '',
        stake: w.stake ? String(w.stake).trim() : '',
      })).slice(0, 6)
    : [];

  const item = {
    PK: `WEEKLY_BRIEF#${weekKey}`,
    SK,
    format: 'signals', // distinguishes from the old prose shape
    weekOf: weekKey,
    asOf: new Date().toISOString().slice(0, 10),
    status: 'draft', // draft → published (human approves via weekly/review.js)
    signals,
    watch,
    threadIds: threads.map((t) => t.threadId),
    generatedAt: new Date().toISOString(),
    model: modelId || LLM_MODEL,
    ttl: Math.floor(Date.now() / 1000) + BRIEF_TTL_DAYS * 86400,
  };
  await ddb.send(new PutCommand({ TableName: SUMMARY_TABLE, Item: item }));

  console.log(`[weekly] draft stored: WEEKLY_BRIEF#${weekKey} (${signals.length} signals, ${watch.length} watch). Approve via weekly/review.js.`);
  return { ok: true, weekKey, status: 'draft', signals: signals.length, watch: watch.length };
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
              sources: Array.isArray(e.sources) ? e.sources : [],
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
      const regions = [...new Set(arr.flatMap((e) => e.regions || []))];
      const seen = new Set();
      const sources = [];
      for (const e of arr) {
        for (const s of e.sources || []) {
          if (s && s.url && !seen.has(s.url)) { seen.add(s.url); sources.push({ title: s.title || s.source || '', url: s.url, source: s.source || '' }); }
        }
      }
      return {
        threadId, entries: arr, regions,
        latestTitle: arr[arr.length - 1].title, category: arr[0].category,
        latestDate: arr[arr.length - 1].date, sources: sources.slice(0, 4),
      };
    })
    .sort((a, b) => b.entries.length - a.entries.length);
}

// Map a 0–100 risk score to the site's four-tier level (null when unknown — honest, no chip).
function riskLevelFromScore(score) {
  if (!Number.isFinite(score)) return null;
  if (score < 25) return 'low';
  if (score < 50) return 'moderate';
  if (score < 75) return 'elevated';
  return 'high';
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

// ── Prompt — SIGNALS digest (not a synthesized essay) ──────────────────────────
// Distilled from how rigorous weeklies actually work (Economist "world this week",
// ISW assessments, Semafor "Semaform"): surface discrete signals, separate fact from
// judgment, verb-mark every claim, calibrate, and DO NOT manufacture a grand thesis or
// force connections. The LLM writes only per-signal TEXT; we attach risk/sources/dates.
function buildSignalsPrompt(weekKey, threadCtx) {
  const threadBlock = threadCtx.map((t, i) => {
    const a = t.analysis || {};
    const outlets = (t.sources || []).map((s) => s.source || s.title).filter(Boolean).slice(0, 5).join(', ');
    const econ = t.econ
      ? `\n  Economic read (already computed): ${(t.econ.instruments || []).map((x) => `${x.instrumentId} ${x.direction}/${x.magnitude}`).slice(0, 4).join(', ') || 'flagged'}`
      : '';
    return [
      `SIGNAL ${i + 1} [threadId: ${t.threadId}] — ${a.threadTitle || t.latestTitle}`,
      `  Latest development: ${t.latestTitle} (as of ${t.latestDate})`,
      a.storyArc ? `  Story arc: ${a.storyArc}` : '',
      a.trajectory ? `  Trajectory (already assessed): ${a.trajectory}` : '',
      Array.isArray(a.watchQuestions) && a.watchQuestions.length ? `  Watch questions: ${a.watchQuestions.join(' | ')}` : '',
      outlets ? `  Covered by: ${outlets}` : '',
      econ,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return `You are an intelligence-desk editor compiling this week's SIGNALS BRIEF (week ending ${weekKey}) for professional readers. This is a SIGNALS DIGEST, not an essay. You surface the week's discrete signals cleanly and let the reader connect them. You do NOT write a grand thesis, a "theme of the week", or a cross-cutting synthesis.

For each SIGNAL below, write these short fields, grounded ONLY in the material provided for that signal:
- "kind": "threat" or "development". Use "threat" when the signal is an escalation, conflict, crisis, disaster, attack, outbreak, or a threat to stability. Use "development" when it is a cooperative agreement, framework, policy, deal, or other non-threatening event — even if it is significant. (This controls whether the reader sees a red risk chip or a neutral one, so classify honestly: a cooperative climate framework is a "development", not a "threat".)
- "lede": the development in <= 10 words (a scannable headline phrase, not a sentence).
- "fact": 1-2 sentences of what happened. VERB-MARK epistemic status: state verified events plainly; mark anything attributed/unconfirmed with "reportedly" or "according to <outlet>"; if a key point is the ABSENCE of something (e.g. a readout did not mention nukes), say so plainly. Use ONLY facts present in this signal's material — never add an event, number, name, or date that isn't here.
- "soWhat": ONE calibrated sentence on why it matters. Allowed: "raises the odds that…", "signals…", "points to…", "a test of…". FORBIDDEN: bare "will", "is going to", "this means X happens", and vague filler ("tensions may rise", "time will tell"). If there is no real so-what, return "" (empty) rather than padding.
- "related": OPTIONAL. Only set this if two signals are LITERALLY the same actor or event with a real causal link — name the other signal. If you are not certain it is a real link, OMIT it. Never infer a thematic connection.

EPISTEMIC DISCIPLINE (this is the whole point):
- Do NOT pick the most dramatic interpretation. If the evidence is ambiguous, say it is ambiguous. If a competing reading is better supported, reflect that in the "fact"/"soWhat" rather than asserting the dramatic one.
- Separate fact from judgment: "fact" = what happened; "soWhat" = your assessment.
- No invented specifics. Do NOT state precise figures, dates, or quotes not present in the material.
- Do NOT write any overall summary, BLUF, or connecting narrative. Only the per-signal fields and the watch list.

Also produce "watch": 3-5 forward items to watch next week, derived from the trajectories/watch-questions above. Each: { "event": named event/actor/decision, "date": specific date if known else "", "stake": one calibrated line on why it matters }. Frame as what to watch, NOT as predictions.

=== THIS WEEK'S SIGNALS (already-analyzed; ground each item ONLY in its own block) ===
${threadBlock || '(none)'}

Return ONLY valid JSON, no code fences:
{
  "signals": [ { "threadId": "...", "kind": "threat", "lede": "...", "fact": "...", "soWhat": "...", "related": null } ],
  "watch": [ { "event": "...", "date": "", "stake": "..." } ]
}
Include one signals entry per SIGNAL above, using its exact threadId.`;
}

function parseJson(content) {
  const cleaned = stripCodeFence(content);
  try { return JSON.parse(cleaned); }
  catch (err) { throw new Error(`Failed to parse JSON: ${err.message}\nRaw: ${cleaned.slice(0, 200)}`); }
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
