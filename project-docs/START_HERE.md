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
Working model: one coordinator session reviews, merges and deploys; lanes (git worktrees) or Sonnet agents build. Stale docs are found and rewritten whole by Sonnet agents, checked against code and AWS. Lane briefs go in `.board/` (ignored via `.git/info/exclude`). Dev machine is an Apple-silicon Mac; Lambdas stay x86_64 (`scripts/lambda.sh` cross-installs linux/x64 deps). The served bundle is the one `docs/index.html` names.

Foundation (goal: the site rebuilds from the record alone, decision 0035): steps 0-4 are done. Notes live in the record (0042), and the story, country, track record, list and archive pages read views (0043 to 0046). Weekly review `newsRecordReview` is live (`TriggerRecordReview`, Mon 01:00 UTC); the first full run (W44, about 520 stories) is Mon 2026-11-02. Pipeline alarms were removed by the operator choice. The countries list still reads `archive_range`.

Step 5 (retire the DynamoDB world tables; operator 2026-10-31; audit of 2026-11-01 in [STEP5_AUDIT.md](architecture/STEP5_AUDIT.md)). Done:
- Record holds history from 2026-03-07 (0047), briefs (0048), fresh views after each ingest (0050), the entries inbox and today view (0051), the forecasts inbox (0052). The economy product is gone, and the `GlobalPerspectiveMarkets` table no longer exists (0049; export under `backup/economy-2026-10-31/`).
- Deleted from AWS 2026-11-01 with their rules, roles and logs: `newsPredictionsSnapshot`, `newsSignals`, `newsImpactAudit`, and `predictions/track_record.json`. `newsGdeltConflict` stays on purpose (operator 2026-11-01); nothing reads its output yet.
- Readers have flags (0053, 0054). `NOTES_READS` accepts only `ddb`, `notes` or `compare` (`backend/shared/src/noteReads.js`); the value `record` silently meant `ddb`. At about 12:15Z on 2026-11-01 it was set to `notes` on newsSensitiveData-dev, newsBreakingAlert, newsPostDevTo, newsWeeklyBrief, newsCountryIntelligence, newsDriftCorrector and newsSystemsAnalysis (checked live); the read API answers from notes. `RECORD_READS=record` on newsBoard, newsRecommend, newsPostLinkedin, newsPostDevTo, newsSensitiveData-dev and newsBreakingAlert still falls back to DynamoDB when a view has no answer or is over 9 h old.
- Other live flags: `newsStoryRecord` `ENTRIES_SOURCE=inbox` and `FORECASTS_SOURCE=compare`; newsPredictionResolver `QUESTIONS_SOURCE=compare`; agent `FORECASTS_INBOX_PREFIX=record/`; `NOTES_PREFIX=record/` on newsWeeklyBrief and the daily Lambdas; `newsCountryFactsUpdater` still `NOTES_PREFIX=record/shadow/` (Monday's check). `newsEmailSender` has no record path (deployed build from 2026-10-20). Read `[notes-compare]`, `[record-reads]`, `[questions-compare]`, `[entries-compare]`, `[forecasts-compare]` log lines; switch only at zero differences.
- Scope: world tables go (SummarizeAndPredict, NewsCache, PredictionLog `PRED#`); user tables (0003), EMAILLOG, BreakingAlerts, ClientErrors and the PredictionLog commitment state stay.
- Board: built and live (design rule in ARCHITECTURE_BOARD.md); live-data fixes released 2026-11-01; presets settled (0054).

The deletes of NewsCache and SummarizeAndPredict are not a midweek item: each needs code work first (blockers in STEP5_AUDIT.md sections 4 and 6). Order of work from here (times UTC; each switch only at zero differences, each delete with an operator yes after an S3 export):
Monday checks first: 2 Nov 01:00 first full weekly review (about 520 stories); 05:00 JST first country facts note (then newsCountryFactsUpdater `NOTES_PREFIX=record/`).
a. Tonight's 23:45Z forecasts compare, then `FORECASTS_SOURCE=inbox` and `QUESTIONS_SOURCE=record`. The PredictionLogScan IAM statement goes later (needs a yes).
b. `newsEmailSender` deploy (after today's 14:00Z weekly send) with a record path, then its `RECORD_READS`.
c. `newsBoard` server side on the record: in the code its web index and score histories now read the record behind `RECORD_READS` (commit 54788ebb); the deploy and the role grants it needs are pending (ARCHITECTURE_BOARD.md section 10).
d. The agent and the five daily Lambdas (thread analysis, systems, country intelligence, drift, weekly brief) read the record (entries inbox/facts, forecasts inbox) instead of `archive#` and `PRED#`.
e. Record paths for the read API actions `topics`, `today`, `archive_range`, `narrative_thread`, `daily_brief`, `latest_daily_brief`, `weekly_brief`, `web_index`, `systems_analysis`, `summary`/`prediction`/`trace_cause`; a design for `staging`/`seen-today`; the freshness monitor stops probing `topics`.
f. Writers stop their DynamoDB puts (the writers read their own rows for refresh and merges today).
g. Export, then delete per family with an operator yes each, and the full rebuild test after each; then remove the read paths and compare flags. Open: about 1,513 Jun to Sep `PRED#` rows not in the facts (export and drop, or backfill).
Renames approved 2026-11-01, to do after Monday's checks, each as create new, move trigger, test, delete old: `NewsProjectInvokeAgentLambda-dev` to `newsAgent`, `newsInvokeGemini-dev` to `newsIngest`, `newsSensitiveData-dev` to `newsReadApi`, `newsPostDevTo` to `newsDailyBrief`; schedules InvokeGoogleGemini to TriggerIngest, InvokeNewsAgent to TriggerAgent, countryIntelliegence to TriggerCountryIntelligence, Fact to TriggerCountryFacts, InvokeDev to TriggerDailyBrief, InvokeLinkedIn to TriggerPostLinkedin, TriggerDailyAnalysis to TriggerThreadAnalysis; env `GROK_*`/`XAI_*` to `LLM_*`.
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
- Foundation leftovers (ARCHITECTURE_TIMELINE.md section 7): the full rebuild test, parser moves to `world/`, the retire list, LatAm and SEA feeds, 2 of 115 `NewsProjectInvokeAgent` tests failing on main, 41 archive days missing everywhere.
- Colour bugs unverified: map labels clip at the right edge and Europe labels overlap; Alerts list and Intel feed show the same stories on home; the country list "Highest Risk" rail should sort by score (`features/countries/CountryListPage.jsx`).
- Record data: over-joined threads (us-court ae75a8 holds about 20 unrelated entries) and duplicate stories the review cannot merge without neighbours (Amazon 35a31e/c5bce9/da86ee, Canadian base fire 6822c0/bf3dd0); the review flags off-story entries as assignment proposals in the readings.
- Backend hygiene: `newsAnalyze` and `newsPolarBilling` (each with sandbox) stay on `nodejs20.x`; `deepseek-v4-flash` default string in `newsPostDevTo`; deployed `newsAnalyze` differs from the repo by about 126 lines (parked credits code): leave it or remove the Lambda (billing code: needs yes).

Parked (each has a decision record): analysis credits (0002); breaking and drift email rules DISABLED until the first follower (`TriggerBreakingEmailSend`, `TriggerDriftEmailSend`).

Open decisions: the hosting cutover (confirmed, steps pending); newsAnalyze versus repo; selection go; whether to merge the unmerged weekly branches; the five test users.
