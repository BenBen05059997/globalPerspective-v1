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
- Built, merged, compared, not yet released: the story page analysis and the country "what changed" band read the views (19 stories and 6 countries match on content; the record adds `from` and `model`). Lists and the cross-country ledger stay on the actions.

Watch next (the full test checklist, browser checks included, is the "What to test" section of https://claude.ai/artifact/69GUFsy8aSACTZYvMpvpyd):
- Agent run 04:25 UTC, `newsThreadAnalysis` 04:40, `newsDriftCorrector` 05:30: a `[notes]` log line each, shadow notes schema-valid; then set `NOTES_PREFIX=record/` on each.
- `newsStoryRecord` 23:45 UTC: the 5 canary stories get a line and chapters; the 7 stale merged-story links files are overwritten.
- First full review Mon 2026-11-02 01:00 UTC (W44, about 520 stories): Run `ok`, `notReached` 0.

Step 4, what each page needs (from the code, 2026-10-31):
- Story page: timeline done; the analysis, drift, forecast and links sections still read DynamoDB (their notes are being written; views and page switch next).
- Story analysis and drift notes (`newsThreadAnalysis`, `newsDriftCorrector`), country briefings (`newsCountryIntelligence`), story-web links (`newsSystemsAnalysis`) and briefs follow the same pattern: writer through `notes.js`, view field, page switch.
- Track record: the page already shows the legacy triggers and the question scheme, labelled. The record holds the forecasts and verdicts but not the weekly draws (seeds, samples) that live in PredictionLog; moving the page needs draw facts (a 0038 design decision). Map and economy need a decision; user data stays in DynamoDB (0003).

Still on the old path: the old Sunday digest (`TriggerWeeklyBrief`, `TriggerWeeklyEmailSend`, 2 recipients); the analyst weekly W1-W3 on unmerged `lane/weekly` and `lane/routine`; `TriggerSelectionShadow` past its end (P7d is an operator decision); `newsInvokeGemini-dev` behind the repo (same behaviour).

Waiting on the operator:
1. Analyst weekly: build it on the readings, rewrite, or drop (ARCHITECTURE_WEEKLY_REVIEW.md section 9).
2. Board design-check answers (117 items, https://claude.ai/artifact/NNBZv4WWDoHFuRGwVXCNGE) and a signed-in look at B0. Design canvas: https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo. Overview and checklist: https://claude.ai/artifact/69GUFsy8aSACTZYvMpvpyd.
3. Track record: record the weekly draws as facts (so the page can move) or keep it on PredictionLog for now.
4. Selection go (P7d); gap benchmark rebuild or drop; Cloudflare cutover steps; delete the leftover `amplify/` (about 56 files never in git).
5. AWS CLI is signed in as the root user; an Identity Center or admin-user login is safer.

Next builds: the board artboards in order (graph, tree, zoom ladder, verdict, weekly, arrivals, summary + monthly, presets, divergence, folding, alerts UI only, map), checklist in ARCHITECTURE_BOARD.md.

Open smaller items:
- Cloudflare: capture DNS/TLS/ruleset state, candidate upload, test host `next.globalperspective.net`, front-Worker `/blog` passthrough, observation window, add `BOARD_ENDPOINT` to `REQUIRED_CONFIG_FIELDS`.
- Foundation leftovers (ARCHITECTURE_TIMELINE.md section 7): the full rebuild test (after step 4), parser moves to `world/`, the retire list, LatAm and SEA feeds, 2 of 83 `NewsProjectInvokeAgentLambda` tests failing on main.
- Colour bugs still unverified: map labels clip at the right edge and Europe labels overlap; Alerts list and Intel feed show the same stories on home; the country list "Highest Risk" rail should sort by score (`features/countries/CountryListPage.jsx`; the default sort is by risk, the filtered case is unchecked).
- Record data: over-joined threads (us-court ae75a8 holds about 20 unrelated entries) and duplicate stories the review cannot merge without neighbours (Amazon 35a31e/c5bce9/da86ee, Canadian base fire 6822c0/bf3dd0); the review flags off-story entries as assignment proposals in the readings for the operator to apply.
- Backend hygiene: `newsAnalyze` and `newsPolarBilling` (each with sandbox) stay on `nodejs20.x`; `deepseek-v4-flash` default string in `newsPostDevTo`; deployed `newsAnalyze` differs from the repo by about 126 lines (parked credits code): leave it or remove the Lambda (billing code: needs yes).

Parked (each has a decision record): analysis credits (0002); economy, jobs DISABLED and surfaces hidden, `newsMarketsData` still runs (0009, 0031); impact audit (0015); Signals API (0032); breaking and drift email rules DISABLED until the first follower; the hidden economy tab on story pages is undecided.

Open decisions: the hosting cutover (confirmed, steps pending); newsAnalyze versus repo; selection go; whether to merge the unmerged weekly branches; the five test users.
