# Start here

Code and live AWS are the truth; docs hold intent and decisions (decisions/0021, 0026). Old docs are deleted, git history keeps them.

## 1. Map
Read order: `CLAUDE.md` -> this file -> [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) -> the architecture doc for your area -> [decisions/README.md](decisions/README.md).
- Areas: [the record](architecture/ARCHITECTURE_TIMELINE.md) (facts, readings, views; stage list in [pipeline.json](architecture/pipeline.json)) · [forecast loop](architecture/ARCHITECTURE_FORECAST_LOOP.md) · [weekly review and analyst weekly](architecture/ARCHITECTURE_WEEKLY_REVIEW.md) · [board](architecture/ARCHITECTURE_BOARD.md) · [ingest proposal](architecture/ARCHITECTURE_INGEST_DESIGN.md) · [storage rules](architecture/DATA_STRATEGY.md) · [world model](architecture/WORLD_MODEL.md) · [step 5 audit](architecture/STEP5_AUDIT.md).
- Next to code: `backend/<group>/README.md`, `backend/<group>/<name>/README.md`, `global-perspectives-starter/frontend/src/features/<name>/README.md` (checked by `quality/check_docs.mjs`).
- Code lives in: Lambdas `backend/<group>/<name>/src/` (shared helpers `backend/shared/src/`, deployed name to dir in `scripts/functions.json`); frontend `global-perspectives-starter/frontend/src/` (`app/` -> `features/` -> `shared/`); edge `cloudflare/front-worker/`; checks `quality/`; forecast harnesses `predictions/`; severity rubric `quality/SEVERITY_CODEBOOK.md`.
- Deploy: frontend through `./deploy.sh` and `.claude/skills/deploy-frontend/` (targets need a fresh yes); Lambdas through `scripts/lambda.sh <name> diff|package|deploy|rollback` (diff first; the deployed zip can differ from the repo).
- Facts come from code and live AWS: `aws lambda list-functions`, `aws events list-rules`, `aws scheduler list-schedules`, `App.jsx`, the served bundle hash. Never trust a doc for state.

## 2. Where we left off (2026-11-01)
Working model: one coordinator session reviews, merges and deploys; lanes (git worktrees) or Sonnet agents build. Stale docs are found and rewritten whole by Sonnet agents, checked against code and AWS. Lane briefs go in `.board/` (ignored via `.git/info/exclude`). Dev machine is an Apple-silicon Mac; Lambdas stay x86_64 (`scripts/lambda.sh` cross-installs linux/x64 deps). Pages serves bundle `index-Upg1U2VW`.

Foundation (goal: the site rebuilds from the record alone, decision 0035): steps 0-4 are done. Notes live in the record (0042), and the story, country, track record, list and archive pages read views (0043 to 0046). Weekly review `newsRecordReview` is live (`TriggerRecordReview`, Mon 01:00 UTC); the first full run (W44, about 520 stories) is Mon 2026-11-02. Pipeline alarms were removed by the operator choice. The countries list still reads `archive_range`.

Step 5 (retire the DynamoDB world tables; operator 2026-10-31; order and preconditions in [STEP5_AUDIT.md](architecture/STEP5_AUDIT.md)). Done:
- Record holds history from 2026-03-07 (0047), briefs (0048), fresh views after each ingest (0050), the entries inbox and today view (0051), the forecasts inbox (0052). The economy product and all its AWS resources are deleted (0049; export under `backup/economy-2026-10-31/`).
- Readers have flags (`NOTES_READS`, `RECORD_READS`, `QUESTIONS_SOURCE`, `ENTRIES_SOURCE`) in compare mode (0053, 0054): `newsBoard` has `RECORD_READS=compare`; `newsPostDevTo`, `newsCountryIntelligence` and the resolver compare; `newsEmailSender` is held until after the Sunday send; `newsStoryRecord` has `ENTRIES_SOURCE=compare`. Writers: `newsWeeklyBrief` and `newsCountryFactsUpdater` still write `NOTES_PREFIX=record/shadow/`. Frontend and the front Worker pre-render read the views. Read `[notes-compare]`, `[record-reads]`, `[questions-compare]`, `[entries-compare]` and `[forecasts-compare]` log lines; switch each reader only at zero differences.
- Scope: world tables go (SummarizeAndPredict, NewsCache, PredictionLog `PRED#`); user tables (0003), EMAILLOG, BreakingAlerts, ClientErrors and the PredictionLog commitment state stay.
- Board: built and live (waves 1 and 2, design rule in ARCHITECTURE_BOARD.md). Live-data fixes released 2026-11-01 (bundle `index-Upg1U2VW`), `newsBoard` memory 1024 MB, and the operator's signed-in board was checked in Chrome by the coordinator. Presets are settled (0054 and ARCHITECTURE_BOARD.md).

