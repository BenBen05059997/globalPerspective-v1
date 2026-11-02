# Stale-docs audit, 2026-11-02

Report only: no doc or code was edited. Checked against `origin/main` db3d7d96 (after the fix, testing and docs rounds). No AWS calls, so live settings are listed under "Needs a live check" only when the repo contradicts itself or the statement is date-bound.

Method: every backticked path, identifier and env name in all in-scope docs was resolved against the tree (script), then each README was read against its Lambda or feature source: `src/` imports of `_shared/*`, `package.json` test scripts, `scripts/functions.json` (runtime, node_modules, schedule names and expressions: all README deployment lines match), `App.jsx` routes, decision statuses. Tests were run for 21 Lambdas (counts below). `node quality/check_docs.mjs`, `check_links.mjs`, `scripts/check-shared-sync.mjs`, `scripts/gen-pipeline-blocks.mjs --check` and a markdown-link scan of all in-scope docs (decisions included): all clean.

## Summary

Stale or contradicted statements found: **58**, in about 40 files (plus `pipeline.json`, which feeds the generated blocks). The previous pass's fixes hold; the new staleness comes from the 1-2 Nov step 5 switches (record writers live, `FORECASTS_SOURCE=inbox`), the shared-module moves (`firebaseAuth`, `httpReply`, `rss`, `questionPool`) and the testing round.

| Area | Docs checked | Stale statements |
|---|---|---|
| A. Root README, backend/README | 2 | 2 |
| B. backend/pipeline (group, 8 Lambdas, cli) | 10 | 6 |
| C. backend/situations | 5 | 1 |
| D. backend/predictions | 2 | 2 |
| E. backend/read-api | 6 | 3 |
| F. backend/distribution | 7 | 2 |
| G. backend/board, membership-studio, monitoring, weekly | 13 | 1 |
| H. backend/shared (README, world/README) | 2 | 4 |
| I. backend/record (protected; report only) | 5 | 7 |
| J. Frontend READMEs (app, shared, fixtures, 12 features) | 15 | 9 |
| K. project-docs (START_HERE, 9 architecture docs, decisions index; 54 decision status lines) | 11 | 18 |
| L. internal-docs, quality, .claude/skills, cloudflare | 8 | 3 |

Tests run (all pass unless noted): newsSavedItems 19, newsClientErrors 16, newsSensitiveData 95, newsRecommend 43, newsPostLinkedIn 24, newsBreakingAlert 25, newsEmailSender 38, newsPostDevTo 37, newsWeeklyBrief 30, newsGdacsIngest 10, newsGdeltConflict 7, newsSituationIngest 26, newsSituationTracker 13, newsCountryFactsUpdater 9, newsThreadAnalysis 10, newsFreshnessMonitor 15, newsBoard 54 (4 skipped), newsPredictionResolver 101 (1 skipped), NewsProjectInvokeAgentLambda 115 (2 fail, unchanged). newsStoryRecord (7 files) and newsRecordReview (3 files) fail here only because the worktree has no frontend `node_modules` (see I5).

"Follow-ups after merge" from `pr-r2-area5.md`, status on main: pipeline README :49/:51 still stale (B2, B3); read-api README :42-43 still stale (E1); distribution README :38-39 still stale (F1); START_HERE:52 now stale (K3); TIMELINE:208 now stale (K10); `store.js:5` and `index.js:187` Lambda comments unchanged (see "Still open from the previous pass").

## A. Root and backend overview

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| A1 | `README.md:23` | "see ARCHITECTURE.md's Frontend Path map" | No such section; the frontend map is "Codemap > Frontend: global-perspectives-starter/frontend/" (`ARCHITECTURE.md:118`) | "see the Codemap, Frontend section of ARCHITECTURE.md" |
| A2 | `backend/README.md:31` | "`src/_shared` is a committed symlink to `backend/shared/src`" (every Lambda folder) | Six Lambda folders have no link: newsAnalyze, newsPolarBilling, newsErrorDigest, newsModelGuard, newsSharedAnalysis, newsGdeltConflict (`ls -la <dir>/src`) | "Most Lambdas have a committed `src/_shared` symlink (not newsAnalyze, newsPolarBilling, newsErrorDigest, newsModelGuard, newsSharedAnalysis, newsGdeltConflict)" |

