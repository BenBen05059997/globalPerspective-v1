# Status: in progress, parked, open decisions

Built from `git log --since=2026-10-17`, the plans in `plans/` and the decision records, read 2026-10-20; the pipeline table, the foundation roadmap line and the Done list re-checked 2026-10-22.
Update a line when its source changes; delete it when its source says done. Design: [ARCHITECTURE](architecture/ARCHITECTURE.md).

## Pipeline status (2026-10-22; ten stages, two clocks; stages as in architecture/ARCHITECTURE_TIMELINE.md §1b)
| # | Stage | Status |
|---|---|---|
| 1 | Ingest | **stopped**: DeepSeek out of credit since 2026-10-20 03:50Z (selector and map ingest fail; GDACS fine; the selector logged LLM 402 within the last 24 h on 2026-10-22); raw capture, RSS parser fix and selection rules in lane W (decision 0040), not deployed |
| 2 | Stories | live; join fixes deployed 2026-10-19; 18 old duplicate stories and a stale re-save of 10-19 under 10-20 remain; guards and same-run joins deployed 2026-10-20 14:20Z (first real test: the 20:25Z run); old duplicates wait for alias repair on the timeline |
| 3 | Daily notes | **stopped** (DeepSeek); forecast settling writes verdicts itself (resolver deployed 2026-10-20, decision 0034), but no verdict row has been written as of 2026-10-22 (zero in `GlobalPerspectivePredictionLog`), the resolver is not broken: it settles a weekly sample of 22 by design (0011) and drafts on Mondays, so the first possible verdict is Monday 2026-10-26 |
| 4 | One reader | built (`backend/shared/src/world/`, provenance, JSONL helper); board uses it; lane B switched; lane C switching; two more readers in progress for lane B |
| 5 | Facts | `newsStoryRecord` facts writer live: rule `TriggerStoryRecord` cron(45 23 * * ? *), first run 2026-10-22 23:45Z; `record/facts/` holds 2026-09-05..2026-10-22, 19 days hold only a Run (archive row missing, not reconstructable); no model steps; no Run alarm (parked) |
| 6 | Review | not started: `newsRecordReview` is planned (§8 steps 3-4: golden week, then first run) |
| 7 | Views | pages still read raw tables; board slice 1 live; `record/views/` is built (2026-10-22: 519 stories, `factsThrough` 2026-10-19; `newsStoryRecord` with links rule and exact entry time, `newsBoard` reading the views, both deployed, IAM applied); the Worker upload (live Worker cc57a42f cannot serve `record/views/`) and the board UI release are not done, so no reader sees them yet; story-view readings wait for the review |
| 8 | Weekly report | W1-W3 built on lane/weekly (B) with an interim live-table pull; final design reads the week's readings after the review; final dry run waits for two shared readers |
| 9 | Delivery | live; the Sunday email still sends the old weekly; the deployed Worker (cc57a42f) cannot serve `weekly/` or `record/` (the repo copy allows `record/views/` and also carries an unreleased `/analyze` redirect; upload not done) |
| 10 | Watch | low-balance alerts live; **freshness monitor paused** 2026-10-20 ~14:40Z (rule `TriggerFreshnessMonitor` DISABLED: it re-sent "content stale" every 2 h during the DeepSeek outage; also pauses the daily settle check). Re-enable after the DeepSeek top-up or lane G's dedupe, whichever is first. No alarm on the model failure yet; two alert topics |

## Deployed 2026-10-20 ~15:20Z (lanes F and G, main f03ab32b)
- Lambdas: newsInvokeGemini-dev, NewsProjectInvokeAgentLambda-dev, newsPredictionResolver, newsSituationIngest,
  newsSituationTracker, newsSensitiveData-dev (seven dead actions removed), newsWeeklyBrief, newsSourceAudit,
  newsFreshnessMonitor (rule still paused). newsClientErrors Function URL CORS now allows www and localhost.
