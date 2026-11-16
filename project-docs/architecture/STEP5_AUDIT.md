# Step 5 audit: what stands between the DynamoDB world tables and their deletion

Step 5 of decision 0035 is open: the three world tables still exist and are still read and written. This file is the work list. Delete it when step 5 ends (`project-docs/START_HERE.md`). Every state fact below was read on 2026-11-17 from the code, `aws lambda get-function-configuration`, `aws dynamodb` or `aws s3` (the 2026-11-16 17:00 UTC snapshot where noted; the flags the snapshot redacts were read live). Line numbers drift: grep the symbol.

## 0. Headline
1. **Nothing in the world tables can be deleted today.** `NewsCache`, `SummarizeAndPredict` and the `PRED#` rows of `GlobalPerspectivePredictionLog` are all still written by live Lambdas (section 1) and read by the read API and the writers (sections 3 and 4). TTL is DISABLED on all three tables, so rows only grow.
2. **Already gone** (read 2026-11-17): the table `GlobalPerspectiveMarkets` (`aws dynamodb list-tables`); the Lambdas `newsPredictionsSnapshot`, `newsSignals`, `newsImpactAudit`, `newsInvokeGemini-dev` and `NewsProjectInvokeAgentLambda-dev` (not in the snapshot).
3. **Kept on purpose:** `newsGdeltConflict` (rule `TriggerGdeltConflict` ENABLED; operator 2026-11-01). The old names `newsPostDevTo` and `newsSensitiveData-dev` still exist, unscheduled and `deployBlocked` in `scripts/functions.json`, until the operator deletes them.
4. **History before the record's first day was copied on 2026-10-31** (decision 0047); the facts manifest holds 254 days through 2026-11-15. Export before any delete is still required for the families the record holds no note for (section 5).
5. **Some "world" rows are send guards or commitment state and stay:** `EMAILLOG#weekly#`, the `DRIFT#` emailed flag, `WEEKLY_BRIEF#` (feeds the Sunday email), PredictionLog `SEED#` (unrevealed secret), `Q#`, `SAMPLE#`, `SETTLE#`.

## 1. Reader and writer switches, live (read 2026-11-17)
Deployed names are the new ones (`newsIngest`, `newsAgent`, `newsDailyBrief`, `newsReadApi`). Values are from `aws-lambdas.json` (2026-11-16 17:00 UTC) except `ENTRIES_SOURCE`, `FORECASTS_SOURCE`, `QUESTIONS_SOURCE`, `SETTLE_SOURCE`, which the snapshot redacts and were read one key at a time.

| Switch (code that reads it) | Values | Live |
|---|---|---|
| `ENTRIES_SOURCE` (`newsStoryRecord` `src/store.js`) | `archive` (default), `inbox`, `compare` | `newsStoryRecord`: `inbox` |
| `FORECASTS_SOURCE` (same) | `log` (default), `inbox`, `compare` | `newsStoryRecord`: `inbox` |
| `QUESTIONS_SOURCE` (`backend/predictions/newsPredictionResolver/src/questions.js`) | `log` (default), `record`, ... | `newsPredictionResolver`: `record` |
| `SETTLE_SOURCE` (`newsFreshnessMonitor`) | `action` (default), `record` | `newsFreshnessMonitor`: `record` |
| `ARCHIVE_READS` (shared `archiveReads.js`; `inbox` and `compare` need `ENTRIES_INBOX_PREFIX`, else it reads `ddb`) | `ddb` (default), `inbox`, `compare` | `inbox` on `newsAgent`, `newsThreadAnalysis`, `newsSystemsAnalysis`, `newsCountryIntelligence`, `newsDriftCorrector`; **`compare` on `newsWeeklyBrief`** |
| `FORKS_READS` (`newsAgent`, the 90-day forecast forks) | `ddb`, `inbox` | `newsAgent`: `inbox` (`FORECASTS_INBOX_PREFIX=record/`) |
| `NOTES_READS` (shared `noteReads.js`; any other value means `ddb`) | `ddb` (default), `notes`, `compare` | `notes` on `newsReadApi`, `newsBreakingAlert`, `newsDailyBrief`, `newsWeeklyBrief`, `newsCountryIntelligence`, `newsDriftCorrector`, `newsSystemsAnalysis`; unset on `newsThreadAnalysis` |
| `RECORD_READS` (shared `recordReads.js`; `record` still falls back to DynamoDB when a view has no answer or is over 9 h old) | `ddb` (default), `record`, `compare` | `record` on `newsBoard`, `newsRecommend`, `newsPostLinkedin`, `newsDailyBrief`, `newsReadApi`, `newsBreakingAlert`; **`compare` on `newsEmailSender`** |
| `NOTES_PREFIX` (writers copy what they store into the record as notes) | `record/` live | `newsAgent`, `newsThreadAnalysis`, `newsSystemsAnalysis`, `newsCountryIntelligence`, `newsDriftCorrector`, `newsWeeklyBrief`, `newsDailyBrief`, `newsCountryFactsUpdater` |

