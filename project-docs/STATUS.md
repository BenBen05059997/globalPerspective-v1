# Status: in progress, parked, open decisions

Built from `git log --since=2026-10-17`, the plans in `plans/` and the decision records, read 2026-10-20; the pipeline table, the foundation roadmap line and the Done list re-checked 2026-10-23; recovery, story continuity and the gap benchmark 2026-10-24.
Update a line when its source changes; delete it when its source says done. Design: [ARCHITECTURE](architecture/ARCHITECTURE.md).

## Start here (handoff 2026-10-26, moving to a new Mac)
- Session role: one coordinator session monitors, reviews, merges, deploys and keeps docs; every code change goes to a lane or a Sonnet sub-agent.
- Board: operator decided 2026-10-24 to build the whole board to the design canvas first (fixtures), then wire data one element at a time. Lane B0 (live defects) is released (4d31cd28). Next: the operator answers the 117-item design check page (https://claude.ai/artifact/NNBZv4WWDoHFuRGwVXCNGE, answers in its `decisions` collection); then one lane per artboard in the order in [the board plan](plans/PLAN_2026-10-20_board.md) (graph, tree, zoom ladder, verdict, weekly, arrivals, summary, presets, divergence, folding, alerts, map). Design canvas: https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo. B0 still needs a signed-in look.
- Waiting on the operator: DeepSeek top-up (402 since 2026-10-20). After it: watch the first selection, verdicts and a 2-3 story review canary; rebuild the gap-benchmark answer key and score DeepSeek on it; yeses to enable `TriggerRecordReview` and the legacy void job.
- Small open items: `newsInvokeGemini-dev` deployed code is behind the repo (shared RSS parser refactor, same behaviour; routine redeploy). `lane/weekly` and `lane/routine` (analyst weekly, 2026-10-20/21) are on GitHub unmerged; review against the new record before merging.
- Lost 2026-10-25: the mailbox `~/Downloads/gp-mailbox/` (lane briefs and reports, board review notes, judge and gap benchmark files). References to it in the plans point at files that no longer exist. Keep future lane briefs in the repo under an ignored folder.

## Pipeline status (2026-10-23; ten stages, two clocks; stages as in architecture/ARCHITECTURE_TIMELINE.md §1b)
Deployed = running in AWS (CodeSha256 read 2026-10-23); merged = on main, not in AWS.
| # | Stage | Status |
|---|---|---|
| 1 | Ingest | **model stopped**: DeepSeek out of credit since 2026-10-20 03:50Z (the selector last logged `LLM 402` at 2026-10-22 20:18Z). Raw capture is deployed and live (`newsInvokeGemini-dev` 2026-10-22 09:26Z, 25 items fetched and 8 in the prompt per feed, done-not-said, code dedupe, significance floor; 0040): `record/inbox/articles/` holds 2026-10-19..10-24 from live capture plus the 17 recovered days (read 2026-10-24) whatever the model does; the selection rules take effect once DeepSeek is funded. GDACS fine |
| 2 | Stories | draw rules and `PRED#` thread reconciliation deployed (`NewsProjectInvokeAgentLambda-dev` 2026-10-22 23:51Z): at most 3 outcomes per story per week, gates, forecasts reconciled to the entry's final thread; they apply from the first funded run. Join fixes and guards deployed earlier; 18 old duplicate stories wait for merges; 93 historical orphan forecasts wait for the operator's redirect |
| 3 | Daily notes | **stopped** (DeepSeek). The forecast loop's resolver half is **deployed** (`newsPredictionResolver` rebuilt code, 2026-10-23, CodeSha256 UHqPWXy/...; env gained `WORLD_BUCKET`, memory 512 MB, role gained `newsPredictionResolver-runs`): watch from the record, own-entry evidence (since 2026-10-24, lane AK, CodeSha256 tbBwVDkm...: also operator-assigned recovered articles as headline-only evidence, reassigned entries and merged stories; reads from the earliest window start to today) (no web search; `search.js` is gone), boxed judge, coverage guard, verdict inbox `record/inbox/verdicts/`. First watch invoke (no writes): 5,006 question branches on 315 threads, 0 moved threads (no entry facts since DeepSeek stopped), 40 grace candidates, 98 over the 60 cap. With DeepSeek unfunded (HTTP 402) drafts are written as `needs_human`; rule-made `no` verdicts still land when coverage is complete. Shadow mode does not suppress DynamoDB writes, only moves the inbox line to `record/shadow/inbox/verdicts/`. `BRAVE_SEARCH_API_KEY` and `GROK_MODEL` stay in the env, unused, until the build is accepted (rollback needs the Brave key) |
| 4 | One reader | built (`backend/shared/src/world/`, provenance, JSONL helper); board uses it; other readers still parse raw rows |
| 5 | Facts | deployed and live: `newsStoryRecord` (lane AJ build, CodeSha256 IuHfVvVg..., 2026-10-24; an `assignment` may name an `article` fact and the views place it on the story as a recovered entry, counts `articlesPlaced`) via rule `TriggerStoryRecord` cron(45 23 * * ? *); `record/facts/` holds 50 days, 2026-09-05..2026-10-24 (read 2026-10-24; the 17 archive-missing gap days now hold recovered article facts; 10-21..10-24 hold raw articles only while DeepSeek is unfunded). Recovered days (17, 2026-09-14..29 and 10-14) are in the record from 2026-10-24. Kinds: entry, article (converted even when the archive day is missing; the Run carries `inputs.rawDay`, `counts.articles`), assignment (929 ingest assignments backfilled; operator and review assignments through `record/inbox/assignments/`), story_born, forecast_drawn, verdict (from the inbox), story_merged, story_split, correction, run. No Run alarm (parked) |
| 6 | Review | **deployed, rule disabled**: `newsRecordReview` created 2026-10-23 (nodejs22.x, 1024 MB, 900 s, role `newsRecordReview-role`, `REVIEW_MODEL=deepseek-v4-pro`); rule `TriggerRecordReview` cron(0 1 ? * MON *) is DISABLED, payload `{"shadow":false}`. Dry run for 2026-W42 (no model, no writes) selected 502 of 519 active stories, skipped 17 (`no_facts_by_week_end`). No readings written yet. Next: DeepSeek top-up, golden-week score, a 2-3 story canary with `threadIds`, then enable the rule (operator yes) |
| 7 | Views | deployed and live (open: the weekly review's `select.js` reads raw `entry` facts by threadId and does not yet see placed articles): `record/views/` rebuilt by every facts run (manifest runId 2026-10-22-9, `factsThrough` 2026-10-22); follows the latest assignment per entry; maps aliases to canonical `wd:Q...` ids and keeps generic actors out of links. The who's who file `record/operator/aliases.json` is still empty (operator-owned; `cli/reconcile-actors.mjs` proposes entries), so actors keep `name:` ids. Reading fields stay `null` until the review runs |
| 8 | Weekly report | W1-W3 built on lane/weekly with an interim live-table pull; the final design reads the week's readings after the review; final dry run waits for two shared readers |
| 9 | Delivery | live; the Worker serves `record/views/` (version `1e17cf9a`, uploaded 2026-10-22; the repo copy's `/analyze` redirect is not uploaded); `newsBoard` (2026-10-22 07:04Z) reads the views and the board UI is released (bundle `index-CWK5qz3j.js`, 2026-10-22); not yet clicked signed in by the operator. The Sunday email still sends the old weekly |
| 10 | Watch | low-balance alerts live; **freshness monitor paused** (rule `TriggerFreshnessMonitor` DISABLED since 2026-10-20: it re-sent "content stale" every 2 h during the DeepSeek outage). Re-enable after the DeepSeek top-up or the alert dedupe. No alarm on the model failure or the Run objects; two alert topics |

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
   archive days diagnosed; (1) done: Ingest writes facts, scheduled daily; (2) done: views builder, `newsBoard` reader, Worker allowlist and board UI released
   (2026-10-22); (2b) record quality gaps: story continuity worked 2026-10-24 (7 operator `story_merged` facts via `record/inbox/merges/`, 10 proposed matches held; 243 operator assignments place recovered articles on 88 stories, lane AJ; the gap benchmark `gp-mailbox/artifacts/gap-benchmark/` is the answer key, 448 legacy branches, scored offline by `predictions/score-gap-benchmark.mjs`), links rule and exact times done, the forecast loop's resolver half deployed 2026-10-23, actor identity
   waits on the who's who file; (2c) raw before model (0040): capture, article and assignment facts deployed, recovery done 2026-10-24 (17 days, 2026-09-14..29 and 10-14, every Run `ok` with `inputs.recovered:true`; `backend/record/cli/recover-day.mjs`, GDELT GKG raw files by default, about 25k `article` facts; outlets GDELT lacks stay dark by operator decision), the Run alarm open;
   (3) `newsRecordReview` weekly, deployed 2026-10-23 with its rule disabled; golden-week score and canary first, then enable; (4) retire duplicates and parsers
   (operator yes each); (5) remove the world DynamoDB rows after the rebuild test.
6. Weekly becomes a view of the week's readings (after the review); weekly page; cloud schedule.
7. Board slice 2 (lines, branch status, tree, arrivals, the board's weekly) fills in once readings exist.
Plans: [foundation](plans/PLAN_2026-10-21_foundation.md), [weekly](plans/PLAN_2026-10-20_analyst_weekly.md),
[board](plans/PLAN_2026-10-20_board.md). Lanes: see Start here.

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
- 2026-10-22: facts writer scheduled and live (`TriggerStoryRecord`); `record/facts/` filled from 2026-09-05; `record/views/` built, `newsBoard` reading it, Worker serving it, board UI released.
- 2026-10-22/23: raw capture (selector to `record/inbox/articles/`, `article` facts), assignment facts (929 backfilled), canonical actor ids in the views, `PRED#` thread reconciliation, draw rules: deployed (decision 0040, 0038 draw half).
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
