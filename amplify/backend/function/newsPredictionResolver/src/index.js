'use strict';

// newsPredictionResolver — the weekly prediction SETTLE Lambda (Batch 4 phase B).
// It replaced the legacy proposer (which scored at scenario probability). Actions:
//   tick    daily 10:30 UTC, idempotent: commit next weeks' seeds, draw every ended week, on Mondays
//           run the draft pass, write a heartbeat. No LLM except in the Monday draft pass.
//   draw    {weekId, dryRun}   reveal + draw one ended week (normally done by tick)
//   draft   {limit, dryRun}    agent drafts for sampled questions past their deadline
//   status  read-only counts
//   replay  {items:[…]}        run the drafter on supplied questions, NO writes (validation only)
// dryRun = no LLM, no writes. Records: SEED#<week>/{COMMIT,SECRET,REVEAL}, SAMPLE#<week>/DRAW,
// Q#<qid>/{SAMPLED,DRAFT#<iso>,VERDICT}, SETTLE#<week>/TICK#<iso>; all immutable.
// The drafter never sees a question's probability (see draft.js).

const lib = require('./lib');
const { draftQuestion } = require('./draft');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const LLM_KEY = process.env.XAI_API_KEY || '';
const LLM_URL_RAW = process.env.GROK_API_URL || 'https://api.deepseek.com';
const DRAFT_MODEL = process.env.DRAFT_MODEL || 'deepseek-v4-pro'; // Q6: judgment on evidence; not the GROK_MODEL (flash)
const DRAFT_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '3', 10);
const DEFAULT_DRAFT_LIMIT = parseInt(process.env.MAX_RESOLVE_PER_RUN || '40', 10);
const REDRAFT_AFTER_DAYS = 5;

const LLM_URL = LLM_URL_RAW.endsWith('/chat/completions') ? LLM_URL_RAW : `${LLM_URL_RAW.replace(/\/$/, '')}/chat/completions`;

async function mapWithConcurrency(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await worker(items[k], k); }
  }));
  return out;
}

// Group the Q# rows by qid.
function groupQuestions(rows) {
  const by = new Map();
  for (const r of rows || []) {
    const qid = String(r.PK).slice(2);
    const g = by.get(qid) || { qid, sampled: null, drafts: [], verdicts: [] };
    if (r.SK === 'SAMPLED') g.sampled = r;
    else if (String(r.SK).startsWith('DRAFT#')) g.drafts.push(r);
    else if (String(r.SK).startsWith('VERDICT')) g.verdicts.push(r);
    by.set(qid, g);
  }
  return [...by.values()];
}

async function ensureCommits(deps, today, dryRun, out) {
  const cur = lib.weekOf(today);
  for (const n of [1, 2]) {
    const wk = lib.addWeeks(cur, n);
    if (await deps.store.get(`SEED#${wk}`, 'COMMIT')) continue;
    if (dryRun) { out.wouldCommit.push(wk); continue; }
    let secret = await deps.store.get(`SEED#${wk}`, 'SECRET');
    if (!secret) {
      const seedHex = lib.newSeed();
      await deps.store.putOnce({ PK: `SEED#${wk}`, SK: 'SECRET', seedHex, createdAt: deps.now() });
      secret = await deps.store.get(`SEED#${wk}`, 'SECRET');
    }
    const ok = await deps.store.putOnce({
      PK: `SEED#${wk}`, SK: 'COMMIT', weekId: wk, weekStart: lib.weekStart(wk), weekEnd: lib.weekEnd(wk),
      commitHash: lib.commitOf(secret.seedHex), rule: lib.RULE, committedAt: deps.now(),
    });
    if (ok) out.committed.push(wk);
  }
}

async function drawWeek(deps, commit, dryRun, out) {
  const wk = commit.weekId;
  if (await deps.store.get(`SAMPLE#${wk}`, 'DRAW')) return;
  const secret = await deps.store.get(`SEED#${wk}`, 'SECRET');
  if (!secret) { out.errors.push(`${wk}: seed secret missing, cannot draw (a new seed is never invented)`); return; }
  if (lib.commitOf(secret.seedHex) !== commit.commitHash) { out.errors.push(`${wk}: seed does not match the published commitment`); return; }
  const rows = await deps.store.predRows(commit.weekStart, commit.weekEnd);
  const eligible = lib.eligibleQuestions(rows, wk);
  const res = lib.draw(secret.seedHex, eligible.map((q) => ({ qid: q.qid, clusterKey: q.clusterKey })), lib.SAMPLE_K);
  const summary = { weekId: wk, eligible: res.eligible, clusters: res.clusters, picked: res.picked.length };
  if (dryRun) { out.wouldDraw.push(summary); return; }
  const now = deps.now();
  await deps.store.putOnce({ PK: `SEED#${wk}`, SK: 'REVEAL', weekId: wk, seedHex: secret.seedHex, revealedAt: now });
  await deps.store.putOnce({
    PK: `SAMPLE#${wk}`, SK: 'DRAW', weekId: wk, rule: lib.RULE, K: lib.SAMPLE_K,
    eligible: res.eligible, clusters: res.clusters,
    pool: eligible.map((q) => ({ q: q.qid, c: q.clusterKey })),
    picked: res.picked, drawnAt: now,
  });
  const byQ = new Map(eligible.map((q) => [q.qid, q]));
  for (const p of res.picked) {
    const q = byQ.get(p.qid);
    await deps.store.putOnce({
      PK: `Q#${p.qid}`, SK: 'SAMPLED', qid: p.qid, weekId: wk, hash: p.h, clusterKey: p.clusterKey,
      pk: q.pk, sk: q.sk, triggerId: q.triggerId, question: q.question, deadline: q.deadline,
      resolutionSource: q.resolutionSource, storyTitle: q.storyTitle, issuedAt: q.issuedAt, drawnAt: now, // no probability, by design
    });
  }
  out.drawn.push(summary);
}

