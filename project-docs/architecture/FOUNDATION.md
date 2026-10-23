# Foundation stocktake (draft)

A dated stocktake (2026-10-21), read for the plan; live state is in [the plan](../plans/PLAN_2026-10-21_foundation.md) and in `reference/*.md`. It describes 2026-10-21 and is not updated: since then `newsStoryRecord` writes the live `record/facts/`, `record/runs/` and `record/views/` daily (rule `TriggerStoryRecord`), the selector captures `record/inbox/articles/`, and `article`, `assignment` and canonical-actor handling exist (decision 0040), so rows below that say the record has no schedule, no views or no inbox are superseded. `record/shadow/` still holds the old dry-run output.

Date: 2026-10-21. Purpose: before building more on the target in [ARCHITECTURE_TIMELINE.md](ARCHITECTURE_TIMELINE.md), record exactly what data we hold, what it is for, what duplicates what and which IDs it carries. Read-only: facts come from code (grep) and live AWS (ap-northeast-1, `get-item`/`query`/`s3 ls`, never Scan). Anything not checked says "not verified" or "not probed". Vocabulary: facts, readings, views, one reader (`backend/shared/src/world/`, here "world/"). NSD = `newsSensitiveData` (deployed as `newsSensitiveData-dev`), the read-api Lambda the frontend calls through `restProxy.js`. Table TTL is DISABLED on all five tables (`describe-time-to-live`); a `ttl` attribute is written but nothing deletes by it (the one exception is TOPIC# pruning by generation, `lib.js` ~445).

Live sizes (`describe-table`): NewsCache 174 items / 40.3 MB; SummarizeAndPredict 3,334 / 6.7 MB; GlobalPerspectivePredictionLog 6,580 / 23.5 MB; GlobalPerspectiveSavedItems 1 / 2 KB; GlobalPerspectiveUserPrefs 2 / 387 B.

## A. DynamoDB key patterns

Key shapes: NewsCache `id`; SummarizeAndPredict and PredictionLog `PK`+`SK`; SavedItems `uid`+`savedKey`; UserPrefs `uid`.

### A1. NewsCache (key `id`)

| Pattern | Holds | Writer | Reader(s) | Date range | Natural ID | TTL attr | Duplicates / overlaps |
|---|---|---|---|---|---|---|---|
| `archive#YYYY-MM-DD` | one day's story entries, with AI text (summary, prediction, trace_cause) | `NewsProjectInvokeAgentLambda` (`buildArchiveEntry`, index.js ~1157) | world `archiveDay`; NSD archive actions; newsWeeklyBrief, newsPostDevTo, newsThreadAnalysis, newsCountryIntelligence, newsSystemsAnalysis, newsInvokeGemini, newsDriftCorrector, newsEconomic* (parked), newsPairIntelligence (parked) | probed 201 days back: 2026-04-04 .. 2026-10-20 (rows present for 142 of 201 days; 2026-10-21 absent, see `today-archive`); gaps in G | entry: `topicId` (`title-<rank>`, unstable), `threadId`, `generationId` | yes, `ttl` ~90 d, not enforced | Entry text is also in `TOPIC#` rows (`SUMMARY`/`PREDICTION`/`TRACE_CAUSE`) and in `record/shadow/timeline` (derived). Same story re-appears in `latest` and `today-archive` |
| `today-archive` | current UTC day's entries, all runs of the day | `NewsProjectInvokeAgentLambda` (index.js ~1277) | world `archiveDay` (nowMs); NSD; newsPostDevTo; newsPostLinkedIn is `latest` only | 1 row, 24 h life (`ARCHIVE_TTL_HOURS`) | same as archive | yes, 24 h, not enforced | Overlaps `archive#<today>` (day rows show `updatedAt` between 12:00 and 20:30 UTC, not verified how often rewritten) |
| `latest` | the current topic pool (newest generation): topics with `significance`, `urgency`, `primaryCountry`, `x_trending`, `threadId` | `NewsProjectInvokeAgentLambda` (`ACTIVE_ITEM_ID`) | world `latestTopics`; NSD; newsBreakingAlert; newsRecommend; newsPostLinkedIn; newsDriftCorrector | 1 row (live probe: 14 topics) | `topicId` / `id`, `threadId` | no | `significance`/`urgency`/`primaryCountry` exist ONLY here (not copied into archive entries) |
| `staging` | topic list the selector produced, before story writer promotes it | `newsInvokeGemini` (CACHE_ID default) | `NewsProjectInvokeAgentLambda` (run-guard.js) | 1 row (14 topics, no `threadId`) | `id` per topic | no | Same topics as `latest` one step earlier |
| `seen-today` | dedupe list `{fingerprint, seenAt, title}` for the selector | `newsInvokeGemini` (`SEEN_TOPICS_ID`) | `newsInvokeGemini` | 1 row (38 entries) | fingerprint | no | none |

NewsCache count check: 142 archive rows (probe) + 4 singleton rows = 146 of 174 items. The other 28 are not accounted for: older than the probe window (before 2026-04-04) or other ids; not verified (no Scan allowed).

### A2. SummarizeAndPredict (key `PK`,`SK`)

| Pattern (PK / SK) | Holds | Writer | Reader(s) | Date range | Natural ID | TTL attr | Duplicates / overlaps |
|---|---|---|---|---|---|---|---|
| `TOPIC#<topicId>` / `SUMMARY`, `PREDICTION`, `TRACE_CAUSE` | per-topic AI text (`content`, model, provider, sourceFingerprint) | `NewsProjectInvokeAgentLambda` (`writeCache`, `touchItem`) | NSD actions summary/prediction/trace_cause (-> StoryCard); newsPostDevTo, newsPostLinkedIn (SUMMARY) | current generation only (pruned by `lib.js` prune rule) | `topicId` (title-based), `threadId` attr | yes, 3 d (259200 s) | Same text as `ai.*` inside archive entries (archive trims to 1,500 chars) |
| `THREAD#<threadId>` / `TOPICS` | pointer thread -> current `topicId` + set `topicIds` (every topicId ever) | `NewsProjectInvokeAgentLambda` (`threadPointerUpdate`) | world `scenarios({threadId})`; NSD | one row per thread, no ttl, grows forever | `threadId` | none | `topicIds` duplicates the thread->entries link derivable from archive |
| `THREAD#<threadId>` / `THREAD_ANALYSIS` | risk score, lead, trajectory, dimensions, keyActors, entryTopicIds | `newsThreadAnalysis` (daily, `TriggerDailyAnalysis`) | world `threadAnalysis`; NSD; newsBreakingAlert, newsWeeklyBrief, newsPostDevTo, newsCountryIntelligence | not probed (sample thread has 1 row) | `threadId` | yes 90 d | `THREAD_HISTORY#` holds past versions |
| `THREAD#<threadId>` / `THREAD_HISTORY#<date>` | daily snapshot of the analysis | `newsThreadAnalysis` | world `threadHistory`; newsDriftCorrector; NSD | sample thread: 2026-10-02 .. 2026-10-19 (10 rows) | `threadId`+date | yes 60 d | overlaps `THREAD_ANALYSIS` (latest = newest history) |
| `THREAD#<threadId>` / `DRIFT#<date>` | "what changed" note | `newsDriftCorrector` | world `driftNotes`; NSD; newsEmailSender (country only) | sample thread: 2026-10-03 .. 2026-10-19 (9) | `threadId`+date | yes 60 d | `DRIFTLOG#` copy of the same note |
| `THREAD#<threadId>` / `DRIFTLOG#<date>` | permanent copy of the drift note | `newsDriftCorrector` (`putDriftNote`) | world `driftNotes`; NSD (member history) | sample thread: 9 rows, same dates as DRIFT | `threadId`+date | NO ttl (permanent) | duplicates `DRIFT#` field for field (`{...base}` written twice, index.js 121-122) |
| `THREAD#<threadId>` / `WEB` | per-story web record (links, places) | `newsSystemsAnalysis` (webRecords.js) | NSD (web_thread) | 1 row per thread in web | `threadId` | none | subset of `WEB#INDEX/LATEST` and `web/latest.json` |
| `COUNTRY#<countryName>` / `COUNTRY_INTELLIGENCE` | country briefing, risk, level | `newsCountryIntelligence` (05:15 UTC) | NSD; newsBreakingAlert, newsWeeklyBrief, newsPostDevTo; newsSignals (Scan `begins_with COUNTRY#`) | France: 1 row | country NAME (not iso3) | yes 90 d | `HISTORY#` holds past versions |
| `COUNTRY#<name>` / `HISTORY#<date>` | daily country snapshot | `newsCountryIntelligence` | world `countryHistory`; newsDriftCorrector; NSD | France: 2026-04-26 .. 2026-10-16 (88 rows) | name+date | yes | overlaps COUNTRY_INTELLIGENCE |
| `COUNTRY#<name>` / `DRIFT#<date>`, `DRIFTLOG#<date>` | country drift note and permanent copy | `newsDriftCorrector` | world; NSD; newsEmailSender (DRIFT only) | France: DRIFT 2026-06-30 .. 10-09 (33); DRIFTLOG 2026-07-08 .. 10-09 (32) | name+date | DRIFT 60 d; DRIFTLOG none | same duplication as thread notes |
| `FACTS#<countryName>` / `COUNTRY_FACTS` | Wikidata country facts | `newsCountryFactsUpdater` (Mon 05:00 JST) | NSD; `NewsProjectInvokeAgentLambda` (forecast inputs); countryFacts.js (frontend, via NSD) | 1 row per country | country NAME | yes 90 d | none |
| `SYSTEMS#<countryName>` / `SYSTEMS_ANALYSIS` | per-country relationship graph input (nodes, edges, backbone) | `newsSystemsAnalysis` | `newsSystemsAnalysis` (builds `WEB#INDEX`, `THREAD#/WEB`); NSD | France: 1 row | country name | yes (line 548) though a code comment at line 530 says no ttl | feeds `WEB#INDEX` and `web/` |
| `WEB#INDEX` / `LATEST` | whole-site link graph (links, shared pairs, threads) | `newsSystemsAnalysis` | world `webIndex`; NSD; newsWeeklyBrief | 1 row | none | none | Same content as S3 `web/latest.json` |
| `DAILY_BRIEF#<date>` / `DAILY_BRIEF` | daily brief for `/daily` | `newsPostDevTo` (23:00 UTC, scheduler `InvokeDev`) | NSD `latest_daily_brief`; `useDailyBrief.js` | probed 95 days: 55 rows, 2026-07-26 .. 2026-10-19 (missing dates in G) | `dateKey` | yes | none |
| `WEEKLY_BRIEF#<weekKey>` / `WEEKLY_BRIEF` | weekly brief draft/published (`weekKey` = a date, `newsWeeklyBrief` line 42) | `newsWeeklyBrief` (Sun 06:00 UTC) | newsEmailSender, NSD, `distribution/cli/weekly/review.js` | not probed | `weekOf` | yes | Planned S3 `weekly/` does not exist yet (B) |
| `EMAILLOG#weekly#<weekOf>` / `EMAIL_LOG` | send marker (idempotence) | `newsEmailSender` | `newsEmailSender` | not probed | `weekOf` | not verified | none |

### A3. GlobalPerspectivePredictionLog (key `PK`,`SK`)

| Pattern | Holds | Writer | Reader(s) | Date range | Natural ID | TTL | Duplicates / overlaps |
|---|---|---|---|---|---|---|---|
| `PRED#<topicId>` / `<YYYY-MM-DD>` | immutable forecast snapshot: scenarios, triggers (`id`, `qid`, due, p) | `NewsProjectInvokeAgentLambda` (index.js ~1037, conditional put) | world `scenarios` (one bounded Scan for date range); NSD; newsPredictionsSnapshot (Scan); resolver (Scan) | `track_record.json`: 4,082 logged + 2,492 legacy = 6,574 of the 6,580 items; `eraCutFrom` 2026-07-04; oldest row not probed (needs Scan) | `topicId` (contains spaces/title) + date; `threadId` attr (copied or founded) | none | Triggers are re-derived into `predictions/track_record.json` (S3) |
| `Q#<qid>` / `SAMPLED` | question drawn into the weekly sample | `newsPredictionResolver` | world `sampledQuestions` (Scan if no qids); NSD; snapshot | weeks 2026-W41 .. W43 (SAMPLE#W41,W42 each 1 row) | `qid` = sha256(pk\|sk\|triggerId)[:20] | none | none |
| `Q#<qid>` / `DRAFT#<iso>` | agent draft verdict (operator-only) | `newsPredictionResolver` | resolver | not probed | `qid` | none | precedes VERDICT |
| `Q#<qid>` / `VERDICT`, `VERDICT#<n>` | settled yes/no/void | `newsPredictionResolver` | world `verdicts`; NSD; snapshot | no VERDICT row existed live on 2026-10-20 per world/README; not re-probed | `qid` + n | none | none |
| `SEED#<isoWeek>` / `COMMIT`, `SECRET`, `REVEAL` | commit-reveal seed for the sample | `newsPredictionResolver` | resolver; snapshot (SECRET excluded) | W41, W42, W43 present (W36, W38, W40: none) | `weekId` | none | none |
| `SAMPLE#<isoWeek>` / `DRAW` | the weekly draw | `newsPredictionResolver` | resolver; snapshot | W41, W42 present; W43 none yet | `weekId` | none | none |
| `SETTLE#<isoWeek>` / `TICK#<iso>` | one row per daily settle tick | `newsPredictionResolver` (10:30 UTC) | snapshot | W40 (5 rows), W41 (7), W42 (7), W43 (2 so far) | iso time | none | none |

### A4. User tables

| Pattern | Table | Holds | Writer | Reader(s) | Range | Natural ID | TTL | Overlap |
|---|---|---|---|---|---|---|---|---|
| `uid` / `board#<boardId>` | GlobalPerspectiveSavedItems | a board: pins, strings, weights, dismissed, summary versions, `lastVisitedAt` | `newsBoard` (store.js) | `newsBoard` | 1 item in table, not probed per key | `boardId` (+ `pinId` per pin; string = pair `a`,`b` of pinIds) | none | pins point at `threadId`/ISO3/actor name |
| `uid` / `<itemType>#<itemId>` | GlobalPerspectiveSavedItems | user-saved item with metadata | `newsSavedItems` (`buildSavedKey`) | `newsSavedItems`, `newsRecommend` (loadSavedItems) | not probed | `itemType#itemId` | none | none |
| `uid` | GlobalPerspectiveUserPrefs | opt-ins, `followedCountries` (set), `followedThreads`, `followedActors`, cached profile | `newsRecommend`, `newsBoard` (follows) | same, `newsEmailSender` | 2 items | `uid` | none | follows live here, boards in SavedItems |

Other tables exist outside this scope (`aws dynamodb list-tables`): GlobalPerspectiveBreakingAlerts, Shares, ClientErrors, ApiKeys, UserTable, Markets, NewsProject-linkedin-posts (`POSTED#` dedupe keys).

## B. S3 prefixes (bucket globalperspective-world-280362093938)

Counts from `aws s3 ls --recursive` on 2026-10-21 (sizes in bytes of the listing; "mod" = LastModified).

| Prefix | What | Writer | Reader | Objects / size | Oldest..newest key | Lifecycle | ID in key | Overlaps |
|---|---|---|---|---|---|---|---|---|
| `world/YYYY/MM/DD/HH/HHMM.json`, `world/latest.json`, `latest.member.json` | map "world" bundle per tracker run: situations, freshness, lede | `newsSituationTracker` (30 min) | frontend via Worker `/data/world/latest.json`; newsSituationTracker | 2,081 / 62.7 MB (+2 latest 38 KB) | 2026/09/08/09/0907 .. 2026/10/21/10/1013 | 30 d to IA, expire 400 d | none (time) | same cadence and count as `situations/history` (2,081 each) |
| `world/shadow/...` | dry-run copy of the world bundle | `newsSituationTracker` DRY_RUN | none found | 6 / 4.7 KB | 2026/09/08/08/0838 .. 0859 | covered by `world/` rule | none | stale since 2026-09-08 |
| `situations/state/<situationKey>.json` | one open situation each | `newsSituationTracker` | Worker (`/data/situations/state/`), frontend map; tracker | 28 / 56.8 KB | n/a | none | `situationId` (`news#<storyId>`, `gdacs#<eventKey>`) in body; key is a sanitized form | `stories/state` has the cluster it came from |
| `situations/index.json`, `situations/inbox/`, `situations/archive/` | index; GDACS inbox; closed situations | tracker; `newsGdacsIngest` | tracker | archive 1,477 / 2.8 MB; inbox 1; index 1 | archive keys `gdacs_DR_<n>`, `news_<axis>_<ISO3>_<slug>` | archive: 30 d to IA; inbox/processed 30 d expire | situation key | none |
| `situations/history/YYYY/MM/DD/HH/HHMM.json` | situation summaries per run | `newsSituationTracker` | only `scripts/situations-log.mjs` (no Lambda) | 2,081 / 50.3 MB | 2026/09/08/09/0907 .. 2026/10/21/10/1013 | 30 d to IA, NO expiry | none | summaries of what `world/` snapshot already holds |
| `stories/state/<storyKey>.json`, `stories/index.json`, `stories/classify-cache.json` | map story clusters (not editorial threads) | `newsSituationIngest` (hourly) | tracker (index), Worker (`stories/state`), `NewsProjectInvokeAgentLambda` matcher | state 3,436 / 2.5 MB; index+cache 0.97 MB | state mod 2026-09-08 .. 10-20 | 15 d IA, expire 45 d | `storyId` = `<axis>_<ISO3>_<slug>` | map "story" vs editorial "thread" = two Story concepts |
| `threads/story-map.json` | links map stories to threadIds (URL-exact + fingerprint) | `NewsProjectInvokeAgentLambda` (matcher) | `newsSituationTracker`, `backend/pipeline/cli/threads.mjs` | 1 / 5.8 KB | mod 2026-10-20 | none | storyId -> threadId | bridge between the two Story ids |
| `corpus/YYYY/MM/DD/HH.jsonl` | classified headlines, hourly, append-only | `newsSituationIngest` | `newsSelectionShadow`, `newsImpactAudit` | 1,009 / 119 MB | 2026/09/08/12 .. 2026/10/20/14 (43 days, nothing after 10-20 14 UTC though `stories/index.json` updated 10-21 09:50 UTC; cause not investigated) | 30 d IA, expire 400 d | per article: url/domain (not verified) | the headlines behind `stories/` and `archive#` sources |
| `corpus/gdelt/YYYY-MM-DD.json`, `corpus/gdacs/latest.json` | GDELT conflict counts; GDACS alerts | `newsGdeltConflict` (6 h); `newsGdacsIngest` (20 min) | `newsImpactAudit` (DISABLED) | gdelt 43 / 183 KB; gdacs 1 / 74 KB | gdelt 2026-09-10 .. 10-21 | `corpus/` rule (400 d) | date | none |
| `web/YYYY/MM/DD.json`, `web/latest.json` | story web (links between threads) | `newsSystemsAnalysis` (05:00 UTC) | world `webLatest`/`webAt`; `newsStoryRecord` | 3 + latest / 1.6 MB (~0.4 MB each) | 2026/10/19 .. 10/21 | none | `runId` in body | same body as `WEB#INDEX/LATEST` in DynamoDB; only 3 days held |
| `predictions/track_record.json` | scored forecast summary | `newsPredictionsSnapshot` (30 min) | NSD, track record page | 1 / 249 KB | rebuilt 2026-10-21 | none | none | derived from `PRED#`/`Q#` rows |
| `signals/latest.json`, `signals/snapshots/YYYY-MM-DD.json` | signal API snapshots (product parked) | `newsSignals` build (rule DISABLED) | `newsSignals` | 40 snapshots / 1.03 GB (~25 MB each); latest 23 MB | 2026-09-09 .. 2026-10-18 | 30 d Glacier IR, expire 365 d | date | duplicates data from DynamoDB and `world/` |
| `record/shadow/timeline/YYYY-MM-DD.jsonl`, `stories/<threadId>/{DATE,latest}.json`, `index.json`, `corrections/` | the record writer's dry-run output (no live `record/facts` or `record/stories`) | `newsStoryRecord` (no schedule, no resource policy: manual invoke only) | none live. `newsBoard` reads `record/index.json` and `record/stories/<id>/latest.json`, which do not exist | 558 / 19.8 MB: 20 timeline days, 267 stories x 2 | timeline 2026-09-30 .. 2026-10-20 (no 10-14) | none | `eventId`, `threadId` | board reads the non-shadow path, so `recordAvailable` is false for every pin |
| `audit/ingest-capture/DATE/HHMM.json`, `audit/selection-shadow/...`, `audit/impact/DATE.json` | selector capture; selection experiment; impact audit | `newsInvokeGemini`; `newsSelectionShadow`; `newsImpactAudit` (DISABLED) | `newsSelectionShadow` reads capture; shadow output: no reader found; impact: none | 8 / 0.6 MB; 5 / 60 KB; 5 / 21 KB | capture 10-17 .. 10-19; impact 2026-09-09 .. 09-12 | `audit/impact` 400 d; the other two none | date | none |
| `tags/backfill/2026-09-11.json` | one-off backfill | no code references it | none found | 1 / 246 KB | 2026-09-11 | none | none | orphan |
| `weekly/` | planned weekly report (backend/weekly/README.md) | none | none | does not exist | | | | |

Lifecycle rules live (`get-bucket-lifecycle-configuration`): corpus/ 400 d; situations/history IA only; world/ 400 d; situations/inbox/processed 30 d; situations/archive IA only; stories/ 45 d; signals/snapshots 365 d; audit/impact 400 d; abort-incomplete-MPU.

## C. Entry fields (archive entry)

Sampled: 8 live archive days (2026-08-15, 09-10, 10-05, 10-10, 10-15, 10-18..10-20), 310 entries, with `buildArchiveEntry` (index.js ~1157) and world/readers.js `entry()`. 803 `sources[]` rows. Count = entries holding the field non-empty.

| Field | Count of 310 | Presence | Source of record object |
|---|---|---|---|
| `topicId`, `threadId`, `title`, `category` (first of `categories`), `regions`, `search_keywords`, `sources`, `archivedAt`, `generationId`, `ai` | 310 | always | `threadId` -> Story; `topicId` -> Entry/Fact (with `generationId`) |
| `iso3` | 210 | sometimes: all rows from 2026-09-12 on; absent on 08-15 and 09-10 (09-11 not probed) | Country (by ISO3) |
| `actors` (names) | 175 non-empty of 210 carrying it | rows from 2026-09-30 on 100% carry the field but 80-95% non-empty; absent on 08-15, 09-10 | Actor (name string only) |
| `event_type` | 210 | sometimes: same boundary as `iso3` | Fact `type` |
| `continues_topic` | 124 | sometimes (~40%) | Story link (thread continuation) |
| `ai.summary`, `ai.prediction`, `ai.trace_cause` | 310 each | always (strings, trimmed to 1,500 chars) | none (text only); prediction text is separate from `PRED#` |
| `sources[].source` (domain) | 803 | always | Source (by domain string) |
| `sources[].title`, `url`, `tier` | 803 | always | Fact evidence |
| `sources[].snippet` | 769 | usually (96%) | Fact evidence |
| `sources[].age` ("8 hours ago") | 796 | usually; relative text, no absolute publish time | none usable |
| `sources[].outletType`, `outletCountry` | 731 of 803 | sometimes (absent in older rows) | Source (type: wire/national/regional) |
| `sources[].enrichScore` | 153 | rarely (19%) | none |

Not on the entry at all: `publishedAt` (only `archivedAt`, our write time), per-source IDs, actor IDs, a numeric score, `significance`, `urgency`, `primaryCountry`, `x_trending` (these exist only on the `latest`/`staging` topic and are not archived). `schemaVersion`: none (grep of `backend/` finds no `schemaVersion`). `world/readers.js` additionally keeps `date`, `archive`, `eventType`, `continuesTopic`, `sourceRow`, `sourceKey` (derived). Record timeline lines (`record/shadow/timeline`) carry `eventId, sourceKey, at, date, kind, threadId, iso3, actors, sources, label, payload, producer, sourceRow`; kinds on 2026-10-20: `branch_status` 4,521, `coverage` 268, `entry` 14 (no `schemaVersion` either).

## D. Parsers of raw rows outside world/

Only `newsStoryRecord` (runtime.js, rules.js, store.js) and `newsBoard` (world.js, presets.js, connect.js) import world/ (grep of `backend`, `scripts`, `quality`, `predictions`). Frontend never reads raw rows: it calls NSD through `restProxy.js`, or fetches S3 JSON via the Worker.

| File | What it parses | Could use world/ today? |
|---|---|---|
| `read-api/newsSensitiveData/src/index.js` (+`lib.js`) | `latest`, `today-archive`, `archive#`, THREAD_ANALYSIS/HISTORY/DRIFT(LOG), COUNTRY_*, FACTS#, PRED#, Q#, WEB#INDEX, `THREAD#/WEB`, DAILY_BRIEF#, TOPIC#; 8 Scans; S3 `predictions/track_record.json` | Yes for all but TOPIC#, FACTS#, COUNTRY_INTELLIGENCE, DAILY_BRIEF#, THREAD#/WEB (no reader for those shapes) |
| `distribution/newsWeeklyBrief/src/index.js` | `archive#`/`today-archive`, THREAD_ANALYSIS, COUNTRY_INTELLIGENCE, WEB#INDEX | archive, analysis, web: yes; country intelligence: no reader |
| `distribution/newsPostDevTo/src/index.js` (+`buildDailySummary.js`) | `today-archive`, THREAD_ANALYSIS, COUNTRY_INTELLIGENCE | partly |
| `distribution/newsPostLinkedIn/src/index.js` | `latest`, `TOPIC#/SUMMARY` | `latest` yes; SUMMARY no |
| `distribution/newsBreakingAlert/src/index.js` | `latest`, THREAD_ANALYSIS, COUNTRY_INTELLIGENCE | partly |
| `distribution/newsEmailSender/src/index.js` | `COUNTRY#/DRIFT#` (Scan), WEEKLY_BRIEF, EMAILLOG | drift: yes (`driftNotes`), rest no |
| `pipeline/newsThreadAnalysis`, `newsCountryIntelligence`, `newsSystemsAnalysis`, `newsDriftCorrector` | each re-reads `archive#`/`today-archive` for the last N days, `latest`, THREAD_ANALYSIS, HISTORY# | yes (`archiveRange`, `threadAnalysis`, `threadHistory`, `countryHistory`); they are also the writers of those rows |
| `pipeline/NewsProjectInvokeAgentLambda/src/index.js`, `newsInvokeGemini` | archive days for dedupe/threading, `PRED#`, `FACTS#`, TOPIC# | archive: yes; the rest are writer-side reads |
| `predictions/newsPredictionsSnapshot` (+`trackRecord.js`, `questionBoard.js`) | Scan of PredictionLog: `PRED#`, `Q#`, `SEED#`, `SAMPLE#`, `SETTLE#` | PRED#, Q#: yes; SEED/SAMPLE/SETTLE: no reader |
| `predictions/newsPredictionResolver/src/store.js` | Scans `SEED#`, `PRED#`, `Q#`; writes all families | writer-owned |
| `read-api/newsSignals/src/index.js`, `signalAdapter.js` | Scan `COUNTRY#` / COUNTRY_INTELLIGENCE | no reader |
| `read-api/newsRecommend/src/index.js` | `latest`, SavedItems, UserPrefs (Scan at line 271) | `latest` yes; user tables: no (user data) |
| `read-api/newsSharedAnalysis/src/analysisContext.js`, `analysisPrompt.js` | builds sources from archive entries, DRIFT, FORECAST | shape only; mirrors frontend `analysis-studio/lib/*` (check-shared-sync) |
| `situations/*`, `board/newsBoard/src/recordViews.js` | S3 `stories/`, `situations/`, `world/`, `threads/`, `record/index.json` | S3 `webAt/webLatest` only exist in world/; the others have no reader |
| `scripts/check-archive-dates.mjs`, `gen-reference.mjs`, `audit-drift-direction.mjs`, `quality/*.js`, `predictions/*.js` | ad hoc raw reads (operator tools) | not verified per file |
| `monitoring/newsSourceAudit/src/index.js` | `latest`-shaped topics (not verified) | not verified |

## E. IDs today

| Object | ID field | Stable? | Defined |
|---|---|---|---|
| Story (editorial thread) | `threadId` = `thread-<slug30>-<sha1(title)[:6]>` | Stable once assigned: inherited via `continues_topic` / `assignThreadId`; a re-titled rerun founds a NEW id. No alias/merge record. In the 2026-10-21 probe `today-archive` had 26 entries but 25 distinct threadIds | `threading.js` `generateThreadId`; `index.js` ~1030 |
| Story (map cluster) | `storyId` = `<axis>_<ISO3>_<slug>` | Changes when the slug changes; separate concept from `threadId`; linked only via `threads/story-map.json` | `newsSituationIngest` `storyKey` |
| Entry / Fact | `topicId` (`<title>-<rank>`) + `generationId`; world adds `sourceKey` = `archive#date\|generationId\|topicId`; record adds `eventId` = sha1(kind+sourceKey) | `topicId` NOT stable (rank/title change per run); `sourceKey` stable only for the same stored row | `buildArchiveEntry`; `world/readers.js` entry(); `record/shadow` |
| Country | `iso3` on entries; `COUNTRY#`/`FACTS#`/`SYSTEMS#` keyed by country NAME | iso3 stable; names stable only while spelling is | `world/readers.js`; writers in A2 |
| Actor | none; free-text name in `actors[]` and `keyActors[]`; board pins use "actor name as in WEB#INDEX" | No: name only, no alias table | `board.schema.json` pin.refId |
| Source / outlet | none; `sources[].source` = domain string | Stable per domain; no `sourceId`, no type table | `buildArchiveEntry`, `outlets.js` |
| Branch | `branchId` = `PRED#<topicId>/<date>/<triggerId>` (derived) | Stable while PRED# row exists (rows immutable) | `world/derive.js` ~70 |
| Fork | `forkId` = `PRED#<topicId>/<date>` (derived) | Stable | `world/derive.js` ~70 |
| Question | `qid` = sha256(pk\|sk\|triggerId)[:20] | Stable (hash of immutable row key) | `questions.js` `qidFor` |
| Verdict | `Q#<qid>` + `VERDICT[#n]`, highest n wins | Stable, append-only | `newsPredictionResolver` |
| Situation | `situationId` = `news#<storyId>` or `gdacs#<eventKey>`; aliases kept | Stable; aliases supported | `situations-core.js` |
| Board | `boardId` (SK `board#<boardId>`), owner `uid` | Stable | `newsBoard/src/store.js` |
| Pin | `pinId`; `refId` = threadId / ISO3 / actor name | Pin stable; `refId` inherits the instability of threadId and actor names | `board.schema.json` |
| String | pair (`a`,`b`) of pinIds, `a` < `b` | Stable while both pins exist | `board.schema.json` |
| Run / Reading | none live (`runId` only inside `web/*.json`) | n/a | not built |

## F. Dead or duplicated

| Item | Evidence |
|---|---|
| `DRIFT#` and `DRIFTLOG#` hold the same body | `newsDriftCorrector/src/index.js:121-122` writes `{...base}` to both; only `ttl` differs |
| `WEB#INDEX/LATEST` + `THREAD#/WEB` (DynamoDB) = `web/latest.json` (S3) | `newsSystemsAnalysis` writes both (index.js 532-534 and `web/${y}/${m}/${d}.json`); world reads either |
| `world/` snapshots and `situations/history` written in the same tracker run | each 2,081 objects, same key shape; history read only by `scripts/situations-log.mjs` |
| `situations/history` has no expiry | lifecycle: IA at 30 d only; 50 MB and growing |
| `world/shadow/` | 6 objects from 2026-09-08, no reader found |
| `tags/backfill/2026-09-11.json` | no code references `tags/` |
| `audit/selection-shadow/`, `audit/impact/` | selection-shadow: written by `newsSelectionShadow`, no reader found; impact: writer rule `TriggerImpactAudit` DISABLED, last object 2026-09-12; capture/shadow have no lifecycle |
| `signals/snapshots` 1.03 GB | `TriggerSignalsBuild` DISABLED; `functions.json` lists no features read it (`"features":[]`); last snapshot 2026-10-18 |
| `record/shadow/` unread; `newsBoard` reads `record/index.json` | `recordViews.js` paths absent in S3; `newsStoryRecord` has no schedule or invoke permission (`events list-rules`, `scheduler list-schedules`, `get-policy`) |
| `newsFreshnessMonitor` | `scripts/functions.json` says ENABLED, live `TriggerFreshnessMonitor` is DISABLED |
| Registered but unscheduled | `newsAnalyze`, `newsBoard`, `newsSharedAnalysis`, `newsSavedItems`, `newsRecommend`, `newsClientErrors`, `newsStoryRecord` (request-driven or manual by design except newsStoryRecord) |
| Parked and disabled | `newsEconomicImpact`, `newsEconomicQuality`, `newsPairIntelligence`, `newsWeeklyMarkets`, `newsImpactAudit`, `newsSignals` build, drift and breaking email sends (rules DISABLED) |
| Deployed name != repo dir | live rule/schedule targets `NewsProjectInvokeAgentLambda-dev`, `newsInvokeGemini-dev`, `newsSensitiveData-dev`, `newsPostLinkedin` |
| `THREAD#/TOPICS` pointer rows | no ttl, one per thread ever created, `topicIds` set only grows |
| NewsCache archive rows past 90 d | TTL disabled; rows from 2026-04-04 still present |
| Weekly report store | `backend/weekly/README.md` names S3 `weekly/`; the prefix does not exist; the live weekly is `WEEKLY_BRIEF#` in DynamoDB |
| `SYSTEMS#` ttl comment | code comment (index.js 530) says no ttl; code at 548-563 writes one |

## G. Gaps for the foundation

| Gap | Evidence |
|---|---|
| No `schemaVersion` on any stored row or record line | grep of `backend/`; timeline sample keys (C) |
| No source ID or source table (outlet type known only on some rows) | `sources[]` has `source` domain; `outletType` on 731 of 803 |
| No actor ID or alias table | `actors[]` are free-text names; 35 of 210 actor-bearing entries have empty `actors` |
| No absolute publish time | sources carry only relative `age`; entry has `archivedAt` |
| `iso3`, `actors`, `event_type` absent before about 2026-09-12 | 08-15 and 09-10 rows lack them; 09-12 onward carry them |
| Entry-level salience not archived | `significance`, `urgency`, `primaryCountry` exist only in `latest`/`staging` |
| Story ID has no merge/alias record | `threadId` is title-hash; map `storyId` is a second ID |
| Country keyed by name in COUNTRY#/FACTS#/SYSTEMS# | key templates in A2 |
| Entry ID not stable across runs | `topicId` = `<title>-<rank>`; relies on `generationId` |
| No reader in world/ for TOPIC#, FACTS#, COUNTRY_INTELLIGENCE, DAILY_BRIEF#, WEEKLY_BRIEF#, `THREAD#/WEB`, SEED/SAMPLE/SETTLE, S3 `stories/ situations/ corpus/ signals/` | D |
| Record output is shadow only and unscheduled | B, F |

Archive days missing from NewsCache (`get-item archive#DATE`, 60 days 2026-08-22 .. 2026-10-20, 28 missing): 2026-08-23 .. 2026-09-02 (11 days), 2026-09-14 .. 2026-09-29 (16 days), 2026-10-14 (1 day). 2026-10-21 is absent as expected (served from `today-archive`). Earlier probes (back to 2026-04-04): also missing 2026-04-29 .. 05-15 and 2026-07-12 .. 07-25 except 07-24. The record timeline mirrors the 10-14 gap. DAILY_BRIEF# is missing for 2026-08-23 .. 09-03, 09-13 .. 09-29, 10-13, 10-14 within 2026-07-26 .. 10-19. The 09-14 .. 09-29 archive gap overlaps S3 data that exists (`world/`, `corpus/`, `stories/` start 2026-09-08) but those hold map headlines, not editorial entries; no copy of the missing editorial days is known.

Not verified: oldest `PRED#` date, THREAD_ANALYSIS date range, per-prefix SummarizeAndPredict item counts (no Scan), SavedItems key mix, the 28 unaccounted NewsCache items, why corpus stops at 2026-10-20 14 UTC, `monitoring/newsSourceAudit` and operator-script reads.

## H. Decision coverage (2026-10-21)

Read-only audit of `scripts/functions.json` (41 entries), `backend/**/src` key templates, `worker.mjs` and `App.jsx` against decisions, plans, architecture docs, rules and folder READMEs. DECIDED = a record says why and the shape; DESCRIBED = says what, not why. A name mention is not a decision.

| Area | Rows | DECIDED | DESCRIBED | UNDOCUMENTED | CONTRADICTED |
|---|---|---|---|---|---|
| Lambdas (41 + 3 planned) | about 44 | about 22 | about 19 | 0 whole Lambdas (gap is cadence and why a separate Lambda) | 0 |
| DynamoDB patterns | about 24 | 8 | 14 | 2 | 0 |
| S3 prefix groups | about 22 | 15 | 4 | 1 | 1 |
| Worker and routes | about 30 | 17 | 7 | 8 | 2 |

Undocumented or contradicted items:

| Item | Status | Where | Note |
|---|---|---|---|
| `COUNTRY_FACTS` / `FACTS#<country>` rows | UNDOCUMENTED | `newsCountryFactsUpdater`, `newsSensitiveData` | Wikidata-as-fact-layer decision is only in operator memory |
| `DAILY_BRIEF`, `WEEKLY#` rows | UNDOCUMENTED | code | key appears in no decision or architecture doc |
| `monitoring/freshness/state.json` | UNDOCUMENTED | `newsFreshnessMonitor` | not in DATA_STRATEGY |
| Worker SPA-shell fallback (200 for unknown paths), root `/` static copy, `/track-record/text`, `/signin`, `/auth/callback`, `/about /contact /privacy /disclosures /whitepaper`, `/__boom` | UNDOCUMENTED | `worker.mjs`, `App.jsx` | rationale in comments only |
| Worker member gate | CONTRADICTED | `isMemberAuthorized` returns false (stub) vs DATA_STRATEGY §4 "JWT-gated at the Worker" | |
| Record layout | CONTRADICTED | the old record doc §3 (`record/index.json`, `stories/`; doc since folded into TIMELINE) vs TIMELINE §5 (`facts`, `readings`, `views`) | newsBoard reads the old layout |
| Board storage shape | CONTRADICTED | DATA_STRATEGY §2 `board#<id>` vs the old record doc `kind:'board'` | |
| Resolver cadence | CONTRADICTED | decision 0027 "weekly settle" vs schedule daily `tick` | may be fine if tick no-ops |
| Story pages under `/weekly` vs planned `/briefings/weekly` | CONTRADICTED | analyst_weekly plan, pipeline.json vs `App.jsx` | name collision |
| Raw `archive#`/`THREAD#`/`DRIFT#` rows stay in DynamoDB while the record is S3 | no ADR | | the bridge decision is ADR 0035 |
| One ingest or two | proposed, unresolved | `ARCHITECTURE_INGEST_DESIGN.md` | |

Stale decisions: 0010 (Studio deep dive gone since 0033) and 0011 (Studio half superseded by 0033, confirm step by 0034) were never marked; 0007 (pair arcs: legacy map and consumers are gone); 0019 (accepted, not cut over); 0014 (does `newsModelGuard` now cover the declined balance alarm: not recorded); 0003 and DATA_STRATEGY §6 (table counts need a live check). Correctly marked: 0006, 0017, 0021, 0025, 0030.

About 17 design choices live only in code comments or memory (Worker bot pre-render, `significance.js` threshold, error-digest "new/spiking only", `scoring.js` no thread term, no-fallback-UI rule in CLAUDE.md only, and others). Full row list: the audit report of 2026-10-21 (session scratchpad, not in the repo).
