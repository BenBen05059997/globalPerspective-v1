# Status: in progress, parked, open decisions

Built from `git log --since=2026-10-17`, the plans in `plans/` and the decision records, read 2026-10-20.
Update a line when its source changes; delete it when its source says done. Design: [ARCHITECTURE](architecture/ARCHITECTURE.md).

## Pipeline status (2026-10-21; ten stages, two clocks; stages as in architecture/ARCHITECTURE_TIMELINE.md §1b)
| # | Stage | Status |
|---|---|---|
| 1 | Ingest | **stopped**: DeepSeek out of credit since 03:50Z (selector and map ingest fail; GDACS fine) |
| 2 | Stories | live; join fixes deployed 2026-10-19; 18 old duplicate stories and a stale re-save of 10-19 under 10-20 remain; guards and same-run joins deployed 2026-10-20 14:20Z (first real test: the 20:25Z run); old duplicates wait for alias repair on the timeline |
| 3 | Daily notes | **stopped** (DeepSeek); forecast settling writes verdicts itself since today, first ~10-24 |
| 4 | One reader | built (`backend/shared/src/world/`, provenance, JSONL helper); board uses it; lane B switched; lane C switching; two more readers in progress for lane B |
| 5 | Facts | `newsStoryRecord` deployed in shadow only, no schedule; per-day model steps still in the code (removal is §8 step 1); history keeps expiring until a scheduled run and backfill exist |
| 6 | Review | not started: `newsRecordReview` is planned (§8 steps 3-4: golden week, then first run) |
| 7 | Views | pages still read raw tables; board slice 1 live; record views exist only in shadow (facts-only views from `newsStoryRecord`, story views wait for the review) |
| 8 | Weekly report | W1-W3 built on lane/weekly (B) with an interim live-table pull; final design reads the week's readings after the review; final dry run waits for two shared readers |
| 9 | Delivery | live; the Sunday email still sends the old weekly; Worker cannot serve `weekly/` or `record/` yet |
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
5. **Record, in the order of ARCHITECTURE_TIMELINE.md §8** (each step waits for its own go): (1) daily facts writer on a
   schedule, shadow prefix first, with backfill before the raw TTLs erase more history; the per-day model steps are removed;
   (2) docs; (3) golden-week fixture; (4) `newsRecordReview` (weekly readings, runs), first run on the golden week;
   (5) board reads readings, the unsettled zone, and the Worker allowlist for `record/` (operator yes).
6. Weekly becomes a view of the week's readings (after the review); weekly page; cloud schedule.
7. Board slice 2 (lines, branch status, tree, arrivals, the board's weekly) fills in once readings exist.
Plans: [record](plans/PLAN_2026-10-20_record_backend.md), [weekly](plans/PLAN_2026-10-20_analyst_weekly.md),
[board](plans/PLAN_2026-10-20_board.md). Lanes and mailbox: `/Users/benlai/Downloads/gp-mailbox/`.

## In progress
- Website release shipped 2026-10-20 (Pages, front Worker, situation Lambdas, smoke checks, desktop click-through).
  Left: phone-width click-through. [linking plan, section R](plans/PLAN_2026-10-19_linking_and_pages.md)
- Cloudflare migration: local build done, candidate uploaded but cannot load data (read API CORS allows only
  the site origins); cutover gated. [linking plan, R](plans/PLAN_2026-10-19_linking_and_pages.md),
  [migration plan](plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md)
- Layered story selection (P7): `newsSelectionShadow` has run since 2026-10-18; shadow week ends about
  2026-10-25, then the operator decides. P1 prompt v2b is prepared and awaits a yes.
  [grounded forecast plan](plans/TASK_2026-10-17_grounded_forecast_and_cost.md)
- Map colour consistency: C3, C4, C7 done; four unverified small bugs left.
  [colour plan](plans/PLAN_2026-10-19_colour_consistency.md)
- Back-end hygiene: 4 Lambdas stay on `nodejs20.x` on purpose (newsAnalyze and newsPolarBilling, each with its
  sandbox); dead non-secret env keys reported, not removed; retired model default string in `newsPostDevTo`.
  [cleanup plan](plans/PLAN_2026-10-20_decisions_and_cleanup.md)

## Done
- 2026-10-20: board slice 1 live (`/board`, `newsBoard`); the resolver writes verdicts itself (decision 0034);
  weekly W0 (`backend/weekly/` schema and section model).
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
