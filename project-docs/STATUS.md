# Status: in progress, parked, open decisions

Built from `git log --since=2026-10-17`, the plans in `plans/` and the decision records, read 2026-10-20.
Update a line when its source changes; delete it when its source says done. Design: [ARCHITECTURE](architecture/ARCHITECTURE.md).

## In progress
- Website release not yet shipped: legacy-pages release, front Worker upload (301s, bot pre-render), then
  deploy `newsSituationIngest` and `newsSituationTracker`, smoke checks, click-through; all unticked, each
  needs a fresh yes. [linking plan, section R](plans/PLAN_2026-10-19_linking_and_pages.md)
- Cloudflare migration: local build done, candidate uploaded but cannot load data (read API CORS allows only
  the site origins); cutover gated. [linking plan, R](plans/PLAN_2026-10-19_linking_and_pages.md),
  [migration plan](plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md)
- Layered story selection (P7): `newsSelectionShadow` has run since 2026-10-18; shadow week ends about
  2026-10-25, then the operator decides. P1 prompt v2b is prepared and awaits a yes.
  [grounded forecast plan](plans/TASK_2026-10-17_grounded_forecast_and_cost.md)
- Map colour consistency: C3, C4, C7 open (off-token surfaces, one green and one amber, baseline falling), plus
  four unverified small bugs. [colour plan](plans/PLAN_2026-10-19_colour_consistency.md)
- Back-end hygiene: 10 Lambdas on `nodejs20.x` (end of life), dead env keys, retired model default string in
  `newsPostDevTo`. [consistency plan](plans/PLAN_2026-10-19_consistency_and_modernisation.md)

## Parked
- Analysis credits: code exists, not shipped; needs a go-live decision. [0002](decisions/0002-analysis-credits-parked.md)
- Economy: impact, quality and weekly-markets jobs DISABLED, surfaces hidden; markets data still runs.
  [0009](decisions/0009-economy-parked.md), [0031](decisions/0031-economy-parked-fx-box-labelled.md)
- Impact audit job DISABLED (feeds nothing shown). [0015](decisions/0015-park-jobs-that-feed-nothing-shown.md)
  (its resolver part is superseded by [0027](decisions/0027-forecast-resolver-unparked-as-weekly-settle.md))
- Signals API: build rule DISABLED, no keys issued, code kept. [0032](decisions/0032-signals-api-parked.md)
- Studio out of the nav until it meets the return criteria. [0030](decisions/0030-studio-out-of-menu.md)
- Breaking and drift email rules DISABLED until the first follower. [drift-email runbook](runbooks/drift-email.md)

## Open decisions
- Studio decision 2, first version: a free country sheet with no model. Recommended YES; the plan says the
  operator decides. [Studio plan](plans/PLAN_2026-10-19_studio_redesign.md)
- Studio decisions 3-8, all recommended YES in the debate judgment (untracked `.board/studio/J2_final_judgment.md`,
  section 15): 3 lens Studio off the front door, 4 falsifiers client-only, 5 link ledger as a week-4 branch,
  6 keep thesis-producers as the target, 7 pricing unchanged and fix the blog, 8 operator reviews links
  about 30 min/week from week 3. None is recorded in a decision record. [Studio plan](plans/PLAN_2026-10-19_studio_redesign.md)
- Studio decision 9 is the operator's: the 5 test users and the first public example (same source).
- Studio decision 10: frontend release at the end of week 1; needs a fresh yes (same source).
- Studio decision 11, recommended: defer MCP and the "signal API not sold" amendment (same source).
- Studio open items: deployed `newsAnalyze` = repo needs either deploying with credits off or removing that
  code; reader-proposed questions into the public track record or a separate ledger; keep the member server
  path (0 runs) or go BYOK-only. [Studio plan, Open](plans/PLAN_2026-10-19_studio_redesign.md)
- The unreleased website release above: when to release.
  [linking plan](plans/PLAN_2026-10-19_linking_and_pages.md)
- Selection go after the shadow week (Combined 11, ours 7, 2 split in the blind review).
  [grounded forecast plan](plans/TASK_2026-10-17_grounded_forecast_and_cost.md)
