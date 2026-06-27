'use strict';

// newsWeeklyMarkets — generates a price-first WEEKLY MARKETS REPORT ("what moved this
// week and why"). It is the instrument→explanation counterpart of /economy (news→instrument)
// and a sibling of newsWeeklyBrief: scheduled draft → human approval → publish → serve.
//
// The honesty contract is the whole point (see WEEKLY_MARKETS_PLAN.md). Three trust tiers,
// kept visibly separate so a post-hoc cause is never sold as fact:
//   • THE MOVE      — the real % change, computed DETERMINISTICALLY from our price history.
//                     The LLM NEVER supplies a number, direction, or anchor.
//   • OUR COVERAGE  — a linked DB thread (ECONOMIC_IMPACT) that cites this instrument; a
//                     SHORT DeepSeek note grounded ONLY in those records.
//   • WEB CONTEXT   — when we have no story: a self-searching LLM (Perplexity sonar) returns
//                     a CITED note, framed as a candidate driver, not causation.
//   • NONE          — neither our coverage nor a usable web result ⇒ honest
//                     "No clear driver found." Never a fabricated cause.
//
// Manual-invoke first (no EventBridge schedule) until output quality is trusted — mirrors
// newsWeeklyBrief / the breaking-detector dry-run approach. Fail-empty (honest) when there's
// no price data, never throw on an LLM error (graceful degrade per mover).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';

// DeepSeek (coverage notes). Legacy GROK_* names hold DeepSeek values in production
// (see feedback-misleading-grok-naming) — reuse them exactly like newsWeeklyBrief does.
const LLM_MODEL = process.env.GROK_MODEL || 'deepseek-chat';
const LLM_ENDPOINT = process.env.GROK_API_URL || 'https://api.deepseek.com/chat/completions';
const LLM_KEY = process.env.XAI_API_KEY || '';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '700', 10);
const TEMPERATURE = Number(process.env.TEMPERATURE || '0.3');

// Perplexity sonar (web-context fallback). The ONLY genuinely new env var. The model does
// its own web search and returns citations — we do NOT run a separate Brave/search call.
const PPLX_KEY = process.env.PERPLEXITY_API_KEY || '';
const PPLX_MODEL = process.env.PERPLEXITY_MODEL || 'sonar';
const PPLX_ENDPOINT = process.env.PERPLEXITY_API_URL || 'https://api.perplexity.ai/chat/completions';

const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
// The markets table is a fixed public table (same constant the markets_global serve action uses).
const MARKETS_TABLE = process.env.MARKETS_DDB_TABLE || 'GlobalPerspectiveMarkets';

const TOP_MOVERS = parseInt(process.env.WEEKLY_TOP_MOVERS || '10', 10);
const WEEK_DAYS = 7;
// Max age of the "week-ago" anchor. If the nearest prior close is older than this (a long
// data gap), there's no honest week-ago point → exclude rather than compare against a
// weeks-old (often dirty) value. Without this, COPPER's 16-day None-gap produced a bogus -99%.
const MAX_ANCHOR_AGE_DAYS = 14;
// A "mover" must have actually moved. Instruments flatter than this (e.g. a yield that
// barely budged) are neither gainers nor losers — drop them from the movers list rather
// than show a "0.0%" row under "biggest movers".
const MIN_MOVE_PCT = Number(process.env.MIN_MOVE_PCT || '0.1');
const REPORT_TTL_DAYS = 180;
// Coverage must be recent to count as "this week's" — a few days of slack over WEEK_DAYS
// tolerates the daily-regeneration cadence without admitting stale (≤21d) records.
const COVERAGE_WINDOW_DAYS = parseInt(process.env.COVERAGE_WINDOW_DAYS || '9', 10);