## B. backend/pipeline

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| B1 | `backend/pipeline/README.md:8` (generated from `project-docs/architecture/pipeline.json:16`) | "its raw rows are still the source of entry, story_born and forecast_drawn facts, read only through world/ until the entries and forecasts inboxes exist" | Both inboxes exist: `backend/shared/src/entriesInbox.js`, `forecastsInbox.js`; the agent appends them (agent README:20-21); `newsStoryRecord/src/store.js:21-27` reads them (`ENTRIES_SOURCE`, `FORECASTS_SOURCE`); START_HERE:22 says both are `inbox` live | Edit `pipeline.json:16`: "...read through world/ unless `ENTRIES_SOURCE`/`FORECASTS_SOURCE` = inbox (the agent appends record/inbox/entries/ and forecasts/)"; run `node scripts/gen-pipeline-blocks.mjs` |
| B2 | `backend/pipeline/README.md:50` | "NewsProjectInvokeAgentLambda, newsCountryFactsUpdater and newsSelectionShadow have no `_shared` link." | All three have one: `NewsProjectInvokeAgentLambda/src/_shared`, `newsCountryFactsUpdater/src/_shared`, `newsSelectionShadow/src/_shared -> ../../../shared/src` (844f0d1a). Agent imports `entriesInbox forecastsInbox notes s3json`; facts updater `notes resolveIso3 s3NoteWriter` | "Every Lambda here has a `src/_shared` link. newsSelectionShadow also symlinks `classifier-core.js` from newsSituationIngest." |
| B3 | `backend/pipeline/README.md:48` | "`resolveIso3.js`: newsThreadAnalysis, newsCountryIntelligence, newsDriftCorrector" | Also imported by newsInvokeGemini, newsSystemsAnalysis, newsCountryFactsUpdater (`grep _shared/resolveIso3`) | List all six |
| B4 | `backend/pipeline/README.md:16, :20, :28` | Agent "Writes" lists no `record/inbox/entries/`, `record/inbox/forecasts/`; facts updater "Writes" lists only `FACTS#`; ":28 The five analysis Lambdas ... each also copy ... as notes" | Agent writes both inboxes (agent README:20-21, gated by `ENTRIES_INBOX_PREFIX`, `FORECASTS_INBOX_PREFIX`); newsCountryFactsUpdater writes `record/notes/country_facts/` (`src/recordNotes.js`; its README:81) | Add the inbox prefixes to the agent row, `S3 record/notes/country_facts/` to the facts-updater row, and "six" Lambdas (incl. facts updater, no model) to :28 |
| B5 | `backend/pipeline/newsInvokeGemini/README.md:3, :28` | "enriches sources (`src/source_enrichment.js`, `src/outlet_metadata.js`)"; "`outlet` comes only from `src/outlet_metadata.js`" | No `src/outlet_metadata.js`; the one outlet table is `backend/shared/src/outlets.js` (`src/rawCapture.js:11`, `src/source_enrichment.js:14` import `./_shared/outlets`) | Replace both with `src/_shared/outlets.js` |
| B6 | `backend/pipeline/newsInvokeGemini/README.md:38` | "Parser (`parseRssXml`): `<item ...attributes>` ... Atom ... entities decoded" as this Lambda's code | `index.js:282-284` is a thin adapter over `_shared/rss.js` `parseRssXml` (also used by newsSituationIngest since b46bb8c7 and `record/cli/recover-day.mjs`); the rules live in shared `rss.js`, tests in `test/parse-rss.test.js` and `backend/shared/test/rss.test.js` | "Parser: shared `_shared/rss.js` (`parseRssXml`), called through an adapter in `index.js`: ..." |

## C. backend/situations

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| C1 | `backend/situations/README.md:33` | "`llm.js`: newsSituationIngest." (shared list) | newsSituationIngest imports `llm`, `outlets`, `resolveIso3`, `rss` (`grep _shared/ newsSituationIngest/src/index.js`); `rss.js` since b46bb8c7 | "newsSituationIngest: `llm.js`, `rss.js` (shared with newsInvokeGemini), `outlets.js`, `resolveIso3.js`" |

## D. backend/predictions

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| D1 | `backend/predictions/README.md:8` (generated from `pipeline.json:18`) | "PRED# rows are still the source of forecast_drawn facts" | `newsStoryRecord` default is `FORECASTS_SOURCE=log` (`store.js:26`) but START_HERE:22 and `newsStoryRecord/README.md:9` say live `inbox`; the resolver's own questions come from facts (`QUESTIONS_SOURCE`) | "forecast_drawn facts come from the forecasts inbox (`FORECASTS_SOURCE`); PRED# rows are the inbox's origin" (edit `pipeline.json:18`, regenerate) |
| D2 | `predictions/README.md:35`, `newsPredictionResolver/README.md:126` | "ISO-week helpers (`weekOf`, `weekStart`) are in `src/lib.js`" | `lib.js:11-12` imports them: `weekStart` from `_shared/questionPool.js:24`, `isoWeekOfDay` (as `weekOf`) from `_shared/questionState.js:12` | "`weekStart` is in shared `questionPool.js`, `isoWeekOfDay` in shared `questionState.js`; `src/lib.js` re-exports them" |

