# Start here

Code and live AWS are the truth; docs hold intent and decisions (decisions/0021, 0026). Old docs are deleted, git history keeps them.

## 1. Map
Read order (at most 12; stop when you have what the task needs):
1. [CLAUDE.md](../CLAUDE.md): rules, authorization, verify.
2. This file: the map and where we left off.
3. [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md): the system map.
4. [architecture/ARCHITECTURE_TIMELINE.md](architecture/ARCHITECTURE_TIMELINE.md): the record (facts, readings, views); the stage list as data is [pipeline.json](architecture/pipeline.json).
5. [architecture/DATA_STRATEGY.md](architecture/DATA_STRATEGY.md): storage rules and prefix owners.
6. [decisions/README.md](decisions/README.md): the index; open a record only when touching its area.
7. One area doc: [forecast loop](architecture/ARCHITECTURE_FORECAST_LOOP.md) · [weekly review](architecture/ARCHITECTURE_WEEKLY_REVIEW.md) · [board](architecture/ARCHITECTURE_BOARD.md) · [ops](architecture/ARCHITECTURE_OPS.md).
8. [architecture/STEP5_AUDIT.md](architecture/STEP5_AUDIT.md): only while step 5 is open; delete it when done.
9. `backend/<group>/README.md` for the area (a map of its Lambdas).
10. `backend/<group>/<name>/README.md` or `global-perspectives-starter/frontend/src/features/<name>/README.md` for the code being changed (checked by `quality/check_docs.mjs`).
11. On demand: [WORLD_MODEL.md](architecture/WORLD_MODEL.md) (ontology), [COSTS.md](architecture/COSTS.md) (spend), [quality/SEVERITY_CODEBOOK.md](../quality/SEVERITY_CODEBOOK.md), `.claude/skills/deploy-frontend/` (releases).
12. Never needed for orientation: the root `README.md` (GitHub landing page), `.agents/**`, `internal-docs/LEGAL_NOTES.md`.

- Code lives in: Lambdas `backend/<group>/<name>/src/` (shared helpers `backend/shared/src/`, deployed name to dir in `scripts/functions.json`); frontend `global-perspectives-starter/frontend/src/` (`app/` -> `features/` -> `shared/`); edge `cloudflare/front-worker/`; checks `quality/`; forecast harnesses `predictions/`.
- Facts come from code and live AWS: `aws lambda list-functions`, `aws events list-rules`, `aws scheduler list-schedules`, `App.jsx`, the served bundle hash. Never trust a doc for state.

## 2. Where we left off (2026-11-06)
Working model: one coordinator session reviews, merges and deploys; lanes (git worktrees) or Sonnet agents build. Stale docs are found and rewritten whole by Sonnet agents, checked against code and AWS. Lane briefs go in `.board/` (ignored via `.git/info/exclude`); page-check sessions keep their rules, releases and a status file per page group in `.board/pages/` (the account and static pages are not checked yet, design undecided). Dev machine is an Apple-silicon Mac; Lambdas stay x86_64 (`scripts/lambda.sh` cross-installs linux/x64 deps). The site serves bundle `index-De4cN7vP` (2026-11-06 00:27 JST, release 431fc4b1: the breaking bell and strip are switched off, briefings names editions by date (never Today/Yesterday) and drops the weekly fallback note; the previous release was `index-CMWPIc99` at 2026-11-06 00:06 JST). Front Worker `globalperspective-rss` version b008ad10 since 2026-11-05 23:15 JST (HEAD like GET, immutable hashed assets, 404 status for unknown paths; rollback version 03d556c8).

Foundation (the site rebuilds from the record alone, decision 0035): steps 0-4 are done; the weekly review `newsRecordReview` is live (`TriggerRecordReview`, Mon 01:00 UTC). Pipeline alarms were removed by the operator's choice. `newsHealth` and the `/ops` page are live ([ARCHITECTURE_OPS.md](architecture/ARCHITECTURE_OPS.md)).

