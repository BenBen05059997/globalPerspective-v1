// A country view of the record (decision 0042) -> the country briefing the country page and card have always read
// from the `country_intelligence` action. The view's `intelligence` is the stored COUNTRY_INTELLIGENCE item as
// newsCountryIntelligence wrote it (the action drops only PK, SK and ttl, which the view never carries), so it needs
// no reshaping. Checked field by field against the action for all 48 countries with a view (2026-10-31).

/** country view -> the briefing in the action's shape, or null when the view is missing or holds no briefing. */
export function intelligenceFromCountryView(view) {
  const intel = view?.intelligence;
  return intel && typeof intel === 'object' && !Array.isArray(intel) && intel.generatedAt ? intel : null;
}
