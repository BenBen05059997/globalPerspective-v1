'use strict';

// GATHER (decision 0038, stage 3; operator decision 2026-10-22). No model, no network beyond the injected facts
// reader. The only evidence is the forecast's own story: its `entry` facts (and operator-assigned `article` facts) in record/facts, dated AFTER the
// forecast's draw day (the PRED issue day) and up to due + GRACE_DAYS. Nothing before the draw, no other story,
// no web search.

const lib = require('./lib');
const { ordered, resolveAliases, placeEntries } = require('./_shared/placement');

const factsKey = (day) => `record/facts/${day}.jsonl`;
const runKey = (day) => `record/runs/${day}.json`;
const dayOf = (v) => String(v || '').slice(0, 10);

/** The days whose entries count for a question: after its draw day, up to min(today, due + GRACE_DAYS). */
function windowOf(q, today) {
  const after = dayOf(q.issuedAt);
  const last = lib.addDays(q.deadline, lib.GRACE_DAYS);
  const to = today < last ? today : last;
  const days = [];
  for (let d = lib.addDays(after, 1); d <= to; d = lib.addDays(d, 1)) days.push(d);
  return { after, to, days };
}

/** The days a `no` needs a healthy Run for: the day after the draw up to the due day (COVERAGE GUARD, lane Q). */
function coverageDays(q) {
  const days = [];
  for (let d = lib.addDays(dayOf(q.issuedAt), 1); d <= q.deadline; d = lib.addDays(d, 1)) days.push(d);
  return days;
}

/** Why a Run object does not prove the day was covered; null when it does (status ok|partial and archiveDay present). */
function runGap(run) {
  if (!run) return 'no run';
  if (run.status !== 'ok' && run.status !== 'partial') return `run ${run.status || 'unknown'}`;
  const a = run.inputs && run.inputs.archiveDay;
  if (a !== 'present') return `archiveDay ${a && typeof a === 'object' ? `thin:${a.thin}` : a || 'unknown'}`;
  return null;
}

/**
 * Read the record/facts days the open questions need (their windows, plus yesterday and today for WATCH) once each.
 * ASSIGNMENTS and MERGES can be written on any later day than the facts they move, so every day from the earliest window start
 * to today is read (one S3 GET per day; the windows alone usually cover most of that range).
 * facts = { getLines(key) -> {lines} } (s3json.getLines, injected). A missing file is an empty day; a failing
 * read puts that day in `failed`, and every question whose window holds it is not judged tonight.
 * Also reads record/runs/DAY.json (facts.getJson) once per day any question's coverage window holds: `gaps` Map(day -> why)
 * holds every day without a healthy Run; an unreadable Run is a gap too.
 * Placement: an `entry` sits on the thread of its latest assignment (else its own threadId); an `article` (threadId null) counts only
 * when an assignment places it; then every thread is replaced by its merge survivor.
 * -> { byThread: Map(threadId -> [{fact, day}]), aliases: Map(from -> survivor), failed, gaps, available }
 */
async function loadEntries(facts, questions, today) {
  const byThread = new Map();
  const failed = new Map();
  const gaps = new Map();
  if (!facts) return { byThread, aliases: new Map(), failed, gaps, available: false };
  const need = new Set([lib.addDays(today, -1), today]);
  let first = null;
  for (const q of questions) for (const d of windowOf(q, today).days) { need.add(d); if (!first || d < first) first = d; }
  if (first) for (let d = first; d <= today; d = lib.addDays(d, 1)) need.add(d);
  const dayOfFact = new Map();
  const all = [];
  for (const day of [...need].sort()) {
    try {
      const { lines } = await facts.getLines(factsKey(day));
      for (const f of lines) {
        if (!f) continue;
        if (f.kind === 'entry' || f.kind === 'article') dayOfFact.set(f.eventId, day);
        if (['entry', 'article', 'assignment', 'story_merged', 'story_split'].includes(f.kind)) all.push(f);
      }
    } catch (e) { failed.set(day, String(e.message).slice(0, 120)); }
  }
  const sorted = ordered(all);
  const { placed } = placeEntries(sorted);
  const { aliases } = resolveAliases(sorted);
  for (const fact of placed) {
    if ((fact.kind !== 'entry' && fact.kind !== 'article') || !fact.threadId) continue;
    const key = aliases.get(fact.threadId) || fact.threadId;
    const list = byThread.get(key) || [];
    list.push({ fact, day: dayOfFact.get(fact.eventId) });
    byThread.set(key, list);
  }
  const runDays = new Set();
  for (const q of questions) for (const d of coverageDays(q)) if (d <= today) runDays.add(d);
  for (const day of [...runDays].sort()) {
    try {
      if (typeof facts.getJson !== 'function') throw new Error('no run reader');
      const why = runGap(await facts.getJson(runKey(day)));
      if (why) gaps.set(day, why);
    } catch (e) { gaps.set(day, `run unreadable: ${String(e.message).slice(0, 80)}`); }
  }
  return { byThread, aliases, failed, gaps, available: true };
}

/** Threads with an entry or assigned article fact in yesterday's or today's file, plus the stories merged into a moved survivor. */
function movedThreads(loaded, today) {
  const recent = new Set([lib.addDays(today, -1), today]);
  const out = new Set();
  for (const [thread, list] of loaded.byThread) if (list.some((x) => recent.has(x.day))) out.add(thread);
  for (const [from, into] of loaded.aliases || []) if (out.has(into)) out.add(from);
  return out;
}

const entryOf = (f) => {
  if (f.kind === 'article') {
    const p = f.payload || {};
    return { eventId: f.eventId || null, title: p.title || '', summary: p.snippet || '', date: f.date || dayOf(f.at), url: p.url || null, kind: 'article', recovered: Boolean(p.recoveredAt || p.recoveredFrom) };
  }
  const src = (f.sources || []).find((x) => x && x.url) || {};
  return { eventId: f.eventId || null, title: f.payload?.title || src.title || '', summary: f.payload?.summary || '', date: f.date || dayOf(f.at), url: src.url || null };
};

/**
 * The evidence bundle of one question: its story's entries dated after the draw day and up to due + GRACE_DAYS,
 * oldest first. -> { entries:[{eventId,title,summary,date,url}], complete, failed }.
 * complete = every day of the window was read for a story we can identify (the precondition for a `no`).
 */
function buildBundle(q, loaded, today) {
  const { after, to, days } = windowOf(q, today);
  const failed = days.some((d) => loaded.failed.has(d));
  const seen = new Set();
  const entries = (q.threadId ? loaded.byThread.get((loaded.aliases && loaded.aliases.get(q.threadId)) || q.threadId) || [] : [])
    .map((x) => entryOf(x.fact))
    .filter((e) => e.date > after && e.date <= to && (e.title || e.summary))
    .filter((e) => !e.eventId || (!seen.has(e.eventId) && seen.add(e.eventId)))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.eventId).localeCompare(String(b.eventId)));
  // COVERAGE GUARD: every day from the day after the draw to the due day needs a healthy Run, or a `no` would claim
  // "not reported" for our own outage. Days after today have no Run yet (a gap).
  const coverageGaps = coverageDays(q).filter((d) => d > today || (loaded.gaps || new Map()).has(d) || !(loaded.gaps && loaded.available))
    .map((d) => ({ day: d, why: d > today ? 'future' : (loaded.gaps && loaded.gaps.get(d)) || 'no run reader' }));
  return { entries, complete: Boolean(loaded.available && q.threadId && !failed), failed, coverageGaps };
}

module.exports = { runKey, coverageDays, runGap, factsKey, windowOf, loadEntries, movedThreads, buildBundle };