## E. backend/read-api

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| E1 | `backend/read-api/README.md:42-43` | newsSensitiveData-dev: `briefs, links, noteReads, recordReads, resolveIso3`; newsRecommend: `links, recordReads`; ":43 newsSavedItems, newsSharedAnalysis and newsClientErrors use none" | newsSensitiveData also `categoryLabels dayZero firebaseAuth`; newsRecommend also `firebaseAuth httpReply`; newsSavedItems `firebaseAuth httpReply`; newsClientErrors `httpReply`; only newsSharedAnalysis uses none | Update the lists as shown; "newsSharedAnalysis uses none" |
| E2 | `read-api/newsSavedItems/README.md:131-132`, `newsClientErrors/README.md:178-179` | "Tests: None." | `src/package.json` `"test": "node --test ../test/*.test.js"`: 19 and 16 tests (5f2e7179, 922d7551) | "`cd .../src && npm test` (offline; 19 tests: auth gate, validation, command shapes, no CORS headers)" and "(16 tests: method gate, 16 KB cap, fingerprint grouping, no CORS headers)" |
| E3 | `read-api/newsRecommend/README.md:112` | "`npm test` (`node test-scoring.mjs`, offline)" | `package.json`: `node test-scoring.mjs && node --test ../test/*.test.js`; 43 tests (prefs, follows, unsubscribe kinds, recommend) | "`npm test` runs `test-scoring.mjs` and `test/*.test.js` (43 tests, offline)" |

## F. backend/distribution

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| F1 | `backend/distribution/README.md:38-39` | BreakingAlert: `links, placeFilter`; EmailSender: `links`; LinkedIn: `links`; DevTo and WeeklyBrief: `dayZero, llm, placeFilter, resolveIso3, briefNotes` | BreakingAlert also `escapeHtml noteReads recordReads`; EmailSender `escapeHtml recordReads`; LinkedIn `categoryLabels httpReply recordReads`; DevTo `categoryLabels jaccard noteReads recordReads` (no direct `dayZero` for WeeklyBrief: it comes through `archiveEntries`) | List per Lambda from `grep -rho '_shared/[A-Za-z0-9_./-]*' <dir>/src` |
| F2 | `backend/distribution/README.md:34` | "The `DAILY_BRIEF#` and `WEEKLY_BRIEF#` rows are still read by the read proxy, the Cloudflare Worker pre-render and newsEmailSender (weekly mode), so they stay until those read the record." | Worker pre-render reads the brief views first (`cloudflare/front-worker/README.md:25-30`, `production/worker.mjs:183,195`); newsEmailSender has a `RECORD_READS` record path (its README:118) | "...read by the read proxy; the Worker pre-render and the email sender read the brief views first (`RECORD_READS`) and fall back to the rows" |

## G. board, membership-studio, monitoring, weekly

Everything else in these groups matched the code (see "Checked and current"). One stale line:

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| G1 | `backend/board/newsBoard/README.md:99` | "`src/firebaseAuth.js` is copied from `newsSavedItems` (`newsRecommend` carries the same one)." | newsSavedItems and newsRecommend now import `_shared/firebaseAuth.js` (one copy for newsRecommend, newsSavedItems, newsSensitiveData; `shared/README.md:21`); newsBoard still carries its own `src/firebaseAuth.js` (header says "COPIED from newsSavedItems") | "`src/firebaseAuth.js` is a local copy of the older block; the shared `_shared/firebaseAuth.js` is what newsRecommend, newsSavedItems and newsSensitiveData use. Candidate to switch." |

## H. backend/shared

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| H1 | `backend/shared/README.md:22` | `httpReply.js` "Used by newsClientErrors, newsSavedItems, newsRecommend, newsPostDevTo, newsPostLinkedIn" | newsPostDevTo does not import it; importers are newsClientErrors, newsSavedItems, newsRecommend, newsPostLinkedIn (newsBoard and newsPolarBilling define their own local `httpReply`) | Drop `newsPostDevTo` |
| H2 | `backend/shared/README.md:67-68` | `rss.js` "shared by newsInvokeGemini and record/cli/recover-day.mjs" | Also newsSituationIngest (`src/index.js` `parseRss` adapter, b46bb8c7) | Add newsSituationIngest |
| H3 | `backend/shared/README.md:13-77` | Module list | `entriesInbox.js`, `forecastsInbox.js`, `questionPool.js`, `recordReads.js` exist in `src/` and are not described (0 matches in the README); `questionPool` is the draw/eligibility rule shared by the resolver and the track-record view | Add four entries (inboxes: decisions 0051/0052; `questionPool`: 0043/0045; `recordReads`: `RECORD_READS`, decision 0054) |
| H4 | `backend/shared/src/world/README.md:108` | "matching `questionBoard.js` and the resolver" | No `questionBoard.js` anywhere in the tree | "matching the resolver (`newsPredictionResolver/src/lib.js`)" |

