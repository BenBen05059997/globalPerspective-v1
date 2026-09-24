// SourceRobustness — the source-truth L1 signal made visible to readers.
// Implements "faithfulness ≠ truth": a story resting on a single outlet must
// visibly read as less corroborated than one carried by many. This is the
// anti-Bloomberg posture — we lead with our doubt instead of printing every
// claim with equal authority (ANALYSIS_SOURCE_TRUTH_PLAN.md L1).
//
// Honesty contract: render NOTHING when there is no source data. Never default
// to a "corroborated" badge on missing data — that would be the exact fabricated
// confidence this signal exists to prevent.
//
// Props:
//   outlets:  number of DISTINCT outlets (the real corroboration signal)
//   sources:  total source count (fallback when distinct-outlet count is absent)
//   regions:  number of distinct covering regions/countries (optional enrichment)
//   size:     "sm" | "md"   default "sm"

export default function SourceRobustness({ outlets, sources, regions, size = 'sm' }) {
  // Prefer distinct outlets; fall back to raw source count. No data → no pill.
  const n = Number.isFinite(outlets) && outlets > 0
    ? outlets
    : (Number.isFinite(sources) && sources > 0 ? sources : null);
  if (n == null) return null;

  const single = n < 2;
  const cls = `srb srb-${size} ${single ? 'srb-warn' : 'srb-ok'}`;
  const regionTail = !single && Number.isFinite(regions) && regions >= 2 ? ` · ${regions} regions` : '';

  if (single) {
    return (
      <span
        className={cls}
        title="Built on a single outlet — treat as unverified until a second source corroborates it."
      >
        ⚠ Single-source
      </span>
    );
  }

  return (
    <span
      className={cls}
      title={`Corroborated by ${n} distinct outlets${regionTail ? `, ${regions} regions` : ''}.`}
    >
      ✓ Corroborated · {n} outlets{regionTail}
    </span>
  );
}
