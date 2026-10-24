'use strict';

// Where a fact sits in the record: the one implementation of assignment, placement and merge rules (decision 0037 section 3, 0040 rule 3).
// Used by newsStoryRecord views, newsPredictionResolver gather and newsRecordReview select, so the three never drift. Pure: facts in, maps out.

const byKey = (...fns) => (a, b) => { for (const f of fns) { const x = f(a); const y = f(b); if (x < y) return -1; if (x > y) return 1; } return 0; };

/** Facts in a stable order (at, eventId) with a repeated eventId dropped, so the output never depends on file order. */
function ordered(facts) {
  const seen = new Set();
  return [...facts].sort(byKey((f) => f.at, (f) => f.eventId)).filter((f) => !seen.has(f.eventId) && seen.add(f.eventId));
}

/**
 * story_merged facts -> {aliases: Map(from -> survivor), applied: [the merge facts that took effect]}. Transitive (A to B to C
 * gives A to C). Oldest merge first; a merge that would close a cycle, or that moves a story already merged, is ignored
 * (0036 section 3). A `story_split` for the same (from, into) at or after a merge cancels that merge (the story is its own again).
 */
function resolveAliases(facts) {
  const direct = new Map();
  const applied = [];
  const root = (id) => { const seen = new Set(); let at = id; while (direct.has(at) && !seen.has(at)) { seen.add(at); at = direct.get(at); } return at; };
  const splits = facts.filter((x) => x.kind === 'story_split');
  const split = (m) => splits.some((x) => x.payload.from === m.payload.from && x.payload.into === m.payload.into && x.at >= m.at);
  for (const f of ordered(facts).filter((x) => x.kind === 'story_merged' && !split(x))) {
    const {from, into} = f.payload;
    if (!from || !into || from === into || direct.has(from) || root(into) === from) continue;
    direct.set(from, into);
    applied.push(f);
  }
  return {aliases: new Map([...direct.keys()].map((from) => [from, root(from)])), applied};
}

const ASSIGNER_RANK = {ingest: 0, review: 1, operator: 2};

/**
 * assignment facts -> Map(entryId -> the current assignment fact). Latest `at` wins; at a tie operator beats review beats ingest,
 * then the larger eventId (0040 rule 3). `supersedes` is informational and not read here.
 */
function currentAssignments(facts) {
  const rank = byKey((f) => f.at, (f) => ASSIGNER_RANK[f.payload.by] ?? -1, (f) => f.eventId);
  const cur = new Map();
  for (const f of facts) {
    if (f.kind !== 'assignment') continue;
    const had = cur.get(f.payload.entryId);
    if (!had || rank(had, f) < 0) cur.set(f.payload.entryId, f);
  }
  return cur;
}

/**
 * Facts -> {placed, reassigned, keep}. `placed` has no assignment facts, and each entry (and any correction of it) sits on the thread of its
 * current assignment instead of its archive thread. `reassigned` = Map(entryId -> the archive thread it left); `keep` = those archive threads,
 * which stay stories even when nothing else is left in them. An assignment may name an `article` fact as well as an entry: the article then sits on
 * the assigned story (an unassigned article has no thread and stays out of every story). An assignment naming no entry or article fact does nothing. With no
 * assignment but the ingest ones nothing moves and `placed` is the facts unchanged.
 */
function placeEntries(facts) {
  const cur = currentAssignments(facts);
  const home = new Map();
  const reassigned = new Map();
  for (const f of facts) {
    const a = (f.kind === 'entry' || f.kind === 'article') && cur.get(f.eventId);
    if (!a || a.payload.threadId === f.threadId) continue;
    home.set(f.eventId, a.payload.threadId);
    if (f.threadId) reassigned.set(f.eventId, f.threadId);
  }
  const placed = facts.filter((f) => f.kind !== 'assignment').map((f) => {
    const to = f.kind === 'entry' || f.kind === 'article' ? home.get(f.eventId) : f.kind === 'correction' ? home.get(f.payload.corrects) : undefined;
    return to ? {...f, threadId: to} : f;
  });
  return {placed, reassigned, keep: new Set(reassigned.values())};
}

module.exports = {byKey, ordered, resolveAliases, currentAssignments, placeEntries};