## I. backend/record (protected area: report only)

| ID | Doc:line | Says | Code / repo says | Replace with |
|---|---|---|---|---|
| I1 | `backend/record/README.md:50` | "Live: `record/` on the first five Lambdas. The two brief writers have no `NOTES_PREFIX`, so they write no note, and their roles have no S3 write statement yet ... Until then the briefs reach the record only through `cli/backfill-brief-notes.mjs`." | Contradicted by `distribution/newsPostDevTo/README.md:14` and `newsWeeklyBrief/README.md:66` (live `record/` since 2026-11-01), `STEP5_AUDIT.md:15`, `START_HERE.md:22`, `features/briefings/README.md:15-17`; `newsCountryFactsUpdater/README.md:81` (live `record/` 2026-11-02) | "Live: `NOTES_PREFIX=record/` on the agent, the four analysis Lambdas, both brief writers and newsCountryFactsUpdater (values: STEP5_AUDIT.md section 1). `cli/backfill-brief-notes.mjs` filled the days before." |
| I2 | `backend/record/README.md:29-33` | Inbox list: articles, verdicts/draws, merges, assignments/splits | Also `entries/` and `forecasts/` (written by the agent; `newsStoryRecord/README.md:8-9`, `DATA_STRATEGY.md:69-70`, decisions 0051/0052) | Add "`entries/` and `forecasts/`: the agent's lines (`ENTRIES_INBOX_PREFIX`, `FORECASTS_INBOX_PREFIX`)" |
| I3 | `backend/record/cli/README.md:70` | "The live brief writers write no notes until their env `NOTES_PREFIX` is set ..., so until then this script is what puts the briefs in the record." | As I1 | "The brief writers write their own notes (live `NOTES_PREFIX=record/`); this script copied the earlier briefs." |
| I4 | `backend/record/newsStoryRecord/README.md:99` | "`schema/views/` holds one schema per view type (`story`, `index`, `links`, `counts`, `manifest`, `track-record`)" | 16 schema files: also `analyses-index`, `brief-daily`, `brief-weekly`, `briefs-index`, `countries-index`, `country`, `forecasts`, `today-index`, `web-index`, `weekly-index` (`ls schema/views`) | "one schema per view type (see `ls schema/views`; 16 today)" |
| I5 | `newsStoryRecord/README.md:166`, `newsRecordReview/README.md:114` | "`FRONTEND_NODE_MODULES` is needed only for the schema test(s)" | Needed by 7 StoryRecord test files (`briefs-views index-views note-schema schema today-view trackRecord views-schema`) and 3 Review files (`handler prompt schema`): all `createRequire(.../ajv/package.json)`; without it 7 and 3 files fail | "needed by the tests that load Ajv (list the files)" |
| I6 | `newsStoryRecord/README.md:90, :170` | "Deployed 2026-10-21 ... current code deployed 2026-10-22 23:54Z ..."; "Last verified: 2026-10-23" | Date-bound: many changes since (refresh 0050, inboxes 0051/0052, `todayView.js`, `forecasts` views, `PredictionLogScan` removed 2026-11-02). Repo cannot say what is deployed | Delete the hash/date, point to `scripts/lambda.sh newsStoryRecord diff` |
| I7 | `backend/record/cli/README.md:214` | "Tests: `node --test cli/test/*.test.mjs`" | Path relative to `backend/record/`: `backend/record/cli/test/*.test.mjs` | Use the repo-root path |