`newsIngest` has no reader flag. It reads `archive#<day>` titles from NewsCache directly (`src/index.js`, for `continues_topic`) and writes `staging` and `seen-today`.

Writers that still put to DynamoDB (grep of SDK calls, read 2026-11-17):
- NewsCache: `newsIngest` (`staging`, `seen-today`); `newsAgent` (`latest`, `archive#DAY`, `today-archive`, the `staging` processed mark).
- SummarizeAndPredict: `newsAgent` (`TOPIC#` summary, cause chain and prediction rows; the `THREAD#/TOPICS` pointer; prunes `TOPIC#`), `newsThreadAnalysis` (`THREAD_ANALYSIS`, `THREAD_HISTORY#`), `newsCountryIntelligence` (`COUNTRY_INTELLIGENCE`, `HISTORY#`), `newsDriftCorrector` (`DRIFT#`, `DRIFTLOG#`), `newsSystemsAnalysis` (`SYSTEMS#`, `WEB#INDEX`, `THREAD#/WEB`), `newsCountryFactsUpdater` (`FACTS#`), `newsDailyBrief` (`DAILY_BRIEF#`), `newsWeeklyBrief` (`WEEKLY_BRIEF#`), `newsEmailSender` (the `EMAILLOG#` sent marker).
- PredictionLog: `newsAgent` (`PRED#` put and thread reconcile); `newsPredictionResolver` (`Q#`, `SEED#`, `SAMPLE#`, `SETTLE#`, which stay).
- `newsStoryRecord` touches no DynamoDB table with both sources on `inbox`; its table env vars serve only the non-default source values.

Compare results read from CloudWatch on 2026-11-17: `newsEmailSender` `[record-reads] email weekly_brief`: `equal` on 2026-11-08, `DIFFER, the record has no answer` on 2026-11-15 (cause not investigated). `newsWeeklyBrief` `[archive-compare]`: `equal` for `today-archive` and the seven days before on 2026-11-15 06:00Z; the run of 2026-11-08 06:00Z showed a `DIFFER` on `today-archive` (field `archivedAt`).

## 2. Tables and families (what is left)
Other projects' tables (BestWaifuChatLogs, Currecy-past, Currency, Polybot*, ppa-*) are out of scope. Operational and user tables stay (decision 0003): `GlobalPerspectiveBreakingAlerts`, `ClientErrors`, `UserTable`, `UserPrefs`, `SavedItems` (also boards), `Shares`, `ApiKeys`, `NewsProject-linkedin-posts` (social dedupe).

Key scans of 2026-11-17 (projection scan of the key attributes; `describe-table` item counts: 196, 4,289, 8,581):

| Table | Families now |
|---|---|
| NewsCache (196) | `archive#DAY` 192 (2026-03-07 to 2026-11-16), `staging`, `latest`, `today-archive`, `seen-today` |
| SummarizeAndPredict (4,289) | `COUNTRY#` `HISTORY#` 1,619, `DRIFT#` 263, `DRIFTLOG#` 237, `COUNTRY_INTELLIGENCE` 50; `THREAD#` `THREAD_HISTORY#` 478, `TOPICS` 458, `THREAD_ANALYSIS` 388, `DRIFT#` 177, `DRIFTLOG#` 177, `WEB` 159; `DAILY_BRIEF#` 152; `FACTS#` 40; `SYSTEMS#` 23; `WEEKLY_BRIEF#` 17; `EMAILLOG#` 13; `TOPIC#` rows 37 (13 summary, 13 cause chain, 11 prediction); `WEB#INDEX` 1 |
| GlobalPerspectivePredictionLog (8,581) | `PRED#` 6,956 (2026-06-02 to 2026-11-16; 5,153 of them before 2026-09-05), `Q#` 1,549, `SETTLE#` 48, `SEED#` 23, `SAMPLE#` 5 |

