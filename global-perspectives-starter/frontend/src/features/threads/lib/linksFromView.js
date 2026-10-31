// linksFromView — one story's index-shaped object from the record's links view
// (/data/record/views/links/<id>.json: `judgedLinks` and `web`, decision 0042), so deriveFromIndex and linkNote
// run on it unchanged. The view carries what `web_index` carried for this one story: the judged links, the
// shared-actor backbone, the story's state/places/webs, and its neighbours' titles and places. Pure.
//
// Not in the view: `targets` (the run's global "most-covered countries" list). linkNote uses only its count,
// in the country_not_analysed wording, so the hook asks `web_index` for it in that one state (`needsTargets`).

const place = ({ name, n }) => ({ name, n });

/** True when the view can answer (the judged links and the web block are both there). */
export function viewHasLinks(view) {
  return Boolean(view && view.threadId && Array.isArray(view.judgedLinks) && view.web && Array.isArray(view.web.backbone));
}

/** @returns {object|null} an index-shaped object for deriveFromIndex/linkNote, or null when the view lacks `web` */
export function indexFromView(view, targets = null) {
  if (!viewHasLinks(view)) return null;
  const id = view.threadId;
  const w = view.web;
  const webs = Array.isArray(w.analysedIn) ? w.analysedIn : [];
  const otherPlaces = w.otherPlaces || {};
  const threads = {
    [id]: { state: w.state, places: (w.places || []).map(place), analysedIn: webs.map(({ country, generatedAt }) => ({ country, generatedAt })) },
  };
  const other = (otherId, title) => { threads[otherId] = { ...(threads[otherId] || {}), title, places: (otherPlaces[otherId] || []).map(place) }; };
  const links = view.judgedLinks.map((l) => {
    other(l.otherThreadId, l.otherTitle);
    return { from: l.from, to: l.to, confidence: l.confidence, lagDays: l.lagDays, mechanism: l.mechanism, cited: l.cited, country: l.country, generatedAt: l.generatedAt };
  });
  const shared = w.backbone.map((b) => {
    other(b.otherThreadId, b.otherTitle);
    return { a: id, b: b.otherThreadId, actors: b.actors, weight: b.weight, country: b.country, generatedAt: b.generatedAt };
  });
  const newest = webs.map((a) => a.generatedAt).filter(Boolean).sort().pop() || null;
  return {
    generatedAt: newest,
    targets: targets || undefined,
    websUsed: webs.map(({ country, generatedAt, nodes }) => ({ country, generatedAt, nodes })),
    links, shared, threads,
  };
}

/** The one state whose wording needs the run's country count, which only `web_index` carries. */
export const needsTargets = (view) => view?.web?.state === 'country_not_analysed';
