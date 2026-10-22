'use strict';

// newsPredictionResolver — the weekly prediction SETTLE Lambda (Batch 4 phase B).
// It replaced the legacy proposer (which scored at scenario probability). Actions:
//   tick    daily 10:30 UTC, idempotent: commit next weeks' seeds, draw every ended week, settle waiting drafts,
//           then the nightly WATCH -> GATHER -> JUDGE -> RECORD pass (decision 0038), write a heartbeat.
//           The only LLM calls are the judge's, for tonight's candidates (src/watch.js).
//   draw    {weekId, dryRun}   reveal + draw one ended week (normally done by tick)
//   draft   {limit, dryRun}    the same check pass on demand (cap = limit)
//   correct {qid, verdict, reason, evidence?}  operator dispute: appends Q#<qid>/VERDICT#<n> (highest n wins)
//   watch   list tonight's candidates only (no model, no writes)
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
const watch = require('./watch');
const gather = require('./gather');
const inbox = require('./inbox');
const { chat, parseJsonContent } = require('./_shared/llm');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const LLM_KEY = process.env.XAI_API_KEY || '';
const DRAFT_MODEL = process.env.DRAFT_MODEL || 'deepseek-v4-pro'; // Q6: judgment on evidence; not the GROK_MODEL (flash)
const DRAFT_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '3', 10);
const DEFAULT_DRAFT_LIMIT = parseInt(process.env.MAX_RESOLVE_PER_RUN || String(watch.MAX_CANDIDATES), 10); // candidates per run
const CHECK_BUDGET_MS = 420000; // stop starting checks after 7 minutes (Lambda timeout is 10)
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

// Unclear drafts that count toward a void: made once `no` was allowed (deadline + GRACE_DAYS) and at least
// REDRAFT_AFTER_DAYS apart, so a story that moves every night cannot void a question in three days.
function countUnclear(drafts, deadline) {
  const from = lib.addDays(deadline, lib.GRACE_DAYS);
  let n = 0;
  let last = null;
  for (const d of drafts.filter(isUnclearDraft).sort((a, b) => String(a.SK).localeCompare(String(b.SK)))) {
    const day = String(d.SK).slice(6, 16);
    if (day < from || (last && day < lib.addDays(last, REDRAFT_AFTER_DAYS))) continue;
    n++;
    last = day;
  }
  return n;
}

// RECORD: settle one question from its drafts (g.drafts includes any draft just written; g.q is the question).
// yes/no/void in the latest draft is the verdict; unclear drafts leave it open until MAX_UNCLEAR_DRAFTS, then void.
// The row is the same for any question; `sampled` marks the pre-registered weekly sample.
async function settleQuestion(deps, g, dryRun, out) {
  if (g.verdicts.length) return;
  const latest = g.drafts.slice().sort((a, b) => String(a.SK).localeCompare(String(b.SK))).pop();
  if (!latest) return;
  let row;
  if (FINAL_DRAFT_VERDICTS.includes(latest.verdict)) {
    row = {
      verdict: latest.verdict,
      evidence: latest.verdict === 'void' ? null : (latest.evidence || { eventId: latest.eventId || null, quote: latest.quote || null, date: null }),
      ...(latest.verdict === 'void' ? { voidReason: latest.voidReason } : {}),
      ...(latest.reason || latest.why ? { reason: latest.reason || latest.why } : {}),
    };
  } else if (countUnclear(g.drafts, (g.q || g.sampled).deadline) >= MAX_UNCLEAR_DRAFTS) {
    row = { verdict: 'void', evidence: null, voidReason: `unclear after ${MAX_UNCLEAR_DRAFTS} drafts`, reason: `unclear after ${MAX_UNCLEAR_DRAFTS} drafts` };
  } else return;
  if (dryRun) { out.wouldSettle.push({ qid: g.qid, verdict: row.verdict }); return; }
  const ok = await deps.store.putOnce({
    PK: `Q#${g.qid}`, SK: 'VERDICT', qid: g.qid, ...row, decidedAt: deps.now(),
    decidedBy: latest.model || 'resolver', confirmedBy: 'resolver', draftSk: latest.SK, sampled: Boolean(g.sampled),
  });
  if (ok) {
    g.verdicts.push(row);
    out.settled.push({ qid: g.qid, verdict: row.verdict });
    await inbox.appendVerdict(deps, out, {
      q: g.q || g.sampled, qid: g.qid, result: row.verdict, voidReason: row.voidReason || null, decidedAt: deps.now(),
      decidedBy: latest.model || 'resolver', evidence: row.verdict === 'void' ? null : row.evidence, reason: row.reason || null, revision: 1,
    });
  }
}

