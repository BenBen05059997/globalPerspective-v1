'use strict';

// record/views/track-record.json: the public track record page (/track-record) built from facts (decision 0043 section 4 and
// 0044). Pure: facts in, one view object out; `today` and `builtAt` come in, no I/O.
//
// `questions` is the weekly sampled-question scheme, the same shape the page read from predictions/track_record.json
// (`data.questions`, built by newsPredictionsSnapshot/questionBoard.js from PredictionLog rows), computed here from
// forecast_drawn, question_commit, question_draw and verdict facts with the shared rules (questionState.js, questionScoring.js).
//   `settleHealth` (decision 0052): what the freshness monitor's alarm reads, from the same facts (the old board read the PredictionLog): the draw due
//   but not written, the next commitment missing, the sampled questions past deadline + 3 days with no verdict, the newest verdict. The daily tick is not
//   a fact: the monitor takes it from the resolver's heartbeat (record/health/settle-tick.json).
//   `draw` of a week (the last POOL_WEEKS_PUBLISHED drawn weeks, 0052): {K, pool, picked} for the page's "Verify this draw", the pool rebuilt from the
//   forecast facts of the week by the resolver's own rule (shared questionPool.js) and published only when it reproduces the draw (its size and its picks
//   with the revealed seed); a week whose draw it cannot reproduce has no `draw` (W41: a story's thread changed after the draw).
//   not in the record, so not in the view: a week's `reviewed` (no reader).
// `legacy` is the frozen pilot era, a constant (trackRecordLegacy.json), not computed.
const {addDays} = require('./_shared/world');
const Q = require('./_shared/questionState');
const {computeScoring} = require('./_shared/questionScoring');
const {poolOfDraw, rowsOfFacts, weekStart: poolWeekStart, weekEnd: poolWeekEnd, daysBetween} = require('./_shared/questionPool');
const LEGACY = require('./trackRecordLegacy.json');

const SCHEMA_VERSION = 1;
const GRACE_DAYS = 3; // a "no" needs the deadline plus this many days (the resolver's rule)
const SAMPLED_WEEKS_SHOWN = 26;
const POOL_WEEKS_PUBLISHED = 4; // the draws that carry their pool (the old board's number)
const HOUR_MS = 3600 * 1000;
const METHOD = {K: 22, leadDays: [Q.LEAD_MIN, Q.LEAD_MAX], rule: 'v1', graceDays: GRACE_DAYS};

const day = (s) => String(s || '').slice(0, 10);
const byWeekStart = (a, b) => (a.payload.weekId < b.payload.weekId ? -1 : a.payload.weekId > b.payload.weekId ? 1 : 0);

// ISO week id -> its Monday and back, the same arithmetic as the resolver's lib (weeksParity-tested there)
function weekStart(weekId) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!m) throw new Error(`trackRecord: bad week id ${weekId}`);
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  return new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000 + (Number(m[2]) - 1) * 7 * 86400000).toISOString().slice(0, 10);
}
const addWeeks = (weekId, n) => Q.isoWeekOfDay(addDays(weekStart(weekId), 7 * n));

// the forecast's story title: its topicId is the title plus a "-<n>" suffix (PRED# key), and no fact carries the title itself
const titleOf = (topicId) => (topicId ? String(topicId).replace(/-\d+$/, '') : null);

/** The latest verdict fact per qid (highest revision, then newest). */
function latestVerdicts(facts) {
  const latest = new Map();
  for (const f of facts) {
    if (f.kind !== 'verdict' || !f.payload.qid) continue;
    const cur = latest.get(f.payload.qid);
    if (!cur || (f.payload.revision ?? 1) > (cur.payload.revision ?? 1) || ((f.payload.revision ?? 1) === (cur.payload.revision ?? 1) && f.at > cur.at)) latest.set(f.payload.qid, f);
  }
  return latest;
}

