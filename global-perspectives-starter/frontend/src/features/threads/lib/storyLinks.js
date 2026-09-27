// storyLinks — pure derivation of "news this story is judged to feed into" (the FED INTO slide)
// from the country systems-analysis graphs (SYSTEMS#<place> — see newsSystemsAnalysis /
// STORY_WEB_RETHINK_PLAN.md §5). Each graph has `nodes[{ threadId, summary }]`,
// `edges[{ from, to, confidence, lagDays, mechanism, citedEntries }]` and its own `generatedAt`.
// A story "feeds into" the news at `edge.to` when `edge.from === threadId` — that is this story's
// own outgoing causal edges, never inferred, never a max-confidence guess across disagreeing webs
// (STORY_WEB_RETHINK_PLAN §5: "when webs disagree, show each web's confidence; never take the max").
import { analysisTextState } from '@/features/threads/lib/storyMode.js';

const CONF_RANK = { strong: 3, medium: 2, weak: 1 };

/**
 * deriveFedInto(threadId, systemsRecords) -> [{ targetThreadId, targetTitle, confidence, lagDays,
 *   mechanism, citedEntries, country, generatedAt, freshness }]
 * `systemsRecords`: [{ country, generatedAt, nodes, edges }]. De-duplicated by target thread,
 * keeping the strongest-confidence, most-recent record for each. Records whose analysis is more
 * than 30 days old are dropped (S5 "hide after 30 days"); 7–30 day records are kept but flagged
 * `freshness: 'older'` so the UI can show the amber label.
 */
export function deriveFedInto(threadId, systemsRecords = []) {
  if (!threadId || !Array.isArray(systemsRecords)) return [];
  const byTarget = new Map();

  for (const record of systemsRecords) {
    if (!record) continue;
    const freshness = analysisTextState(record.generatedAt);
    if (freshness === 'hidden') continue; // S5: analysis older than 30 days is not shown
    const nodeById = new Map((record.nodes || []).map((n) => [n.threadId, n]));
    for (const edge of record.edges || []) {
      if (edge.from !== threadId || !edge.to || edge.to === threadId) continue;
      const targetNode = nodeById.get(edge.to);
      const candidate = {
        targetThreadId: edge.to,
        targetTitle: targetNode?.summary || targetNode?.title || null,
        confidence: edge.confidence || null,
        lagDays: edge.lagDays ?? null,
        mechanism: edge.mechanism || null,
        citedEntries: Array.isArray(edge.citedEntries) ? edge.citedEntries : [],
        country: record.country || null,
        generatedAt: record.generatedAt || null,
        freshness,
      };
      const existing = byTarget.get(edge.to);
      if (!existing || (CONF_RANK[candidate.confidence] || 0) > (CONF_RANK[existing.confidence] || 0)) {
        byTarget.set(edge.to, candidate);
      }
    }
  }

  return [...byTarget.values()].sort((a, b) => (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0));
}

/**
 * deriveFedFrom(threadId, systemsRecords) -> same shape as deriveFedInto, but for INCOMING
 * edges (edge.to === threadId) — STORY_WEB_RETHINK_PLAN §5(c) "Earlier news judged to feed in".
 * Only rendered by callers when non-empty (S6-style: no empty-shell sections).
 */
export function deriveFedFrom(threadId, systemsRecords = []) {
  if (!threadId || !Array.isArray(systemsRecords)) return [];
  const bySource = new Map();

  for (const record of systemsRecords) {
    if (!record) continue;
    const freshness = analysisTextState(record.generatedAt);
    if (freshness === 'hidden') continue;
    const nodeById = new Map((record.nodes || []).map((n) => [n.threadId, n]));
    for (const edge of record.edges || []) {
      if (edge.to !== threadId || !edge.from || edge.from === threadId) continue;
      const sourceNode = nodeById.get(edge.from);
      const candidate = {
        sourceThreadId: edge.from,
        sourceTitle: sourceNode?.summary || sourceNode?.title || null,
        confidence: edge.confidence || null,
        lagDays: edge.lagDays ?? null,
        mechanism: edge.mechanism || null,
        citedEntries: Array.isArray(edge.citedEntries) ? edge.citedEntries : [],
        country: record.country || null,
        generatedAt: record.generatedAt || null,
        freshness,
      };
      const existing = bySource.get(edge.from);
      if (!existing || (CONF_RANK[candidate.confidence] || 0) > (CONF_RANK[existing.confidence] || 0)) {
        bySource.set(edge.from, candidate);
      }
    }
  }

  return [...bySource.values()].sort((a, b) => (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0));
}
