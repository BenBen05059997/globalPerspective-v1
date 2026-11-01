# Step 5 audit: what stands between the DynamoDB world tables and their deletion (2026-11-01, about 13:00 UTC)

Replaces the 2026-10-31 audit. Method: live `aws lambda get-function-configuration` (one named variable at a time), `aws dynamodb describe-table`, `aws events` / `aws scheduler`, `aws s3`, and grep of `backend/`. Row counts and the file:line references below come from the 31 Oct key scans and greps unless marked "re-checked"; line numbers drift, grep the symbol. Git history keeps the 31 Oct text.

## 0. Headline
1. **NewsCache and SummarizeAndPredict cannot be deleted midweek.** Each needs code work first (sections 3 and 4). The order of work is in section 6 and in `START_HERE.md`.
2. **Deleted from AWS on 2026-11-01** (re-checked, `ResourceNotFoundException`): `newsPredictionsSnapshot`, `newsSignals`, `newsImpactAudit`, with their rules, roles and log groups, and `predictions/track_record.json`. The table `GlobalPerspectiveMarkets` no longer exists (`describe-table`: not found; economy retired by 0049). The read API no longer has `prediction_snapshot` or `prediction_track_record`.
3. **Kept on purpose:** `newsGdeltConflict` (rule `TriggerGdeltConflict` ENABLED; operator 2026-11-01). Nothing reads its output yet.
4. **The record does not hold history before 2026-09-05** for entries, `THREAD_ANALYSIS` (202 of 330 rows are Mar-Sep stories not in the record), `THREAD_HISTORY#` and the older `PRED#` rows. Deleting loses it unless exported first (destructive, operator decision).
5. **Several "world" rows are send guards or commitment state**: `EMAILLOG#weekly#`, the `DRIFT#` emailed flag, `WEEKLY_BRIEF#` (feeds the Sunday email), PredictionLog `SEED#` (unrevealed secret), `Q#`, `SAMPLE#`, `SETTLE#`. They stay.

