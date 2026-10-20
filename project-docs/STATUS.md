# Status: in progress, parked, open decisions

Built from `git log --since=2026-10-17`, the plans in `plans/` and the decision records, read 2026-10-20.
Update a line when its source changes; delete it when its source says done. Design: [ARCHITECTURE](architecture/ARCHITECTURE.md).

## In progress
- Website release shipped 2026-10-20 (Pages, front Worker, situation Lambdas, smoke checks, desktop click-through).
  Left: phone-width click-through. [linking plan, section R](plans/PLAN_2026-10-19_linking_and_pages.md)
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

## Done
- Lens Analysis Studio retired 2026-10-20: `/analyze` redirects to the first thread story or the countries list,
  every link into it is removed, its screens and BYOK/provider code are deleted; shared-run pages
  (`/analyze/s/:id`), the analysis libraries and the `newsAnalyze`/`newsSharedAnalysis` Lambdas stay.
  The country page is the sheet. [0030](decisions/0030-studio-out-of-menu.md)

## Parked
- Analysis credits: code exists, not shipped; needs a go-live decision. [0002](decisions/0002-analysis-credits-parked.md)
- Economy: impact, quality and weekly-markets jobs DISABLED, surfaces hidden; markets data still runs.
  [0009](decisions/0009-economy-parked.md), [0031](decisions/0031-economy-parked-fx-box-labelled.md)
- Impact audit job DISABLED (feeds nothing shown). [0015](decisions/0015-park-jobs-that-feed-nothing-shown.md)
  (its resolver part is superseded by [0027](decisions/0027-forecast-resolver-unparked-as-weekly-settle.md))
- Signals API: build rule DISABLED, no keys issued, code kept. [0032](decisions/0032-signals-api-parked.md)
- Breaking and drift email rules DISABLED until the first follower. [drift-email runbook](runbooks/drift-email.md)

## Open decisions
- Studio retirement follow-ups: deploy the frontend release that carries the `/analyze` redirect (needs a fresh
  yes) and the front Worker 301; the deployed `newsAnalyze` differs from the repo and no page calls it now, so it
  needs a decision (leave, or remove the Lambda and its repo code); the country sheet's remaining items are in the
  [Studio plan](plans/PLAN_2026-10-19_studio_redesign.md). Decisions 4 to 11 of that plan are not recorded
  in a decision record.
- Hosting: finish the Cloudflare cutover (retire the GitHub Pages release path) or keep Pages for now.
  [migration plan](plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md)
- Selection go after the shadow week (Combined 11, ours 7, 2 split in the blind review).
  [grounded forecast plan](plans/TASK_2026-10-17_grounded_forecast_and_cost.md)
