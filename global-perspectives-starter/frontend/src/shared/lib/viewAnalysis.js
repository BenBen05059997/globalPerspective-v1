// A story view's `analysis` (decisions 0037, 0042): the latest story analysis note in exactly the shape the
// `thread_analysis` action returns for the same story (payload fields + generatedAt, model, threadId, iso3). The
// builder stores it as the writer did, so this is a presence check, not a reshape: a view without one answers null
// and the caller falls back to the action.
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** story view -> the story analysis item, or null when the view has none (or is not a story view). */
export function analysisFromView(view) {
  const a = view?.analysis;
  return isObject(a) && Object.keys(a).length ? a : null;
}