// ── Instrument universe (mirrors the markets_global serve action) ────────────────
// Each category's HISTORY# row stores many tickers as top-level fields. Commodities are
// stored lowercase and must map UP to the frontend's UPPERCASE instrument ids; rates/equities
// are already uppercase; crypto rows also carry *_24h_change fields that are NOT price series.
const COMMODITY_UP = { brent: 'BRENT', wti: 'WTI', gold: 'GOLD', copper: 'COPPER', dxy: 'DXY', vix: 'VIX', natgas: 'NATGAS' };
const CRYPTO_PRICE = new Set(['BTC', 'ETH']);
const META_FIELDS = new Set(['pk', 'sk', 'ttl', 'updatedAt', 'asOf']);

// Friendly display names for known ids; unknown ids fall back to the id itself (honest, no guess).
const INSTRUMENT_NAMES = {
  BRENT: 'Brent crude', WTI: 'WTI crude', GOLD: 'Gold', COPPER: 'Copper',
  DXY: 'US Dollar Index', VIX: 'VIX', NATGAS: 'Natural gas',
  US10Y: 'US 10Y yield', US2Y: 'US 2Y yield', UK10Y: 'UK 10Y yield',
  DE10Y: 'German 10Y yield', JP10Y: 'Japan 10Y yield',
  BTC: 'Bitcoin', ETH: 'Ethereum',
};

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

exports.handler = async (event = {}) => {
  if (!SUMMARY_TABLE) return fail('Missing table config (SUMMARIZE_PREDICT_TABLE)');

  const weekKey = (event.weekKey || new Date().toISOString().slice(0, 10));
  const SK = 'WEEKLY_MARKETS'; // canonical record the serving layer reads
  console.log(`[weekly-markets] generating report for week ending ${weekKey}`);

  // 1. Deterministic week-over-week % move for every tracked instrument (never via LLM).
  const { movers: candidates, excluded } = await computeWeeklyMovers();
  console.log(`[weekly-markets] ${candidates.length} eligible instruments, ${excluded.length} excluded (thin history)`);
  if (candidates.length === 0) return fail('No price history with ≥2 weekly anchors — failing empty (honest).');

  // 2. Select the week's biggest movers (top-N by |%|). Simple + transparent.
  const selected = candidates
    .slice()
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, TOP_MOVERS);

  // 3a. Our coverage: ECONOMIC_IMPACT records (PK begins_with ECON#THREAD#, hasImpact true)
  // whose instruments[].instrumentId matches a mover. Scanned once, indexed by instrument id.
  // Restricted to records computed in the last ~week so we don't staple a stale story (the
  // ECON record persists up to 21d) onto this week's move — that would be post-hoc correlation.
  const coverageByInstrument = await loadCoverage(COVERAGE_WINDOW_DAYS);

  // 3b/c/d. Per-mover grounding — coverage note (DeepSeek) → web context (Perplexity) → none.
  // Every branch is wrapped: an LLM error degrades that ONE mover, it never blocks the report.
  const movers = [];
  for (const m of selected) {
    const coverage = coverageByInstrument[m.instrumentId] || [];
    const mover = {
      instrumentId: m.instrumentId,
      name: m.name,
      changePct: m.changePct,
      direction: m.direction,
      weekStart: m.weekStart,
      weekEnd: m.weekEnd,
      grounding: 'none',
      note: 'No clear driver found.',
      coverage: [],
      sources: [],
    };

    if (coverage.length) {
      // (a) We have a story → DeepSeek writes a SHORT note grounded ONLY in our records.
      mover.grounding = 'coverage';
      mover.coverage = coverage.slice(0, 4);
      mover.note = await coverageNote(m, mover.coverage);
    } else {
      // (b) No story → Perplexity sonar (self-searching LLM) returns a CITED web-context note.
      const web = await webContextNote(m);
      if (web && web.note && web.sources.length) {
        mover.grounding = 'web';
        mover.note = web.note;
        mover.sources = web.sources.slice(0, 5);
      }
      // (d) else: leave grounding:'none' / "No clear driver found." — never fabricate a cause.
    }
    movers.push(mover);
  }

  const item = {
    PK: `WEEKLY_MARKETS#${weekKey}`,
    SK,
    weekOf: weekKey,
    asOf: new Date().toISOString().slice(0, 10),
    status: 'draft', // draft → published (human approves via weekly-markets/review.js)
    movers,
    excluded, // instruments shown as "history accruing", not dropped silently
    generatedAt: new Date().toISOString(),
    model: LLM_MODEL,
    ttl: Math.floor(Date.now() / 1000) + REPORT_TTL_DAYS * 86400,
  };
  await ddb.send(new PutCommand({ TableName: SUMMARY_TABLE, Item: item }));

  const tiers = movers.reduce((acc, m) => { acc[m.grounding] = (acc[m.grounding] || 0) + 1; return acc; }, {});
  console.log(`[weekly-markets] draft stored: WEEKLY_MARKETS#${weekKey} (${movers.length} movers — ${JSON.stringify(tiers)}). Approve via weekly-markets/review.js.`);
  return { ok: true, weekKey, status: 'draft', movers: movers.length, grounding: tiers };
};

