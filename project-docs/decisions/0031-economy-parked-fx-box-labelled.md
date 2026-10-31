# 0031. Economy stays parked; its dead links go; the FX box is labelled raw quotes

Status: superseded by 0049 (economy retired 2026-10-31)
Date: 2026-10-19

## Context
Economy is parked (0009): the economic-impact jobs are off and the surfaces sit behind `ECONOMY_PARKED`. Links
still led into it or into the paused markets note: the `/today` masthead's "Markets this week →"
(`/weekly-markets`), the story page's "← Back to Economy" fallback and markets up-link, and the country rail's
"How markets moved this week →". The country FX box showed hourly quotes (`newsMarketsData` still runs) with no
word on what they are.

## Decision
We will keep economy parked, not deleted, and remove every link that dead-ends in it. An old `?tab=economy`
link opens the story's Overview. The country FX box is labelled "Market prices · raw quotes · as of <time>"
and links to no story. Components only tests used (`DisruptionRow`, `DisruptionPreview`) are deleted.

## Consequences
- `/economy` stays reachable by URL; re-enabling stays as 0009 describes.
- Economy links guarded by `ECONOMY_PARKED` (rendered only when it is false) stay in code for the return.

Source: `project-docs/plans/PLAN_2026-10-19_linking_and_pages.md` (deleted 2026-10-26; in git history) (Decisions 5; checklist E1).