async function draftPass(deps, today, limit, dryRun, out) {
  const groups = groupQuestions(await deps.store.listQuestionRows());
  const cutoff = lib.addDays(today, -REDRAFT_AFTER_DAYS);
  const due = groups
    .filter((g) => g.sampled && g.verdicts.length === 0 && lib.isDue(g.sampled.deadline, today))
    .filter((g) => !g.drafts.some((d) => String(d.SK).slice(6, 16) > cutoff))
    .sort((a, b) => String(a.sampled.deadline).localeCompare(String(b.sampled.deadline)))
    .slice(0, limit);
  out.dueForDraft = due.length;
  if (dryRun) { out.wouldDraft = due.map((g) => ({ qid: g.qid, deadline: g.sampled.deadline })); return; }
  await mapWithConcurrency(due, DRAFT_CONCURRENCY, async (g) => {
    const d = await draftQuestion(g.sampled, deps);
    const at = deps.now();
    await deps.store.putOnce({ PK: `Q#${g.qid}`, SK: `DRAFT#${at}`, qid: g.qid, ...d, model: deps.draftModel, at });
    out.drafted.push({ qid: g.qid, verdict: d.verdict });
  });
}

async function run(event, deps) {
  const action = (event && event.action) || 'tick';
  const dryRun = Boolean(event && event.dryRun);
  const now = deps.now();
  const today = String(now).slice(0, 10);
  const out = { action, dryRun, today, committed: [], wouldCommit: [], drawn: [], wouldDraw: [], drafted: [], errors: [] };

  if (action === 'status') {
    const commits = await deps.store.listCommits();
    const groups = groupQuestions(await deps.store.listQuestionRows());
    return {
      ...out, commits: commits.map((c) => c.weekId).sort(),
      sampled: groups.filter((g) => g.sampled).length,
      due: groups.filter((g) => g.sampled && g.verdicts.length === 0 && lib.isDue(g.sampled.deadline, today)).length,
      drafted: groups.filter((g) => g.drafts.length).length,
      verdicts: groups.filter((g) => g.verdicts.length).length,
    };
  }

  if (action === 'replay') {
    const items = Array.isArray(event.items) ? event.items.slice(0, 20) : [];
    out.results = await mapWithConcurrency(items, DRAFT_CONCURRENCY, async (q) => ({ ...(await draftQuestion(q, deps)) }));
    out.usage = deps.usage ? deps.usage() : null;
    return out;
  }

  if (action === 'tick' || action === 'draw') {
    if (action === 'tick') await ensureCommits(deps, today, dryRun, out);
    const commits = await deps.store.listCommits();
    for (const c of commits.sort((a, b) => a.weekId.localeCompare(b.weekId))) {
      if (action === 'draw' && event.weekId && event.weekId !== c.weekId) continue;
      if (lib.weekEnd(c.weekId) < today) await drawWeek(deps, c, dryRun, out);
    }
  }

  if (action === 'draft' || (action === 'tick' && (lib.isMonday(today) || event.draft))) {
    await draftPass(deps, today, Number(event.limit) || DEFAULT_DRAFT_LIMIT, dryRun, out);
  }

  if (action === 'tick' && !dryRun) {
    await deps.store.putOnce({
      PK: `SETTLE#${lib.weekOf(today)}`, SK: `TICK#${now}`, at: now,
      committed: out.committed, drawn: out.drawn.map((d) => d.weekId), drafted: out.drafted.length, errors: out.errors,
    });
  }
  if (out.errors.length) console.error('settle errors', JSON.stringify(out.errors));
  console.log('settle', JSON.stringify({ action, dryRun, committed: out.committed, drawn: out.drawn.length, drafted: out.drafted.length, wouldCommit: out.wouldCommit, wouldDraw: out.wouldDraw.length }));
  return out;
}

function defaultDeps() {
  const { makeStore } = require('./store');
  const { makeSearch } = require('./search');
  const search0 = makeSearch(process.env.BRAVE_SEARCH_API_KEY || '');
  const usage = { llmCalls: 0, searches: 0, promptTokens: 0, completionTokens: 0 };
  return {
    now: () => new Date().toISOString(),
    store: makeStore(LOG_TABLE, REGION),
    draftModel: DRAFT_MODEL,
    usage: () => ({ ...usage, model: DRAFT_MODEL }),
    search: async (q) => { usage.searches++; return search0(q); },
    async llm(prompt) {
      if (!LLM_KEY) throw new Error('LLM key is not configured');
      const resp = await fetch(LLM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
        body: JSON.stringify({
          model: DRAFT_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 500,
          response_format: { type: 'json_object' }, thinking: { type: 'disabled' },
        }),
      });
      if (!resp.ok) throw new Error(`LLM ${resp.status}: ${(await resp.text()).slice(0, 160)}`);
      const data = await resp.json();
      usage.llmCalls++;
      usage.promptTokens += data?.usage?.prompt_tokens || 0;
      usage.completionTokens += data?.usage?.completion_tokens || 0;
      return JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    },
  };
}

exports.run = run;
exports.groupQuestions = groupQuestions;
exports.handler = async (event = {}) => run(event, defaultDeps());
