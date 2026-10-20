'use strict';

// newsPredictionResolver — the weekly prediction SETTLE Lambda (Batch 4 phase B).
// It replaced the legacy proposer (which scored at scenario probability). Actions:
//   tick    daily 10:30 UTC, idempotent: commit next weeks' seeds, draw every ended week, on Mondays
//           run the draft pass, write a heartbeat. No LLM except in the Monday draft pass.
//   draw    {weekId, dryRun}   reveal + draw one ended week (normally done by tick)
//   draft   {limit, dryRun}    agent drafts for sampled questions past their deadline, then settles them
//   correct {qid, verdict, reason, evidence?}  operator dispute: appends Q#<qid>/VERDICT#<n> (highest n wins)
//   status  read-only counts
//   replay  {items:[…]}        run the drafter on supplied questions, NO writes (validation only)
// dryRun = no LLM, no writes. Records: SEED#<week>/{COMMIT,SECRET,REVEAL}, SAMPLE#<week>/DRAW,
// Q#<qid>/{SAMPLED,DRAFT#<iso>,VERDICT,VERDICT#<n>}, SETTLE#<week>/TICK#<iso>; all immutable.
// No human gate (decision 0034): a yes/no/void draft becomes the VERDICT row at once (tick settles any
// draft that is waiting); an unclear draft stays open, is re-drafted after REDRAFT_AFTER_DAYS and
// becomes void after MAX_UNCLEAR_DRAFTS.
// The drafter never sees a question's probability (see draft.js).

const lib = require('./lib');
const { draftQuestion } = require('./draft');
const { chat, parseJsonContent } = require('./_shared/llm');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const LLM_KEY = process.env.XAI_API_KEY || '';
const DRAFT_MODEL = process.env.DRAFT_MODEL || 'deepseek-v4-pro'; // Q6: judgment on evidence; not the GROK_MODEL (flash)
const DRAFT_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '3', 10);
const DEFAULT_DRAFT_LIMIT = parseInt(process.env.MAX_RESOLVE_PER_RUN || '40', 10);
const REDRAFT_AFTER_DAYS = 5;
const MAX_UNCLEAR_DRAFTS = 3;
const FINAL_DRAFT_VERDICTS = ['yes', 'no', 'void']; // anything else (not_yet, needs_human) is unclear
const CORRECTION_VERDICTS = ['yes', 'no', 'void'];

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
      threadId: q.threadId || null,
      pk: q.pk, sk: q.sk, triggerId: q.triggerId, question: q.question, deadline: q.deadline,
      resolutionSource: q.resolutionSource, storyTitle: q.storyTitle, issuedAt: q.issuedAt, drawnAt: now, // no probability, by design
    });
  }
  out.drawn.push(summary);
}

