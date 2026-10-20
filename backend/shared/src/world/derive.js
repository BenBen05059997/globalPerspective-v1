'use strict';

// Pure derivations over what readers.js returns. No client, no clock, no AWS. Every consumer that needs one of these
// numbers calls it here instead of computing it again.

const { tierFromScore } = require('./tier');
const { eachDay } = require('./dates');

const arr = (x) => (Array.isArray(x) ? x : []);
const dayList = (range) => (Array.isArray(range) ? range : arr(range && range.days));

/** Outlet identity: the host the pipeline stored, trimmed, lower-cased, without a leading "www.". */
const outletName = (s) => String(s || '').trim().toLowerCase().replace(/^www\./, '');

/** Sorted distinct outlets of entries (or topics: anything with `sources[].source`). Empty names do not count. */
function outletsOf(entries) {
  const set = new Set();
  for (const e of arr(entries)) for (const s of arr(e && e.sources)) { const n = outletName(s && s.source); if (n) set.add(n); }
  return [...set].sort();
}

/** { [threadId]: [entries ascending by date then topicId] } over an archiveRange result (or its days array). */
function entriesByThread(range) {
  const out = {};
  for (const d of dayList(range)) for (const e of d.entries) if (e.threadId) (out[e.threadId] ||= []).push(e);
  for (const list of Object.values(out)) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.topicId) < String(b.topicId) ? -1 : 1));
  return out;
}

/**
 * Story birth: the earliest archive day a thread has an entry on.
 *   born              that day
 *   bornAt            the earliest archivedAt among the thread's entries ON that day (the pipeline's last write of
 *                     its first entry: an upper bound for first appearance); `${born}T00:00:00Z` when none has one,
 *                     with bornAtApprox: true
 *   windowLimited     true when no present day before `born` exists inside the window: the story may be older than
 *                     the window (born is the window's first day, or every earlier day in it is missing)
 *   missingBefore     missing days inside the window before `born` (a missing day can hide an earlier appearance)
 * `range` is archiveRange's result, or a days array with opts { from, missingDays }.
 */
function birthByThread(range, opts = {}) {
  const days = dayList(range);
  const from = opts.from || (range && range.from) || (days[0] && days[0].date);
  const missing = opts.missingDays || (range && range.missingDays) || [];
  const out = {};
  for (const [threadId, list] of Object.entries(entriesByThread(days))) {
    const born = list[0].date;
    const stamps = list.filter((e) => e.date === born && e.archivedAt).map((e) => e.archivedAt).sort();
    const before = from && born > from ? eachDay(from, born).slice(0, -1) : [];
    out[threadId] = {
      threadId, born, bornAt: stamps[0] || `${born}T00:00:00Z`, bornAtApprox: !stamps.length,
      firstTopicId: list[0].topicId, entryCount: list.length,
      windowLimited: before.every((d) => missing.includes(d)),
      missingBefore: before.filter((d) => missing.includes(d)),
    };
  }
  return out;
}

/**
 * Forks and branches from scenarios() snapshots: one fork per PRED# snapshot, one branch per trigger.
 *   fork    { forkId:'PRED#<topicId>/<date>', drawnAt:<date>, atEvent:<topicId>, threadId, branches }
 *   branch  { branchId:'<forkId>/<trigger id>', scenarioId, text:<scenario label or trigger text>, p (percent 0..100
 *             of the TRIGGER, null when the trigger carries none), scenarioP (percent of the scenario), trigger,
 *             resolutionSource, due, question, qid }
 * Sorted by drawnAt then forkId. A snapshot with no triggers gives a fork with no branches.
 */
function branchesFromScenarios(snapshots) {
  return arr(snapshots).map((snap) => {
    const forkId = `${snap.pk}/${snap.date}`;
    const branches = [];
    for (const s of arr(snap.scenarios)) for (const t of arr(s.triggers)) {
      branches.push({
        branchId: `${forkId}/${t.id}`, scenarioId: String(s.index), text: s.label || t.trigger, p: t.p, scenarioP: s.probability,
        trigger: t.trigger, resolutionSource: t.resolutionSource || '', due: t.due, question: t.question, qid: t.qid,
      });
    }
    return { forkId, drawnAt: snap.date, atEvent: snap.topicId, threadId: snap.threadId, branches };
  }).sort((a, b) => (a.drawnAt < b.drawnAt ? -1 : a.drawnAt > b.drawnAt ? 1 : a.forkId < b.forkId ? -1 : a.forkId > b.forkId ? 1 : 0));
}

/**
 * What the pull could and could not see, for the report and the weekly's coverage line.
 * opts.since (default range.from): count only days from there on (the weekly counts its 7 days of a 37-day pull).
 * opts.births (birthByThread) + opts.analyses ({threadId: anything truthy when the thread has an analysis as of the
 * run): add analysedNew = { analysed, total } over stories born on or after `since`.
 */
function coverage(range, opts = {}) {
  const since = opts.since || range.from;
  const scope = dayList(range).filter((d) => d.date >= since);
  const entries = scope.flatMap((d) => d.entries);
  const out = {
    from: range.from, to: range.to, since,
    expectedDays: eachDay(since, range.to).length, daysWithData: scope.length,
    missingDays: arr(range.missingDays).filter((d) => d >= since), windowMissingDays: arr(range.missingDays),
    entries: entries.length, stories: new Set(entries.map((e) => e.threadId).filter(Boolean)).size, outlets: outletsOf(entries).length,
    analysedNew: null,
  };
  if (opts.births) {
    const fresh = Object.values(opts.births).filter((b) => b.born >= since);
    out.analysedNew = { analysed: fresh.filter((b) => opts.analyses && opts.analyses[b.threadId]).length, total: fresh.length };
  }
  return out;
}

/**
 * The reading of a thread's risk as of a day: its THREAD_ANALYSIS when that was generated on or before `asOf`
 * (any analysis when asOf is omitted), else the last THREAD_HISTORY point on or before it, else null. A current
 * analysis never leaks backward into a historical replay.
 * -> { source:'analysis'|'history', date, riskScore, tier, title, trajectory } | null
 */
function analysisAsOf(analysis, history, asOf) {
  if (analysis && (!asOf || (analysis.asOfDay && analysis.asOfDay <= asOf))) {
    return { source: 'analysis', date: analysis.asOfDay, riskScore: analysis.riskScore, tier: analysis.tier, title: analysis.title, trajectory: analysis.trajectory };
  }
  const h = arr(history).filter((p) => !asOf || p.date <= asOf).slice(-1)[0];
  return h ? { source: 'history', date: h.date, riskScore: h.score, tier: h.tier, title: h.title || null, trajectory: h.trajectory } : null;
}

module.exports = { outletName, outletsOf, entriesByThread, birthByThread, branchesFromScenarios, coverage, analysisAsOf, tierFromScore };