## J. Frontend READMEs

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| J1 | `features/home/README.md:9` (generated from `pipeline.json:27`) | "reads today's topics from raw tables; target: a today view of the daily facts" | Same README:43: the five calls are answered from the record's today view (`index/today.json`, `shared/api/todayView.js`, decision 0051) while views are fresh; `shared/data/contentService.js:1-4` | "reads the record's today view (`index/today.json`) while fresh; the actions are the fallback" (edit `pipeline.json:27`) |
| J2 | `features/static/README.md:10` (generated from `pipeline.json:37`) | "reads the daily brief only; not a record view" | Same README:34,38: `useDailyBrief()` reads the record's `index/briefs.json` and brief views first | "reads the daily brief from the record's brief views, the action as fallback" |
| J3 | `features/breaking/README.md:37` | "`newsBreakingAlert` (rule `TriggerBreakingAlert`, `cron(35 4/8 * * ? *)`" | `scripts/functions.json`: `cron(45 4/8 * * ? *)`; `newsBreakingAlert/README.md:81` explains why :45 | `cron(45 4/8 * * ? *)` |
| J4 | `features/briefings/README.md:51, :64` (and :44-45) | "Rebuilt nightly, so today's daily and a newer weekly are not in them yet"; "`newsStoryRecord` (rule `TriggerStoryRecord`, 23:45 UTC) turns the brief notes into `briefs/` views" | Refresh rules rebuild after each brief: `TriggerStoryRecordRefreshBrief` 14:15 UTC daily, `...RefreshWeekly` Sun 06:15 (`record/README.md:24`, decision 0050) | "Rebuilt after each ingest and brief (refresh rules) and nightly; a newer day can still be missing for up to a few hours" |
| J5 | `features/track-record/README.md:40-41, :59-60` | "drafts verdicts on Mondays and writes them itself (none written as of 2026-10-22)"; "on Mondays drafts verdicts (Brave Search evidence)" | The Monday-only pass is gone: `tick` runs WATCH to RECORD nightly (`newsPredictionResolver/README.md:133`); evidence is the story's own entry facts, no Brave (`:134`) | "nightly watches open branches and writes verdicts itself from the story's own entries (decision 0034/0038); the operator only corrects" |
| J6 | `features/track-record/README.md:32`, `lib/sampleRule.js:2` | "mirrors `backend/predictions/newsPredictionResolver/src/lib.js`" / "`amplify/backend/function/newsPredictionResolver/src/lib.js` (`rankKey`, `draw`)" | `rankKey`, `draw` live in shared `backend/shared/src/questionPool.js` (`lib.js:11` imports them); the golden fixture still ties both sides (`scripts/check-shared-sync.mjs:237-240`) | "mirrors `backend/shared/src/questionPool.js`" |
| J7 | `app/README.md:10` | "It also adds a console test hook, `window.testProxyGeocode`." | The hook calls `geocodeProxy` -> proxy action `geocode` (`restProxy.js:125-126`), which `newsSensitiveData` answers 400 (read-api README:36) | Remove the hook and `geocodeProxy` (code), or say "calls the removed `geocode` action (400)" |
| J8 | `shared/README.md:65` | `api/` list of readers | `forecastViews.js` and `viewsFresh.js` (the 9-hour rule, named in `ARCHITECTURE.md:123`) exist in `src/shared/api/` and are not listed | Add both |
| J9 | "Last verified" stamps: `features/{home,map,threads,countries,briefings,track-record,account,static,breaking}/README.md` (2026-10-31), `analysis-studio` (2026-10-20), `quality/SEVERITY_CODEBOOK.md:3` (2026-10-19) | Stamp implies the whole README was re-read that day | Several of these READMEs changed in substance since (J4, J5); the stamps hide that | Delete the stamps (git log is the date) |

## K. project-docs

