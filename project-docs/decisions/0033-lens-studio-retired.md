# 0033. The lens Analysis Studio is retired

Status: accepted (supersedes 0030; refines 0011)
Date: 2026-10-20

## Context
Decision 0030 took the Studio out of the menu until it met return criteria. Since then the country page became the
"sheet" (fact and judgment marks, what we don't know, copy, print, a private view), which gives the reader the
analyst tool without a model run.

## Decision
We will retire the lens Studio screens. `/analyze` redirects (client route and front Worker 301) to the first
requested story when it is a thread id, otherwise to the countries list. Every link into the Studio, the Account key
panel and the browser-key (BYOK) storage and picker are removed. Kept: shared-run pages (`/analyze/s/:id`) so links
already out there work, the analysis libraries that `quality/analysis/` and the share Lambda use, and the Lambdas
`newsAnalyze` and `newsSharedAnalysis` (untouched).

## Consequences
- The site can no longer create a share; `newsAnalyze` has no caller until it is removed or revived (a separate decision).
- `ROUTE.studio` and `studioHref` are gone from both link cores.
- The redesign plan `plans/PLAN_2026-10-19_studio_redesign.md` stays as history for what the sheet grew from.
