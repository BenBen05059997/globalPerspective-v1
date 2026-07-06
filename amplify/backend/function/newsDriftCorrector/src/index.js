'use strict';

// newsDriftCorrector — the "living analysis" corrector (Phase 1b; LIVING_ANALYSIS_PLAN.md).
//
// Per covered country: (1) gate DETERMINISTICALLY on the daily HISTORY# snapshots — did the
// conclusion move recently (risk level / |Δscore|≥8 / trajectory)? Most days → no-op, no LLM.
// (2) If it moved, GROUND the "why" in the country's REAL recent archive events and ask the
// LLM to pick the single event that explains it (or honestly declare no single driver — it
// can never invent a cause). (3) Write a DRIFT#<date> NOTE — never overwrite the analysis.
//
// Model = DeepSeek (same family as the analyzer): the corrector grounds a causal explanation
// in real events (generation), it does NOT judge the analyzer's prose — so family-bias, which
// bites on quality-judging, doesn't apply. See LIVING_ANALYSIS_PLAN.md non-negotiable #4.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { findAllDrifts, threadConclusionMoved, buildDriftPrompt, parseDriftResponse } = require('./lib');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
// Legacy GROK_* names hold DeepSeek values in production (see feedback-misleading-grok-naming).
const LLM_MODEL = process.env.GROK_MODEL || 'deepseek-chat';
const LLM_URL = (process.env.GROK_API_URL || 'https://api.deepseek.com/chat/completions');
const LLM_KEY = process.env.XAI_API_KEY || '';
const DRIFT_TTL_DAYS = parseInt(process.env.DRIFT_TTL_DAYS || '60', 10);
const LOOKBACK_DAYS = parseInt(process.env.DRIFT_LOOKBACK_DAYS || '10', 10); // only note RECENT moves
const MAX_EVENTS = parseInt(process.env.DRIFT_MAX_EVENTS || '25', 10);
const COUNTRIES = (process.env.DRIFT_COUNTRIES
  || 'Iran,Israel,United States,Venezuela,China,Japan,Ukraine,Russia,France,Germany,Democratic Republic of the Congo,South Africa')
  .split(',').map((s) => s.trim()).filter(Boolean);

const COUNTRY_PK = (n) => `COUNTRY#${n}`;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });

const DAY = 86400000;
function parseDay(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
function fmtDay(ms) { const d = new Date(ms); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; }

async function readHistory(country) {
  const out = await ddb.send(new QueryCommand({
    TableName: SUMMARY_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :h)',
    ExpressionAttributeValues: { ':pk': COUNTRY_PK(country), ':h': 'HISTORY#' },
  }));
  return (out.Items || []).map((it) => ({
    dateKey: it.dateKey || String(it.SK || '').replace('HISTORY#', ''),
    riskLevel: it.riskLevel, riskScore: it.riskScore, trajectory: it.trajectory, headline: it.headline,
  }));
}

// Real archive events for this country between two dates (inclusive). Reads archive#<date>
// rows (+ today-archive for the current day), filters entries whose regions include the country.
async function readCountryEvents(country, fromDate, toDate) {
  const from = parseDay(fromDate); const to = parseDay(toDate);
  if (from == null || to == null) return [];
  const todayKey = fmtDay(Date.now());
  const seen = new Set(); const events = [];
  for (let ms = from; ms <= to; ms += DAY) {
    const dateKey = fmtDay(ms);
    const id = dateKey === todayKey ? 'today-archive' : `archive#${dateKey}`;
    let Item;
    try { ({ Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id } }))); } catch { Item = null; }
    for (const e of (Item?.entries || [])) {
      if (!Array.isArray(e.regions) || !e.regions.includes(country)) continue;
      const key = e.topicId || e.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      events.push({ topicId: key, title: e.title || '', date: dateKey });
    }
  }
  return events.slice(-MAX_EVENTS);
}

async function alreadyNoted(country, dateKey) {
  const { Item } = await ddb.send(new GetCommand({ TableName: SUMMARY_TABLE, Key: { PK: COUNTRY_PK(country), SK: `DRIFT#${dateKey}` } }));
  return !!Item;
}