| ID | Doc:line | Says | Code / repo says | Replace with |
|---|---|---|---|---|
| K1 | `START_HERE.md:14, :24` (same hash in `features/board/README.md:12`, `ARCHITECTURE_BOARD.md:58`, as a historical release note) | "Pages serves bundle `index-Upg1U2VW`"; "live-data fixes released 2026-11-01 (bundle `index-Upg1U2VW`)" | `docs/index.html` names `/assets/index-CjAFeg1j.js` (also `docs/assets/index-CjAFeg1j.js`); the PR (pr-r2-area5.md) said this was reworded but main still has the hash | "Pages serves the bundle `docs/index.html` names" (the hash drifts each release) |
| K2 | `START_HERE.md:49` | "2 of 83 `NewsProjectInvokeAgent` tests failing on main" | `node --test .../NewsProjectInvokeAgentLambda/test/*.test.js`: 115 tests, 113 pass, 2 fail (same two zero-generated handler tests) | "2 of 115" |
| K3 | `START_HERE.md:52` | "`deepseek-v4-flash` default string in `newsPostDevTo`" | No such string in `newsPostDevTo/src` (fallback is `deepseek-v4-pro`); `git grep v4-flash` hits only `quality/analysis/check.mjs`, `llmProviders.js`, a fixture, an agent comment | Delete the clause |
| K4 | `ARCHITECTURE.md:166` | "`newsSensitiveData-dev` still answers what the views do not hold: today's topics, the home map's topic card, the board's pin titles, member extras" | Contradicts :280 and `features/home/README.md:43`, `shared/data/contentService.js:1-4`: those read the record's today view first | "...what the views do not hold: member extras, country history depth, corrections, and the fallback for stale views" |
| K5 | `ARCHITECTURE.md:131` | Worker "pre-renders pages for bot user-agents (calling proxy actions)" | Pre-render reads the record's view files first, the actions only when no view answers (`cloudflare/front-worker/README.md:25-30`) | "...pre-renders from the record's views, falling back to proxy actions" |
| K6 | `ARCHITECTURE.md:284` | Decisions list ends at 0050 | 0051-0054 (entries inbox, forecasts inbox, notes readers, `RECORD_READS`) are live in code and cited throughout this file | Add 0051 to 0054 |
| K7 | `ARCHITECTURE_TIMELINE.md:96`; `ARCHITECTURE_FORECAST_LOOP.md:63` | `forecast_drawn` comes from "`PredictionLog PRED#` (the facts run scans the 30-day window)" / "it scans the prediction log" | Default is `log` (`store.js:26`) but live is `inbox` with the scan removed (`newsStoryRecord/README.md:9`, `STEP5_AUDIT.md:16,53`); FORECAST_LOOP:65 and :103 already say so | "from the forecasts inbox (`FORECASTS_SOURCE=inbox`), or the PRED# scan when `log`" |
| K8 | `ARCHITECTURE_TIMELINE.md:12, :170` | Inboxes: articles, verdicts, draws, merges, splits, assignments | Also `entries/` and `forecasts/` (agent) | Add them |
| K9 | `ARCHITECTURE_TIMELINE.md:196` | "the email sender and the Worker read the DynamoDB rows until each reads the record or is retired (0048)" | :184 of the same file, `cloudflare/front-worker/README.md:25`, `newsEmailSender/README.md:118` (decision 0054): both read the brief views first | Match :184 |
| K10 | `ARCHITECTURE_TIMELINE.md:208` | "a legacy script still edits verdicts in place" | No such script: `predictions/` holds `settle-correct.js` (appends `VERDICT#n`), `verify-draw.mjs`, `score-gap-benchmark.mjs`; `resolve-v1-*.js`/`review.js` deleted | Delete the clause |
| K11 | `ARCHITECTURE_FORECAST_LOOP.md:74` | "The resolver writes only `record/inbox/verdicts/` and `record/inbox/draws/` (and their shadows) under `record/`" | It also writes the tick heartbeat `record/views/health/settle-tick.json` (`SETTLE_HEARTBEAT_KEY`; resolver README:117, `DATA_STRATEGY.md:80`) | Add the heartbeat |
| K12 | `ARCHITECTURE_INGEST_DESIGN.md:32` | "Keep the article's `publishedAt` (today the ingest parses it and drops it)" | newsSituationIngest keeps it: `index.js:63-68` adapter returns `publishedAt`; README:27 "Corpus rows retain RSS `publishedAt` in ISO UTC" | "...(the ingest now keeps it in the corpus row)" |
| K13 | `ARCHITECTURE_BOARD.md:116` | List ends with a bare "- RESURRECTED." | No referent; flagged in the previous pass, still there | Delete the line or write what was meant |
| K14 | `decisions/README.md:54` | 0047 status "proposed (built and proven locally; the coordinator runs it, shadow first)" | `0047-history-before-record.md:3`: "accepted ... run live 2026-10-31 ... 0 diffs" | "accepted (operator); run live 2026-10-31" |
| K15 | `decisions/README.md:17-18` | 0010 and 0011 "superseded by 0035" | The files `0010-...md:3`, `0011-...md:3` still say "Status: accepted" with no pointer (append-only rule says the status line carries the supersession) | Add a one-line Status note to each file, or make the index say "accepted (superseded in part, see 0035)" |
| K16 | `decisions/README.md:39` | 0032 "accepted (extends 0015)" (Signals API parked) | `newsSignals` is deleted from AWS and the repo (899af309; START_HERE:20) | "superseded: newsSignals deleted 2026-11-01" |
| K17 | `decisions/0051-...md:3`, `0053-...md:3`, `0054-...md:3` | "Built and proven locally; nothing is deployed, no env is set" / "built and proven read-only, not deployed" / "Built and measured read-only; nothing deployed, uploaded or set" | Repo docs say live: `ENTRIES_SOURCE=inbox`, `NOTES_READS=notes` on 7 readers, `RECORD_READS` on 6 (START_HERE:21-22; `STEP5_AUDIT.md:13-16`); `0052-...md:3` already says "deployed 2026-11-01" | Append "deployed 2026-11-01/02" to each Status line |
| K18 | `decisions/0050-...md:3` | "the frontend part waits for the release" | `ARCHITECTURE.md:5`: the Pages build already has 0048 to 0050 | Append "released" |

