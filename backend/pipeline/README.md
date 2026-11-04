# pipeline

The content pipeline. It picks the day's news topics from RSS feeds, writes the story text and forecasts, links stories into threads,
and then builds the thread, country and cause-web analyses that the site shows. It serves readers of the site pages. Every job runs on a schedule; all model calls go to a DeepSeek endpoint set in each Lambda's live env.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: **1 Ingest** → **2 Stories** → **3 Daily notes** → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 1, 2, 3: the selector (1), the story writer and forecasts (2), story analysis, country briefings, drift notes and the story web (3, daily notes). Timeline: writes no facts or readings; writes the entry, story_analysis, drift, country, link and web notes into record/notes/ (NOTES_PREFIX); its raw rows are still the source of entry, story_born and forecast_drawn facts, read only through world/ until the entries and forecasts inboxes exist. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda | What it does | README |
|---|---|---|
| newsIngest | Fetches RSS feeds, asks one LLM call to pick the topics, and stores them as the pending list. | [link](newsInvokeGemini/README.md) |
| newsAgent | Writes summary, cause chain and forecast per topic, assigns threads, and publishes the list. | [link](NewsProjectInvokeAgentLambda/README.md) |
| newsSelectionShadow | Logs what a layered selector would have picked beside the live pick; nothing reads it. | [link](newsSelectionShadow/README.md) |
| newsThreadAnalysis | Re-analyses threads that have a new event, with a multi-axis risk read. | [link](newsThreadAnalysis/README.md) |
| newsSystemsAnalysis | Builds a cause-and-effect web for the top countries and per-story web records. | [link](newsSystemsAnalysis/README.md) |
| newsCountryFactsUpdater | Refreshes capital, population and leadership facts per country from Wikidata and ACLED. | [link](newsCountryFactsUpdater/README.md) |
| newsCountryIntelligence | Writes the country briefings and 4-axis risk read for countries that need a refresh. | [link](newsCountryIntelligence/README.md) |
| newsDriftCorrector | Checks whether a conclusion moved and, if so, writes a note naming the event that explains it. | [link](newsDriftCorrector/README.md) |

The `cli/` folder holds an operator tool, not a Lambda: [cli/README.md](cli/README.md).

## Notes in the record (decision 0042)

The five analysis Lambdas (the agent, newsThreadAnalysis, newsSystemsAnalysis, newsCountryIntelligence, newsDriftCorrector) each also copy what they stored into the record as notes (`backend/shared/src/notes.js`, best-effort, never failing the run). The prefix is env `NOTES_PREFIX`: the code defaults to `record/shadow/`, and the live env of all five sets `record/`. The DynamoDB rows stay the primary copy until the world tables retire (step 5, `project-docs/architecture/STEP5_AUDIT.md`).

## Archive reads (step 5d, 2026-11-04)

Shared `backend/shared/src/archiveReads.js`, env `ARCHIVE_READS` = `ddb` (default) | `inbox` | `compare` (any other value, or `inbox`/`compare` without `ENTRIES_INBOX_PREFIX`, means `ddb`). `inbox` reads the day files `record/inbox/entries/` instead of the NewsCache archive rows; `compare` answers from NewsCache and logs the differences (`[archive-compare]`). Live: newsAgent `inbox` (with `FORKS_READS=inbox` for its forecast forks); newsThreadAnalysis, newsSystemsAnalysis, newsCountryIntelligence, newsDriftCorrector and (in distribution) newsWeeklyBrief `compare`, `ENTRIES_INBOX_PREFIX=record/`. Each moves to `inbox` after 3 clean nights. newsIngest still reads `archive#` titles directly.

## Pipeline

1. Three times a day (04:15, 12:15, 20:15 UTC) newsIngest fetches the feeds, picks topics and writes them to NewsCache `staging`.
2. Five minutes later newsSelectionShadow logs a comparison pick to S3. Nothing downstream uses it.
3. At :25 newsAgent reads `staging`, writes the summary, cause chain and forecast for each topic, and gives each topic a threadId.
4. It then copies `staging` to `latest`, writes the archive rows, the thread pointers and the forecast row, and writes `threads/story-map.json` for the situations group.
5. Once a day newsThreadAnalysis (04:40) reads 30 days of archive and re-analyses threads with a new event.
6. newsSystemsAnalysis (05:00) builds the cause webs and the web index from the archive and thread analyses.
7. newsCountryFactsUpdater runs Mondays at 05:00 Tokyo time and refreshes the `FACTS#` rows that the country briefings use.
8. newsCountryIntelligence (05:15) writes country briefings for countries its refresh policy selects.
9. newsDriftCorrector (05:30) compares the daily history rows and writes drift notes.
10. The browser reads these rows through the `newsReadApi` API proxy (pages that already have a record view read the view first and use the action as the fallback; see the read-api group). The actions are `topics` and `today` (home), `summary`, `prediction`, `trace_cause`, `narrative_thread` and `thread_analysis` (story pages), `country_intelligence`, `country_facts`, `country_history` (country pages), `systems_analysis`, `web_index`, `corrections_feed`.
11. Pages that call them: `/today` and `/` (topics), `/weekly/thread/:threadId` (narrative thread, forecast, web), `/weekly/country/:countryName` (country intelligence, facts, history), `/track-record` (corrections feed).

## Shared code

- `llm.js` (chat client): newsIngest, newsThreadAnalysis, newsSystemsAnalysis, newsCountryIntelligence, newsDriftCorrector.
- `dayZero.js`: newsThreadAnalysis, newsSystemsAnalysis, newsCountryIntelligence, newsDriftCorrector.
- `resolveIso3.js` (with `countries.js`, `iso3Names.json`): newsThreadAnalysis, newsCountryIntelligence, newsDriftCorrector.
- `placeFilter.js`: newsSystemsAnalysis, newsCountryIntelligence. `riskDimensions.js`: newsThreadAnalysis, newsCountryIntelligence.
- newsAgent, newsCountryFactsUpdater and newsSelectionShadow have no `_shared` link. newsSelectionShadow symlinks `classifier-core.js` from newsSituationIngest.

## Known limits

- Rows carry a `ttl`, but live TTL on the SummarizeAndPredict table is DISABLED, so those rows do not expire.
- Forecast, summary, analysis and briefing text are model-written; the facts layer is `FACTS#`.
- newsCountryFactsUpdater writes leadership for 12 countries only; the others get capital and population. A time budget skips countries it cannot reach.
- newsSystemsAnalysis rewrites the same-day `web/YYYY/MM/DD.json` on every rerun.
- newsDriftCorrector skips a date that already has a `DRIFT#` row.
- newsAgent skips a `staging` that already has `agentProcessedAt`, unless forced.
- newsSelectionShadow needs a `JEV_API_KEY` and does not affect the site.

## How to check it

    aws events list-rules --region ap-northeast-1 --query 'Rules[?starts_with(Name,`Trigger`)].[Name,State,ScheduleExpression]' --output text
    aws scheduler list-schedules --region ap-northeast-1 --query 'Schedules[].[Name,State]' --output text
    aws lambda get-function-configuration --region ap-northeast-1 --function-name newsThreadAnalysis --query '[Runtime,LastModified,Environment.Variables.NOTES_PREFIX]'
