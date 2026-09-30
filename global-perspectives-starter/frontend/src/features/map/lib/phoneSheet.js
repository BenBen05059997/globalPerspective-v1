// Phone map sheet policy (Batch 3 / H2). On a phone the map pane sits BELOW the compact HUD (its top was
// measured at y=499..556 on a 390x844 screen), and the bottom sheet at `half` (45vh) covered y=406..786 -
// so selecting a country (whose card is long) hid the whole visible map. A country now opens at `peek`
// (title only, ~120px) and the map pane is scrolled into view, so the country stays visible above the
// sheet; situations and stories keep `half` (their cards are short and the map focus is the marker).

/** phoneSheetStopFor - the sheet stop a new selection opens at. */
export function phoneSheetStopFor({ focus = null, storyParam = null, countryParam = null } = {}) {
  if (focus || storyParam) return 'half';
  return countryParam ? 'peek' : 'half';
}

/** mapScrollTop - the window scrollY that puts the map pane's top edge just under a sticky/fixed header. */
export function mapScrollTop({ mapTop, scrollY, headerHeight = 0 }) {
  const t = Number(mapTop); const y = Number(scrollY); const h = Number(headerHeight) || 0;
  if (!Number.isFinite(t) || !Number.isFinite(y)) return null;
  return Math.max(0, Math.round(t + y - h));
}