// Verdict rows have no probability and are never replaced: VERDICT is number 1, corrections are VERDICT#2, #3, ...
const verdictOrder = (sk) => { const m = /^VERDICT#(\d+)$/.exec(sk); return sk === 'VERDICT' ? 1 : m ? Number(m[1]) : 0; };

// An unclear draft is one the drafter judged and could not settle (not_yet, or needs_human on evidence); an LLM
// outage (needs_human with an 'llm error' note) is not a judgment and never counts toward voiding a question.
const isUnclearDraft = (d) => !FINAL_DRAFT_VERDICTS.includes(d.verdict) && !/^llm error/.test(String(d.note || ''));

// Settle one question from its drafts (g.drafts includes any draft just written). yes/no/void in the latest
// draft is the verdict; an unclear draft leaves it open until MAX_UNCLEAR_DRAFTS, then void.
async function settleQuestion(deps, g, dryRun, out) {
  if (g.verdicts.length) return;
  const latest = g.drafts.slice().sort((a, b) => String(a.SK).localeCompare(String(b.SK))).pop();
  if (!latest) return;
  let row;
  if (FINAL_DRAFT_VERDICTS.includes(latest.verdict)) {
    row = {
      verdict: latest.verdict,
      evidence: latest.verdict === 'void' ? null : { url: latest.url || null, quote: latest.quote || null },
      ...(latest.verdict === 'void' ? { voidReason: latest.voidReason } : {}),
    };
  } else if (g.drafts.filter(isUnclearDraft).length >= MAX_UNCLEAR_DRAFTS) {
    row = { verdict: 'void', evidence: null, voidReason: `unclear after ${MAX_UNCLEAR_DRAFTS} drafts` };
  } else return;
  if (dryRun) { out.wouldSettle.push({ qid: g.qid, verdict: row.verdict }); return; }
  const ok = await deps.store.putOnce({
    PK: `Q#${g.qid}`, SK: 'VERDICT', qid: g.qid, ...row, decidedAt: deps.now(),
    decidedBy: 'resolver', confirmedBy: 'resolver', draftSk: latest.SK,
  });
  if (ok) { g.verdicts.push(row); out.settled.push({ qid: g.qid, verdict: row.verdict }); }
}

// Daily: settle every due question whose draft is already waiting (no LLM).
async function settlePass(deps, today, dryRun, out) {
  for (const g of groupQuestions(await deps.store.listQuestionRows())) {
    if (g.sampled && lib.isDue(g.sampled.deadline, today)) await settleQuestion(deps, g, dryRun, out);
  }
}

// Operator dispute path: append the next VERDICT#<n> with a reason; the snapshot reads the highest n.
async function correct(deps, event, out) {
  const { qid, verdict } = event;
  const reason = String(event.reason || '').trim();
  if (!qid || !CORRECTION_VERDICTS.includes(verdict) || !reason) { out.errors.push('correct needs qid, verdict (yes|no|void) and a reason'); return; }
  if (!(await deps.store.get(`Q#${qid}`, 'SAMPLED'))) { out.errors.push(`${qid}: not a sampled question`); return; }
  const rows = await deps.store.queryPK(`Q#${qid}`);
  const n = Math.max(0, ...rows.map((r) => verdictOrder(r.SK))) + 1;
  const ev = event.evidence || {};
  const ok = await deps.store.putOnce({
    PK: `Q#${qid}`, SK: `VERDICT#${n}`, qid, verdict,
    evidence: verdict === 'void' ? null : { url: ev.url || null, quote: ev.quote || null },
    ...(verdict === 'void' ? { voidReason: reason } : {}),
    decidedAt: deps.now(), decidedBy: 'operator', confirmedBy: 'operator', reason,
  });
  if (ok) out.corrected = { qid, sk: `VERDICT#${n}`, verdict };
  else out.errors.push(`${qid}: VERDICT#${n} was written by someone else just now; run the correction again`);
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
    g.drafts.push({ PK: `Q#${g.qid}`, SK: `DRAFT#${at}`, ...d });
    await settleQuestion(deps, g, false, out);
  });
}

async function run(event, deps) {
  const action = (event && event.action) || 'tick';
  const dryRun = Boolean(event && event.dryRun);
  const now = deps.now();
  const today = String(now).slice(0, 10);
  const out = { action, dryRun, today, committed: [], wouldCommit: [], drawn: [], wouldDraw: [], drafted: [], settled: [], wouldSettle: [], errors: [] };

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

  if (action === 'correct') {
    await correct(deps, event, out);
    if (out.errors.length) console.error('settle errors', JSON.stringify(out.errors));
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

  if (action === 'tick' || action === 'draft') await settlePass(deps, today, dryRun, out);

  if (action === 'draft' || (action === 'tick' && (lib.isMonday(today) || event.draft))) {
    await draftPass(deps, today, Number(event.limit) || DEFAULT_DRAFT_LIMIT, dryRun, out);
  }

  if (action === 'tick' && !dryRun) {
    await deps.store.putOnce({
      PK: `SETTLE#${lib.weekOf(today)}`, SK: `TICK#${now}`, at: now,
      committed: out.committed, drawn: out.drawn.map((d) => d.weekId), drafted: out.drafted.length, settled: out.settled.length, errors: out.errors,
    });
  }
  if (out.errors.length) console.error('settle errors', JSON.stringify(out.errors));
  console.log('settle', JSON.stringify({ action, dryRun, committed: out.committed, drawn: out.drawn.length, drafted: out.drafted.length, settled: out.settled.length, wouldCommit: out.wouldCommit, wouldDraw: out.wouldDraw.length }));
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
      const r = await chat({ step: 'settle_draft', model: DRAFT_MODEL, user: prompt, temperature: 0.1, maxTokens: 500, json: true });
      usage.llmCalls++;
      usage.promptTokens += r.usage?.prompt_tokens || 0;
      usage.completionTokens += r.usage?.completion_tokens || 0;
      return parseJsonContent(r.content);
    },
  };
}

exports.run = run;
exports.groupQuestions = groupQuestions;
exports.MAX_UNCLEAR_DRAFTS = MAX_UNCLEAR_DRAFTS;
exports.REDRAFT_AFTER_DAYS = REDRAFT_AFTER_DAYS;
exports.handler = async (event = {}) => run(event, defaultDeps());