Step 5, retire the DynamoDB world tables (operator 2026-10-31): flags, blockers and order of work are in [STEP5_AUDIT.md](architecture/STEP5_AUDIT.md); decisions [0053](decisions/0053-country-and-story-readers-on-notes.md) to [0056](decisions/0056-models-by-measured-quality.md); the board rounds in [ARCHITECTURE_BOARD.md](architecture/ARCHITECTURE_BOARD.md) section 10. Open:
- Reader switches move from `compare` to the record only at zero differences; next: `newsEmailSender` after its first compare (Sun 8 Nov 14:00Z), the five daily Lambdas' `ARCHIVE_READS` after 3 clean nights, `newsIngest` still reads `archive#` titles directly.
- Read API actions without a record path, writers still putting to DynamoDB, then export and delete per family, each with an operator yes (STEP5_AUDIT sections 3, 4, 6).
- Forecast loop ([0055](decisions/0055-sampled-first-and-record-gap-void.md), deployed 4 Nov): watch the resolver logs for `sampled`, `others`, `overflow`. Record gaps 13-14 Oct and 21-24 Oct.
- Models ([0056](decisions/0056-models-by-measured-quality.md)): review, systems analysis, daily brief and `newsIngest` (since 2026-11-04) on Flash; country briefings, forecasts and the weekly brief stay on Pro. The review canary on 25 live W44 stories found uncited "pending" clauses, so the prompt is review-5; gates passed on Flash.
- Still on the old path: the Sunday digest (`TriggerWeeklyBrief`, `TriggerWeeklyEmailSend`); `TriggerSelectionShadow` is still ENABLED (04:20/12:20/20:20 UTC) past its planned end; `newsIngest` was redeployed 2026-11-04 (commit c9948088), so the deployed zip is no longer older than the repo.
- Alert emails and schedules (operator, chat, 2026-11-05/06 JST): `TriggerErrorDigest` DISABLED (~00:15; the `/ops` Quality panel covers client errors); `newsSourceAudit` has no `SNS_TOPIC_ARN` (~00:15; it still runs Mon/Wed/Fri and logs `[audit]` lines for `/ops`, emails nothing); `newsModelGuard` (DeepSeek balance) is the one alert email kept on `GlobalPerspectiveAlerts`; `TriggerFreshnessMonitor` is still ENABLED and is to be disabled once `newsHealth` goes `HEAL=dry` to `HEAL=on` (planned 6 Nov after the first dry tick is reviewed, not done). Breaking alerts are paused for a redesign: `newsBreakingAlert` `DRY_RUN=true` (~00:20) and `TriggerBreakingAlert` DISABLED (~00:25); before that it had emailed 7 proposals, none confirmed. The bell and strip are being unmounted in a separate frontend change, not released yet. The weekly subscriber email (`TriggerWeeklyEmailSend`) is unchanged and ENABLED.
- Old-name Lambdas: `newsInvokeGemini-dev` and `NewsProjectInvokeAgentLambda-dev` were deleted 2026-11-05 (operator yes); `newsPostDevTo` and `newsSensitiveData-dev` still exist, unscheduled and deploy-blocked, until the operator deletes them. Schedule names and env `GROK_*`/`XAI_*` are not renamed yet (STEP5_AUDIT).
- Open PRs #40-#44 (frontend dependencies, held for a release day) and #45-#49 (security, accessibility, docs fixes), read 2026-11-04.

Waiting on the operator:
1. Board decisions: a board summary writer (model and price), a schema field for alert choices, a coverage note in the board feed. Design canvas: https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo; overview: https://claude.ai/artifact/69GUFsy8aSACTZYvMpvpyd. Delete the test board "QA test 2026-11-03" on the operator's account.
2. Derive `iso3` from old `regions` for history ([0047](decisions/0047-history-before-record.md)).
3. Selection go (P7d) and one ingest or two ([0057](decisions/0057-one-ingest-or-two.md), proposed); gap benchmark rebuild or drop; the Cloudflare cutover steps ([decision 0019](decisions/0019-frontend-hosting-two-worker-cloudflare.md), [front-worker README](../cloudflare/front-worker/README.md)); delete the leftover untracked `amplify/` (about 56 files).
4. AWS CLI is signed in as the root user; an Identity Center or admin-user login is safer.
5. `newsAnalyze` versus repo: the deployed zip differs from the repo (parked credits code); leave it or remove the Lambda (billing code: needs yes). `newsAnalyze` and `newsPolarBilling` stay on `nodejs20.x`.

Open smaller items:
- Foundation leftovers: [ARCHITECTURE_TIMELINE.md](architecture/ARCHITECTURE_TIMELINE.md) section 7.
- Colour bugs unverified: map labels clip at the right edge and Europe labels overlap; Alerts list and Intel feed show the same stories on home; the country list "Highest Risk" rail should sort by score (`features/countries/CountryListPage.jsx`).
- Record data: over-joined threads and duplicate stories the review cannot merge without neighbours; the review flags off-story entries as assignment proposals in the readings.
- `deepseek-v4-flash` default string in `newsDailyBrief`.

Parked (each has a decision record): analysis credits (0002); breaking and drift email rules DISABLED until the first follower (`TriggerBreakingEmailSend`, `TriggerDriftEmailSend`). Paused without a record yet: the breaking alert (`TriggerBreakingAlert` DISABLED, `DRY_RUN=true`, redesign to come).
