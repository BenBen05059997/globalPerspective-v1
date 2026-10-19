# 0029. /today is kept and linked from the map

Status: accepted (refines 0016)
Date: 2026-10-19

## Context
Decision 0016 moved the old home to `/today`, reached only through a teaser card inside the map's About drawer.
Usage over 7 days (read-API logs, `.board/linking/usage.md`) showed 6 direct `today` hits and 0 on-click
Predict / Trace Cause calls. The operator ruled that usage numbers do not decide this: the site has no users yet.

## Decision
We will keep `/today` and link it from the map: "Read today's topics →" heads the map's About content (the
desktop About drawer and the phone fold below the map). The Worker gets a bot pre-render for `/today`.

## Consequences
- The buried "Today's topics" teaser card is replaced by that one link.
- `/today` can be promoted later without a new route.

Source: `project-docs/plans/PLAN_2026-10-19_linking_and_pages.md` (Decisions 3; "Usage evidence").
