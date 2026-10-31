# Start here

Code and live AWS are the truth; docs hold intent and decisions (decisions/0021, 0026). Old docs are deleted, git history keeps them.

## 1. Map
Read order: `CLAUDE.md` -> this file -> [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) -> the architecture doc for your area -> [decisions/README.md](decisions/README.md).
- Areas: [the record](architecture/ARCHITECTURE_TIMELINE.md) (facts, readings, views; stage list in [pipeline.json](architecture/pipeline.json)) · [forecast loop](architecture/ARCHITECTURE_FORECAST_LOOP.md) · [weekly review and analyst weekly](architecture/ARCHITECTURE_WEEKLY_REVIEW.md) · [board](architecture/ARCHITECTURE_BOARD.md) · [ingest proposal](architecture/ARCHITECTURE_INGEST_DESIGN.md) · [storage rules](architecture/DATA_STRATEGY.md) · [world model](architecture/WORLD_MODEL.md).
- Next to code: `backend/<group>/README.md`, `backend/<group>/<name>/README.md`, `global-perspectives-starter/frontend/src/features/<name>/README.md` (checked by `quality/check_docs.mjs`).
- Code lives in: Lambdas `backend/<group>/<name>/src/` (shared helpers `backend/shared/src/`, deployed name to dir in `scripts/functions.json`); frontend `global-perspectives-starter/frontend/src/` (`app/` -> `features/` -> `shared/`); edge `cloudflare/front-worker/`; checks `quality/`; forecast harnesses `predictions/`; severity rubric `quality/SEVERITY_CODEBOOK.md`.
- Deploy: frontend through `./deploy.sh` and `.claude/skills/deploy-frontend/` (targets need a fresh yes); Lambdas through `scripts/lambda.sh <name> diff|package|deploy|rollback` (diff first; the deployed zip can differ from the repo).
- Facts come from code and live AWS: `aws lambda list-functions`, `aws events list-rules`, `aws scheduler list-schedules`, `App.jsx`, the served bundle hash. Never trust a doc for state.

## 2. Where we left off (2026-10-31)
Working model: one coordinator session reviews, merges and deploys; lanes (git worktrees) or Sonnet agents build. Stale docs are found and rewritten whole by Sonnet agents, checked against code and AWS. Lane briefs go in `.board/` (ignored via `.git/info/exclude`). Dev machine is an Apple-silicon Mac since 2026-10-30; Lambdas stay x86_64 (`scripts/lambda.sh` cross-installs linux/x64 deps).

Foundation (goal: the site rebuilds from the record alone, decision 0035): steps 0-2c done; step 3 (weekly review) live; **step 4 under way: the daily model notes move into the record (decision 0042), one note type at a time, then each page switches to views.** Step 5 (delete the old DynamoDB world rows, one yes each) follows once no page reads them.

Live since 2026-10-30/31:
- DeepSeek credit restored 2026-10-25. Weekly review `newsRecordReview` live: `TriggerRecordReview` ENABLED (Mon 01:00 UTC), prompt review-4, `REVIEW_CONCURRENCY` 12; canary readings for 5 W43 stories in `record/readings/2026-W43.jsonl`. No `branch_status` reading: status = verdict, else due date.
- Legacy void job: 2,451 void verdicts (2026-10-30). `TriggerFreshnessMonitor` ENABLED with its S3 dedupe marker. No pipeline alarms (operator choice).
- Rebuild test for views (`backend/record/newsStoryRecord/scripts/rebuild-test.js`): 1,252 of 1,252 live views rebuild from facts; every story now gets a links view.
- Notes (0042): schema `backend/record/schema/note.schema.json`, shared `notes.js` (`buildNote`, `entryNote`, `archiveEntryNotes`, `storyAnalysisNote`, `driftNote`, `makeNoteWriter`), `noteId` in `record.js`. Live entry notes: 33 exact (capture CLI) + 3,713 archive copies (`backfill-entry-notes.mjs`; format `text`, model null, `from: archive`; views prefer an exact note). Writers deployed with `NOTES_PREFIX` = `record/shadow/` until checked: the agent (entry; policy `entryNotesWriter`), `newsThreadAnalysis` (story_analysis; `storyAnalysisNotesWriter`), `newsDriftCorrector` (drift; `driftNotesWriter` on the shared `newsCountryIntelligence-role-xqboqh2y`, also used by `newsCountryIntelligence`, `newsSystemsAnalysis`, `newsEconomicImpact`).
- Story views carry entry notes, outlet country and type, `topicId` and `iso3`; new entry facts keep source snippet, tier and actor names.
- **Story page timeline reads the record** (released to Pages 2026-10-31): view entries up to `factsThrough`, `narrative_thread` only for later days or a story with no view. Compared on 10 stories: every shown entry keeps its AI tabs, sources and countries; re-seen headlines show on their first day; same-article duplicates show once; non-country regions are dropped. The Pages script now ships `textures/` (the globe texture 404 is fixed).