Step 5 plan from here (set 2026-10-31; times UTC; each switch only at zero differences, each delete with an operator yes after an S3 export):
1. Sat 31 Oct 20:25 agent run: first `[inbox] forecasts:` shadow line; if it matches, copy the shadow forecasts inbox to `record/inbox/forecasts/`, agent `FORECASTS_INBOX_PREFIX=record/`, newsStoryRecord `FORECASTS_SOURCE=compare`.
2. Sat 31 Oct 23:45 nightly build: first full 30-day `[entries-compare]`; at 0 differences newsStoryRecord `ENTRIES_SOURCE=inbox`.
3. Sun 1 Nov 06:00 weekly brief note (shadow); if it equals the row, newsWeeklyBrief `NOTES_PREFIX=record/`. All day: read the `[notes-compare]`, `[record-reads]`, `[questions-compare]`, `[forecasts-compare]` lines; switch each reader at 0 differences (read API, newsPostDevTo, newsBreakingAlert, newsPostLinkedin, newsRecommend, newsCountryIntelligence, newsDriftCorrector, newsSystemsAnalysis, newsWeeklyBrief, resolver, newsBoard). 14:00 weekly email as usual, then newsEmailSender to compare, then record.
4. Mon 2 Nov 01:00 first full weekly review (about 520 stories: lines and chapters for the board and the story page); 05:00 JST first country facts note (newsCountryFactsUpdater `NOTES_PREFIX=record/` if it matches).
5. Build (Claude): provisional forecasts in the views refresh; story page and readers off `prediction_snapshot`; retire `newsPredictionsSnapshot` and `PredictionLogScan`.
6. Midweek, operator yes each: delete the world rows family by family in the STEP5_AUDIT order, each after an export to `backup/`; full rebuild test after each; then remove the DynamoDB read paths and the compare flags (one reader per family).
Goal at the end: the record is the only store for world data; pages and jobs read views built from it; user data, billing, BreakingAlerts, ClientErrors and the PredictionLog commitment state stay in DynamoDB (operator scope 2026-10-31).

Still on the old path: the old Sunday digest (`TriggerWeeklyBrief`, `TriggerWeeklyEmailSend`, 2 recipients); the analyst weekly W1-W3 on unmerged `lane/weekly` and `lane/routine`; `TriggerSelectionShadow` still ENABLED (04:20/12:20/20:20 UTC) past its planned end; `newsInvokeGemini-dev` behind the repo (same behaviour).

Waiting on the operator:
1. Analyst weekly: build it on the readings, rewrite, or drop (ARCHITECTURE_WEEKLY_REVIEW.md section 9).
2. Board decisions: a board summary writer (model and price), a schema field for alert choices, a coverage note in the board feed. Design canvas: https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo; overview: https://claude.ai/artifact/69GUFsy8aSACTZYvMpvpyd.
3. Countries list: adopt the record's article counts (0046) or keep `archive_range` until step 5; derive `iso3` from old `regions` for history (0047).
4. Selection go (P7d); gap benchmark rebuild or drop; Cloudflare cutover steps; delete the leftover untracked `amplify/` (about 56 files).
5. AWS CLI is signed in as the root user; an Identity Center or admin-user login is safer.

Open smaller items:
- Cloudflare: capture DNS/TLS/ruleset state, candidate upload, test host `next.globalperspective.net`, front-Worker `/blog` passthrough, observation window, add `BOARD_ENDPOINT` to `REQUIRED_CONFIG_FIELDS`.
- Foundation leftovers (ARCHITECTURE_TIMELINE.md section 7): the full rebuild test, parser moves to `world/`, the retire list, LatAm and SEA feeds, 2 of 83 `NewsProjectInvokeAgent` tests failing on main, 41 archive days missing everywhere.
- Colour bugs unverified: map labels clip at the right edge and Europe labels overlap; Alerts list and Intel feed show the same stories on home; the country list "Highest Risk" rail should sort by score (`features/countries/CountryListPage.jsx`).
- Record data: over-joined threads (us-court ae75a8 holds about 20 unrelated entries) and duplicate stories the review cannot merge without neighbours (Amazon 35a31e/c5bce9/da86ee, Canadian base fire 6822c0/bf3dd0); the review flags off-story entries as assignment proposals in the readings.
- Backend hygiene: `newsAnalyze` and `newsPolarBilling` (each with sandbox) stay on `nodejs20.x`; `deepseek-v4-flash` default string in `newsPostDevTo`; deployed `newsAnalyze` differs from the repo by about 126 lines (parked credits code): leave it or remove the Lambda (billing code: needs yes).

Parked (each has a decision record): analysis credits (0002); impact audit (0015); Signals API (0032, without the economic signal); breaking and drift email rules DISABLED until the first follower (`TriggerBreakingEmailSend`, `TriggerDriftEmailSend`).

Open decisions: the hosting cutover (confirmed, steps pending); newsAnalyze versus repo; selection go; whether to merge the unmerged weekly branches; the five test users.
