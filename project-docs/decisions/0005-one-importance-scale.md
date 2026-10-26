# 5. One importance scale: the canonical risk tier

Status: accepted
Date: 2026-09-12 (amended 2026-09-15)

## Context
Eight different "how big a deal is this" scales existed across the pipeline and the pages.

## Decision
We will resolve everything a reader sees as importance to the single canonical tier
(low / moderate / elevated / high, the `riskTiers.js` bands). Four scales are not importance and
keep their own labelled meaning: prediction probabilities (likelihood), the breaking-alert score
(an internal decision gate, never displayed), economic-impact severity (market-movement magnitude)
and urgency (tempo; added as the fourth exception on 2026-09-15). Editorial `significance` stays a
legacy field (its only consumer is the LinkedIn post-order sort).

## Consequences
- No new importance scales; new surfaces show the tier.
- The rubric behind the tier is `quality/SEVERITY_CODEBOOK.md`.

Source: `project-docs/architecture/WORLD_MODEL.md` (D2 and the 2026-09-15 amendment);
`git show 120de90:project-docs/archive/architecture/ONE_TRUTH_EXECUTION_PLAN.md` (deleted 2026-10-19);
`git show 120de90:project-docs/archive/architecture/IMPORTANCE_SCALE_MAPPING.md` (deleted 2026-10-19)