- Notes now in the record (all live, writers in shadow until checked): entry 3,746; story_analysis 124; drift 222 country + 105 story; country 1,560 (48 briefings + 1,512 history copies); link 330. Writers: the agent, newsThreadAnalysis, newsDriftCorrector, newsCountryIntelligence, newsSystemsAnalysis (policies `entryNotesWriter`, `storyAnalysisNotesWriter`, `driftNotesWriter`, `countryLinkNotesWriter`). Backfill CLIs in `backend/record/cli/` (one per subtype).
- Views from notes: story views carry `analysis` (with `driftNote`), links views `judgedLinks`, and 48 `countries/<ISO3>` views (only the newest drift note: drift depth is a member perk served by `country_history`; views are public).
- Released to Pages 2026-10-31 (second release): the story page analysis and the country "what changed" band read the views (19 stories and 6 countries match on content; the record adds `from` and `model`). Lists and the cross-country ledger stay on the actions.

Watch next (the full test checklist, browser checks included, is the "What to test" section of https://claude.ai/artifact/69GUFsy8aSACTZYvMpvpyd):
- Note writers live (`NOTES_PREFIX=record/`, first shadow runs checked 2026-10-31): the agent (entry), `newsThreadAnalysis` (story_analysis), `newsSystemsAnalysis` (link + web; web notes from its next 05:00 run), `newsDriftCorrector` (drift), `newsCountryIntelligence` (country; switched 2026-10-31 before any run had generated a briefing: check the first `[notes] country:` log line of its 05:15 UTC run).
- Third release 2026-10-31: the story page forecast (record views with draw facts, decision 0043; a forecast stays with its own story) and "fed into" links (links view `judgedLinks` + `web`) read the record. Resolver writes draws to `record/inbox/draws/` (policy `newsPredictionResolver-record` extended).
- Fourth release 2026-10-31: the track record page reads `track-record.json` (decision 0044; issued 5,283 and all 66 sampled questions match the old file; legacy count 2,418 = PRED rows without `methodologyVersion`), and the list pages read the index views `index/analyses.json`, `index/web.json`, `index/countries.json` (Stories page analyses and country arcs, stories web and map story card, countries list, map risk layer; each falls back to its action). Fifth and sixth releases: the 7-90 day window text (0045), and the 30-day archive readers (Stories page and map, country page, related stories, map country card, risk-layer names) on `index/weekly.json` (0046: repeats shown once, places from `iso3`); the countries list stays on `archive_range` until the operator adopts the record's counts. Step 4 is done apart from that one reader.
- Forecast facts: the facts run now scans PredictionLog for the 30-day window (policy statement `PredictionLogScan` on `newsStoryRecord-role`) instead of reading only the day's entry topics; `backend/record/cli/backfill-forecasts.mjs` added 5 missed forecasts. 348 early-September PRED rows (no thread, no question branches) are not in the record and go with step 5.
- `newsStoryRecord` 23:45 UTC: the 5 canary stories get a line and chapters; the 7 stale merged-story links files are overwritten.
- First full review Mon 2026-11-02 01:00 UTC (W44, about 520 stories): Run `ok`, `notReached` 0.

Step 4, what each page needs (from the code, 2026-10-31):
- Story page: timeline done; the analysis, drift, forecast and links sections still read DynamoDB (their notes are being written; views and page switch next).
- Story analysis and drift notes (`newsThreadAnalysis`, `newsDriftCorrector`), country briefings (`newsCountryIntelligence`), story-web links (`newsSystemsAnalysis`) and briefs follow the same pattern: writer through `notes.js`, view field, page switch.
- Track record: on the record (0044); `settleHealth` (freshness monitor) and the draw pool stay in PredictionLog. Map needs a decision; economy is retired (0049); user data stays in DynamoDB (0003).

Still on the old path: the old Sunday digest (`TriggerWeeklyBrief`, `TriggerWeeklyEmailSend`, 2 recipients); the analyst weekly W1-W3 on unmerged `lane/weekly` and `lane/routine`; `TriggerSelectionShadow` past its end (P7d is an operator decision); `newsInvokeGemini-dev` behind the repo (same behaviour).

Step 5 (retire the DynamoDB world tables; operator 2026-10-31). Audit: [architecture/STEP5_AUDIT.md](architecture/STEP5_AUDIT.md) (nothing deletable yet; order and preconditions there). Decisions and state:
- History before 2026-09-05 into the record (0047): `backend/record/cli/backfill-history.mjs` + `check-history.mjs`. 2026-10-31: backup in `s3://globalperspective-world-280362093938/backup/record-2026-10-31/`, dry run matches (6,324 entry facts, 4,203 stories, 5,100 forecast facts + 1,513 rows to `record/legacy/predictions/`, track record unchanged); shadow run under `record/shadow-history/` in progress, then live. Open: derive `iso3` from old `regions` (operator), 41 archive days missing everywhere.
- Briefs into the record (0048): `daily_brief`/`weekly_brief` notes, `briefs/` views, `index/briefs.json`. newsPostDevTo, newsWeeklyBrief, newsStoryRecord deployed; 152 notes backfilled live. Waiting: the writers' S3 IAM statements (operator yes), then `NOTES_PREFIX` shadow then live; frontend release. Email and Worker still read `WEEKLY_BRIEF#`/`DAILY_BRIEF#`.
- Fresh views (0050): `newsStoryRecord` `{refresh:true}` rebuilds the views after each ingest and brief with today's archive entries as provisional entries (no fact appended); pages answer the newest days from the views while `manifest.builtAt` is under 9 h old. Built and tested, not deployed: Lambda deploy, a manual refresh, the refresh rules (commands in the decision's hand-off), then the frontend release.
- Economy retired (0049): code removed and merged; Markets rules DISABLED; newsBreakingAlert deployed. Waiting: frontend release, then the read API deploy (`newsSensitiveData-dev`), Worker deploy, then AWS deletions one yes each (5 Lambdas, 3 roles, 7 rules, 5 log groups, `GlobalPerspectiveMarkets`, 168 economy rows).
- Still to build before deletions: entries and forecasts inboxes, a "today" view (home, /today, board), record readers for country history depth, corrections, country facts, and the Worker.

