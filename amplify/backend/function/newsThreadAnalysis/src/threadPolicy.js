'use strict';

// Change-driven thread analysis (Batch 2 / D2). Pure: no AWS, no network.
// A thread is re-analysed only when it has a NEW event (a topicId the stored analysis has not seen).
// Entries ageing out of the 30-day archive window never trigger one.

const MAX_STORED_IDS = 50;

function entryIds(thread) {
  return [...new Set((thread.entries || []).map((e) => e.topicId).filter(Boolean))].sort();
}

/** -> { stale: boolean, reason: 'new-thread' | 'new-events' | 'no-new-events', detail? } */
function isStale(existing, thread) {
  if (!existing) return { stale: true, reason: 'new-thread' };
  const ids = entryIds(thread);
  if (Array.isArray(existing.entryTopicIds)) {
    const seen = new Set(existing.entryTopicIds);
    const fresh = ids.filter((id) => !seen.has(id));
    return fresh.length
      ? { stale: true, reason: 'new-events', detail: `${fresh.length} new entr${fresh.length === 1 ? 'y' : 'ies'}` }
      : { stale: false, reason: 'no-new-events' };
  }
  // legacy item (written before this change): count only, and only growth counts
  return thread.entries.length > (existing.entryCount || 0)
    ? { stale: true, reason: 'new-events', detail: `${thread.entries.length} entries vs ${existing.entryCount} analysed (legacy item)` }
    : { stale: false, reason: 'no-new-events', detail: 'legacy item' };
}

const newestDate = (thread) => (thread.entries || []).reduce((m, e) => (e.date > m ? e.date : m), '');

/** Changed threads only, newest activity first, then larger threads; at most maxThreads. */
function selectThreads({ threads, existingByThread, maxThreads = 10 }) {
  const plan = threads.map((t) => ({ thread: t, threadId: t.threadId, entries: t.entries.length, newest: newestDate(t), ...isStale(existingByThread[t.threadId], t) }));
  const changed = plan.filter((p) => p.stale).sort((a, b) => b.newest.localeCompare(a.newest) || b.entries - a.entries);
  const chosen = new Set(changed.slice(0, maxThreads).map((p) => p.threadId));
  const rest = plan.filter((p) => !p.stale);
  return [...changed, ...rest].map((p) => ({
    threadId: p.threadId, entries: p.entries, newest: p.newest,
    run: chosen.has(p.threadId),
    reason: p.stale && !chosen.has(p.threadId) ? 'over-cap' : p.reason,
    detail: p.detail,
  }));
}

/** DeepSeek V4 request body. thinking must be disabled: it defaults on and burns max_tokens. */
function buildRequestBody({ model, prompt, maxTokens, temperature, topP }) {
  return {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    thinking: { type: 'disabled' },
    response_format: { type: 'json_object' },
  };
}

module.exports = { MAX_STORED_IDS, entryIds, isStale, selectThreads, buildRequestBody };