function fail(msg) {
  console.error('[weekly-markets] ' + msg);
  return { ok: false, error: msg };
}

// ── Deterministic move computation (mirrors markets_global's HISTORY# transpose) ──
// Scan each category's HISTORY# rows once, transpose into per-instrument daily-close series
// (oldest→newest, carrying dates), then compute the week-over-week % from a "now" anchor and a
// "~1 week ago" anchor. The LLM is NEVER involved here — these are real, computed numbers.
async function computeWeeklyMovers() {
  const histScan = (pk) => ddb.send(new ScanCommand({
    TableName: MARKETS_TABLE,
    FilterExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':pk': pk, ':prefix': 'HISTORY#' },
  }));

  const movers = [];
  const excluded = [];

  // Transpose a category's rows into { id → [{date, value}] } using `idFor` to map a row
  // field to a canonical instrument id (or null to skip non-instrument fields).
  const addCategory = (items, idFor) => {
    const sorted = (items || []).slice().sort((a, b) => String(a.sk).localeCompare(String(b.sk)));
    const cols = {}; // instrumentId → [{date, value}] oldest→newest
    for (const row of sorted) {
      const date = String(row.sk || '').replace('HISTORY#', '');
      for (const field of Object.keys(row)) {
        if (META_FIELDS.has(field)) continue;
        const id = idFor(field);
        if (!id) continue;
        const v = row[field];
        if (v == null || typeof v !== 'number' || Number.isNaN(v)) continue;
        (cols[id] = cols[id] || []).push({ date, value: v });
      }
    }
    for (const [id, series] of Object.entries(cols)) {
      const move = weekMove(series);
      if (!move) {
        // <2 weekly anchors (thin/young history) — mark excluded, do NOT fabricate a move.
        excluded.push({ instrumentId: id, name: INSTRUMENT_NAMES[id] || id, reason: 'history accruing' });
        continue;
      }
      // Effectively flat → not a mover (don't list, don't mark "history accruing" — it has data).
      if (Math.abs(move.changePct) < MIN_MOVE_PCT) continue;
      movers.push({
        instrumentId: id,
        name: INSTRUMENT_NAMES[id] || id,
        ...move,
      });
    }
  };

  try {
    const [hComm, hRates, hEq, hCr] = await Promise.all([
      histScan('COMMODITIES#GLOBAL'), histScan('RATES#GLOBAL'),
      histScan('EQUITIES#GLOBAL'), histScan('CRYPTO#GLOBAL'),
    ]);
    addCategory(hComm.Items, (f) => COMMODITY_UP[f] || null);   // commodities: lowercase → UPPER
    addCategory(hRates.Items, (f) => f.toUpperCase());          // rates: already uppercase ids
    addCategory(hEq.Items, (f) => f.toUpperCase());             // equities: already uppercase ids
    // Crypto rows carry price fields (BTC, ETH) AND *_24h_change fields; only prices are series.
    addCategory(hCr.Items, (f) => CRYPTO_PRICE.has(f) ? f : null);
  } catch (err) {
    console.error('[weekly-markets] history scan failed:', err.message);
  }
  return { movers, excluded };
}

