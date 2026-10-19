// requestedStories — resolve `/analyze?stories=<id,id>` (built by studioHref in shared/lib/links.js) into the
// picker's selection. An id may be a thread id (the canonical story key every page links with) or one of
// today's topic ids (older links). Lookup order per id: today's topic by topic id, today's topic carrying
// that thread, then the earlier-stories list (last 30 days, one row per thread). An id that matches nothing
// is dropped (never a guessed story). Pure: AnalysisStudio supplies today's topics and the earlier rows.
//   -> { selected: topicId[] (at most `max`), picked: { [topicId]: earlierRow } }
export function resolveRequestedStories(requested, { topics = [], earlierRows = [], max }) {
  const selected = [];
  const picked = {};
  for (const id of requested) {
    if (selected.length >= max) break;
    const today = topics.find((t) => (t.topicId || t.id) === id) || topics.find((t) => t.threadId === id);
    const earlier = today ? null : earlierRows.find((r) => r.threadId === id);
    const topicId = today ? (today.topicId || today.id) : earlier?.topicId;
    if (!topicId || selected.includes(topicId)) continue;
    selected.push(topicId);
    if (earlier) picked[topicId] = earlier;
  }
  return { selected, picked };
}