Waiting on the operator:
1. Analyst weekly: build it on the readings, rewrite, or drop (ARCHITECTURE_WEEKLY_REVIEW.md section 9).
2. Board design-check answers (117 items, https://claude.ai/artifact/NNBZv4WWDoHFuRGwVXCNGE) and a signed-in look at B0. Design canvas: https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo. Overview and checklist: https://claude.ai/artifact/69GUFsy8aSACTZYvMpvpyd.
3. Countries list: adopt the record's article counts (0046) or keep `archive_range` until step 5.
4. Selection go (P7d); gap benchmark rebuild or drop; Cloudflare cutover steps; delete the leftover `amplify/` (about 56 files never in git).
5. AWS CLI is signed in as the root user; an Identity Center or admin-user login is safer.

Next builds: the board artboards in order (graph, tree, zoom ladder, verdict, weekly, arrivals, summary + monthly, presets, divergence, folding, alerts UI only, map), checklist in ARCHITECTURE_BOARD.md.

Open smaller items:
- Cloudflare: capture DNS/TLS/ruleset state, candidate upload, test host `next.globalperspective.net`, front-Worker `/blog` passthrough, observation window, add `BOARD_ENDPOINT` to `REQUIRED_CONFIG_FIELDS`.
- Foundation leftovers (ARCHITECTURE_TIMELINE.md section 7): the full rebuild test (after step 4), parser moves to `world/`, the retire list, LatAm and SEA feeds, 2 of 83 `NewsProjectInvokeAgentLambda` tests failing on main.
- Colour bugs still unverified: map labels clip at the right edge and Europe labels overlap; Alerts list and Intel feed show the same stories on home; the country list "Highest Risk" rail should sort by score (`features/countries/CountryListPage.jsx`; the default sort is by risk, the filtered case is unchecked).
- Record data: over-joined threads (us-court ae75a8 holds about 20 unrelated entries) and duplicate stories the review cannot merge without neighbours (Amazon 35a31e/c5bce9/da86ee, Canadian base fire 6822c0/bf3dd0); the review flags off-story entries as assignment proposals in the readings for the operator to apply.
- Backend hygiene: `newsAnalyze` and `newsPolarBilling` (each with sandbox) stay on `nodejs20.x`; `deepseek-v4-flash` default string in `newsPostDevTo`; deployed `newsAnalyze` differs from the repo by about 126 lines (parked credits code): leave it or remove the Lambda (billing code: needs yes).

Parked (each has a decision record): analysis credits (0002); impact audit (0015); Signals API (0032, without the economic signal); breaking and drift email rules DISABLED until the first follower. Retired 2026-10-31 (0049): the economy product (page, story tab, FX box, markets actions, five Lambdas); its AWS resources and DynamoDB data wait for the coordinator's deletes.

Open decisions: the hosting cutover (confirmed, steps pending); newsAnalyze versus repo; selection go; whether to merge the unmerged weekly branches; the five test users.