// Compute the week-over-week % from a per-instrument daily series [{date, value}] oldest→newest.
// Returns null if there aren't ≥2 anchors spanning ~a week (honest: "history accruing").
function weekMove(series) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const end = series[series.length - 1];
  const endDate = new Date(end.date + 'T00:00:00Z');
  // The week-ago anchor = the latest row on/before (endDate - 6d). Tolerate weekends/holidays
  // by walking back to the closest available earlier close. If none is that old, history is
  // too thin for a weekly move → exclude rather than compare two adjacent days.
  const cutoff = new Date(endDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - (WEEK_DAYS - 1));
  let start = null;
  for (let i = series.length - 2; i >= 0; i--) {
    const d = new Date(series[i].date + 'T00:00:00Z');
    if (d <= cutoff) { start = series[i]; break; }
    start = series[i]; // fallback to the oldest available if nothing reaches the cutoff
  }
  if (!start || !start.value || start === end) return null;
  // Reject a stale anchor across a data gap (see MAX_ANCHOR_AGE_DAYS) — no honest week-ago point.
  const ageDays = (endDate - new Date(start.date + 'T00:00:00Z')) / 86400000;
  if (ageDays > MAX_ANCHOR_AGE_DAYS) return null;
  const pct = ((end.value - start.value) / start.value) * 100;
  // Sanity ceiling: a legitimate weekly move can't be 100%+; that magnitude means a
  // non-price field was transposed as an instrument (the same class of bug markets_global
  // guards day-over-day). Drop it rather than report a garbage move.
  if (!Number.isFinite(pct) || Math.abs(pct) >= 100) return null;
  return {
    changePct: Math.round(pct * 100) / 100,
    direction: pct >= 0 ? 'up' : 'down',
    weekStart: start.value,
    weekEnd: end.value,
  };
}

// ── Our coverage lookup (mirrors economic_top_movers' ECON#THREAD# scan) ─────────
// Index every instrument cited by a hasImpact ECONOMIC_IMPACT record → [{threadId, headline, severity}].
async function loadCoverage(windowDays) {
  const byId = {};
  const cutoff = new Date(Date.now() - windowDays * 86400 * 1000).toISOString();
  try {
    let lastKey;
    do {
      const resp = await ddb.send(new ScanCommand({
        TableName: SUMMARY_TABLE,
        FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND hasImpact = :hi',
        ExpressionAttributeValues: { ':prefix': 'ECON#THREAD#', ':sk': 'ECONOMIC_IMPACT', ':hi': true },
        ProjectionExpression: 'instruments, severity, headline, scopeId, generatedAt',
        ExclusiveStartKey: lastKey,
      }));
      for (const it of (resp.Items || [])) {
        // "This week's" coverage only — skip records older than the window (ISO strings sort lexically).
        if (it.generatedAt && String(it.generatedAt) < cutoff) continue;
        for (const inst of (it.instruments || [])) {
          if (!inst || !inst.instrumentId) continue;
          const id = inst.instrumentId;
          (byId[id] = byId[id] || []).push({
            threadId: it.scopeId, // economic_top_movers uses scopeId as the thread id
            headline: it.headline,
            severity: it.severity,
          });
        }
      }
      lastKey = resp.LastEvaluatedKey;
    } while (lastKey);
  } catch (err) {
    console.error('[weekly-markets] coverage scan failed:', err.message);
  }
  return byId;
}

