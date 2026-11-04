# Step 5 audit: what stands between the DynamoDB world tables and their deletion (updated 2026-11-04, evening JST)

Replaces the 2026-10-31 audit; flags re-read live 2026-11-04. Method: live `aws lambda get-function-configuration` (one named variable at a time), `aws dynamodb describe-table`, `aws events` / `aws scheduler`, `aws s3`, and grep of `backend/`. Row counts and the file:line references below come from the 31 Oct key scans and greps unless marked "re-checked"; line numbers drift, grep the symbol. Git history keeps the 31 Oct text.

## 0. Headline
1. **NewsCache and SummarizeAndPredict cannot be deleted midweek.** Each needs code work first (sections 3 and 4). The order of work is in section 6 and in `START_HERE.md`.
2. **Deleted from AWS on 2026-11-01** (re-checked, `ResourceNotFoundException`): `newsPredictionsSnapshot`, `newsSignals`, `newsImpactAudit`, with their rules, roles and log groups, and `predictions/track_record.json`. The table `GlobalPerspectiveMarkets` no longer exists (`describe-table`: not found; economy retired by 0049). The read API no longer has `prediction_snapshot` or `prediction_track_record`.
3. **Kept on purpose:** `newsGdeltConflict` (rule `TriggerGdeltConflict` ENABLED; operator 2026-11-01). Nothing reads its output yet.
4. **The record does not hold history before 2026-09-05** for entries, `THREAD_ANALYSIS` (202 of 330 rows are Mar-Sep stories not in the record), `THREAD_HISTORY#` and the older `PRED#` rows. Deleting loses it unless exported first (destructive, operator decision).
5. **Several "world" rows are send guards or commitment state**: `EMAILLOG#weekly#`, the `DRIFT#` emailed flag, `WEEKLY_BRIEF#` (feeds the Sunday email), PredictionLog `SEED#` (unrevealed secret), `Q#`, `SAMPLE#`, `SETTLE#`. They stay.

