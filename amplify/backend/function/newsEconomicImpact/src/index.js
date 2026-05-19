'use strict';

/**
 * newsEconomicImpact — per-thread economic disruption analysis
 *
 * For every news thread with an economic dimension:
 *   - Picks instruments from a CLOSED allowlist (any unknown ticker → dropped)
 *   - Emits direction (up/down/mixed), magnitude (small/moderate/large) — NEVER %
 *   - Cites topicIds for every claim (uncited claims dropped post-parse)
 *   - Snapshots actual market prices from MARKETS_DDB_TABLE (compute, don't generate)
 *   - Writes tombstone records {hasImpact:false} when no economic dimension exists
 *
 * DDB writes: SUMMARIZE_PREDICT_TABLE
 *   PK: ECON#THREAD#{threadId}    SK: ECONOMIC_IMPACT   (21-day TTL)
 *
 * Reads:
 *   - TOPICS_DDB_TABLE: today-archive + archive#YYYY-MM-DD (30 days)
 *   - SUMMARIZE_PREDICT_TABLE: THREAD#{id}/THREAD_ANALYSIS, TOPIC#{id}/SUMMARY
 *   - MARKETS_DDB_TABLE: FX#USD/LATEST, RATES#GLOBAL/LATEST, COMMODITIES#GLOBAL/LATEST,
 *                       EQUITIES#GLOBAL/LATEST
 *
 * Env vars (legacy names — point at DeepSeek in production):
 *   XAI_API_KEY, GROK_MODEL, GROK_API_URL
 *   TOPICS_DDB_TABLE, SUMMARIZE_PREDICT_TABLE, MARKETS_DDB_TABLE
 *   LLM_CONCURRENCY (default 4)
 *   ECON_MIN_ENTRIES (default 2) — skip threads below this article count
 *   ECON_MAX_THREADS (default 15) — cap analyses per run
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const ANALOG_CATALOG = require('./economic_analogs.json');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const GROK_MODEL = process.env.GROK_MODEL || 'deepseek-chat';
const GROK_ENDPOINT = process.env.GROK_API_URL || 'https://api.deepseek.com/chat/completions';
const GROK_KEY = process.env.XAI_API_KEY || '';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '1500', 10);
const TEMPERATURE = Number(process.env.TEMPERATURE || '0.2');
const LLM_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '4', 10);

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const MARKETS_TABLE = process.env.MARKETS_DDB_TABLE || 'GlobalPerspectiveMarkets';

const ECON_PK_PREFIX = 'ECON#THREAD#';
const ECON_SK = 'ECONOMIC_IMPACT';
const THREAD_PK_PREFIX = 'THREAD#';
const THREAD_SK = 'THREAD_ANALYSIS';
const TOPIC_PK_PREFIX = 'TOPIC#';
const TOPIC_SUMMARY_SK = 'SUMMARY';

const ECON_TTL_DAYS = 21;
const ARCHIVE_DAYS = 30;
const MIN_ENTRIES_PER_THREAD = parseInt(process.env.ECON_MIN_ENTRIES || '2', 10);
const MAX_THREADS = parseInt(process.env.ECON_MAX_THREADS || '15', 10);

// Categories where economic dimension is plausible (filters out pure-society/science/tech threads)
const ECONOMIC_CATEGORIES = new Set([
  'economy', 'conflict', 'politics', 'energy', 'climate', 'trade', 'security',
  'business', 'markets', 'sanctions', 'diplomacy',
]);

// CLOSED INSTRUMENT ALLOWLIST — anything outside this set is dropped server-side.
// This is the single most important hallucination guard in the system.
const INSTRUMENT_ALLOWLIST = new Set([
  // Commodities
  'BRENT', 'WTI', 'GOLD', 'COPPER', 'VIX', 'DXY',
  // Rates
  'US10Y', 'US2Y', 'UK10Y', 'DE10Y', 'JP10Y',
  // Equity indices (NSEI/TA125 replaced with INDA/EIS US-listed ETF proxies — Stooq coverage)
  'SPX', 'NDX', 'DJI', 'FTM', 'DAX', 'N225', 'HSI', 'SSEC',
  'KS11', 'TWII', 'INDA', 'BVSP', 'MERV', 'XU100', 'EIS',
  // Sector + credit ETFs
  'XLE', 'ITA', 'SOXX', 'XLF', 'EEM', 'EFA', 'GDX', 'SHY', 'EMB', 'HYG',
  // Qualitative buckets (when no specific instrument fits)
  'EQUITIES_EM', 'EQUITIES_DM', 'CREDIT_EM', 'CREDIT_DM',
  // Crypto (Phase 2 — tag with geopoliticalRelevance when used)
  'BTC', 'ETH',
]);

// FX pairs added dynamically below from the FX latest snapshot at runtime.

const VALID_DIRECTIONS = new Set(['up', 'down', 'mixed']);
const VALID_MAGNITUDES = new Set(['small', 'moderate', 'large']);
const VALID_SEVERITIES = new Set(['minor', 'moderate', 'severe']);
const VALID_CONFIDENCES = new Set(['low', 'medium', 'high']);
const VALID_HORIZONS = new Set(['immediate', 'days', 'weeks', 'months']);

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async () => {
  console.log('Economic impact analysis started');

  if (!TOPICS_TABLE || !SUMMARY_TABLE) {
    console.error('Missing table configuration');
    return { statusCode: 500, body: 'Missing table config' };
  }
  if (!GROK_KEY) {
    console.error('Missing XAI_API_KEY');
    return { statusCode: 500, body: 'Missing API key' };
  }

  const entries = await readArchiveEntries(ARCHIVE_DAYS);
  console.log(`Loaded ${entries.length} archive entries`);

  const threads = groupByThread(entries);
  const eligible = threads
    .filter(t => t.entries.length >= MIN_ENTRIES_PER_THREAD)
    .filter(t => ECONOMIC_CATEGORIES.has(t.category))
    .sort((a, b) => b.entries.length - a.entries.length)
    .slice(0, MAX_THREADS);

  console.log(`Eligible threads for economic analysis: ${eligible.length} (cap ${MAX_THREADS})`);

  if (eligible.length === 0) {
    return { statusCode: 200, body: 'No eligible threads' };
  }

  const [threadAnalyses, topicSummaries, marketContext] = await Promise.all([
    loadThreadAnalyses(eligible.map(t => t.threadId)),
    loadTopicSummaries(eligible.flatMap(t => t.entries.map(e => e.topicId)).filter(Boolean)),
    loadMarketContext(),
  ]);

  console.log(`Loaded ${Object.keys(threadAnalyses).length} thread analyses, ${Object.keys(topicSummaries).length} topic summaries`);
  console.log(`Market context keys: ${Object.keys(marketContext).join(', ')}`);

  // Build dynamic FX allowlist from current FX snapshot (e.g. "USD/EUR")
  const fxKeys = new Set();
  if (marketContext.FX?.rates) {
    for (const ccy of Object.keys(marketContext.FX.rates)) fxKeys.add(`USD/${ccy}`);
  }

  let generated = 0;
  let tombstoned = 0;
  let failed = 0;
  let skipped = 0;

  await mapWithConcurrency(eligible, LLM_CONCURRENCY, async (thread) => {
    try {
      // Skip if existing record is fresh and thread hasn't grown
      const existing = await readExisting(thread.threadId);
      if (existing && existing.entryCount === thread.entries.length && isFresh(existing.generatedAt, 7)) {
        skipped++;
        return;
      }

      const result = await generateEconomicImpact(thread, threadAnalyses, topicSummaries, marketContext, fxKeys);

      if (!result || result.hasImpact === false) {
        await writeTombstone(thread);
        tombstoned++;
        return;
      }

      await writeImpact(thread, result, marketContext);
      generated++;
    } catch (err) {
      failed++;
      console.error(`Failed for thread ${thread.threadId}:`, err.message);
    }
  });

  const summary = `Economic impact done: ${generated} generated, ${tombstoned} tombstoned, ${skipped} skipped, ${failed} failed`;
  console.log(summary);
  return { statusCode: 200, body: summary };
};

// ─── Concurrency ──────────────────────────────────────────────────────────────

async function mapWithConcurrency(items, concurrency, worker) {
  const queue = [...items];
  const inflight = [];
  while (queue.length || inflight.length) {
    while (inflight.length < concurrency && queue.length) {
      const item = queue.shift();
      const p = worker(item).finally(() => {
        const idx = inflight.indexOf(p);
        if (idx >= 0) inflight.splice(idx, 1);
      });
      inflight.push(p);
    }
    if (inflight.length) await Promise.race(inflight);
  }
}

// ─── Data loading ─────────────────────────────────────────────────────────────

function formatDateKey(date) {
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
    const key = i === 0 ? 'today-archive' : formatDateKey(date);
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

    try {
      const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: key } }));
      if (Item && Array.isArray(Item.entries)) {
        for (const e of Item.entries) {
          entries.push({
            topicId: e.topicId,
            threadId: e.threadId || null,
            title: e.title,
            date: dateStr,
            regions: e.regions || [],
            category: (e.category || 'other').toLowerCase(),
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to read ${key}:`, err.message);
    }
  }

  return entries;
}

function groupByThread(entries) {
  const map = {};
  for (const e of entries) {
    if (!e.threadId) continue;
    if (!map[e.threadId]) {
      map[e.threadId] = { threadId: e.threadId, entries: [], category: e.category };
    }
    map[e.threadId].entries.push(e);
    // Use the most common category across entries
    if (e.category && ECONOMIC_CATEGORIES.has(e.category)) map[e.threadId].category = e.category;
  }
  return Object.values(map);
}

async function loadThreadAnalyses(threadIds) {
  const analyses = {};
  await Promise.all(threadIds.map(async (threadId) => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `${THREAD_PK_PREFIX}${threadId}`, SK: THREAD_SK },
      }));
      if (Item) analyses[threadId] = Item;
    } catch {}
  }));
  return analyses;
}

async function loadTopicSummaries(topicIds) {
  const summaries = {};
  const unique = [...new Set(topicIds)].slice(0, 100); // cap to avoid hot-loop on huge sets
  await Promise.all(unique.map(async (topicId) => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `${TOPIC_PK_PREFIX}${topicId}`, SK: TOPIC_SUMMARY_SK },
      }));
      if (Item?.content) summaries[topicId] = Item.content;
    } catch {}
  }));
  return summaries;
}

async function loadMarketContext() {
  const ctx = {};
  const fetch = async (pk, sk, key) => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: MARKETS_TABLE,
        Key: { pk, sk },
      }));
      if (Item) ctx[key] = Item;
    } catch (err) {
      console.warn(`Markets fetch ${pk}/${sk} failed: ${err.message}`);
    }
  };
  await Promise.all([
    fetch('FX#USD', 'LATEST', 'FX'),
    fetch('RATES#GLOBAL', 'LATEST', 'RATES'),
    fetch('COMMODITIES#GLOBAL', 'LATEST', 'COMMODITIES'),
    fetch('EQUITIES#GLOBAL', 'LATEST', 'EQUITIES'),
    fetch('CRYPTO#GLOBAL', 'LATEST', 'CRYPTO'),
  ]);
  return ctx;
}

async function readExisting(threadId) {
  try {
    const { Item } = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: `${ECON_PK_PREFIX}${threadId}`, SK: ECON_SK },
    }));
    return Item || null;
  } catch { return null; }
}

function isFresh(iso, days) {
  if (!iso) return false;
  const generated = new Date(iso).getTime();
  return Date.now() - generated < days * 86400 * 1000;
}

// ─── Prompt + LLM ─────────────────────────────────────────────────────────────

function buildInstrumentTable(marketContext, fxKeys) {
  const lines = [];
  const push = (id, label, valueFmt) => lines.push(`  ${id.padEnd(12)} ${label.padEnd(28)} ${valueFmt}`);

  // Commodities
  const C = marketContext.COMMODITIES || {};
  push('BRENT',  'ICE Brent crude',         fmt(C.brent, '$'));
  push('WTI',    'NYMEX WTI crude',         fmt(C.wti, '$'));
  push('GOLD',   'COMEX gold',              fmt(C.gold, '$'));
  push('COPPER', 'COMEX copper',            fmt(C.copper, '$'));
  push('VIX',    'CBOE VIX',                fmt(C.vix));
  push('DXY',    'US dollar index',         fmt(C.dxy));

  // Rates
  const R = marketContext.RATES || {};
  push('US10Y',  '10Y Treasury yield',      fmt(R.US10Y, '', '%'));
  push('US2Y',   '2Y Treasury yield',       fmt(R.US2Y, '', '%'));
  push('UK10Y',  '10Y UK gilt yield',       fmt(R.UK10Y, '', '%'));
  push('DE10Y',  '10Y German bund yield',   fmt(R.DE10Y, '', '%'));
  push('JP10Y',  '10Y JGB yield',           fmt(R.JP10Y, '', '%'));

  // Equities + ETFs
  const E = marketContext.EQUITIES || {};
  for (const id of ['SPX','NDX','DJI','FTM','DAX','N225','HSI','SSEC','KS11','TWII','INDA','BVSP','MERV','XU100','EIS']) {
    push(id, id === 'INDA' ? 'INDA (India proxy ETF)' : id === 'EIS' ? 'EIS (Israel proxy ETF)' : `${id} index`, fmt(E[id]));
  }
  for (const id of ['XLE','ITA','SOXX','XLF','EEM','EFA','GDX','SHY','EMB','HYG']) {
    push(id, `${id} ETF`, fmt(E[id], '$'));
  }

  // FX (top 10 most relevant)
  if (marketContext.FX?.rates) {
    const top = ['EUR','GBP','JPY','CNY','CHF','AUD','CAD','INR','BRL','MXN','TRY','ARS','RUB','KRW','ZAR'];
    for (const ccy of top) {
      const v = marketContext.FX.rates[ccy];
      if (v != null) push(`USD/${ccy}`, `USD per ${ccy}`, v.toFixed(4));
    }
  }

  // Crypto (use sparingly — only when geopoliticalRelevance applies: sanctions, capital flight)
  const X = marketContext.CRYPTO || {};
  push('BTC', 'Bitcoin (use only for sanctions/capital-flight stories)', fmt(X.BTC, '$'));
  push('ETH', 'Ethereum (use only for sanctions/capital-flight stories)', fmt(X.ETH, '$'));

  // Qualitative buckets
  lines.push('  EQUITIES_EM  Emerging-market equities     (qualitative)');
  lines.push('  EQUITIES_DM  Developed-market equities    (qualitative)');
  lines.push('  CREDIT_EM    Emerging-market credit       (qualitative)');
  lines.push('  CREDIT_DM    Developed-market credit      (qualitative)');

  return lines.join('\n');
}

function fmt(v, prefix = '', suffix = '') {
  if (v == null || isNaN(v)) return '(unavailable)';
  return `${prefix}${Number(v).toFixed(2)}${suffix}`;
}

function buildAnalogReference(threadCategory) {
  // Surface 6-8 most-relevant analogs by category overlap. LLM picks closest.
  const events = ANALOG_CATALOG.events || [];
  const relevant = events
    .map(e => {
      const matchScore = (e.category || []).includes(threadCategory) ? 2 : 0;
      return { ...e, matchScore };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 8);
  return relevant.map(e =>
    `  - id="${e.id}" "${e.name}" (${e.year}) cats=[${(e.category || []).join(',')}] trigger="${e.trigger}"`
  ).join('\n');
}

function buildPrompt(thread, threadAnalysis, topicSummaries, marketContext, fxKeys) {
  const ta = threadAnalysis || {};
  const todayStr = new Date().toISOString().slice(0, 10);

  // Topic snippets (one line per entry, with summary if available)
  const topicLines = thread.entries.slice(0, 12).map(e => {
    const summary = (topicSummaries[e.topicId] || '').slice(0, 180).replace(/\s+/g, ' ').trim();
    return `  [${e.topicId}] ${e.date} · ${e.title}${summary ? ` — ${summary}` : ''}`;
  }).join('\n');

  const validTopicIds = thread.entries.map(e => e.topicId).filter(Boolean);

  return `You are a markets-grounded geopolitical analyst. Analyze whether this news thread is causing an economic disruption. If it has no genuine market-relevant dimension, return {"hasImpact": false}.

TODAY: ${todayStr}

=== THREAD ===
title: ${ta.threadTitle || thread.entries[thread.entries.length - 1]?.title || '(unknown)'}
threadId: ${thread.threadId}
category: ${thread.category}
articles: ${thread.entries.length}
storyArc: ${(ta.storyArc || '(no analysis yet)').slice(0, 400)}
trajectory: ${(ta.trajectory || '').slice(0, 300)}
rootCauseChain: ${(ta.rootCauseChain || '').slice(0, 300)}

=== TOPIC ENTRIES (valid citation IDs) ===
${topicLines}

=== ALLOWED INSTRUMENTS (with current values) ===
${buildInstrumentTable(marketContext, fxKeys)}

=== HISTORICAL ANALOG CATALOG (pick CLOSEST by mechanism) ===
${buildAnalogReference(thread.category)}

Prefer an analog ID from this catalog over inventing one. If none truly fits, omit historicalAnalog rather than fabricate. When you cite an analog, use its exact name and year — the frontend joins back to the catalog to show realized historical moves.

=== HARD RULES — VIOLATIONS WILL BE DROPPED ===
1. instrumentId MUST be from the table above. Anything else dropped.
2. Every instrument and every claim MUST cite at least 1 topicId from the entries above.
3. NEVER emit price levels or percentage moves. Use direction (up/down/mixed) and magnitude (small/moderate/large).
4. If the thread has no genuine economic dimension, return {"hasImpact": false}. Do NOT invent disruption.
5. Pick 2-5 instruments most relevant to this story. Do NOT list every related ticker.
6. Mechanism must cite at least one topicId inline using square brackets, e.g. "[topic-abc]".
7. winners/losers: 2-4 each, type ∈ {country, sector, company}.
8. historicalAnalog.event must be a real, named past event. caveat must note how this differs.

Return ONLY this JSON — no markdown, no commentary:

{
  "hasImpact": true,
  "headline": "<8-14 word sharp headline tying news to economic move>",
  "severity": "minor | moderate | severe",
  "severityScore": <0-100 integer>,
  "confidence": "low | medium | high",
  "horizon": "immediate | days | weeks | months",
  "instruments": [
    {
      "instrumentId": "<from allowlist>",
      "direction": "up | down | mixed",
      "magnitude": "small | moderate | large",
      "rationale": "<1 sentence, must cite [topicId]>",
      "citedTopicIds": ["<topicId>", ...]
    }
  ],
  "winners": [{ "name": "...", "type": "country|sector|company", "why": "<1 sentence>" }],
  "losers":  [{ "name": "...", "type": "country|sector|company", "why": "<1 sentence>" }],
  "mechanism": "<1-2 paragraph causal chain. Cite topicIds inline as [topic-xxx].>",
  "historicalAnalog": {
    "event": "<named past event>",
    "year": "<YYYY>",
    "outcome": "<what historically happened to relevant assets>",
    "caveat": "<how the current situation differs>"
  },
  "watchSignals": ["<concrete observable>", "..."],
  "citedTopicIds": ["<all topicIds cited anywhere>"]
}`;
}

async function generateEconomicImpact(thread, threadAnalyses, topicSummaries, marketContext, fxKeys) {
  const prompt = buildPrompt(thread, threadAnalyses[thread.threadId], topicSummaries, marketContext, fxKeys);
  const { content } = await invokeLLM(prompt);
  const cleaned = stripCodeFence(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    // Retry once with lower temperature
    console.warn(`Parse failed, retrying with t=0.1: ${err.message}`);
    const retry = await invokeLLM(prompt, 0.1);
    try {
      parsed = JSON.parse(stripCodeFence(retry.content));
    } catch (err2) {
      throw new Error(`Failed to parse LLM response: ${err2.message}\nRaw: ${cleaned.slice(0, 300)}`);
    }
  }

  if (parsed.hasImpact === false) return { hasImpact: false };

  return validateImpact(parsed, thread, fxKeys);
}

function validateImpact(parsed, thread, fxKeys) {
  const validTopicIds = new Set(thread.entries.map(e => e.topicId).filter(Boolean));
  const allowedInstruments = new Set([...INSTRUMENT_ALLOWLIST, ...fxKeys]);

  // Validate instruments — drop unknown tickers, drop uncited
  const instruments = (parsed.instruments || []).filter(inst => {
    if (!inst.instrumentId || !allowedInstruments.has(inst.instrumentId)) {
      console.warn(`Drop instrument: unknown id "${inst.instrumentId}"`);
      return false;
    }
    if (!VALID_DIRECTIONS.has(inst.direction)) {
      console.warn(`Drop instrument ${inst.instrumentId}: invalid direction "${inst.direction}"`);
      return false;
    }
    if (!VALID_MAGNITUDES.has(inst.magnitude)) inst.magnitude = 'moderate';
    const cited = (inst.citedTopicIds || []).filter(id => validTopicIds.has(id));
    if (cited.length === 0) {
      console.warn(`Drop instrument ${inst.instrumentId}: no valid citations`);
      return false;
    }
    inst.citedTopicIds = cited;
    return true;
  }).slice(0, 6);

  // If no valid instruments, treat as tombstone
  if (instruments.length === 0) {
    console.warn(`No valid instruments for ${thread.threadId} — tombstone`);
    return { hasImpact: false };
  }

  // Normalize enums
  const severity = VALID_SEVERITIES.has(parsed.severity) ? parsed.severity : 'moderate';
  const confidence = VALID_CONFIDENCES.has(parsed.confidence) ? parsed.confidence : 'low';
  const horizon = VALID_HORIZONS.has(parsed.horizon) ? parsed.horizon : 'days';
  const severityScore = Math.max(0, Math.min(100, parseInt(parsed.severityScore) || 50));

  // Validate winners/losers
  const cleanList = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 5).map(x => ({
    name: String(x.name || '').slice(0, 80),
    type: ['country', 'sector', 'company'].includes(x.type) ? x.type : 'country',
    why: String(x.why || '').slice(0, 200),
  })).filter(x => x.name);

  // Citation list
  const citedTopicIds = [...new Set(
    [...(parsed.citedTopicIds || []), ...instruments.flatMap(i => i.citedTopicIds)]
      .filter(id => validTopicIds.has(id))
  )];

  if (citedTopicIds.length === 0) {
    console.warn(`Drop record for ${thread.threadId}: zero valid citations`);
    return { hasImpact: false };
  }

  return {
    hasImpact: true,
    headline: String(parsed.headline || '').slice(0, 160),
    severity,
    severityScore,
    confidence,
    horizon,
    instruments,
    winners: cleanList(parsed.winners),
    losers: cleanList(parsed.losers),
    mechanism: String(parsed.mechanism || '').slice(0, 1500),
    historicalAnalog: parsed.historicalAnalog && typeof parsed.historicalAnalog === 'object' ? {
      event: String(parsed.historicalAnalog.event || '').slice(0, 120),
      year: String(parsed.historicalAnalog.year || '').slice(0, 10),
      outcome: String(parsed.historicalAnalog.outcome || '').slice(0, 400),
      caveat: String(parsed.historicalAnalog.caveat || '').slice(0, 300),
    } : null,
    watchSignals: (Array.isArray(parsed.watchSignals) ? parsed.watchSignals : []).slice(0, 6).map(s => String(s).slice(0, 200)),
    citedTopicIds,
  };
}

// ─── DDB writes ───────────────────────────────────────────────────────────────

function snapshotMarkets(marketContext, instruments) {
  // Snapshot only the prices for instruments actually cited, plus a few baseline indicators
  const snap = {};
  const baseline = ['BRENT', 'DXY', 'VIX', 'GOLD', 'SPX'];
  const wanted = new Set([...baseline, ...instruments.map(i => i.instrumentId)]);

  const C = marketContext.COMMODITIES || {};
  const E = marketContext.EQUITIES || {};
  const R = marketContext.RATES || {};
  const X = marketContext.CRYPTO || {};

  for (const id of wanted) {
    let val = null;
    if (id === 'BRENT') val = C.brent;
    else if (id === 'WTI') val = C.wti;
    else if (id === 'GOLD') val = C.gold;
    else if (id === 'COPPER') val = C.copper;
    else if (id === 'VIX') val = C.vix;
    else if (id === 'DXY') val = C.dxy;
    else if (id === 'BTC') val = X.BTC;
    else if (id === 'ETH') val = X.ETH;
    else if (R[id] != null) val = R[id];
    else if (E[id] != null) val = E[id];
    else if (id.startsWith('USD/') && marketContext.FX?.rates) {
      val = marketContext.FX.rates[id.slice(4)] ?? null;
    }
    if (val != null && !isNaN(val)) {
      snap[id] = {
        value: Number(val),
        asOf: C.asOf || E.asOf || R.asOf || marketContext.FX?.asOf || null,
      };
    }
  }
  return snap;
}

async function writeImpact(thread, result, marketContext) {
  const ttl = Math.floor(Date.now() / 1000) + ECON_TTL_DAYS * 86400;
  const marketSnap = snapshotMarkets(marketContext, result.instruments);

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: `${ECON_PK_PREFIX}${thread.threadId}`,
      SK: ECON_SK,
      scope: 'thread',
      scopeId: thread.threadId,
      threadId: thread.threadId,
      hasImpact: true,
      entryCount: thread.entries.length,
      ...result,
      marketContext: marketSnap,
      generatedAt: new Date().toISOString(),
      modelId: GROK_MODEL,
      ttl,
    },
  }));
}

async function writeTombstone(thread) {
  const ttl = Math.floor(Date.now() / 1000) + ECON_TTL_DAYS * 86400;
  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: `${ECON_PK_PREFIX}${thread.threadId}`,
      SK: ECON_SK,
      scope: 'thread',
      scopeId: thread.threadId,
      threadId: thread.threadId,
      hasImpact: false,
      entryCount: thread.entries.length,
      generatedAt: new Date().toISOString(),
      modelId: GROK_MODEL,
      ttl,
    },
  }));
}

// ─── LLM API ──────────────────────────────────────────────────────────────────

async function invokeLLM(prompt, temperature = TEMPERATURE) {
  const response = await fetch(GROK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages: [
        { role: 'system', content: 'You are a markets-grounded geopolitical analyst. Return only valid JSON. Cite every claim. If no economic dimension exists, return {"hasImpact": false}.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: MAX_TOKENS,
      temperature,
      response_format: { type: 'json_object' },
    }),
  });

  const rawText = await response.text();
  let parsed;
  try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }

  if (!response.ok) {
    const message = parsed?.error?.message || rawText || `status ${response.status}`;
    throw new Error(`LLM API error: ${message}`);
  }

  const content = parsed?.choices?.[0]?.message?.content || '';
  return { content: stripCodeFence(content) };
}

function stripCodeFence(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}
