# 24. Features get an index.js public API; Lambdas, CLIs and docs are grouped by feature

Status: accepted (supersedes the "no index.js barrels" and "do not move Lambda paths" parts of 0006)
Date: 2026-10-19

## Context
The 2026-09-24 restructure rejected `index.js` barrels (circular-import risk, a second thing to keep
in sync) and rejected moving Lambda directories (many hard-coded paths, deployed zips drifting from
the repo). By 2026-10-19 the frontend had four cross-feature import cycles, and the backend had
`scripts/lambda.sh` + `scripts/functions.json` for per-Lambda diff, package and rollback.

## Decision
We will (wave 3 of the consistency and modernisation plan, operator go 2026-10-19):
- move cross-feature modules to `shared/` to break the cycles, then give each feature an `index.js`
  as its public API;
- archive dead folders, then group Lambdas, CLIs and docs by feature with one README each (the
  largest move; last);
- bundle a shared backend `llm.js` into each Lambda at deploy.

## Consequences
- The `app → features → shared` direction from 0006 still holds.
- Every hard-coded path to a moved Lambda folder must be updated in the same change.
- Production deploys after wave 3 need a fresh operator "yes"; env renames (`GROK_*`/`XAI_*` →
  `LLM_*`) are not part of this decision.

Source: `project-docs/plans/PLAN_2026-10-19_consistency_and_modernisation.md` (Phases 3–4,
operator decision 4); coordinator board `.board/board.json` → `decisions.wave3` ("GO (operator
2026-10-19; overrides the 2026-09-24 restructure doc on barrels/Lambda folders)");
`git show 120de90:project-docs/archive/architecture/REPO_RESTRUCTURE_DESIGN_2026-09-24.md` (deleted 2026-10-19) (§2.6 and the barrel note)
