# 22. Crisis hues re-picked (option A)

Status: accepted (amends the hue values under 0013)
Date: 2026-10-19

## Context
Two crisis hues sat on top of status colours: humanitarian next to the warning amber, economic next
to the accent cyan, and conflict `#ee7754` about 4° from `--error #ff6a4d`. Readers could not tell a
crisis type from a status.

## Decision
We will use the operator's pick from the swatch page (option A): humanitarian orchid `#d987e0`,
economic green `#8fd46a`, and `--error` moved to rose `#f2689a`; conflict keeps `#ee7754`.

## Consequences
- `crisisHue` derives hex and RGB from the tokens, so the values live in one place
  (`shared/styles/tokens.css`).

Source: `project-docs/plans/PLAN_2026-10-19_colour_consistency.md` (Operator decisions 2026-10-19, C5)