The old economy rows (`ECON#`, `PAIR#`, `WEEKLY_MARKETS#`) no longer appear in the key scan.

## 3. NewsCache: blockers
- Done: `newsAgent` and the four daily analysis Lambdas read archive days from `record/inbox/entries/` (`ARCHIVE_READS=inbox`); `newsStoryRecord` builds entries from the inbox. The agent still writes `archive#` and `today-archive`.
- `newsWeeklyBrief` is still `compare` (section 1).
- `newsIngest` reads `archive#` titles directly, with no switch and no record path.
- `staging` and `seen-today` are the handoff between `newsIngest` and `newsAgent` (and `newsHealth`'s heal pass reads `staging`): needs a design decision before NewsCache can go.
- `latest` and `today-archive` are still read by `newsPostLinkedin`, `newsBreakingAlert`, `newsRecommend`, `newsDailyBrief` and the read API behind `RECORD_READS`; with `record` they read the views and fall back to DynamoDB, so they are not DynamoDB-free until the fallback is removed.
- Read API actions `topics`, `today`, `archive_range`, `narrative_thread` and `summary` / `prediction` / `trace_cause` answer from NewsCache and the `TOPIC#` rows only (`readTopicsCache`, `readTodayArchive`, `readArchiveRange`, `readNarrativeThread`, `readSummaryPredictionCache` in `backend/read-api/newsSensitiveData/src/index.js`); `rss` has a record path. The front Worker prerender is record-first and falls back to the actions `topics`, `daily_brief`, `latest_daily_brief`, `weekly_brief`. The frontend still calls the actions (`shared/api/restProxy.js`, `archiveRange.js`, `recordViews.js`, `contentService.js`, threads hooks); which calls are only fallbacks needs checking per call site.
- `newsFreshnessMonitor` probes `?action=topics` (the rule is ENABLED).

## 4. SummarizeAndPredict and PredictionLog `PRED#`: blockers
SummarizeAndPredict:
- The writers read their own rows for refresh policy and merges (`newsThreadAnalysis`, `newsCountryIntelligence`, `newsDriftCorrector`, the `newsSystemsAnalysis` `SYSTEMS#` scan, the `newsCountryFactsUpdater` merge). Without the rows they regenerate everything (paid model calls).
- Read API actions with no record path: `daily_brief`, `latest_daily_brief`, `weekly_brief`, `systems_analysis` (`SYSTEMS#` has no note type), `web_index` (the record has `index/web.json`, which `newsBoard` reads). `thread_analysis`, `country_*`, `corrections_feed` and the previews read the notes behind `NOTES_READS=notes`.
- `newsEmailSender` (weekly email, rule ENABLED Sun 14:00Z) reads `WEEKLY_BRIEF#` and `EMAILLOG#weekly#` and is on `compare`; the sent marker stays in DynamoDB unless moved by a separate design.
- `newsCountryFactsUpdater` writes `country_facts` notes; its merge still reads `FACTS#`.
- The agent's `TOPIC#` cache and the `THREAD#/TOPICS` pointer.
- Notes types that exist in the record: `entry`, `story_analysis`, `drift`, `country`, `link`, `web`, `daily_brief`, `weekly_brief`, `country_facts`, `story_history` (`backend/record/schema/note.schema.json`). No note type: `TOPIC#`, `SYSTEMS#`, `EMAILLOG#`, the `THREAD#/TOPICS` pointer.

PredictionLog `PRED#`:
- Done: forecasts reach the record through `record/inbox/forecasts/`; `newsStoryRecord` `FORECASTS_SOURCE=inbox` (no table scan); `newsPredictionResolver` `QUESTIONS_SOURCE=record`; the agent reads its forecast forks from the inbox.
- Left: the agent's `PRED#` put and thread reconcile are still DynamoDB writes. The `PRED#` rows before 2026-09-05 (5,153) that no story places are kept whole under `record/legacy/predictions/` (decision 0047); the 1,513 Jun-Sep rows are not migrated as facts (operator 2026-11-03) and go with the `PRED#` export at the end.
- `Q#`, `SEED#`, `SAMPLE#`, `SETTLE#` stay (resolver state, unrevealed seed).

## 5. Record coverage
Read 2026-11-17: the facts manifest holds 254 days (2026-03-07 to 2026-11-15, `factsManifestDays` in `record/views/manifest.json`); `record/legacy/predictions/` exists; `record/shadow/` and `record/shadow-history/` still exist in the bucket (trial copies). Measurements of 2026-10-31 (entries, country notes, `THREAD_ANALYSIS` note counts, web notes for 18 of 22 countries) were not re-run. Before any export or delete, re-measure per family: note count against row count (`backend/record/cli/compare-reads.mjs`, `check-eligible.mjs`).
Not verified: entry-by-entry equality of facts and archive; deployed-versus-repo diffs of the Lambdas (diff before deploying any: `newsAgent`, `newsIngest` and `newsWeeklyBrief` were all modified 2026-11-16).

## 6. Order of work from here (each switch at zero differences; each delete after an S3 export, with an operator yes)
Done: the forecast inbox and scan removal; country facts notes; `newsBoard` on the record; `QUESTIONS_SOURCE=record`; the four renames; the agent and four daily Lambdas on `ARCHIVE_READS=inbox`; `newsEmailSender` deployed in `compare`; history copy (decision 0047); briefs in the record (decision 0048).
- b. `newsEmailSender` `RECORD_READS=record`: only after the compare is `equal` again. 2026-11-15 said "the record has no answer": find why first.
- d. `newsWeeklyBrief` `ARCHIVE_READS=inbox` (the 2026-11-15 compare was equal); give `newsIngest`'s `archive#` title read a record path.
- e. Record paths for the read API actions in sections 3 and 4; a design for `staging` / `seen-today`; the freshness monitor off `topics`; remove each frontend fallback after its matching step.
- f. Writers stop their DynamoDB puts (agent first, then the analysis Lambdas, briefs, facts).
- g. Export, then delete per family with an operator yes each, and the full rebuild test after each (decision 0037: delete the views in a copy, rebuild from facts, readings and notes). Order: derived and duplicate families first (`DRIFTLOG#`, `WEB`, `SYSTEMS#`, `TOPICS`), then thread and country families, then `PRED#`, then NewsCache last. `EMAILLOG#` and the PredictionLog commitment state stay unless moved to S3 by a separate design. The old economy rows, if any remain, are exported if wanted and deleted with a yes.

Renames still open (approved 2026-11-01): schedule names `InvokeGoogleGemini` to `TriggerIngest`, `InvokeNewsAgent` to `TriggerAgent`, `countryIntelliegence` to `TriggerCountryIntelligence`, `Fact` to `TriggerCountryFacts`, `InvokeDev` to `TriggerDailyBrief`, `InvokeLinkedIn` to `TriggerPostLinkedin`, `TriggerDailyAnalysis` to `TriggerThreadAnalysis`. The env keys `GROK_*` / `XAI_*` keep their names (they hold DeepSeek or the way back to it). Do renames before or after a delete that touches the same code, never mid-switch.

## 7. What would break a user-facing send, billing, or user data
- Weekly email (rule ENABLED): `WEEKLY_BRIEF#` and `EMAILLOG#weekly#`; deleting either gives no mail or a duplicate.
- `newsBreakingAlert` (rule `TriggerBreakingAlert` DISABLED, `DRY_RUN=true`) reads thread analysis and country intelligence when run; the breaking and drift email rules are DISABLED but their code still reads `DRIFT#` and sets a sent flag.
- `newsDailyBrief` builds the daily brief; `newsPostLinkedin` posts externally; its dedupe rows live in `NewsProject-linkedin-posts` (leave).
- Billing and user tables are untouched by every step. IAM changes need a fresh yes.
