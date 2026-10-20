// countryConnections — "How it connects" (MODEL JUDGMENT): story-web links that start at one of this country's
// story arcs, read from the web index the app already holds (deriveFromIndex, threads' public API). The wording is
// "judged to feed into", never "caused". A lag below zero or missing is "order unclear".
import { deriveFromIndex } from '@/features/threads';

const RANK = { strong: 3, medium: 2, weak: 1 };

export const lagText = (lagDays) => (Number.isFinite(lagDays) && lagDays >= 0 ? `lag ${lagDays}d` : 'order unclear');

/**
 * @param index  the web index or null
 * @param arcs   [{ threadId, latestTitle }]
 * @returns {Array<{fromId, fromTitle, toId, toTitle, confidence, lag, mechanism, cited:[{title,date,topicId}], asOf}>}
 *   strongest first, one row per (from, to) pair, at most `limit`
 */
export function connectionRows(index, arcs, { limit = 6, now = Date.now() } = {}) {
  if (!index) return [];
  const seen = new Set();
  const rows = [];
  for (const arc of arcs || []) {
    for (const l of deriveFromIndex(index, arc.threadId, now).fedInto) {
      const key = `${arc.threadId}>${l.targetThreadId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        fromId: arc.threadId,
        fromTitle: arc.latestTitle || index.threads?.[arc.threadId]?.title || arc.threadId,
        toId: l.targetThreadId,
        toTitle: l.targetTitle || l.targetThreadId,
        confidence: l.confidence,
        lag: lagText(l.lagDays),
        mechanism: l.mechanism,
        cited: l.cited,
        asOf: l.generatedAt,
      });
    }
  }
  return rows.sort((a, b) => (RANK[b.confidence] || 0) - (RANK[a.confidence] || 0)).slice(0, limit);
}