// ── Coverage note (DeepSeek, grounded ONLY in our records) ───────────────────────
// Graceful degrade: if the DeepSeek key is unset or the call fails, fall back to a
// deterministic note built from our own headlines (honest, no fabricated cause).
async function coverageNote(mover, coverage) {
  const headlines = coverage.map((c) => c.headline).filter(Boolean);
  const fallback = headlines.length
    ? `Our coverage cites ${mover.name}: ${headlines.slice(0, 2).join('; ')}.`
    : `Our coverage cites ${mover.name} this week.`;
  if (!LLM_KEY) return fallback;

  const dir = mover.direction === 'up' ? 'rose' : 'fell';
  const prompt = `You are a markets-desk editor. ${mover.name} (${mover.instrumentId}) ${dir} ${Math.abs(mover.changePct)}% over the past week. Below is OUR OWN published coverage that cites this instrument. Write ONE short note (<= 2 sentences) explaining the likely driver, grounded STRICTLY in the coverage provided.

RULES:
- Use ONLY facts present in the coverage below. Do NOT add an event, figure, date, or name that is not here.
- Frame as a candidate driver, not certain causation ("our coverage links the move to…", not "rose because…").
- Do NOT restate the % number; the reader already sees it.

OUR COVERAGE:
${coverage.map((c, i) => `${i + 1}. ${c.headline || '(no headline)'}${c.severity ? ` [severity: ${c.severity}]` : ''}`).join('\n')}

Return ONLY valid JSON, no code fences: { "note": "..." }`;

  try {
    const content = await invokeLLM(prompt);
    const parsed = parseJson(content);
    const note = parsed && typeof parsed.note === 'string' ? parsed.note.trim() : '';
    return note || fallback;
  } catch (err) {
    console.warn(`[weekly-markets] coverage note LLM failed for ${mover.instrumentId}: ${err.message}`);
    return fallback;
  }
}

// ── Web-context note (Perplexity sonar — the model searches the web itself) ───────
// Returns { note, sources:[{title,url}] } or null. Graceful degrade: missing key / error /
// no citations ⇒ null, so the mover falls back to grounding:'none' ("No clear driver found").
// We deliberately do NOT run a separate search call — sonar does the search natively.
async function webContextNote(mover) {
  if (!PPLX_KEY) return null;

  const dir = mover.direction === 'up' ? 'rose' : 'fell';
  const prompt = `${mover.name} (${mover.instrumentId}) ${dir} about ${Math.abs(mover.changePct)}% over the past week. Search the web and write ONE short note (<= 2 sentences) on the most-cited candidate driver(s) of that move.

RULES:
- Frame as candidate drivers, NOT certain causation ("news attributes the move to…", never "rose because…").
- Do NOT invent figures or dates; only state what your sources support.
- Do NOT restate the % number.`;

  try {
    const res = await fetch(PPLX_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PPLX_KEY}` },
      body: JSON.stringify({
        model: PPLX_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.warn(`[weekly-markets] perplexity ${res.status} for ${mover.instrumentId}: ${body?.error?.message || ''}`);
      return null;
    }
    const note = body?.choices?.[0]?.message?.content;
    const sources = perplexitySources(body);
    if (!note || !sources.length) return null; // no citation ⇒ not usable web context (honest)
    return { note: String(note).trim(), sources };
  } catch (err) {
    console.warn(`[weekly-markets] perplexity call failed for ${mover.instrumentId}: ${err.message}`);
    return null;
  }
}

// Normalize Perplexity's web-source metadata to [{title,url}] (mirrors services/llm.js).
// sonar returns `search_results` [{title,url,date}] (richer) and/or `citations` [url,…].
function perplexitySources(body) {
  if (Array.isArray(body?.search_results) && body.search_results.length) {
    return body.search_results
      .map((r) => ({ title: r.title || r.url, url: r.url }))
      .filter((r) => r.url);
  }
  if (Array.isArray(body?.citations) && body.citations.length) {
    return body.citations.filter(Boolean).map((u) => ({ title: u, url: u }));
  }
  return [];
}

// ── DeepSeek call (OpenAI-compatible; mirrors newsWeeklyBrief.invokeLLM) ──────────
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
  return extractContent(parsed);
}

function extractContent(payload) {
  if (!payload) return '';
  const msg = payload?.choices?.[0]?.message?.content;
  if (typeof msg === 'string') return msg;
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload);
}

function parseJson(content) {
  const cleaned = stripCodeFence(content);
  return JSON.parse(cleaned);
}

function stripCodeFence(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').replace(/,(\s*[\]}])/g, '$1').trim();
}