async function callLLM(prompt) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
    body: JSON.stringify({ model: LLM_MODEL, temperature: 0.2, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`llm ${res.status}: ${body?.error?.message || res.statusText}`);
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error('llm empty response');
  return text;
}

// Write a drift note twice, idempotently (same SK per date):
//  - DRIFT#<date>    — 60d TTL; powers the live "what changed" band + corrections ledger.
//  - DRIFTLOG#<date> — NO TTL; the PERMANENT archive the member-only full correction history
//    accrues into (MEMBER_GATING_PLAN.md P3). Without this, "full history" would cap at 60 days.
async function putDriftNote(pk, dateKey, base, ttl) {
  await ddb.send(new PutCommand({ TableName: SUMMARY_TABLE, Item: { ...base, PK: pk, SK: `DRIFT#${dateKey}`, ttl } }));
  await ddb.send(new PutCommand({ TableName: SUMMARY_TABLE, Item: { ...base, PK: pk, SK: `DRIFTLOG#${dateKey}` } }));
}

async function writeNote(country, drift, note) {
  const { current: cur, prior } = drift;
  const ttl = Math.floor(Date.now() / 1000) + DRIFT_TTL_DAYS * DAY / 1000;
  const base = {
    countryName: country, asOf: cur.dateKey, since: prior.dateKey,
    changeLevel: prior.riskLevel !== cur.riskLevel ? { from: prior.riskLevel, to: cur.riskLevel } : undefined,
    changeScore: { from: Number(prior.riskScore), to: Number(cur.riskScore), delta: Number(cur.riskScore) - Number(prior.riskScore) },
    priorHeadline: prior.headline, currentHeadline: cur.headline,
    triggerEvent: note.triggerEvent || undefined,
    whyChanged: note.whyChanged,
    noSingleDriver: !!note.noSingleDriver,
    generatedAt: new Date().toISOString(),
  };
  await putDriftNote(COUNTRY_PK(country), cur.dateKey, base, ttl);
}

async function processCountry(country) {
  const history = await readHistory(country);
  if (history.length < 2) return { country, status: 'no-history' };
  // Only consider RECENT drift: restrict to snapshots within the lookback window.
  const latestMs = Math.max(...history.map((h) => parseDay(h.dateKey) || 0));
  const recent = history.filter((h) => { const d = parseDay(h.dateKey); return d != null && d >= latestMs - LOOKBACK_DAYS * DAY; });
  const drifts = findAllDrifts(recent);
  if (!drifts.length) return { country, status: 'no-recent-drift' };
  if (!LLM_KEY) return { country, status: 'no-llm-key' };

  // Ground EVERY move we haven't grounded yet (backfill) — keeps the read from drifting.
  let noted = 0, skipped = 0; const triggers = [];
  for (const drift of drifts) {
    if (await alreadyNoted(country, drift.current.dateKey)) { skipped++; continue; }
    const events = await readCountryEvents(country, drift.prior.dateKey, drift.current.dateKey);
    const note = parseDriftResponse(await callLLM(buildDriftPrompt(country, drift.prior, drift.current, events)), events);
    if (!note) continue;
    await writeNote(country, drift, note);
    noted++; if (note.triggerEvent?.title) triggers.push(note.triggerEvent.title);
  }
  return { country, status: noted ? 'noted' : (skipped ? 'already-noted' : 'parse-fail'), moves: drifts.length, noted, skipped, triggers };
}

// ─── Thread drift (living-analysis Phase 3) ──────────────────────────────────
const THREAD_PK = (id) => `THREAD#${id}`;

async function readThreadHistory(threadId) {
  const out = await ddb.send(new QueryCommand({
    TableName: SUMMARY_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :h)',
    ExpressionAttributeValues: { ':pk': THREAD_PK(threadId), ':h': 'THREAD_HISTORY#' },
  }));
  return (out.Items || []).map((it) => ({
    dateKey: it.dateKey || String(it.SK || '').replace('THREAD_HISTORY#', ''),
    riskScore: it.riskScore, trajectory: it.trajectory, threadTitle: it.threadTitle,
  }));
}