// Daily: settle every due question whose draft is already waiting (no LLM).
async function settlePass(deps, today, dryRun, out) {
  for (const g of groupQuestions(await deps.store.listQuestionRows())) {
    if (g.sampled && lib.isDue(g.sampled.deadline, today)) { g.q = g.sampled; await settleQuestion(deps, g, dryRun, out); }
  }
}

// Operator dispute path: append the next VERDICT#<n> with a reason; the snapshot reads the highest n.
async function correct(deps, event, out) {
  const { qid, verdict } = event;
  const reason = String(event.reason || '').trim();
  if (!qid || !CORRECTION_VERDICTS.includes(verdict) || !reason) { out.errors.push('correct needs qid, verdict (yes|no|void) and a reason'); return; }
  const rows = await deps.store.queryPK(`Q#${qid}`);
  if (!rows.length) { out.errors.push(`${qid}: no such question (no Q# rows)`); return; }
  const n = Math.max(0, ...rows.map((r) => verdictOrder(r.SK))) + 1;
  const ev = event.evidence || {};
  const ok = await deps.store.putOnce({
    PK: `Q#${qid}`, SK: `VERDICT#${n}`, qid, verdict,
    evidence: verdict === 'void' ? null : { url: ev.url || null, quote: ev.quote || null },
    ...(verdict === 'void' ? { voidReason: reason } : {}),
    decidedAt: deps.now(), decidedBy: 'operator', confirmedBy: 'operator', reason,
  });
  if (ok) {
    out.corrected = { qid, sk: `VERDICT#${n}`, verdict };
    const q = rows.find((r) => r.pk && r.sk) || {}; // SAMPLED or a DRAFT row carries the PRED key
    await inbox.appendVerdict(deps, out, {
      q, qid, result: verdict, voidReason: verdict === 'void' ? reason : null, decidedAt: deps.now(), decidedBy: 'operator',
      evidence: verdict === 'void' ? null : { quote: ev.quote || null, url: ev.url || null, title: ev.title || null, date: ev.date || null }, reason, revision: n,
    });
  }
  else out.errors.push(`${qid}: VERDICT#${n} was written by someone else just now; run the correction again`);
}

// WATCH (no model): which open question branches get a check tonight. Questions come from the PRED rows and from
// the SAMPLED rows (same fields; a sampled question is just a flagged one). A failing facts read (for example the
// role lacks s3:GetObject on record/facts/*) is reported and the pass goes on with the age rule alone.
async function watchSelect(deps, today, limit, out) {
  const [preds, qrows] = await Promise.all([deps.store.allQuestionPreds(), deps.store.listQuestionRows()]);
  const groups = new Map(groupQuestions(qrows).map((g) => [g.qid, g]));
  const questions = watch.questionsFromPreds(preds);
  const known = new Set(questions.map((q) => q.qid));
  for (const g of groups.values()) if (g.sampled && !known.has(g.qid)) questions.push({ ...watch.questionFromSampled(g.sampled), qid: g.qid });
  // GATHER's reader: the story's entry facts since each open question's draw (one read per facts day, shared)
  const open = questions.filter((q) => !(groups.get(q.qid) || { verdicts: [] }).verdicts.length);
  const loaded = await gather.loadEntries(deps.facts, open, today);
  if (loaded.failed.size) out.errors.push(`watch: facts unreadable on ${loaded.failed.size} day(s), questions whose window holds them are not judged tonight (${[...loaded.failed.values()][0]})`);
  const moved = gather.movedThreads(loaded, today);
  const bundles = new Map(open.map((q) => [q.qid, gather.buildBundle(q, loaded, today)]));
  const sel = watch.selectCandidates({ questions, groups, moved, bundles, today, redraftAfterDays: REDRAFT_AFTER_DAYS, cap: limit });
  out.watch = {
    questions: questions.length, movedThreads: moved.size, candidates: sel.candidates.length, total: sel.total, overflow: sel.overflow, unreadable: sel.unreadable,
    moved: sel.candidates.filter((c) => c.reason === 'moved').length, grace: sel.candidates.filter((c) => c.reason === 'grace').length,
  };
  console.log('watch', JSON.stringify(out.watch));
  return { sel, groups };
}

