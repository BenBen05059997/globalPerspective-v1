'use strict';

// GATHER (decision 0038, stage 3; operator decision 2026-10-22). No model, no network beyond the injected facts
// reader. The only evidence is the forecast's own story: its `entry` facts in record/facts, dated AFTER the
// forecast's draw day (the PRED issue day) and up to due + GRACE_DAYS. Nothing before the draw, no other story,
// no web search.

const lib = require('./lib');

const factsKey = (day) => `record/facts/${day}.jsonl`;
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

/**
 * Read the record/facts days the open questions need (their windows, plus yesterday and today for WATCH) once each.
 * facts = { getLines(key) -> {lines} } (s3json.getLines, injected). A missing file is an empty day; a failing
 * read puts that day in `failed`, and every question whose window holds it is not judged tonight.
 * -> { byThread: Map(threadId -> [{fact, day}]), failed: Map(day -> message), available }
 */
async function loadEntries(facts, questions, today) {
  const byThread = new Map();
  const failed = new Map();
  if (!facts) return { byThread, failed, available: false };
  const need = new Set([lib.addDays(today, -1), today]);
  for (const q of questions) for (const d of windowOf(q, today).days) need.add(d);
  for (const day of [...need].sort()) {
    try {
      const { lines } = await facts.getLines(factsKey(day));
      for (const f of lines) {
        if (!f || f.kind !== 'entry' || !f.threadId) continue;
        const list = byThread.get(f.threadId) || [];
        list.push({ fact: f, day });
        byThread.set(f.threadId, list);
      }
    } catch (e) { failed.set(day, String(e.message).slice(0, 120)); }
  }
  return { byThread, failed, available: true };
}

/** Threads with an entry fact in yesterday's or today's file. */
function movedThreads(loaded, today) {
  const recent = new Set([lib.addDays(today, -1), today]);
  const out = new Set();
  for (const [thread, list] of loaded.byThread) if (list.some((x) => recent.has(x.day))) out.add(thread);
  return out;
}

const entryOf = (f) => {
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
  const entries = (q.threadId ? loaded.byThread.get(q.threadId) || [] : [])
    .map((x) => entryOf(x.fact))
    .filter((e) => e.date > after && e.date <= to && (e.title || e.summary))
    .filter((e) => !e.eventId || (!seen.has(e.eventId) && seen.add(e.eventId)))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.eventId).localeCompare(String(b.eventId)));
  return { entries, complete: Boolean(loaded.available && q.threadId && !failed), failed };
}

module.exports = { factsKey, windowOf, loadEntries, movedThreads, buildBundle };
