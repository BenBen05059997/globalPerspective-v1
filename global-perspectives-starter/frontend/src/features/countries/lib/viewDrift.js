// A country view of the record (decision 0042) -> the drift notes the country page has always read from the
// `country_history` action. Each view note is the DRIFT# item as newsDriftCorrector stored it plus `generatedAt` and
// `model` (the builder's asStored); the action returns the same item without `model`.

/** country view -> drift notes in the action's shape, newest first; [] when the view has none (or is not a country view). */
export function driftFromCountryView(view) {
  const drift = Array.isArray(view?.drift) ? view.drift : [];
  return drift.filter((n) => n && typeof n === 'object').map(({ model, ...note }) => note); // eslint-disable-line no-unused-vars
}

/**
 * The notes to show: the view's, cut to as many as the action returned. The action carries the member gate (it caps
 * the depth by tier server-side and reports the honest total), so its count is the cap and its total/gated stay. The
 * view is used only when it holds at least that many (its 90-note window or a missing backfill never shows fewer
 * notes than the action did); otherwise the action's notes stand.
 */
export function combineDrift(view, history) {
  const fromAction = Array.isArray(history?.driftNotes) ? history.driftNotes : [];
  const fromView = driftFromCountryView(view);
  const notes = fromAction.length > 0 && fromView.length >= fromAction.length ? fromView.slice(0, fromAction.length) : fromAction;
  return { driftNotes: notes, total: Number(history?.driftNotesTotal) || notes.length, gated: !!history?.driftNotesGated };
}
