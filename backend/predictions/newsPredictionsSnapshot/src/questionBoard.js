'use strict';

// Builds `data.questions`: the public view of the weekly sampled-question flow (Batch 4 phase C).
// Input: raw PredictionLog rows of every family (PRED#, SEED#, SAMPLE#, Q#, SETTLE#). SECRET seed
// rows and operator-only DRAFT# rows are excluded by the scan filter and are ignored here as well.
// Pure: `nowIso` is passed in. `scoring` is null below 150 resolved questions (Stage 2).

const W = require('./weeks');
const { computeScoring } = require('./scoring');

const GRACE_DAYS = 3;
const SAMPLED_WEEKS_SHOWN = 26;
const POOL_WEEKS_PUBLISHED = 4;
const METHOD = { K: 22, leadDays: [7, 84], rule: 'v1', graceDays: GRACE_DAYS };

const day = (s) => String(s || '').slice(0, 10);

function verdictOrder(sk) { const m = /^VERDICT#(\d+)$/.exec(sk); return sk === 'VERDICT' ? 1 : m ? Number(m[1]) : 0; }

function buildQuestionBoard(items, nowIso) {
  const today = day(nowIso);
  const nowMs = Date.parse(nowIso);
  const commits = new Map();
  const reveals = new Map();
  const draws = new Map();
  const sampledRows = [];
  const verdictsBy = new Map();
  const ticks = [];
  const reviews = [];
  const pIndex = new Map();
  let issued = 0;
  let firstIssuedAt = null;
  const issuedDays = [];

  for (const it of items) {
    const pk = String(it.PK || '');
    const sk = String(it.SK || '');
    if (pk.startsWith('SEED#')) {
      if (sk === 'COMMIT') commits.set(it.weekId, it);
      else if (sk === 'REVEAL') reveals.set(it.weekId, it);
    } else if (pk.startsWith('SAMPLE#')) {
      if (sk === 'DRAW') draws.set(it.weekId, it);
    } else if (pk.startsWith('Q#')) {
      if (sk === 'SAMPLED') sampledRows.push(it);
      else if (sk.startsWith('VERDICT')) { const a = verdictsBy.get(it.qid) || []; a.push({ ...it, _n: verdictOrder(sk) }); verdictsBy.set(it.qid, a); }
    } else if (pk.startsWith('SETTLE#')) {
      if (sk.startsWith('TICK#')) ticks.push(it);
      else if (sk.startsWith('REVIEW#')) reviews.push(it);
    } else if (pk.startsWith('PRED#') && it.questionSchema) {
      for (const s of it.scenarios || []) {
        for (const t of s.triggers || []) {
          if (t && t.question === true && t.qid) {
            issued++;
            pIndex.set(t.qid, typeof t.p === 'number' ? t.p : null);
            const at = it.generatedAt || it.SK;
            if (!firstIssuedAt || String(at) < firstIssuedAt) firstIssuedAt = String(at);
            issuedDays.push(day(it.SK || it.generatedAt));
          }
        }
      }
    }
  }

  const commitList = [...commits.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const firstCommit = commitList[0] || null;

  // latest verdict per question (highest correction number wins)
  const latestVerdict = new Map();
  for (const [qid, arr] of verdictsBy) latestVerdict.set(qid, arr.sort((a, b) => b._n - a._n)[0]);

  // ---- sampled questions ----
  const sampledAll = sampledRows.map((r) => {
    const v = latestVerdict.get(r.qid) || null;
    let state;
    if (v) state = v.verdict === 'yes' ? 'yes' : v.verdict === 'no' ? 'no' : 'void';
    else state = day(r.deadline) < today ? 'past_deadline_unchecked' : 'awaiting';
    return {
      qid: r.qid, weekId: r.weekId, storyTitle: r.storyTitle || null, question: r.question,
      resolutionSource: r.resolutionSource || null, p: pIndex.has(r.qid) ? pIndex.get(r.qid) : null,
      deadline: r.deadline, issuedAt: r.issuedAt || null, clusterKey: r.clusterKey || null, state,
      ...(v ? { verdict: { decidedAt: v.decidedAt, url: v.evidence?.url || null, quote: v.evidence?.quote || null } } : {}),
      ...(v && v.verdict === 'void' ? { voidReason: v.voidReason || null } : {}),
    };
  });
  sampledAll.sort((a, b) => (a.weekId === b.weekId ? String(a.deadline).localeCompare(String(b.deadline)) : b.weekId.localeCompare(a.weekId)));
  const weekIdsDesc = [...new Set(sampledAll.map((s) => s.weekId))].sort().reverse().slice(0, SAMPLED_WEEKS_SHOWN);
  const sampled = sampledAll.filter((s) => weekIdsDesc.includes(s.weekId));

  const count = (st) => sampledAll.filter((s) => s.state === st).length;
  const counts = {
    locked: sampledAll.length, yes: count('yes'), no: count('no'), void: count('void'),
    awaiting: count('awaiting'), pastDeadlineUnchecked: count('past_deadline_unchecked'),
  };
  counts.resolved = counts.yes + counts.no;

  // ---- weeks (every week from the first commit to the latest committed / current week) ----
  const weeks = [];
  if (firstCommit) {
    const last = [W.weekOf(today), ...commitList.map((c) => c.weekId)].sort().pop();
    const drawnIds = [...draws.keys()].sort();
    const poolWeeks = new Set(drawnIds.slice(-POOL_WEEKS_PUBLISHED));
    for (let w = firstCommit.weekId; w <= last; w = W.addWeeks(w, 1)) {
      const c = commits.get(w) || null;
      const rv = reveals.get(w) || null;
      const dr = draws.get(w) || null;
      const dueRows = sampledRows.filter((r) => W.weekOf(W.addDays(day(r.deadline), GRACE_DAYS)) === w);
      const settledV = [...latestVerdict.values()].filter((v) => W.weekOf(day(v.decidedAt)) === w);
      const rev = reviews.filter((r) => W.weekOf(day(r.at)) === w);
      weeks.push({
        weekId: w, weekStart: W.weekStart(w),
        commit: c ? { hash: c.commitHash, committedAt: c.committedAt } : null,
        reveal: rv ? { seedHex: rv.seedHex, revealedAt: rv.revealedAt } : null,
        drawn: Boolean(dr), eligible: dr ? dr.eligible : null, clusters: dr ? dr.clusters : null, picked: dr ? (dr.picked || []).length : null,
        due: dueRows.length, settled: settledV.length, void: settledV.filter((v) => v.verdict === 'void').length, reviewed: rev.length > 0,
        ...(dr && poolWeeks.has(w) ? { draw: { K: dr.K, pool: dr.pool || [], picked: dr.picked || [] } } : {}),
      });
    }
  }

  // ---- warm-up: questions issued before the first commitment's week began ----
  const warmUp = firstCommit ? issuedDays.filter((d) => d < firstCommit.weekStart).length : issued;

  // ---- scoring (null below 150) ----
  const scored = sampledAll.filter((s) => (s.state === 'yes' || s.state === 'no') && typeof s.p === 'number')
    .map((s) => ({ p: s.p, y: s.state === 'yes' ? 1 : 0, cluster: s.clusterKey || s.qid }));
  const scoring = computeScoring(scored, { voidCount: counts.void });

  // ---- settle health (drives the dead-man's alarm; every rule needs something committed) ----
  const tickTimes = ticks.map((t) => t.at).sort();
  const lastTickAt = tickTimes.length ? tickTimes[tickTimes.length - 1] : null;
  let drawMissedWeek = null;
  for (const c of commitList) {
    const end = W.weekEnd(c.weekId);
    const graceEnd = Date.parse(`${W.addDays(end, 1)}T00:00:00Z`) + 36 * 3600 * 1000; // Tuesday 12:00 UTC
    if (nowMs > graceEnd && !draws.has(c.weekId)) { drawMissedWeek = c.weekId; break; }
  }
  const nextWeek = W.addWeeks(W.weekOf(today), 1);
  const started = firstCommit ? Date.parse(firstCommit.committedAt) : null;
  const commitMissing = Boolean(firstCommit) && nowMs >= started + 2 * 86400000 && !commits.has(nextWeek);
  const tickStale = Boolean(firstCommit) && nowMs > (lastTickAt ? Date.parse(lastTickAt) : started) + 3 * 86400000;
  const dueUnsettled = sampledAll.filter((s) => !latestVerdict.has(s.qid) && W.addDays(day(s.deadline), GRACE_DAYS) <= today);
  const oldest = dueUnsettled.reduce((m, s) => Math.max(m, W.daysBetween(W.addDays(day(s.deadline), GRACE_DAYS), today)), 0);
  const verdictTimes = [...latestVerdict.values()].map((v) => v.decidedAt).sort();
  const settleHealth = {
    expectedDrawWeek: drawMissedWeek, drawMissed: Boolean(drawMissedWeek), commitMissing, tickStale, lastTickAt,
    lastVerdictAt: verdictTimes.length ? verdictTimes[verdictTimes.length - 1] : null,
    dueUnsettled: dueUnsettled.length, oldestDueUnsettledDays: dueUnsettled.length ? oldest : null,
  };

  return {
    schema: 1, builtAt: nowIso, method: METHOD,
    firstIssuedAt, firstCommit: firstCommit ? { weekId: firstCommit.weekId, committedAt: firstCommit.committedAt } : null,
    firstDrawWeek: drawnIdsFirst(draws),
    issued, sampledTotal: sampledAll.length, warmUp,
    weeks, sampled, counts, scoring, settleHealth,
  };
}

function drawnIdsFirst(draws) { const ids = [...draws.keys()].sort(); return ids[0] || null; }

module.exports = { buildQuestionBoard, METHOD };
