// webIndexLinks — derives one story's links and state from the whole `web_index` object. The link
// rows keep the shape storyLinks.js (the pre-index derivation) produced, so FedIntoList and the
// slides did not change, and add `cited` (dated, titled headlines) when the web stored them.
// Each web keeps its OWN confidence: two webs that link the same pair give two rows, never the max
// (STORY_WEB_RETHINK_PLAN §5). Freshness: amber after 7 days, hidden after 30 (client-side, the
// table's TTL is off).
import { analysisTextState } from '@/features/threads/lib/storyMode.js';

const CONF_RANK = { strong: 3, medium: 2, weak: 1 };
const byConfidence = (a, b) => (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0);

function row(l, otherKey, otherId, titles, now) {
  const freshness = analysisTextState(l.generatedAt, now);
  return {
    [`${otherKey}ThreadId`]: otherId,
    [`${otherKey}Title`]: titles?.[otherId]?.title || null,
    confidence: l.confidence || null,
    lagDays: l.lagDays ?? null,
    mechanism: l.mechanism || null,
    citedEntries: Array.isArray(l.cited) ? l.cited.map((c) => c.topicId) : [],
    cited: Array.isArray(l.cited) ? l.cited.filter((c) => c && c.title) : [],
    country: l.country || null,
    generatedAt: l.generatedAt || null,
    freshness,
  };
}

/**
 * @returns {{ fedInto:Array, fedFrom:Array, state:string|null, meta:object|null, hasIndex:boolean }}
 *   state: linked | analysed_no_links | single_update | country_not_analysed | null (unknown story) | 'no_index'
 */
export function deriveFromIndex(index, threadId, now = Date.now()) {
  if (!index) return { fedInto: [], fedFrom: [], state: 'no_index', meta: null, hasIndex: false };
  const meta = index.threads?.[threadId] || null;
  const links = index.links || [];
  const usable = (l) => analysisTextState(l.generatedAt, now) !== 'hidden';
  const fedInto = links.filter((l) => l.from === threadId && usable(l)).map((l) => row(l, 'target', l.to, index.threads, now)).sort(byConfidence);
  const fedFrom = links.filter((l) => l.to === threadId && usable(l)).map((l) => row(l, 'source', l.from, index.threads, now)).sort(byConfidence);
  // a story whose only links are older than 30 days is, for the reader, not linked
  const state = meta ? ((fedInto.length || fedFrom.length) ? 'linked' : (meta.state === 'linked' ? 'analysed_no_links' : meta.state)) : null;
  return { fedInto, fedFrom, state, meta, hasIndex: true };
}

/** distinct linked stories in a row list (two webs can link the same target) */
export function distinctTargets(rows, key = 'targetThreadId') {
  return new Set((rows || []).map((r) => r[key])).size;
}
