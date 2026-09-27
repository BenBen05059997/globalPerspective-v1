// imported by Node tooling outside src/ — keep relative imports
// "Our data vs this run" (TRACK_RECORD_AND_STUDIO_RULING.md; S5c F1 + D4).
//
// The Studio deck's map draws a place only if the run names it AND a source lists it
// (source regions). A place the run names that no selected story's regions back is
// still real (it may genuinely be relevant) but is NOT drawn as verified — it gets the
// sand "THIS RUN" hatching (DS1 legend: solid --c-accent border = OUR DATA, sand
// --c-run-hatch hatching = THIS RUN) instead of being silently treated as ours.
//
// Pure, dependency-free — same reason as analysisStruct.js: testable without a browser
// and safe to reuse from the offline eval.

export function normalizePlaceName(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

// classifyPlaces(places, sourceRegions) -> { ours: string[], runOnly: string[] }
//   - ours:    named by the run AND present in a source region → OUR DATA token.
//   - runOnly: named by the run but backed by no source region → THIS RUN sand hatching.
// Dedupes by normalized name (case/whitespace-insensitive), keeps first-seen casing.
export function classifyPlaces(places, sourceRegions) {
  const regionSet = new Set(
    (Array.isArray(sourceRegions) ? sourceRegions : []).map(normalizePlaceName).filter(Boolean)
  );
  const seen = new Set();
  const ours = [];
  const runOnly = [];
  (Array.isArray(places) ? places : []).forEach((p) => {
    const name = typeof p === 'string' ? p.trim() : '';
    if (!name) return;
    const key = normalizePlaceName(name);
    if (seen.has(key)) return;
    seen.add(key);
    if (regionSet.has(key)) ours.push(name);
    else runOnly.push(name);
  });
  return { ours, runOnly };
}

// D4: a scenario's `places` that aren't backed by ANY source region are dropped from
// the picture entirely (never drawn, never silently treated as verified) and reported
// in `dropped` so the UI can note it honestly — "a place not in any source region →
// dropped from the picture and noted" (S5c brief). Never mutates the input.
export function dropUnbackedPlaces(scenarios, sourceRegions) {
  const regionSet = new Set(
    (Array.isArray(sourceRegions) ? sourceRegions : []).map(normalizePlaceName).filter(Boolean)
  );
  const dropped = [];
  const out = (Array.isArray(scenarios) ? scenarios : []).map((s) => {
    const places = Array.isArray(s.places) ? s.places : [];
    if (places.length === 0) return s;
    const kept = [];
    places.forEach((p) => {
      if (regionSet.has(normalizePlaceName(p))) kept.push(p);
      else dropped.push({ scenario: s.name, place: p });
    });
    if (kept.length === places.length) return s;
    const next = { ...s };
    if (kept.length) next.places = kept;
    else delete next.places;
    return next;
  });
  return { scenarios: out, dropped };
}
