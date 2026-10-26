# 23. Radar: one sweep that reveals what is happening now (12-hour window)

Status: accepted
Date: 2026-10-19

## Context
The radar beam looped every 10 s forever at full brightness, every marker flared as it passed, and
up to 8 rings rippled forever. Nothing told the reader why a marker was lit; the operator found it
too much.

## Decision
We will run one faint, thin lap when the map opens (about 4–5 s), then stop; the play control
becomes "Scan again". "Happening now" means a story changed within the last 12 hours, at most 5;
those markers breathe softly while it is true, and the beam shows a short card beside each one as
it passes (one at a time). No "NEW" tag. Reduced motion: no sweep, no cards, no breathing, a still
soft halo.

## Consequences
- The expanding ripple ring and the per-marker flare are removed.
- New data while the page is open runs one sweep.

Source: `project-docs/plans/PLAN_2026-10-19_colour_consistency.md` (deleted 2026-10-26; in git history) (Operator decisions
2026-10-19; C6 R1–R6)
