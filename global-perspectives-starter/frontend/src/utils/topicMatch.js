// Country-name matching for topics/archive entries.
//
// Region labels in our data are free-text country names ("United States",
// "France", …) with inconsistent casing across sources, so matching is a
// case-insensitive exact compare. Extracted from WorldMapV2, where the same
// predicate had been pasted at three call sites (editorial picks, the
// right-panel leaderboard, and the detail-panel coverage filter).

export const countryNameEq = (a, b) =>
  !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

// First topic whose `regions` includes `name` (case-insensitive). Returns
// undefined when topics is empty/missing or nothing matches.
export function findTopicForCountry(topics, name) {
  if (!Array.isArray(topics) || !name) return undefined;
  return topics.find(
    (t) => Array.isArray(t.regions) && t.regions.some((r) => countryNameEq(r, name)),
  );
}
