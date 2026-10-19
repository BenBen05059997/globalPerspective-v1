# 16. The map console is the home page

Status: accepted
Date: 2026-10-01

## Context
The map-as-home programme (stage S6) and the approved console design made the map the site's main
view, while the old home (today's topics by region) still held real content.

## Decision
We will render the map console (`SituationHome`) at `/`. `/map` redirects to `/` with query and
hash kept (one canonical URL); the old home moves to `/today` and stays indexable. The nav "Map"
item points to `/` (exact match). The Worker's bot pre-render for `/` stays a static positioning
and directory page.

## Consequences
- Links that carry `?layer= ?country= ?story= ?focus=` keep working through the redirect.
- `/today` is reachable from the map's About drawer.

Source: `git show 120de90:project-docs/archive/redesign-ux/_active/TASK_2026-10-01_home_swap.md` (deleted 2026-10-19);
`git show a5c0de8:project-docs/plans/MAP_HOME_SITUATION_PLAN.md` (deleted 2026-10-19)