## 1. Reader switches, live (re-checked 2026-11-01 about 13:00Z)
- `NOTES_READS` accepts only `ddb` (default), `notes` or `compare` (`backend/shared/src/noteReads.js:14-17`); any other value, including `record`, silently means `ddb`. It was `record` until about 12:15Z today, so those readers answered from DynamoDB. Now `notes` on newsSensitiveData-dev, newsBreakingAlert, newsPostDevTo, newsWeeklyBrief, newsCountryIntelligence, newsDriftCorrector and newsSystemsAnalysis (each read live). The read API was checked afterwards and answers from notes.
- `RECORD_READS=record` on newsBoard, newsRecommend, newsPostLinkedin, newsPostDevTo, newsSensitiveData-dev and newsBreakingAlert. It still falls back to DynamoDB when a view has no answer or is over 9 h old, so these readers are not DynamoDB-free.
- `NOTES_PREFIX=record/` on newsPostDevTo, newsWeeklyBrief, newsCountryIntelligence, newsDriftCorrector, newsSystemsAnalysis and the agent. `newsCountryFactsUpdater` is still `record/shadow/` (Monday's check).
- `newsStoryRecord`: `ENTRIES_SOURCE=inbox`, `FORECASTS_SOURCE=compare`. `newsPredictionResolver`: `QUESTIONS_SOURCE=compare`. Agent: `FORECASTS_INBOX_PREFIX=record/`. `newsEmailSender`: no flags, deployed build from 2026-10-20, no record path.

## 2. Tables and families (what is left)
Other projects are out of scope (BestWaifuChatLogs, Currecy-past, Currency, Polybot*, ppa-*). `NewsProject-linkedin-posts` (about 16k rows) is the social dedupe table: operational, leave.

| Table | Class |
|---|---|
| SummarizeAndPredict (PK,SK) | world, plus the ops family `EMAILLOG#` |
| NewsCache (id) | ingest working store plus `archive#` days (2026-03-07 onward) |
| GlobalPerspectivePredictionLog (PK,SK) | `PRED#` forecasts (world) plus commitment state (`Q#`, `SEED#`, `SAMPLE#`, `SETTLE#`) |
| BreakingAlerts, ClientErrors, UserTable, UserPrefs, SavedItems (also boards), Shares, ApiKeys | operational or user data: stay (0003) |

SummarizeAndPredict families (31 Oct counts): country `HISTORY#` 1,560, `DRIFT#` 248, `DRIFTLOG#` 222, `COUNTRY_INTELLIGENCE` 48, `FACTS#` 40; thread `THREAD_HISTORY#` 338, `THREAD_ANALYSIS` 330, `TOPICS` pointer 135, `DRIFT#`/`DRIFTLOG#` 121 each, `WEB` 119; `WEB#INDEX` 1; `SYSTEMS#` 22; `DAILY_BRIEF#` 137; `WEEKLY_BRIEF#` 15; `TOPIC#` cache (short-lived, the agent prunes); `EMAILLOG#weekly#` 11. The parked economy rows (`ECON#`, `PAIR#`, `WEEKLY_MARKETS#`) belong to retired code (0049): export if wanted, then delete with a yes.

## 3. NewsCache: blockers (grep-verified 2026-11-01)
- The agent (`NewsProjectInvokeAgentLambda`) reads `archive#` for 7 days for thread assignment and the publish gate. Large.
- `newsThreadAnalysis`, `newsSystemsAnalysis`, `newsCountryIntelligence`, `newsDriftCorrector`, `newsWeeklyBrief` and `newsInvokeGemini` read `archive#` / `today-archive` directly, with no switch.
- The read API actions `topics`, `today`, `archive_range`, `narrative_thread` have no record path (the story page and 30-day pages call `archive_range` / `narrative_thread` for the newest days; `/`, `/today` and the board read `topics`/`today`).
- `staging` and `seen-today` are the ingest handoff between `newsInvokeGemini` and the agent: needs a design decision.
- The freshness monitor probes `topics`.
- History: 141 archive days (6,919 entries) before 09-05 exist only here; export before any delete.
- Already moved: the record's own entries input (`ENTRIES_SOURCE=inbox`, compared clean over 25 days and 851 entries).

## 4. SummarizeAndPredict and PredictionLog `PRED#`: blockers
SummarizeAndPredict:
- The writers read their own existing rows for refresh policy and merges (`newsThreadAnalysis`, `newsCountryIntelligence`, the `newsSystemsAnalysis` `SYSTEMS#` scan, the `newsCountryFactsUpdater` merge). Without the rows they regenerate everything (paid LLM).
- `newsBoard` reads `WEB#INDEX`, `THREAD_HISTORY#` and country `HISTORY#` with no switch (being moved now). `newsWeeklyBrief` reads `WEB#INDEX`.
- Read API actions with no record path: `daily_brief`, `latest_daily_brief`, `weekly_brief`, `web_index`, `systems_analysis`, `summary` / `prediction` / `trace_cause`. The front Worker pre-render calls the brief actions and `topics`.
- The agent's `TOPIC#` cache and the `THREAD#/TOPICS` pointer.
- `newsEmailSender` (weekly email, ENABLED Sun 14:00Z) reads `WEEKLY_BRIEF#` and `EMAILLOG#weekly#`; its deployed build has no record path. Deploy after today's 14:00Z send.
- `newsCountryFactsUpdater` writes notes to `record/shadow/` still; `FACTS#` has no note subtype or view.
- No record shape yet: `THREAD_HISTORY#`, `FACTS#`, `DAILY_BRIEF#`, `WEEKLY_BRIEF#`, `TOPIC#`.

PredictionLog `PRED#`:
- The agent's `readThreadForks` (90-day `PRED#` query for draw cadence and the duplicate gate).
- `newsStoryRecord` `FORECASTS_SOURCE=compare`, decided by tonight's 23:45Z compare; then `inbox`; then remove the `PredictionLogScan` IAM statement (needs an operator yes).
- `newsPredictionResolver` `QUESTIONS_SOURCE=compare`.
- The agent's `PRED#` put and thread reconcile.
- About 1,513 Jun-Sep `PRED#` rows are not in the facts: operator decision, export and drop, or backfill.
- Forecasts inbox matched the log on 2026-11-01 (639 rows, 0 differences); inbox at `record/inbox/forecasts/`.
- `Q#`, `SEED#`, `SAMPLE#`, `SETTLE#` stay in PredictionLog (resolver state, unrevealed seed). `draw.pool` and `settleHealth` lived in the deleted track-record snapshot; the record views and the freshness monitor (`SETTLE_SOURCE=record`) now carry what the pages need.

## 5. Record coverage (31 Oct measurements, not re-run)
- Entries 2026-09-05..10-31 complete modulo the repeat rule (0046); the entries inbox and today view (0051) supply recent days. Before 09-05: not in the record.
- Country intelligence, history and drift notes: complete or near (48 subjects, 1,560 history lines). 26 country `DRIFT#` rows and about 22 thread drift rows have no note.
- `THREAD_ANALYSIS`: 128 of 330 have notes. `WEB`/`SYSTEMS#`: partial (web notes for 18 of 22 countries).
- Forecasts: facts and inbox hold the drawn forecasts of the window; the older rows are section 4.
- Verdicts, commits, draws: in facts and inboxes.
- Not verified: entry-by-entry equality of facts and archive; why 2026-09-05 has 0 entry facts; why 4 of 22 SYSTEMS countries lack a web note; owner of `Currency`, `Currecy-past` and `so-v3-engine`; deployed diffs of about 35 Lambdas.

## 6. Order of work from here (each switch at zero differences; each delete after an S3 export, with an operator yes)
Monday first: 2 Nov 01:00Z full weekly review; 05:00 JST first country facts note (`newsCountryFactsUpdater` to `NOTES_PREFIX=record/` if it matches).
a. Tonight's forecasts compare, then `FORECASTS_SOURCE=inbox` and `QUESTIONS_SOURCE=record`.
b. `newsEmailSender` deploy after the 14:00Z send, then its `RECORD_READS`.
c. `newsBoard` server side on the record.
d. The agent and the five daily Lambdas read the record (entries inbox/facts, forecasts inbox) instead of `archive#` and `PRED#`.
e. Record paths for the read API actions in sections 3 and 4; a design for `staging` / `seen-today`; the freshness monitor off `topics`; frontend fallbacks removed after each matching step.
f. Writers stop their DynamoDB puts.
g. Export, then delete per family with an operator yes each, and the full rebuild test after each. Derived and duplicate families first (`DRIFTLOG#`, `WEB`, `SYSTEMS#`, `TOPICS`), then thread and country families, then `PRED#`, then NewsCache last. `EMAILLOG#` and the PredictionLog commitment state stay unless moved to S3 by a separate design.

Renames approved 2026-11-01 (after Monday's checks; create new, move trigger, test, delete old): `NewsProjectInvokeAgentLambda-dev` to `newsAgent`, `newsInvokeGemini-dev` to `newsIngest`, `newsSensitiveData-dev` to `newsReadApi`, `newsPostDevTo` to `newsDailyBrief`; schedules InvokeGoogleGemini to TriggerIngest, InvokeNewsAgent to TriggerAgent, countryIntelliegence to TriggerCountryIntelligence, Fact to TriggerCountryFacts, InvokeDev to TriggerDailyBrief, InvokeLinkedIn to TriggerPostLinkedin, TriggerDailyAnalysis to TriggerThreadAnalysis; env `GROK_*` / `XAI_*` to `LLM_*`. Do these before the deletes touch the same code, or after; never mid-switch.

## 7. What would break a user-facing send, billing, or user data
- Weekly email (ENABLED): `WEEKLY_BRIEF#` and `EMAILLOG#weekly#`; deleting either gives no mail or a duplicate.
- `newsBreakingAlert` (every 8 h, `cron(45 4/8)`) reads thread analysis and country intelligence; breaking and drift email rules are DISABLED but their code still reads `DRIFT#` and sets a sent flag.
- `newsPostDevTo` and `newsPostLinkedin` post externally; dedupe rows live in `NewsProject-linkedin-posts` (leave).
- Billing and user tables are untouched by every step. IAM changes (the `PredictionLogScan` statement) need a fresh yes.