/** {draw: {K, pool, picked}} of a drawn week when the forecast facts reproduce it, else {}. Shapes as the page's verifier reads them: pool [{q, c}], picks {qid, h, clusterKey}. */
function publishedDraw(drawFact, forecastRows, weekId) {
  const a = poolWeekStart(weekId);
  const b = poolWeekEnd(weekId);
  const rebuilt = poolOfDraw(forecastRows.filter((r) => r.SK >= a && r.SK <= b), weekId, drawFact.payload);
  if (!rebuilt) return {};
  return {draw: {K: drawFact.payload.K, pool: rebuilt.pool.map((q) => ({q: q.qid, c: q.clusterKey})), picked: drawFact.payload.picked.map((p) => ({qid: p.qid, h: p.hash, clusterKey: p.clusterKey}))}};
}

function buildTrackRecord(allFacts, {today, now = `${today}T12:00:00.000Z`}) {
  const commits = allFacts.filter((f) => f.kind === 'question_commit').sort(byWeekStart);
  const commitBy = new Map(commits.map((f) => [f.payload.weekId, f]));
  const drawBy = new Map(allFacts.filter((f) => f.kind === 'question_draw').map((f) => [f.payload.weekId, f]));
  const verdictBy = latestVerdicts(allFacts);

  // every issued question: its branch, the fact it was drawn in and its issue day (the date in the forkId)
  const issuedQ = new Map();
  let issued = 0;
  let firstIssuedAt = null;
  const issueDays = [];
  for (const f of allFacts) {
    if (f.kind !== 'forecast_drawn') continue;
    const issueDay = f.payload.forkId.slice(f.payload.forkId.lastIndexOf('/') + 1);
    for (const b of f.payload.branches) {
      if (b.question !== true || !b.qid) continue;
      issued++;
      issueDays.push(issueDay);
      if (!issuedQ.has(b.qid)) issuedQ.set(b.qid, {f, b, issueDay});
      if (!firstIssuedAt || f.at < firstIssuedAt) firstIssuedAt = f.at;
    }
  }

  // ---- sampled questions: the picks of every draw, joined to the question they name ----
  const sampledAll = [];
  for (const d of [...drawBy.values()].sort(byWeekStart)) {
    for (const p of d.payload.picked) {
      const q = issuedQ.get(p.qid);
      if (!q) continue; // a pick whose forecast is not in the record cannot be shown (counted in sampledTotal below)
      const v = verdictBy.get(p.qid) || null;
      const state = Q.outcomeState({sampled: true, result: v ? v.payload.result : null, deadline: q.b.due, today});
      sampledAll.push({
        qid: p.qid, weekId: d.payload.weekId, storyTitle: titleOf(q.f.payload.topicId), question: q.b.trigger,
        resolutionSource: q.b.resolutionSource || null, p: typeof q.b.p === 'number' ? q.b.p : null,
        deadline: q.b.due, issuedAt: q.f.at, clusterKey: q.f.threadId || p.clusterKey || null, state,
        ...(v ? {verdict: {decidedAt: v.at, url: (v.payload.evidence && v.payload.evidence.url) || null, quote: (v.payload.evidence && v.payload.evidence.quote) || null}} : {}),
        ...(v && v.payload.result === 'void' ? {voidReason: v.payload.voidReason || null} : {}),
      });
    }
  }
  const sampledTotal = [...drawBy.values()].reduce((n, d) => n + d.payload.picked.length, 0);
  sampledAll.sort((a, b) => (a.weekId === b.weekId ? String(a.deadline).localeCompare(String(b.deadline)) : b.weekId.localeCompare(a.weekId)));
  const shownWeeks = [...new Set(sampledAll.map((s) => s.weekId))].sort().reverse().slice(0, SAMPLED_WEEKS_SHOWN);
  const sampled = sampledAll.filter((s) => shownWeeks.includes(s.weekId));

  const count = (st) => sampledAll.filter((s) => s.state === st).length;
  const counts = {locked: sampledAll.length, yes: count('yes'), no: count('no'), void: count('void'), awaiting: count('awaiting'), pastDeadlineUnchecked: count('past_deadline_unchecked')};
  counts.resolved = counts.yes + counts.no;

  // ---- weeks: every week from the first commitment to the latest committed or the current week ----
  const first = commits[0] || null;
  const settled = [...verdictBy.values()]; // every question with a verdict, sampled or watched, as the old board counted them
  const weeks = [];
  const drawnIds = [...drawBy.keys()].sort();
  const poolWeeks = new Set(drawnIds.slice(-POOL_WEEKS_PUBLISHED));
  const forecastRows = poolWeeks.size ? rowsOfFacts(allFacts) : [];
  if (first) {
    const last = [Q.isoWeekOfDay(today), ...commits.map((c) => c.payload.weekId)].sort().pop();
    for (let w = first.payload.weekId; w <= last; w = addWeeks(w, 1)) {
      const c = commitBy.get(w) || null;
      const dr = drawBy.get(w) || null;
      const dueN = sampledAll.filter((s) => Q.isoWeekOfDay(addDays(day(s.deadline), GRACE_DAYS)) === w).length;
      const sv = settled.filter((v) => Q.isoWeekOfDay(day(v.at)) === w);
      weeks.push({
        weekId: w, weekStart: weekStart(w),
        commit: c ? {hash: c.payload.commitHash, committedAt: c.at} : null,
        reveal: dr ? {seedHex: dr.payload.seedHex, revealedAt: dr.at} : null,
        drawn: Boolean(dr), eligible: dr ? dr.payload.eligible : null, clusters: dr ? dr.payload.clusters : null, picked: dr ? dr.payload.picked.length : null,
        due: dueN, settled: sv.length, void: sv.filter((v) => v.payload.result === 'void').length,
        ...(dr && poolWeeks.has(w) ? publishedDraw(dr, forecastRows, w) : {}),
      });
    }
  }

  const warmUp = first ? issueDays.filter((d) => d < weekStart(first.payload.weekId)).length : issued;
  const scored = sampledAll.filter((s) => (s.state === 'yes' || s.state === 'no') && typeof s.p === 'number')
    .map((s) => ({p: s.p, y: s.state === 'yes' ? 1 : 0, cluster: s.clusterKey || s.qid}));

  // ---- settle health (the alarm's inputs; every rule needs something committed) ----
  const nowMs = Date.parse(now);
  const nextWeek = Q.isoWeekOfDay(addDays(today, 7));
  const drawMissedWeek = commits.map((c) => c.payload.weekId).find((wk) => nowMs > Date.parse(`${addDays(poolWeekEnd(wk), 1)}T00:00:00Z`) + 36 * HOUR_MS && !drawBy.has(wk)) || null; // Tuesday 12:00 UTC
  const dueUnsettled = sampledAll.filter((s) => !verdictBy.has(s.qid) && addDays(day(s.deadline), GRACE_DAYS) <= today);
  const verdictTimes = [...verdictBy.values()].map((v) => v.at).sort();
  const settleHealth = {
    expectedDrawWeek: drawMissedWeek, drawMissed: Boolean(drawMissedWeek),
    commitMissing: Boolean(first) && nowMs >= Date.parse(first.at) + 2 * 24 * HOUR_MS && !commitBy.has(nextWeek),
    lastVerdictAt: verdictTimes.length ? verdictTimes[verdictTimes.length - 1] : null,
    dueUnsettled: dueUnsettled.length,
    oldestDueUnsettledDays: dueUnsettled.length ? dueUnsettled.reduce((m, s) => Math.max(m, daysBetween(addDays(day(s.deadline), GRACE_DAYS), today)), 0) : null,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    asOf: today, // the states (awaiting / past deadline) are as of this day
    builtFrom: {factsThrough: allFacts.filter((f) => f.kind !== 'run').reduce((m, f) => (m === null || f.date > m ? f.date : m), null)},
    questions: {
      method: METHOD, firstIssuedAt,
      firstCommit: first ? {weekId: first.payload.weekId, committedAt: first.at} : null,
      firstDrawWeek: drawnIds[0] || null,
      issued, sampledTotal, warmUp, weeks, sampled, counts,
      scoring: computeScoring(scored, {voidCount: counts.void}),
      settleHealth,
    },
    legacy: LEGACY,
  };
}

module.exports = {SCHEMA_VERSION, METHOD, SAMPLED_WEEKS_SHOWN, POOL_WEEKS_PUBLISHED, buildTrackRecord};