## 1. Reader switches, live (re-read 2026-11-04, each named variable read with `get-function-configuration`)
Deployed names are the new ones (renames 3 and 4 Nov: `newsIngest`, `newsAgent`, `newsDailyBrief`, `newsReadApi`; the old functions still exist, unscheduled and deploy-blocked in `scripts/functions.json`, until they are deleted).
- `NOTES_READS` accepts only `ddb` (default), `notes` or `compare` (`backend/shared/src/noteReads.js:14-17`); any other value, including `record`, silently means `ddb`. It is `notes` on newsReadApi, newsBreakingAlert, newsDailyBrief, newsWeeklyBrief, newsCountryIntelligence, newsDriftCorrector and newsSystemsAnalysis.
- `RECORD_READS=record` on newsBoard, newsRecommend, newsPostLinkedin, newsDailyBrief, newsReadApi and newsBreakingAlert; `compare` on newsEmailSender (first compare of the weekly brief: Sun 8 Nov 14:00Z). `record` still falls back to DynamoDB when a view has no answer or is over 9 h old, so these readers are not DynamoDB-free. newsBoard reads the story web and the histories from the record (role policy `newsBoard-record`, operator yes 2026-11-01).
- `NOTES_PREFIX=record/` on newsDailyBrief, newsWeeklyBrief, newsCountryIntelligence, newsDriftCorrector, newsSystemsAnalysis, newsAgent and newsCountryFactsUpdater.
- `ARCHIVE_READS` (step 5d, shared `backend/shared/src/archiveReads.js`; values `ddb` (default), `inbox`, `compare`; anything else, or `inbox`/`compare` without `ENTRIES_INBOX_PREFIX`, means `ddb`): `newsAgent` is `inbox` since 2026-11-04 04:30Z, with `FORKS_READS=inbox` (its 90-day forecast forks from `record/inbox/forecasts/`). `newsThreadAnalysis`, `newsSystemsAnalysis`, `newsCountryIntelligence`, `newsDriftCorrector` and `newsWeeklyBrief` are `compare` with `ENTRIES_INBOX_PREFIX=record/` (deployed 2026-11-04, function last-modified 09:00-09:03Z in AWS; their roles got the inline policy `entriesInboxReader`, `s3:GetObject` on `record/inbox/entries/*`). They answer from NewsCache and log differences. Known difference: `today-archive` `archivedAt` differs by about 0.15 s. Each moves to `inbox` after 3 clean nights (dailies from 5 Nov, weekly brief after Sun 8 Nov). Rollback zips: `.deploy-backups/<fn>/`.
- `newsStoryRecord`: `ENTRIES_SOURCE=inbox`, `FORECASTS_SOURCE=inbox` (the 11-01 23:45Z compare: 0 differences over 647 snapshots). `newsPredictionResolver`: `QUESTIONS_SOURCE=record` (set 2026-11-02 ~13:40Z after W44's eligible pool matched, 295 = 295). `newsFreshnessMonitor`: `SETTLE_SOURCE=record`.
- `newsReadApi` env is cut to the 8 keys its code reads: `FIREBASE_PROJECT_ID`, `NOTES_READS`, `RECORD_READS`, `REGION`, `SUMMARIZE_PREDICT_TABLE`, `TOPICS_CACHE_MAX_AGE_SECONDS`, `TOPICS_DDB_TABLE`, `USERS_DDB_TABLE`. API Gateway `ba4q3fnwq6` `/proxy` points at it. `newsIngest` has no reader flags (it reads `archive#` titles directly, see section 3).

## 2. Tables and families (what is left)
Other projects are out of scope (BestWaifuChatLogs, Currecy-past, Currency, Polybot*, ppa-*). `NewsProject-linkedin-posts` (about 16k rows) is the social dedupe table: operational, leave.

| Table | Class |
|---|---|
| SummarizeAndPredict (PK,SK) | world, plus the ops family `EMAILLOG#` |
| NewsCache (id) | ingest working store plus `archive#` days (2026-03-07 onward) |
| GlobalPerspectivePredictionLog (PK,SK) | `PRED#` forecasts (world) plus commitment state (`Q#`, `SEED#`, `SAMPLE#`, `SETTLE#`) |
| BreakingAlerts, ClientErrors, UserTable, UserPrefs, SavedItems (also boards), Shares, ApiKeys | operational or user data: stay (0003) |

Key scan 2026-11-02: SummarizeAndPredict 3,541 items, PredictionLog 7,170; every family is still read or written (PredictionLog `PRED#` by the agent), so no family is deletable yet. `GlobalPerspectiveMarkets` is gone.

SummarizeAndPredict families (31 Oct counts): country `HISTORY#` 1,560, `DRIFT#` 248, `DRIFTLOG#` 222, `COUNTRY_INTELLIGENCE` 48, `FACTS#` 40; thread `THREAD_HISTORY#` 338, `THREAD_ANALYSIS` 330, `TOPICS` pointer 135, `DRIFT#`/`DRIFTLOG#` 121 each, `WEB` 119; `WEB#INDEX` 1; `SYSTEMS#` 22; `DAILY_BRIEF#` 137; `WEEKLY_BRIEF#` 15; `TOPIC#` cache (short-lived, the agent prunes); `EMAILLOG#weekly#` 11. The parked economy rows (`ECON#`, `PAIR#`, `WEEKLY_MARKETS#`) belong to retired code (0049): export if wanted, then delete with a yes.

## 3. NewsCache: blockers (grep-verified 2026-11-01, flags re-read 2026-11-04)
- Done 2026-11-04: `newsAgent` reads the previous days' entries from `record/inbox/entries/` (`ARCHIVE_READS=inbox`). It still writes `archive#` / `today-archive` and `staging` / `latest`.
- In `compare`, not yet switched: `newsThreadAnalysis`, `newsSystemsAnalysis`, `newsCountryIntelligence`, `newsDriftCorrector`, `newsWeeklyBrief` (section 1).
- `newsIngest` reads `archive#` titles directly (`src/index.js`, for `continues_topic`), with no switch.
- The read API actions `topics`, `today`, `archive_range`, `narrative_thread` have no record path (the story page and 30-day pages call `archive_range` / `narrative_thread` for the newest days; the countries list no longer calls `archive_range`, it reads the record's weekly index since 2026-11-03; `/`, `/today` and the board read `topics`/`today`).
- `staging` and `seen-today` are the ingest handoff between `newsIngest` and `newsAgent`: needs a design decision.
- The freshness monitor probes `topics`.
- History: 141 archive days (6,919 entries) before 09-05 exist only here; export before any delete.

## 4. SummarizeAndPredict and PredictionLog `PRED#`: blockers
SummarizeAndPredict:
- The writers read their own existing rows for refresh policy and merges (`newsThreadAnalysis`, `newsCountryIntelligence`, the `newsSystemsAnalysis` `SYSTEMS#` scan, the `newsCountryFactsUpdater` merge). Without the rows they regenerate everything (paid LLM).
- `newsBoard` now reads the web and the histories from the record behind `RECORD_READS` (DynamoDB only as the fallback). `newsWeeklyBrief` reads `WEB#INDEX`.
- Read API actions with no record path: `daily_brief`, `latest_daily_brief`, `weekly_brief`, `web_index`, `systems_analysis`, `summary` / `prediction` / `trace_cause`. The front Worker pre-render calls the brief actions and `topics`.
- The agent's `TOPIC#` cache and the `THREAD#/TOPICS` pointer.
- `newsEmailSender` (weekly email, ENABLED Sun 14:00Z) reads `WEEKLY_BRIEF#` and `EMAILLOG#weekly#`; the deployed build (2026-11-02) has the record path for the brief in `compare`; the sent marker stays in DynamoDB.
- `newsCountryFactsUpdater` writes `country_facts` notes to `record/notes/`; its merge still reads `FACTS#`, and there is no view.
- No record shape yet: `THREAD_HISTORY#`, `FACTS#`, `DAILY_BRIEF#`, `WEEKLY_BRIEF#`, `TOPIC#`.

PredictionLog `PRED#`:
- Done 2026-11-04: the agent's `readThreadForks` (90-day forks for draw cadence and the duplicate gate) reads `record/inbox/forecasts/` (`FORKS_READS=inbox`).
- `newsStoryRecord` `FORECASTS_SOURCE=inbox` and the `PredictionLogScan` statement removed (operator yes); the first nightly without the scan is 2026-11-02 23:45Z.
- Done 2026-11-02: `newsPredictionResolver` `QUESTIONS_SOURCE=record`. The 2026-11-02 nightly (`record/runs/2026-11-02.json`) is ok with no failures, the first without the scan: 21 `forecast_drawn` facts, a `question_commit`, a `question_draw`. Since 2026-11-04 04:30Z the agent's fork read is the inbox; it still puts the `PRED#` rows and reconciles threads, which are DynamoDB writes.
- The agent's `PRED#` put and thread reconcile.
- About 1,513 Jun-Sep `PRED#` rows are not in the facts. Operator decision 2026-11-03: dropped, not migrated. They go with the PredictionLog `PRED#` export and delete at the end of step 5. (Decision 0047 already keeps the whole rows under `record/legacy/predictions/`.)
- Forecasts inbox matched the log on 2026-11-01 (639 rows, then 647 snapshots in the 23:45Z compare, 0 differences); inbox at `record/inbox/forecasts/`.
- `Q#`, `SEED#`, `SAMPLE#`, `SETTLE#` stay in PredictionLog (resolver state, unrevealed seed). `draw.pool` and `settleHealth` lived in the deleted track-record snapshot; the record views and the freshness monitor (`SETTLE_SOURCE=record`) now carry what the pages need.

## 5. Record coverage (31 Oct measurements, not re-run)
- Entries 2026-09-05..10-31 complete modulo the repeat rule (0046); the entries inbox and today view (0051) supply recent days. Before 09-05: not in the record.
- Country intelligence, history and drift notes: complete or near (48 subjects, 1,560 history lines). 26 country `DRIFT#` rows and about 22 thread drift rows have no note.
- `THREAD_ANALYSIS`: 128 of 330 have notes. `WEB`/`SYSTEMS#`: partial (web notes for 18 of 22 countries).
- Forecasts: facts and inbox hold the drawn forecasts of the window; the older rows are section 4.
- Verdicts, commits, draws: in facts and inboxes.
- Not verified: entry-by-entry equality of facts and archive; why 2026-09-05 has 0 entry facts; why 4 of 22 SYSTEMS countries lack a web note; owner of `Currency`, `Currecy-past` and `so-v3-engine`; deployed diffs of about 35 Lambdas.

## 6. Order of work from here (each switch at zero differences; each delete after an S3 export, with an operator yes)
Done 1-4 Nov: forecasts nightly on the inbox and the scan removed; country facts notes live; `newsEmailSender` deployed in `compare`; `newsBoard` on the record; `QUESTIONS_SOURCE=record`; the four renames; the agent on the inboxes (`ARCHIVE_READS`/`FORKS_READS=inbox`); the five daily Lambdas deployed in `compare`.
b. `newsEmailSender` `RECORD_READS=record` after the first compare (Sun 8 Nov 14:00Z).
d. Move `newsThreadAnalysis`, `newsSystemsAnalysis`, `newsCountryIntelligence`, `newsDriftCorrector` to `ARCHIVE_READS=inbox` after 3 clean nights (from 5 Nov) and `newsWeeklyBrief` after Sun 8 Nov; `newsIngest`'s `archive#` title read still needs a path.
e. Record paths for the read API actions in sections 3 and 4; a design for `staging` / `seen-today`; the freshness monitor off `topics`; frontend fallbacks removed after each matching step.
f. Writers stop their DynamoDB puts.
g. Export, then delete per family with an operator yes each, and the full rebuild test after each. Derived and duplicate families first (`DRIFTLOG#`, `WEB`, `SYSTEMS#`, `TOPICS`), then thread and country families, then `PRED#`, then NewsCache last. `EMAILLOG#` and the PredictionLog commitment state stay unless moved to S3 by a separate design.

Renames (approved 2026-11-01; create new, move trigger, test, delete old). Done: `NewsProjectInvokeAgentLambda-dev` to `newsAgent` and `newsInvokeGemini-dev` to `newsIngest` (3 Nov); `newsPostDevTo` to `newsDailyBrief` and `newsSensitiveData-dev` to `newsReadApi` (4 Nov). The schedules `InvokeGoogleGemini`, `InvokeNewsAgent`, `InvokeDev` and API Gateway `ba4q3fnwq6` `/proxy` point at the new functions (checked live 2026-11-04); the old functions stay unscheduled and deploy-blocked in `scripts/functions.json` until deleted (deleting them needs the operator). Planned, not done: schedule names InvokeGoogleGemini to TriggerIngest, InvokeNewsAgent to TriggerAgent, countryIntelliegence to TriggerCountryIntelligence, Fact to TriggerCountryFacts, InvokeDev to TriggerDailyBrief, InvokeLinkedIn to TriggerPostLinkedin, TriggerDailyAnalysis to TriggerThreadAnalysis; env `GROK_*` / `XAI_*` to `LLM_*`. Do these before the deletes touch the same code, or after; never mid-switch.

## 7. What would break a user-facing send, billing, or user data
- Weekly email (ENABLED): `WEEKLY_BRIEF#` and `EMAILLOG#weekly#`; deleting either gives no mail or a duplicate.
- `newsBreakingAlert` (every 8 h, `cron(45 4/8)`) reads thread analysis and country intelligence; breaking and drift email rules are DISABLED but their code still reads `DRIFT#` and sets a sent flag.
- `newsDailyBrief` (no longer posts to dev.to) builds the daily brief; `newsPostLinkedin` posts externally; dedupe rows live in `NewsProject-linkedin-posts` (leave).
- Billing and user tables are untouched by every step. IAM changes need a fresh yes.