- Smoke: every page action 200, removed `world_overview` 400, `/` and a story page 200, no Lambda errors after deploy.
- Held for the alerts review: the alarm spec in `backend/monitoring/alarms/` (new alarms, one topic).

## Roadmap (order and dependencies, 2026-10-20)
1. **DeepSeek top-up** (operator): every LLM Lambda fails with 402 since 2026-10-20 03:50Z; nothing new is processed.
2. **One world reader** `backend/shared/src/world/` (coordinator, on main) → lanes B and C switch to it before DONE;
   `newsBoard` switches with a redeploy.
3. **Weekly W2-W3** (lane B) → test email (operator yes) → Saturday 2026-10-24 run → Sunday switch (operator yes).
4. **Story pipeline fixes** (lane D): verify the 2026-10-19 join fixes, merge the 18 old duplicates, close the join gaps,
   stale-run guard, a 402 alarm (operator yes). **Must precede step 5**, or the record stores split stories as truth.
5. **Foundation, steps 0-5 of [the plan](plans/PLAN_2026-10-21_foundation.md)** (decision 0035; each step waits for its own go): (0) done: missing
   archive days diagnosed; (1) done: Ingest writes facts, scheduled daily; (2) views builder and `newsBoard` reader deployed with IAM applied (2026-10-22); still open: Worker
   upload and the board UI release (operator yes each); (2b) record quality gaps (links rule,
   exact times, the open forecast loop); (3) `newsRecordReview` weekly, golden-week fixture first; (4) retire duplicates and parsers
   (operator yes each); (5) remove the world DynamoDB rows after the rebuild test.
6. Weekly becomes a view of the week's readings (after the review); weekly page; cloud schedule.
7. Board slice 2 (lines, branch status, tree, arrivals, the board's weekly) fills in once readings exist.
Plans: [foundation](plans/PLAN_2026-10-21_foundation.md), [weekly](plans/PLAN_2026-10-20_analyst_weekly.md),
[board](plans/PLAN_2026-10-20_board.md). Lanes and mailbox: `/Users/benlai/Downloads/gp-mailbox/`.

## In progress
- Website release shipped 2026-10-20 (Pages, front Worker, situation Lambdas, smoke checks, desktop click-through).
  Left: phone-width click-through. [linking plan, section R](plans/PLAN_2026-10-19_linking_and_pages.md)
- Cloudflare migration: local build done, candidate uploaded but cannot load data (read API CORS allows only
  the site origins); cutover gated. [linking plan, R](plans/PLAN_2026-10-19_linking_and_pages.md),
  [migration plan](plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md)
- Layered story selection (P7): `newsSelectionShadow` has run since 2026-10-18; shadow week ends about
  2026-10-25, then the operator decides. P1 prompt v2b is prepared and awaits a yes.
  [grounded forecast plan](plans/PLAN_2026-10-22_forecast_loop.md)
- Map colour consistency: C3, C4, C7 done; four unverified small bugs left.
  [colour plan](plans/PLAN_2026-10-19_colour_consistency.md)
- Back-end hygiene: 4 Lambdas stay on `nodejs20.x` on purpose (newsAnalyze and newsPolarBilling, each with its
  sandbox); dead non-secret env keys reported, not removed; retired model default string in `newsPostDevTo`.
  [cleanup plan](plans/PLAN_2026-10-20_decisions_and_cleanup.md)

## Done
- 2026-10-20: board slice 1 live (`/board`, `newsBoard`); the resolver deployed to write verdicts itself (decision 0034; none written yet);
  weekly W0 (`backend/weekly/` schema and section model).
- 2026-10-22: facts writer scheduled and live (`TriggerStoryRecord`); `record/facts/` filled from 2026-09-05; `record/views/` built and `newsBoard` reading it.
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
  [grounded forecast plan](plans/PLAN_2026-10-22_forecast_loop.md)
