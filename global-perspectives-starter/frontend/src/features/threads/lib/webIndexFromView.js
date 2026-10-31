// webIndexFromView — the record's web view (/data/record/views/index/web.json, decision 0042) as the `web_index`
// action's object, so every reader (Stories web, the map's story card and arcs, the country page's connections)
// keeps its code. The view carries links, shared-actor links, per-story state/title/places/webs and the webs used;
// `generatedAt` is the newest web's time. Not in it: the run's `targets` (only linkNote's country_not_analysed wording
// needs the count; useStoryLinks asks the action for it), `coverage` totals and `runId` (no reader uses them). Pure.

/** True when the view can answer: the arrays and the thread table are all there. */
export function webViewUsable(view) {
  return Boolean(view && Array.isArray(view.links) && Array.isArray(view.shared) && Array.isArray(view.websUsed) && view.threads && typeof view.threads === 'object');
}

/** @returns {object|null} a `web_index`-shaped object, or null when the view is missing or malformed */
export function webIndexFromView(view) {
  if (!webViewUsable(view)) return null;
  const { links, shared, threads, websUsed, generatedAt, maxAgeDays } = view;
  return { generatedAt, maxAgeDays, websUsed, links, shared, threads };
}
