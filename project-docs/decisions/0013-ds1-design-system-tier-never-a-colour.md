# 13. One design system (DS1): hue means crisis type; risk tier is never a colour

Status: accepted (crisis hue values amended by 0022)
Date: 2026-09-26 (neutral tier tokens built 2026-10-01)

## Context
Pages answered "where, how sure, how fresh, whose claim" in different ways, and risk was shown with
traffic-light colours that collided with status colours.

## Decision
We will use one token set (DS1, `shared/styles/tokens.css`) across the site:
- hue means crisis type only;
- risk tier is number + tier word + ring weight, never a colour (`--tier-*` tokens are neutral);
- amber `--warn` means stale or paused; `--ok` / `--error` mean a check passed or failed;
- solid lines mean reported, dashed lines mean a judged link; freshness shows as brightness plus a
  date;
- shared blocks in `shared/ui/` (TierChip, StoryRow, StoryPeek, BootLoader, and the rest) are
  reused, never re-styled locally.

## Consequences
- Operator decision 11 of 2026-10-01 made the tier tokens neutral everywhere (TierChip, Stories
  counts, country risk bars, map feed, track record, briefings).
- Style ratchets in `quality/check_*.mjs` stop colour and px drift from coming back.

Source: `git show a5c0de8:project-docs/plans/REDESIGN_MASTER_PLAN.md` (deleted 2026-10-19) (§1, §3.1 DS1);
`git show 120de90:project-docs/archive/redesign-ux/_active/TASK_2026-10-01_dark_site_shared_tokens.md` (deleted 2026-10-19) (decision 11);
`project-docs/plans/PLAN_2026-10-19_colour_consistency.md` ("What the site already decided")
