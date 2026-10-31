# Step 5 audit: what can be deleted from DynamoDB, in what order (read-only, 2026-10-31)

Method: `aws dynamodb list-tables / describe-table / scan` (key-only scans, nothing written), `aws s3` reads of `record/`, `aws lambda list-functions / get-function-configuration`, `aws events / scheduler`, `scripts/lambda.sh <name> diff`, grep of backend, frontend, Worker. Row counts are live item counts from full key scans (describe-table lags by a few).

## 0. Headline

1. **Nothing in the world tables can be deleted today.** Every world family still has at least one live (non-fallback) reader. The biggest: `/` (SituationHome), `/today` and the board read `topics`/`summary`/`today` (NewsCache `latest`, `today-archive`, `TOPIC#`) with no record view at all; the 30-day pages and the story timeline always call `archive_range` / `narrative_thread` for the newest days (structural, not just a fallback); the daily brief, weekly brief, country facts, country history (member depth), corrections ledger, the map's and board's thread-analysis lists, and the economy page are action-only.
2. **The record does not hold the history before 2026-09-05.** Facts run 2026-09-05..2026-10-31 (57 days, `record/facts/manifest.json`). NewsCache has 177 `archive#` days from 2026-03-07: **141 archive days (6,919 entries) before 09-05 exist only in DynamoDB**. 202 of 330 `THREAD_ANALYSIS` rows (Mar-Sep) belong to stories not in the record (0 of 202 are `story_born` in facts). 5,153 pre-record PRED rows too (section 3). Deleting these loses that history unless exported first (operator decision, destructive).
3. **Two families are ingest inputs of the record and must move to `record/inbox/` before they can go**: NewsCache `archive#`/`today-archive` (entry rows: the facts run's `world.archiveRange`, backend/record/newsStoryRecord/src/store.js:19) and PredictionLog `PRED#` (store.js:24 `world.scenarios`; also the resolver's own PRED scan, newsPredictionResolver/src/store.js:46,51). Inbox kinds that exist and are live: articles 31,089 lines, assignments 243, verdicts 19, draws 9, merges 7 (a `splits` inbox is read by newsStoryRecord/src/index.js but has no files). **There is no inbox for entries or for forecasts.**
4. Some "world" rows are really **send guards or operational state**: `EMAILLOG#weekly#...` (weekly email idempotency marker, newsEmailSender/src/index.js:128,137), the `DRIFT#` "emailed" flag (newsEmailSender/src/index.js:207-236; that send rule is DISABLED but the code is there), `WEEKLY_BRIEF#` (the weekly email's content; send rule ENABLED Sun 14:00 UTC), PredictionLog `SEED#` (commit-reveal secret), `Q#`, `SAMPLE#`, `SETTLE#`.

## 1. Tables (30 in the account; 12 belong to Global Perspectives)

Other projects, out of scope: BestWaifuChatLogs, Currecy-past (2 rows), Currency (9 rows, `BASE#` keys; no repo code, its Lambdas `currencyRouter-dev` etc. are not in functions.json: owner unknown), Polybot*, ppa-*. `NewsProject-linkedin-posts` (about 16k rows, `POSTED#<PLATFORM>#<slug>`) is the social-post dedupe table of newsPostDevTo/newsPostLinkedin (env SOCIAL_POSTS_TABLE): operational; leave.

| Table | Rows | Size | TTL | Class |
|---|---|---|---|---|
| SummarizeAndPredict (PK,SK) | 3,635 (key scan 3,651) | 7.3 MB | DISABLED | world + one ops family (EMAILLOG) |
| NewsCache (id) | 180 (scan 181) | 41.4 MB | DISABLED | ingest working store + archive |
| GlobalPerspectivePredictionLog (PK,SK) | 7,068 | 24.2 MB | DISABLED | forecasts + commitment state |
| GlobalPerspectiveMarkets (pk,sk) | 484 | 0.12 MB | ENABLED | world, economy (parked pipelines, page still routed) |
| GlobalPerspectiveBreakingAlerts (alertKey) | 3 | 0.06 MB | ENABLED | operational (alert dedupe) |
| GlobalPerspectiveClientErrors | 51 | 0.05 MB | - | operational |
| GlobalPerspectiveUserTable / UserPrefs / SavedItems | 13 / 2 / 1 | tiny | - | user data (stays, decision 0003); SavedItems also holds boards (newsBoard/src/store.js:45) |
| GlobalPerspectiveShares, ApiKeys | 0 / 0 | - | - | user/billing-adjacent, empty |

Billing (parked): newsPolarBilling and newsAnalyze update `GlobalPerspectiveUserTable` (newsPolarBilling/src/index.js:98,122; newsAnalyze/src/index.js:123,133,225). No step below touches them.

## 2. Row-key families and counts (class W = world, O = operational)

SummarizeAndPredict:

| Family (PK / SK) | Rows | Class |
|---|---|---|
| `COUNTRY#<name>` / `HISTORY#<date>` | 1,560 | W |
| `COUNTRY#<name>` / `DRIFT#<date>` | 248 | W |
| `COUNTRY#<name>` / `DRIFTLOG#<date>` | 222 | W (permanent copy of DRIFT#) |
| `COUNTRY#<name>` / `COUNTRY_INTELLIGENCE` | 48 | W |
| `THREAD#<id>` / `THREAD_HISTORY#<date>` | 338 | W |
| `THREAD#<id>` / `THREAD_ANALYSIS` | 330 | W |
| `THREAD#<id>` / `TOPICS` (thread-to-topic pointer) | 135 | W (derived) |
| `THREAD#<id>` / `DRIFT#<date>` + `DRIFTLOG#<date>` | 121 + 121 | W |
| `THREAD#<id>` / `WEB` | 119 | W |
| `WEB#INDEX` / `LATEST` | 1 | W (derived) |
| `SYSTEMS#<country>` / `SYSTEMS_ANALYSIS` | 22 | W |
| `ECON#THREAD#<id>` / `ECONOMIC_IMPACT` | 139 | W (parked) |
| `PAIR#<a-and-b>` / `PAIR_ANALYSIS` | 15 | W (parked) |
| `FACTS#<country>` / `COUNTRY_FACTS` | 40 | W |
| `DAILY_BRIEF#<date>` / `DAILY_BRIEF` | 137 | W |
| `WEEKLY_BRIEF#<date>` / `WEEKLY_BRIEF` | 15 | W (feeds the weekly email) |
| `WEEKLY_MARKETS#<date>` / `WEEKLY_MARKETS` | 14 | W (parked) |
| `TOPIC#<topicId>` / `SUMMARY`,`TRACE_CAUSE`,`PREDICTION` | 6 / 6 / 3 | W (short-lived cache; agent prunes, NewsProjectInvokeAgentLambda/src/index.js:1119) |
| `EMAILLOG#weekly#<week>` / `EMAIL_LOG` | 11 | **O: send idempotency marker** |

NewsCache: `archive#YYYY-MM-DD` 177 (2026-03-07..2026-10-31; W + **ingest input**); `today-archive`, `latest`, `staging`, `seen-today` 1 each (ingest working store).

PredictionLog: `PRED#<topicId>`/`<date>` 6,613 (Jun 2,136; Jul 1,228; Aug 1,684; Sep 875; Oct 690; W + **ingest input**); `Q#<qid>` SAMPLED 66, DRAFT# 321, VERDICT 19 (O); `SEED#<week>` COMMIT 6, SECRET 6, REVEAL 3 (O, **SECRET = unrevealed seed**); `SAMPLE#<week>`/DRAW 3 (O, holds the eligible `pool`); `SETTLE#<week>`/`TICK#` 31 (O).

Markets: FX#USD 92, COMMODITIES#GLOBAL 92, CRYPTO#GLOBAL 92, EQUITIES#GLOBAL 92, RATES#GLOBAL 66, MACRO#<country> 50 (LATEST + HISTORY#, TTL 35-90 d). Not in the record in any form. Writer `newsMarketsData` has three ENABLED rules (MarketsDataHourly, MarketsMacrosWeekly, MarketsYieldsDaily). `/economy` is routed (App.jsx:131).

## 3. Is the record complete? (measured)

| Family | In record? | Evidence |
|---|---|---|
| archive entries 2026-09-05..10-31 | **complete modulo the repeat rule** | 1,100 `entry` facts vs 1,331 archive entries in the window; the gap is the documented repeat rule (decision 0046: 118 of 838 in the last 30 days are an article listed again). Only counts compared for older days. 2026-09-05 shows 0 entry facts keyed to it (50 archive entries; cause not diagnosed); 2026-10-20 (14 entries, all repeats per 0046). Facts also cover 21 days with no archive row (09-14..09-29, 10-14, 10-21..10-24: recovered) |
| archive entries before 09-05 | **no** | 141 days, 6,919 entries in DDB only |
| story births | complete for the window | 507 `story_born`; the archive carries 4,124 distinct threadIds overall |
| `THREAD_ANALYSIS` (330) | **partial** | 128 rows have a `story_analysis` note (134 lines, 128 subjects, all with a row). 202 rows are Mar-Sep stories (Mar 96, Apr 25, May 42, Jun 14, Jul 8, Aug 7, Sep 10) not in the record at all |
| `THREAD_HISTORY#` (338) | **no** | no note subtype. Readers: newsDriftCorrector index.js:185, newsBoard connect (`threadHistory`), shared readers.js:165 |
| `COUNTRY_INTELLIGENCE` 48 + `HISTORY#` 1,560 | **complete** | `notes/country` 1,560 lines, 48 subjects; 48 `countries/<ISO3>` views |
| country `DRIFT#`/`DRIFTLOG#` | **complete or near** | 248 DRIFT# dates (union with DRIFTLOG# 222 = 248); 222 country drift notes. The 26 extra DRIFT# rows are newer than DRIFTLOG#; whether each is a note: not checked. Public view carries only the newest note; depth is served by `country_history` |
| thread `DRIFT#`/`DRIFTLOG#` (121) | **partial** | 110 story drift note lines, 99 distinct (story,date): about 22 rows without a note (not itemised) |
| `THREAD#/WEB`, `WEB#INDEX`, `SYSTEMS#` (119/1/22) | **partial** | web notes for 18 countries vs 22 SYSTEMS rows; link notes 372 lines/93 subjects; `index/web.json` + `links/<id>` views are live-read. The view lacks the run `targets.count` (useStoryLinks.js) |
| `TOPICS` pointers (135) | derivable | threadId to topicIds is in entry facts |
| `FACTS#`, `DAILY_BRIEF#`, `WEEKLY_BRIEF#` | **no** | no note subtype, no view |
| `ECON#`, `PAIR#`, `WEEKLY_MARKETS#`, Markets | **no** | economy parked (0009/0031); needs a decision |
| `TOPIC#` (15) | **no** | entry notes (3,761 lines) carry AI text for archived entries, but Home/StoryCard read `TOPIC#` by topicId |
| `PRED#` | **partial, by choice** | 717 rows have a threadId and all 717 are `forecast_drawn` facts; 395 unthreaded rows are also in facts (thread taken from the topic's archive entry). Facts: 1,112 `forecast_drawn`, each traces to a PRED row. **5,501 PRED rows are not in the record**: Jun 2,136 + Jul 1,228 + Aug 1,684 + Sep 453 (09-03: 23, 09-04: 82 before the window; **348 from 09-05..09-30 with no thread, none with `questionSchema`** = the known gap, confirmed) |
| `Q#.../VERDICT` (19) | complete | 19 verdict inbox lines; facts hold 2,470 `verdict` = 19 + 2,451 legacy void |
| `SEED#`/`SAMPLE#` | commit/reveal/draw in facts (`question_commit` 6, `question_draw` 3) | **`draw.pool` and `settleHealth` are not in the record or the track-record view** (newsStoryRecord/src/trackRecord.js:9-10) |
| `EMAILLOG`, BreakingAlerts, ClientErrors, user tables | n/a | keep |

## 4. Writers and readers

Frontend actions go through `src/shared/api/restProxy.js` (proxyAction :90, proxyActionWithAuth :149); read API = `backend/read-api/newsSensitiveData/src/index.js` (deployed `newsSensitiveData-dev`, identical to repo). "Live" = primary path, no record alternative, or called every time. "FB" = only after a record view fails or is empty.

### A. NewsCache (`archive#DAY`, `today-archive`, `latest`, `staging`, `seen-today`)
- Writers: `newsInvokeGemini-dev` (pipeline/newsInvokeGemini/src/index.js:76,394; InvokeGoogleGemini 04:15/12:15/20:15 UTC); `NewsProjectInvokeAgentLambda-dev` (index.js:290, :1069 staging->latest, :1284 `today-archive`, :1314 `archive#DAY`; InvokeNewsAgent 04:25/12:25/20:25 UTC); repair CLI backend/pipeline/cli/threads.mjs:322; lane script .board/linking/country_merge.mjs.
- Readers (Lambdas): `newsStoryRecord` (shared world, store.js:19, runtime.js:13; 23:45 UTC); `newsThreadAnalysis` (index.js:93,104); `newsSystemsAnalysis` (:143,158); `newsCountryIntelligence` (:164,175); `newsDriftCorrector` (:68,201,267); `newsWeeklyBrief` (:164,173); `newsEconomicImpact` (:212,222; rule DISABLED); `newsPairIntelligence` (:273,284; DISABLED); `newsPostDevTo` (:286); `newsPostLinkedin` (:274 latest); `newsBreakingAlert` (:57 latest); `newsRecommend` (:80 latest); `newsBoard` presets/connect via shared `world.latestTopics` (newsBoard/src/world.js:13,19; shared readers.js:52-101); `newsSensitiveData` actions `topics` (:166), `summary/prediction/trace_cause` (:181), `today` (:213), `rss` (:226; reads today-archive then latest, :1656-1681), `narrative_thread` (:365), `archive_range` (:382); reads at :1241,1380,1487-1515,1563-1581,1665,1681.
- Readers (scripts): quality/verify_ddb.js:81, scripts/check-archive-dates.mjs:38, predictions/forecast-ab/run.mjs:166,183, predictions/jev-backtest/run.mjs:54, backend/pipeline/cli/dupes.mjs:58, backend/record/cli/backfill-entry-notes.mjs:53, backfill-link-notes.mjs:82, backfill-story-analysis-notes.mjs:66, capture-entry-notes.mjs:60.
- Frontend: **live** `topics`/`summary`/`prediction`/`trace_cause`/`today` (shared/data/contentService.js:56,91,107,123,136; consumers Home.jsx:195,250,296 for `/today`, useTodayArchive.js:8, `useGeminiTopics` in SituationHome.jsx (route `/`), BoardPage.jsx, useStoryCardData.js:48 map card). **Live** `archive_range` for the newest recorded day onward (shared/api/archiveRange.js:77-91, called every time) and for the countries list (useWeeklyArchive.js:49). **FB** `archive_range` for all 30 days when `index/weekly.json` is unusable (archiveRange.js:80-82). **Live** `narrative_thread` on every story page (useNarrativeThread.js:30; needed for days after `factsThrough` and for stories without a view, e.g. the 202 pre-record stories). Analysis-studio fetchers (analysisContext.js:100-102,121-123).
- Worker (cloudflare/front-worker/production/worker.mjs): bot pre-render calls `topics` (:310), `daily_brief` (:238), `latest_daily_brief` (:242), `weekly_brief` (:273), `thread_preview` (:151), `country_preview` (:178); `/rss` (:428). The Worker reads no table itself.

### B. PredictionLog `PRED#`
- Writers: `NewsProjectInvokeAgentLambda-dev` (index.js:1046 put-once per topic per day; :590 thread reconcile).
- Readers: `newsStoryRecord` (store.js:24, needs `dynamodb:Scan`, policy statement `PredictionLogScan`); `newsPredictionResolver` (store.js:46 window scan, :51 questionSchema scan: how it finds eligible questions); `newsPredictionsSnapshot` (src/index.js:42 full Scan into `predictions/track_record.json`, every 30 min); `newsSensitiveData` `prediction_snapshot` (index.js:608-640) and the `prediction_track_record` live-Scan fallback (:782); `newsSignals` (parked, TriggerSignalsBuild DISABLED; index.js:156,299); scripts quality/calibration_report.js, predictions/review.js, resolve-v1-*.js, settle-correct.js, verify-draw.mjs.
- Frontend: **live** `prediction_snapshot` in `useStoryQuestion` (briefings, :19 by thread), `useCountryStories` (country card, :60), analysis-studio (analysisContext.js:123,161). **FB** in `useThreadForecast` (story page, :34; record view first).

### C. PredictionLog `Q#`, `SEED#`, `SAMPLE#`, `SETTLE#`
- Writer and reader: `newsPredictionResolver` only (index.js:67-111 seed/commit/reveal/sample; :163,193 verdicts; :246 drafts; :309 settle tick). Copies go to `record/inbox/verdicts|draws` (live). `newsPredictionsSnapshot` scans them into `track_record.json` (questionBoard.js:115 `draw.pool`, :144 `settleHealth`). `newsSensitiveData` reads SEED/SAMPLE at index.js:651-660.
- Frontend: **live** `prediction_track_record` for "Verify this draw" (track-record/lib/drawPool.js:7); **FB** for the page (useTrackRecord.js:11-14). `newsFreshnessMonitor` gets `settleHealth` through the proxy (monitoring/newsFreshnessMonitor/src/settleCheck.js:15), so the alarm needs `track_record.json`.

### D. SummarizeAndPredict, thread families

| Family | Writers | Readers: Lambdas | Frontend live | Frontend FB |
|---|---|---|---|---|
| `THREAD_ANALYSIS` | newsThreadAnalysis index.js:261 (04:40 UTC TriggerDailyAnalysis) | newsSystemsAnalysis, newsCountryIntelligence, newsDriftCorrector, newsBreakingAlert :160,301, newsPostDevTo :45, newsWeeklyBrief :57, Econ/Pair/EconQuality (parked), newsBoard presets/connect (`world.analyses`), `thread_analysis` (index.js:398-421), `thread_preview` (:1039), newsSharedAnalysis analysisContext | WeeklyMap.jsx:836 (map thread panel, non-light), usePinInfo.js:27 (board pins), analysis-studio | storyAnalysis.js:14-15; useThreadAnalyses.js light mode (WeeklyPage.jsx:80, CountryPage.jsx:398) |
| `THREAD_HISTORY#` | newsThreadAnalysis index.js:267 | newsDriftCorrector :185, newsBoard connect, shared readers.js:165 | none | none |
| `TOPICS` pointer | agent index.js:612 (lib.js:549-552) | agent :628, shared readers.js:267 (`prediction_snapshot` by thread) | via useStoryQuestion | - |
| thread `DRIFT#`/`DRIFTLOG#` | newsDriftCorrector index.js:124-125, :216 | `thread_analysis` driftNote (index.js:410-421), `corrections_feed` (:551-600 Scan), newsSensitiveData/src/lib.js:22 | corrections ledger (useCorrectionsFeed.js:17) | story page drift reads the view |
| `THREAD#/WEB` + `WEB#INDEX` | newsSystemsAnalysis index.js:540,542 (05:00 UTC) | `web_index` (:741-753), newsBoard presets.js:18 / connect.js:37 | useStoryLinks only for `needsTargets` or unviewed stories (:55-59) | useWebIndex.js:35-41 |
| `SYSTEMS#` | newsSystemsAnalysis index.js:558 | `systems_analysis` (:710-721), newsPairIntelligence | none (legacy branch useStoryLinks.js:31, only when `web_index` itself fails) | legacy |

### E. SummarizeAndPredict, country families

| Family | Writers | Readers: Lambdas | Frontend live | FB |
|---|---|---|---|---|
| `COUNTRY_INTELLIGENCE` | newsCountryIntelligence index.js:536 (05:15 UTC) | `country_intelligence` (:436-445), `country_preview` (:1014), newsBreakingAlert :114, newsPostDevTo :63, newsWeeklyBrief :65, newsDriftCorrector, Pair/Signals | none for the page (country view first) | useCountryIntelligence.js:22-27, :98; useCountryRiskLayer.js:101 |
| `HISTORY#` | newsCountryIntelligence index.js:546 | `country_history` (:487-535), newsDriftCorrector :50, newsBoard connect | `useCountryHistory` (country page: risk snapshots and membership gate come ONLY from this action, :21-30), `useDeskChanges` (account, :39) | - |
| `DRIFT#`/`DRIFTLOG#` | newsDriftCorrector :124-125 (05:30 UTC) | `country_history`, `corrections_feed`, newsEmailSender :207-236 (rule DISABLED), newsCountryIntelligence :310 | country page, corrections ledger | notes from the view when it holds as many (viewDrift.js) |
| `FACTS#` | newsCountryFactsUpdater index.js:286 (Mondays 05:00 JST) | `country_facts` (:465-476), newsCountryIntelligence :336, newsPairIntelligence :408, agent (FACTS_SK :44) | `useCountryFacts` (:14) | - |

### F. Briefs, email log, economy
- `DAILY_BRIEF#`: writer `newsPostDevTo` (index.js:233; 23:00 JST InvokeDev). Readers `daily_brief`/`latest_daily_brief` (index.js:240-285), Worker pre-render. Frontend live: shared/hooks/useDailyBrief.js:92,149; briefings/hooks/useDailyEditionsIndex.js:53.
- `WEEKLY_BRIEF#`: writer `newsWeeklyBrief` (index.js:140; Sun 06:00 UTC). Readers `weekly_brief` (:286-325 Scan), `newsEmailSender` (index.js:117-125; **TriggerWeeklyEmailSend ENABLED Sun 14:00 UTC**), Worker. Frontend live: useWeeklyBrief.js:13.
- `EMAILLOG#weekly#`: newsEmailSender only (index.js:128,137).
- `WEEKLY_MARKETS#`, `ECON#THREAD#`, `PAIR#`: writers newsWeeklyMarkets :181, newsEconomicImpact :737,758, newsPairIntelligence :574 (all rules DISABLED). Readers: `weekly_markets`, `economic_impact*`, `economic_top_movers` actions; frontend economy hooks; newsBreakingAlert :125, newsWeeklyBrief :58, newsSignals.
- `TOPIC#`: agent index.js:573,892 (prune :1119); readers `summary/prediction/trace_cause` (index.js:1299-1314); Home and StoryCard.
- Markets table: writers newsMarketsData index.js:57, newsEconomicQuality :164; readers `markets_global/country/history` (index.js:1060-1200 Scans), newsWeeklyMarkets; frontend useMarketsGlobal/Country/History. Live.
- BreakingAlerts: writer newsBreakingAlert :250,260 (TriggerBreakingAlert ENABLED); readers newsEmailSender :174-183, newsRecommend :24, frontend `list_alerts`/`get_alert` (restProxy.js:354,370). Operational.

## 5. Deployed-vs-repo drift (read-only `scripts/lambda.sh <name> diff`)
- newsStoryRecord and newsSensitiveData-dev: identical to repo.
- NewsProjectInvokeAgentLambda-dev: deployed `_shared/notes.js` is older than the repo (repo ahead; `questionScoring.js`, `questionState.js` only in repo). Deploy the repo version before the agent is changed again.
- newsInvokeGemini-dev: repo is ahead (RSS parse moved to `_shared/rss`), same behaviour.
- The other ~35 Lambdas were not diffed. `newsAnalyze` is known to differ (parked credits; leave).
- Deployed but not in functions.json (other projects): GCF*, ecbHistory, imfHistory, currencyRouter, geminiCurrency, PPA*, Polybot*, MemoryLambda, OpenAIProxy, requestUpload, LogWaifuActivity, `so-v3-engine` (owner unknown), the Amplify role-updater. Nothing found reading the GP world tables, but they have no repo code, so "unknown" for them.

## 6. Recommended deletion order and exact preconditions

Rule for every step: export the family to S3 first, then delete under a fresh operator "yes". Order is by dependency depth: derived rows first, ingest inputs last.

| # | Family (rows) | In record? | Preconditions / blockers |
|---|---|---|---|
| 1 | `DRIFTLOG#` country 222 + thread 121 | complete (duplicate of DRIFT# and notes) | On 0035's retire list. `country_history`, `corrections_feed` (index.js:487-600) and newsSensitiveData/src/lib.js:22 stop reading DRIFTLOG# (read drift notes with the member depth gate kept in the Lambda); stop the put (newsDriftCorrector index.js:125); first write notes for the 26 country DRIFT# rows newer than DRIFTLOG# and the ~22 thread rows with no note |
| 2 | `WEB#INDEX` 1, `THREAD#/WEB` 119, `SYSTEMS#` 22 | partial | Add run `targets.count` to the web view (or drop that wording) so `useStoryLinks` stops calling `web_index` (:55); backfill the 4 countries without a web note or accept; point newsBoard presets.js:18/connect.js:37 at `index/web.json`; remove FB `loadFromAction` (useWebIndex.js:24-41), legacy `useLegacyLinks`/`systems_analysis` (useStoryLinks.js:25-48; action index.js:710), action `web_index` (:741); stop newsSystemsAnalysis puts (index.js:540,542,558) |
| 3 | `THREAD_HISTORY#` 338 | **no** | Add a note type (from the THREAD_ANALYSIS payload) in newsThreadAnalysis plus backfill, or drop the feature; move newsDriftCorrector :185 and newsBoard connect scores; then stop index.js:267 |
| 4 | `TOPICS` pointers 135 | derivable | Replace `world.threadTopics` (readers.js:267) and the agent read (index.js:628) with facts or views; do after step 7 (`prediction_snapshot` by thread uses it); stop the agent put (:612) |
| 5 | thread `THREAD_ANALYSIS` 330 + thread `DRIFT#` 121 | partial: 202 pre-record rows | Operator decision on the 202 pre-record stories (export, or accept 404 deep links now served by `thread_analysis`/`narrative_thread`). Remove live readers: WeeklyMap.jsx:836 (needs trajectory, rootCauseChain, entryShortTitles), usePinInfo.js:27, analysis-studio and newsSharedAnalysis; remove FBs storyAnalysis.js:14-15, useThreadAnalyses light FB. Re-point Lambdas: newsBreakingAlert :160,301 (**user-facing send**), newsPostDevTo :45, newsWeeklyBrief :57, newsSystemsAnalysis, newsCountryIntelligence, newsBoard presets/connect, `thread_preview` (worker.mjs:151). Then stop newsThreadAnalysis puts (index.js:261,267) |
| 6 | `COUNTRY#` intelligence 48, `HISTORY#` 1,560, country `DRIFT#` 248, `FACTS#` 40 | intel/history/drift complete; FACTS no | Move `country_history` snapshots and membership gating to record notes/views (useCountryHistory.js:21-30, useDeskChanges.js:39); `corrections_feed` to drift notes; give `country_facts` a note/view or leave it; remove FB `fetchCountryBriefing` (useCountryIntelligence.js:22-27,98) and useCountryRiskLayer.js:101; re-point newsBreakingAlert :114 (user-facing), newsPostDevTo :63, newsWeeklyBrief :65, newsDriftCorrector :50, newsBoard connect, `country_preview`. Remove or re-home the newsEmailSender DRIFT# reader and sent-flag (index.js:207-236) first |
| 7 | `PRED#` 6,613 | partial; 5,501 not in record | **Move ingest to an inbox**: the agent writes a `record/inbox/forecasts/DAY.jsonl` line per forecast (replacing the PRED# put, index.js:1046); `newsStoryRecord` reads it in place of `world.scenarios` (store.js:24); the resolver's eligible-question scan (store.js:46,51) reads `forecast_drawn` facts; `newsPredictionsSnapshot` builds the track record from facts and inbox instead of a full log Scan; put `draw.pool` in the draws inbox line and `settleHealth` somewhere the freshness monitor reads; remove live `prediction_snapshot` readers (useStoryQuestion.js:19, useCountryStories.js:60, analysisContext) and FB useThreadForecast.js:34, then the action (index.js:608). Decide the 5,153 pre-09-05 rows (they back the frozen legacy figures; export) and the 348 unthreaded 09-05..09-30 rows (known gap: export then drop) |
| 8 | PredictionLog `Q#`, `SEED#`, `SAMPLE#`, `SETTLE#` | verdict, commit and draw are in facts; operational state is not | **Do not delete in step 5.** Resolver put-once state and the unrevealed seed. Moving to S3 is a separate design; until then PredictionLog stays with only these families |
| 9 | NewsCache `archive#` 177 + `today-archive`, `latest`, `staging`, `seen-today` | complete from 09-05 only | **Last.** (a) entry inbox: agent writes entries (final `threadId`, topicId, ai, iso3, sources) to `record/inbox/entries/DAY.jsonl`; `newsStoryRecord` reads it instead of `world.archiveRange` (store.js:19). (b) Re-point the daily Lambdas that read archive/today-archive/latest (4A) to facts/views. (c) Pages: `/today`, `/`, board, StoryCard need a "today" view replacing `topics`/`summary`/`prediction`/`trace_cause`/`today` and `TOPIC#`; story timeline needs `narrative_thread` replaced (views built at ingest, not nightly, or the inbox supplies the recent days); the 30-day pages need an index built after each ingest to drop the always-called `archive_range` (archiveRange.js:77-91); the countries list needs 0046 adopted (operator item 3). (d) `rss`, newsPostDevTo, newsPostLinkedin, newsBreakingAlert, newsRecommend read `latest`/`today-archive`. (e) Decide the 141 pre-09-05 archive days (export then drop, or backfill facts) |
| 10 | `DAILY_BRIEF#` 137, `WEEKLY_BRIEF#` 15 | **no** | No record shape. Decide (reading/note, or keep as non-record published artifact). `WEEKLY_BRIEF#` feeds the ENABLED weekly email: cannot go until the email reads something else. `DAILY_BRIEF#` is read by the Worker pre-render and 3 hooks |
| 11 | `EMAILLOG#weekly#` 11 | n/a (send guard) | Keep, or move the marker to S3 first. Deleting risks a duplicate weekly email at the next Sunday run (user-facing send) |
| 12 | Markets 484, `ECON#` 139, `PAIR#` 15, `WEEKLY_MARKETS#` 14 | **no** | Retired in code 2026-10-31 (decision 0049: route, readers and Lambdas removed; rules DISABLED). Export if wanted, then delete under a fresh operator yes. |
| - | BreakingAlerts, ClientErrors, linkedin-posts, user/billing tables | n/a | Not touched |

What becomes dead: steps 1-6 leave the Lambdas alive (they keep writing notes), only their DDB puts go. Step 7 kills the agent's PRED# put and `prediction_snapshot`. Step 9 shrinks `newsSensitiveData-dev` to the member-gated actions. `newsSignals` (+ disabled `TriggerSignalsBuild`, decision 0032), `newsEconomicImpact`, `newsEconomicQuality`, `newsPairIntelligence`, `newsWeeklyMarkets` (all rules DISABLED) read the world tables: delete or stub them before the tables go. `TriggerImpactAudit` (disabled) and `TriggerSelectionShadow` (past its end, P7d) read corpus/capture, not the tables.

## 7. Frontend fallbacks to remove (after the matching step)

Record first with an action fallback:
- shared/api/archiveRange.js:77-91 (`actionDays` when the index is missing; the newest-days call is structural, see step 9c)
- shared/api/storyAnalysis.js:14-15 (`thread_analysis`)
- features/threads/hooks/useThreadAnalyses.js (action path for light mode; non-light stays live for WeeklyMap)
- features/countries/hooks/useCountryIntelligence.js:22-27,98; features/map/hooks/useCountryRiskLayer.js:101 (`country_intelligence`)
- features/threads/hooks/useThreadForecast.js:34 (`prediction_snapshot`)
- features/threads/hooks/useWebIndex.js:24-41; useStoryLinks.js:25-48,55 (`web_index`, `systems_analysis`)
- features/track-record/hooks/useTrackRecord.js:11-14 (`prediction_track_record`)
- features/countries/hooks/useCountryHistory.js (drift notes view with action backing)

Live action calls with no record alternative (blockers, not fallbacks): `topics`/`summary`/`prediction`/`trace_cause`/`today` (contentService.js), `narrative_thread`, `archive_range` (newest days, countries list), `thread_analysis` (WeeklyMap, usePinInfo, analysisContext), `country_history`, `corrections_feed`, `country_facts`, `daily_brief`/`latest_daily_brief`/`weekly_brief`, `prediction_snapshot` (useStoryQuestion, useCountryStories, analysisContext), `prediction_track_record` (drawPool.js:7), economy actions, `systems_analysis` (legacy). The Worker (worker.mjs:151,178,238,242,273,310,428) depends on `thread_preview`, `country_preview`, `daily_brief`, `latest_daily_brief`, `weekly_brief`, `topics`, `rss`.

## 8. What would break a user-facing send, billing, or user data
- Weekly email (TriggerWeeklyEmailSend ENABLED): reads `WEEKLY_BRIEF#` (newsEmailSender/src/index.js:117-125) and `EMAILLOG#weekly#` (:128), recipients from `GlobalPerspectiveUserPrefs`. Deleting either gives no mail or a duplicate.
- `newsBreakingAlert` (TriggerBreakingAlert ENABLED every 8 h): reads `latest`, `THREAD_ANALYSIS`, `COUNTRY_INTELLIGENCE`, `ECON#`; writes the BreakingAlerts table. Breaking and drift email rules are DISABLED but their code still reads `DRIFT#` and sets a sent flag (index.js:214,235).
- `newsPostDevTo` (23:00 JST) and `newsPostLinkedin` (every 3 h) post externally from `today-archive`/`latest`/`THREAD_ANALYSIS`/`COUNTRY_INTELLIGENCE`; dedupe rows live in `NewsProject-linkedin-posts` (leave).
- Billing and user tables (UserTable, UserPrefs, SavedItems incl. boards, Shares, ApiKeys) are untouched by every step. `newsBoard` reads user tables and also world rows through `world.js` (steps 2, 5, 6, 9).
- IAM: removing the PredictionLog Scan statement from newsStoryRecord's role, or table access from other roles, is an IAM change and needs a fresh yes.

## 9. Unsure / not verified
- Entry-by-entry equality of facts vs archive (only counts and the 0046 measurement); why 2026-09-05 has 0 entry facts keyed to it.
- Whether the 26 country DRIFT# rows without a DRIFTLOG# and the ~22 thread drift rows without a note exist as notes (counts say not exactly).
- Why 4 of 22 SYSTEMS countries lack a web note.
- Owner of `Currency`/`Currecy-past` and `so-v3-engine` (no repo code).
- `newsSignals` consumers (ApiKeys table is empty, so likely none).
- Deployed diffs for the other ~35 Lambdas were not run.
- Nothing was clicked in a browser; "live" is from code, not from the served bundle.