## L. internal-docs, quality, skills, cloudflare

| ID | Doc:line | Says | Code says | Replace with |
|---|---|---|---|---|
| L1 | `internal-docs/LEGAL_NOTES.md:3, :9, :16-17, :23-35, :81, :90` | RSS "+ Brave Search API" is a live input; production inference "DeepSeek/Gemini" | No code reads `BRAVE_SEARCH_API_KEY` or calls Brave (only a comment, `outlets.js` host names, a test); Gemini was replaced by DeepSeek with no fallback (decision 0014; shared `llm.js` has a `gemini` provider, no Lambda selects it). Legal text: operator decides | Operator to confirm and reword (not edited) |
| L2 | `quality/SEVERITY_CODEBOOK.md:15, :29` | prompts quoted from `newsCountryIntelligence` "(~line 490)" and `newsThreadAnalysis` "(~line 201)" | `grep -n "INDEPENDENT axes"`: line 465 and line 174 | "(~line 465)", "(~line 174)", or drop the line numbers |
| L3 | `quality/SEVERITY_CODEBOOK.md:9` | "No prompt or rubric change ... before the Phase 3 baseline (`quality/calibration/severity-YYYY-MM-DD.md`) exists" | `quality/calibration/` does not exist (the :3 status says the baseline is in git history) | Say the baseline is in git history, or remove the gate sentence |

## Needs a live check

Repo-only evidence cannot settle these; each is a live setting or a date-bound statement. Where the repo contradicts itself it is already above (I1, K17, K1).

- Schedules ENABLED/DISABLED and expressions in every README "Trigger" line: `scripts/functions.json` header says "Read from live AWS 2026-10-31". All README lines agree with it (script check); the file itself may be a day old.
- `NOTES_PREFIX` values: DevTo:14, WeeklyBrief:66, FactsUpdater:81 (live `record/`), `ARCHITECTURE.md:257,277`, `DATA_STRATEGY.md:86`.
- `NOTES_READS=notes` on 7 readers (START_HERE:21, STEP5_AUDIT:13); `RECORD_READS` values: BreakingAlert:89 (`record`), EmailSender:118 (`compare`, first compare Sun 8 Nov 14:00Z), newsBoard README:48 (`record`), `ARCHITECTURE_BOARD.md:68`.
- `QUESTIONS_SOURCE=compare`, "switch to `record` after the 2 Nov 10:30Z compare" (resolver README:106, START_HERE:28, STEP5_AUDIT:16); `FORECASTS_SOURCE=inbox`, "`PredictionLogScan` removed, first nightly without it 2026-11-02 23:45Z" (newsStoryRecord README:9, :94; today).
- "First full weekly review is Mon 2026-11-02 01:00 UTC" (START_HERE:16, :27; WEEKLY_REVIEW:90; ARCHITECTURE_BOARD:70; newsRecordReview README:3): date-bound, true or false today.
- `DRY_RUN=false` (BreakingAlert, SituationTracker), `EMAIL_SEND_DRY_RUN=false`, `STALE_HOURS` 9, `SETTLE_SOURCE=record`, `REVIEW_CONCURRENCY` 12, `MAX_RESOLVE_PER_RUN` 40 (FORECAST_LOOP:58; resolver README says default 60), `ANALYZE_DAILY_CAP`, `POLAR_CREDIT_PACKS` unset.
- Lambda size/timeout lines: newsSensitiveData 85 s / 512 MB, newsFreshnessMonitor 30 s / 128 MB, newsBoard 1024 MB / 15 s, newsRecordReview 900 s / 1024 MB, resolver 600 s / 512 MB.
- Function-URL CORS state (membership-studio README:38, read-api README:48, alarms README:65); IAM statements named in READMEs (`newsBoard-record`, `freshnessStateMarker`, `PredictionLogScan`); S3 lifecycle (`DATA_STRATEGY.md:90`); CloudWatch alarm list (`ARCHITECTURE.md:333`, `alarms/README.md:52`); table existence (`GlobalPerspectiveMarkets` deleted).
- TTL "DISABLED" on SummarizeAndPredict and PredictionLog (pipeline README:54, predictions README:43).
- Whether the served Pages bundle is `index-CjAFeg1j` (repo) or another (K1).
- `lane/weekly`, `lane/routine` unmerged: exist on origin (checked), not re-read for content.

## Checked and current

