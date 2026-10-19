# 0030. The Studio leaves the menu until its return criteria are met

Status: accepted (refines 0011)
Date: 2026-10-19

## Context
Decision 0011 kept the Analysis Studio as a page with a public example. Measured 2026-10-19
(`.board/linking/studio.md`): 0 `newsAnalyze` invocations in 30 days, 0 shares, the deployed `newsAnalyze`
prompt is stale against the frontend's, the member output cap (1600 tokens) truncates the structured block, and
the public example (`EXAMPLE_SHARE_ID`) was never set.

## Decision
We will remove "Studio" from the main menu and the phone tab bar (menu = Map · Stories · Briefings · Track
record) and from the map's "Elsewhere" teasers. `/analyze` and `/analyze/s/:id` stay routed; existing shares keep
working; in-context links (a story's "Analyze this arc") stay. Its redesign as a bring-your-own-hypothesis tool is
`plans/PLAN_2026-10-19_studio_redesign.md`. It returns to the menu when all three hold: a real public example,
sharing working end to end, and a deployed `newsAnalyze` that matches the repo.

## Consequences
- `quality/verify_pages.sh` asserts the menu has no Studio item; a new record supersedes this one when it returns.

Source: `project-docs/plans/PLAN_2026-10-19_linking_and_pages.md` (Decisions 4).
