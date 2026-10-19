# 4. Placeless developments are kept, demoted below events

Status: accepted
Date: 2026-09-12

## Context
The world-model debate asked whether content without a place and actor (science, generic tech,
climate policy, society) belongs on a map-first site. The mission line is "what materially changes
lives, even if underreported".

## Decision
We will keep DEVELOPMENTS, demoted: they never get a map pin or a category quota, earn a spot only
by clearing a raised material-change bar, and never take the lead position, which goes to EVENTS.
The split is a display tag over existing fields (`iso3[]`/`actors[]` present means EVENT, absent
means DEVELOPMENT), with no new ID space, scale or taxonomy.

## Consequences
- Developments show in a quieter, secondary treatment below events, not as a nav page or a peer of
  the front page.

Source: `project-docs/rules/WORLD_MODEL.md` (Operator decisions 2026-09-12, D1)