- `CLAUDE.md`: all paths, scripts and rules resolve (`lambda.sh`, `deploy.sh`, `.env.example`, skills paths).
- `backend/README.md` (except A2), `backend/pipeline/README.md` table rows and schedule text, all pipeline Lambda READMEs except B5/B6: env names, defaults (`TOPICS_LIMIT` 15/20, `MAX_THREADS` 10, `SYSTEMS_TOP_N` 5, `MAX_TOKENS`), feed counts (26/25/40 countries), test commands and the 2 known agent failures.
- `backend/pipeline/cli/README.md`: `threads.mjs` subcommands (`list-joins merge move split`), `dupes.mjs` flags (`--from --to --since --method`), test files.
- `backend/situations/*` (except C1): 25 feeds, 80 stories, env tuning names, `DRY_RUN`, test lists; GDACS/GDELT "no DynamoDB" statements.
- `backend/predictions/newsPredictionResolver/README.md` (except D2): actions, `SAMPLE_K` 22, `LEAD_MIN/MAX` 7/90, `GRACE_DAYS` 3, `REDRAFT_AFTER_DAYS` 5, `MAX_UNCLEAR_DRAFTS` 3, 7-minute budget, cap 60, inbox line shapes.
- `backend/distribution/*` (except F1/F2): all five Lambda READMEs match the fix round: DevTo missing-config throw (`index.js:171-174`), BreakingAlert proposal-write failure (`index.js:251`), EmailSender `sentTo` marker and breaking `emailedAt`, LinkedIn caps and `Every attempted post failed`.
- `backend/read-api/newsSensitiveData/README.md`, `newsSharedAnalysis/README.md` (byte-identical copies guarded by `check-shared-sync.mjs:115-117`), `backend/monitoring/*` (incl. `alarms/README.md` CORS file and spec facts), `backend/membership-studio/*` (incl. deployed-snapshot), `backend/board/README.md`, `newsBoard/README.md` (except G1), `backend/weekly/README.md`.
- `backend/shared/README.md` (except H1-H3), `world/README.md` (except H4: export list matches `world/index.js`).
- `backend/record/newsStoryRecord/README.md` env/limits (`LOOKBACK_DAYS` 100, `ACTIVE_DAYS` 60, `SPECIFIC_SHARE` 0.05, `LINK_WINDOW_DAYS` 14, `MAX_PUBLISHED_AGE_DAYS` 30, `ENTRIES_SOURCE`/`FORECASTS_SOURCE`), `newsRecordReview/README.md` (`MAX_TOKENS` 6000, `ENTRY_CAP` 60, 60 s spare), `record/cli/README.md` (every script listed exists; only `recover-lib.mjs` undocumented), golden-week README.
- Frontend: `app/README.md` routes table and redirects match `App.jsx` and `LegacyRedirects.jsx`; `board`, `map`, `threads`, `countries`, `account`, `static`, `weekly`, `analysis-studio`, `fixtures` READMEs match their folders (hooks, components, localStorage keys, public `index.js` API, `isDeadBranch` not called).
- `START_HERE.md` apart from K1-K3; `ARCHITECTURE.md` apart from K4-K6; `DATA_STRATEGY.md` (prefix table, refresh times, ownership: current); `STEP5_AUDIT.md` (`noteReads.js:14-17` correct); `WORLD_MODEL.md`; `ARCHITECTURE_WEEKLY_REVIEW.md`; `cloudflare/front-worker/README.md` (`DATA_ALLOWED`, redirects, 9 h rule, tests); `quality/analysis/README.md` and `quality/briefing/README.md` (both scripts run clean); `.claude/skills/deploy-frontend/SKILL.md` and `DEPLOYMENT_NOTES.md` (targets match `deploy.sh` usage); `.claude/skills/onboard/SKILL.md`; `cli/` (no README; `index.js` uses only live actions `today`, `country_preview`, `thread_preview`).

## Still open from the previous pass (not re-counted)

Decision-record pointers to deleted plan docs; `package.json` descriptions ("generated by Amplify", "Shadow ingest ... never touches the live feed" in newsGdacsIngest/newsGdeltConflict, newsPostDevTo "posted to Dev.to"); Lambda comments `newsGdacsIngest/src/index.js:4-12`, `newsPredictionResolver/src/store.js:5` ("resolve-v1-*.js") and `src/index.js:187` ("the snapshot reads the highest n"), `newsBreakingAlert/src/index.js:8` (names `newsSignals`); frontend comments to deleted plans; `quality/severity_*.js` and `scripts/check-shared-sync.mjs:265` print `ONE_TRUTH_EXECUTION_PLAN.md`; `scripts/setup-cloudwatch-alarms.sh:13-15`; `.agents/product-marketing-context.md` pricing ($15/$150 "buys Analysis Studio compute"); `docs/WHITEPAPER.md` (build output, not audited).