// Archive events belonging to this thread in the window (filter by threadId, not region).
async function readThreadEvents(threadId, fromDate, toDate) {
  const from = parseDay(fromDate); const to = parseDay(toDate);
  if (from == null || to == null) return [];
  const todayKey = fmtDay(Date.now());
  const seen = new Set(); const events = [];
  for (let ms = from; ms <= to; ms += DAY) {
    const dateKey = fmtDay(ms);
    const id = dateKey === todayKey ? 'today-archive' : `archive#${dateKey}`;
    let Item;
    try { ({ Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id } }))); } catch { Item = null; }
    for (const e of (Item?.entries || [])) {
      if (e.threadId !== threadId) continue;
      const key = e.topicId || e.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      events.push({ topicId: key, title: e.title || '', date: dateKey });
    }
  }
  return events.slice(-MAX_EVENTS);
}

async function threadAlreadyNoted(threadId, dateKey) {
  const { Item } = await ddb.send(new GetCommand({ TableName: SUMMARY_TABLE, Key: { PK: THREAD_PK(threadId), SK: `DRIFT#${dateKey}` } }));
  return !!Item;
}

async function writeThreadNote(threadId, drift, note) {
  const { current: cur, prior } = drift;
  const ttl = Math.floor(Date.now() / 1000) + DRIFT_TTL_DAYS * DAY / 1000;
  const base = {
    threadId, asOf: cur.dateKey, since: prior.dateKey,
    changeScore: { from: Number(prior.riskScore), to: Number(cur.riskScore), delta: Number(cur.riskScore) - Number(prior.riskScore) },
    priorTitle: prior.threadTitle, currentTitle: cur.threadTitle,
    triggerEvent: note.triggerEvent || undefined,
    whyChanged: note.whyChanged,
    noSingleDriver: !!note.noSingleDriver,
    generatedAt: new Date().toISOString(),
  };
  await putDriftNote(THREAD_PK(threadId), cur.dateKey, base, ttl);
}

async function processThread(threadId) {
  const history = await readThreadHistory(threadId);
  if (history.length < 2) return { threadId, status: 'no-history' };
  const latestMs = Math.max(...history.map((h) => parseDay(h.dateKey) || 0));
  const recent = history.filter((h) => { const d = parseDay(h.dateKey); return d != null && d >= latestMs - LOOKBACK_DAYS * DAY; });
  const drifts = findAllDrifts(recent, threadConclusionMoved);
  if (!drifts.length) return { threadId, status: 'no-recent-drift' };
  if (!LLM_KEY) return { threadId, status: 'no-llm-key' };

  let noted = 0, skipped = 0; const triggers = [];
  for (const drift of drifts) {
    if (await threadAlreadyNoted(threadId, drift.current.dateKey)) { skipped++; continue; }
    const events = await readThreadEvents(threadId, drift.prior.dateKey, drift.current.dateKey);
    const subject = `the story "${drift.current.threadTitle || threadId}"`;
    const note = parseDriftResponse(await callLLM(buildDriftPrompt(subject, drift.prior, drift.current, events)), events);
    if (!note) continue;
    await writeThreadNote(threadId, drift, note);
    noted++; if (note.triggerEvent?.title) triggers.push(note.triggerEvent.title);
  }
  return { threadId, status: noted ? 'noted' : (skipped ? 'already-noted' : 'parse-fail'), moves: drifts.length, noted, skipped, triggers };
}

// Discover active threads from the served `latest` topics (bounded, cheap).
async function discoverThreadIds() {
  try {
    const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: 'latest' } }));
    const topics = Item?.topics || Item?.data?.topics || [];
    return [...new Set(topics.map((t) => t.threadId).filter(Boolean))];
  } catch { return []; }
}

exports.handler = async (event = {}) => {
  const results = { countries: [], threads: [] };

  const countries = event.country ? [event.country] : COUNTRIES;
  for (const country of countries) {
    try { results.countries.push(await processCountry(country)); }
    catch (err) { results.countries.push({ country, status: 'error', error: err.message }); }
  }

  const threadIds = event.threadId ? [event.threadId] : await discoverThreadIds();
  for (const threadId of threadIds) {
    try { results.threads.push(await processThread(threadId)); }
    catch (err) { results.threads.push({ threadId, status: 'error', error: err.message }); }
  }

  console.log('drift-corrector', JSON.stringify(results));
  return results;
};

module.exports.processThread = processThread;

module.exports.processCountry = processCountry; // for local proving