// GATHER + JUDGE + RECORD for tonight's candidates. The evidence bundle (own-story entries after the draw) rides along; the judge never sees p.
async function checkPass(deps, today, limit, dryRun, out) {
  const { sel, groups } = await watchSelect(deps, today, limit, out);
  out.dueForDraft = sel.candidates.length;
  if (dryRun) { out.wouldCheck = sel.candidates.map((c) => ({ qid: c.qid, deadline: c.deadline, reason: c.reason, sampled: c.sampled })); return; }
  const started = Date.now();
  await mapWithConcurrency(sel.candidates, DRAFT_CONCURRENCY, async (c) => {
    if (Date.now() - started > (deps.budgetMs || CHECK_BUDGET_MS)) { out.skippedForTime = (out.skippedForTime || 0) + 1; return; }
    const { bundle, reason, sampled, ...q } = c;
    const d = await draftQuestion({ ...q, bundle }, deps);
    const at = deps.now();
    const g = groups.get(q.qid) || { qid: q.qid, sampled: null, drafts: [], verdicts: [] };
    g.q = q;
    await deps.store.putOnce({ PK: `Q#${q.qid}`, SK: `DRAFT#${at}`, qid: q.qid, ...d, deadline: q.deadline, pk: q.pk, sk: q.sk, triggerId: q.triggerId, threadId: q.threadId, trigger: reason, model: d.model || deps.draftModel, at });
    out.drafted.push({ qid: q.qid, verdict: d.verdict });
    g.drafts.push({ PK: `Q#${q.qid}`, SK: `DRAFT#${at}`, ...d, model: d.model || deps.draftModel });
    await settleQuestion(deps, g, false, out);
  });
}

async function run(event, deps) {
  const action = (event && event.action) || 'tick';
  const dryRun = Boolean(event && event.dryRun);
  const now = deps.now();
  const today = String(now).slice(0, 10);
  if (event && event.shadow) deps = { ...deps, shadow: true };
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

  if (action === 'watch') {
    await checkPass(deps, today, Number(event.limit) || DEFAULT_DRAFT_LIMIT, true, out);
    return out;
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

  if (action === 'draft' || action === 'tick') {
    await checkPass(deps, today, Number(event.limit) || DEFAULT_DRAFT_LIMIT, dryRun, out);
  }

  if (action === 'tick' && !dryRun) {
    await deps.store.putOnce({
      PK: `SETTLE#${lib.weekOf(today)}`, SK: `TICK#${now}`, at: now,
      committed: out.committed, drawn: out.drawn.map((d) => d.weekId), drafted: out.drafted.length, settled: out.settled.length, watch: out.watch || null, errors: out.errors,
    });
  }
  if (out.errors.length) console.error('settle errors', JSON.stringify(out.errors));
  console.log('settle', JSON.stringify({ action, dryRun, committed: out.committed, drawn: out.drawn.length, drafted: out.drafted.length, settled: out.settled.length, candidates: out.watch ? out.watch.total : 0, wouldCommit: out.wouldCommit, wouldDraw: out.wouldDraw.length }));
  return out;
}

// s3json over the world bucket (the SDK ships with the Lambda runtime): reads record/facts/* (WATCH) and appends to record/inbox/verdicts/* (RECORD).
function makeFacts() {
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { makeS3Json } = require('./_shared/s3json');
  return makeS3Json({ client: new S3Client({ region: REGION }), GetObjectCommand, PutObjectCommand, bucket: process.env.WORLD_BUCKET });
}

function defaultDeps() {
  const s3 = makeFacts();
  const { makeStore } = require('./store');
  const usage = { llmCalls: 0, promptTokens: 0, completionTokens: 0 };
  return {
    now: () => new Date().toISOString(),
    store: makeStore(LOG_TABLE, REGION),
    facts: s3,
    inbox: s3,
    draftModel: DRAFT_MODEL,
    usage: () => ({ ...usage, model: DRAFT_MODEL }),
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
