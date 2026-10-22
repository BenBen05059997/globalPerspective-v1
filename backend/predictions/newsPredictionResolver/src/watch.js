'use strict';

// WATCH (decision 0038, stage 2): no model. Which open question branches deserve a check tonight?
//   - the story moved: a new `entry` fact for its threadId in yesterday's or today's record/facts file, or
//   - the branch is old: its due date passed GRACE_DAYS ago (the first day a `no` is allowed).
// Nothing else is checked. Oldest due first; a per-run cap with the overflow logged.

const lib = require('./lib');

const MAX_CANDIDATES = 60;

const factsKey = (day) => `record/facts/${day}.jsonl`;

/**
 * Entry facts of yesterday and today -> Map(threadId -> [entry fact]). deps.facts = { getLines(key) -> {lines} }
 * (s3json.getLines, injected so tests run offline). A missing file is an empty day, not an error.
 */
async function movedThreads(facts, today) {
  const moved = new Map();
  if (!facts) return moved;
  for (const d of [lib.addDays(today, -1), today]) {
    const { lines } = await facts.getLines(factsKey(d));
    for (const f of lines) {
      if (!f || f.kind !== 'entry' || !f.threadId) continue;
      const list = moved.get(f.threadId) || [];
      list.push(f);
      moved.set(f.threadId, list);
    }
  }
  return moved;
}

/** Every question branch (question:true, qid, deadline) in the PRED rows, once per qid. */
function questionsFromPreds(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    for (const s of row.scenarios || []) {
      for (const t of s.triggers || []) {
        if (!t || t.question !== true || !t.qid || !t.deadline || seen.has(t.qid)) continue;
        seen.add(t.qid);
        out.push({
          qid: t.qid, pk: row.PK, sk: row.SK, triggerId: t.id,
          question: t.text, deadline: t.deadline, resolutionSource: t.resolutionSource || null,
          storyTitle: row.title || null, issuedAt: row.generatedAt || String(row.SK || '').slice(0, 10),
          threadId: row.threadId || null, // no probability is copied, by design
        });
      }
    }
  }
  return out;
}

/** A SAMPLED row already holds the question fields (no probability). */
const questionFromSampled = (r) => ({
  qid: r.qid, pk: r.pk, sk: r.sk, triggerId: r.triggerId, question: r.question, deadline: r.deadline, resolutionSource: r.resolutionSource || null,
  storyTitle: r.storyTitle || null, issuedAt: r.issuedAt, threadId: r.threadId || null,
});

const draftDay = (d) => String(d.SK).slice(6, 16);

/**
 * Pick tonight's candidates. groups: Map(qid -> {sampled, drafts, verdicts}) from the Q# rows.
 * A question with a verdict row is never a candidate. A question already checked today is skipped; one whose
 * only reason is its age is re-checked only after redraftAfterDays (the old 5-day rule).
 * -> { candidates:[{...question, reason:'moved'|'grace', entries}], total, overflow }
 */
function selectCandidates({ questions, groups, moved, today, redraftAfterDays, cap = MAX_CANDIDATES }) {
  const cutoff = lib.addDays(today, -redraftAfterDays);
  const picked = [];
  for (const q of questions) {
    const g = groups.get(q.qid);
    if (g && g.verdicts.length) continue;
    const entries = q.threadId ? moved.get(q.threadId) : null;
    const isMoved = Boolean(entries && entries.length);
    const isOld = q.deadline <= lib.addDays(today, -lib.GRACE_DAYS);
    if (!isMoved && !isOld) continue;
    const days = (g ? g.drafts : []).map(draftDay);
    if (days.includes(today)) continue;
    if (!isMoved && days.some((d) => d > cutoff)) continue;
    picked.push({ ...q, reason: isMoved ? 'moved' : 'grace', entries: isMoved ? entries : [], sampled: Boolean(g && g.sampled) });
  }
  picked.sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)) || String(a.qid).localeCompare(String(b.qid)));
  return { candidates: picked.slice(0, cap), total: picked.length, overflow: Math.max(0, picked.length - cap) };
}

module.exports = { MAX_CANDIDATES, factsKey, movedThreads, questionsFromPreds, questionFromSampled, selectCandidates };
