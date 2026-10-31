# record

The world's memory, on two clocks: facts appended daily with no model, readings written weekly with hindsight. Alongside them the record keeps the notes the other Lambdas write, and builds static views from all three. The pages, the board and the track-record page read those views.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → **5 Facts** → **6 Review** → **7 Views** → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 5, 6, 7: newsStoryRecord appends the daily facts (5) and rebuilds the views (7); newsRecordReview writes the weekly readings (6). Timeline: newsStoryRecord is the only writer of record/facts, record/runs (daily) and record/views; newsRecordReview is the only writer of record/readings and record/runs/review-*; views are rebuilt from facts, readings and notes; the facts run from 2026-03-07 (history copy, decision 0047). See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | `backend/weekly/`, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, user DynamoDB items, `features/board/` |

An agent working on the record does not write the other groups. Design: `project-docs/architecture/ARCHITECTURE_TIMELINE.md`.

## Lambdas

| Lambda | What it does | Trigger (live) | README |
|---|---|---|---|
| newsStoryRecord | The facts writer and the only view builder. Appends the day's facts to `record/facts/YYYY-MM-DD.jsonl` (no model), writes the Run in `record/runs/YYYY-MM-DD.json`, then rebuilds `record/views/` from all facts, readings and notes. With `{"refresh":true}` it appends no fact and only rebuilds the views, with today's archive entries as provisional entries (decision 0050). | EventBridge `TriggerStoryRecord`, 23:45 UTC daily, input `{"shadow":false}`. Refresh rules, input `{"refresh":true,"shadow":false}`: `TriggerStoryRecordRefresh` 04:35, 12:35, 20:35 UTC; `TriggerStoryRecordRefreshBrief` 14:15; `TriggerStoryRecordRefreshAnalysis` 05:20; `TriggerStoryRecordRefreshWeekly` Sunday 06:15. All ENABLED | [README](newsStoryRecord/README.md) |
| newsRecordReview | The weekly review. One boxed model call per active story; checked answers become readings with hindsight in `record/readings/YYYY-Www.jsonl`, plus the review Run `record/runs/review-YYYY-Www.json` and auto-merges in `record/inbox/merges/`. | EventBridge `TriggerRecordReview`, Monday 01:00 UTC, ENABLED, input `{"shadow":false}` | [README](newsRecordReview/README.md) |

Each is the only writer of its keys. Neither has a Function URL. `newsStoryRecord` has reserved concurrency 1, so a refresh and the nightly run never overlap: keep any new rule at least five minutes clear of 23:45.

Inboxes under `record/inbox/` are how other writers hand input to the facts writer:
- `articles/`: the selector's raw capture of every fetched article;
- `verdicts/` and `draws/`: the resolver's verdicts, and its weekly commit and draw lines;
- `merges/`: the review's auto-merges;
- `assignments/` and `splits/`: the operator, or approved review proposals (`splits/` has no file yet).

`newsStoryRecord` reads each inbox for the run day and the six days before. The operator-owned who's who file `record/operator/aliases.json` is applied to actor ids in the views only (canonical ids are `wd:Q...`; entries marked generic never ground a link).

Views are rebuilt in full by every nightly run and every refresh, and the manifest is written last, so a reader that sees a new manifest sees a complete set. Dated objects are create-only; latest and index objects are replaceable pointers. The pages treat the views as fresh while `manifest.json` `builtAt` is under 9 hours old.

## Notes: the model's daily words

Alongside facts and readings the record keeps notes, the text a model wrote about a thing at a time (decision 0042). Each is one append-only file per day and subtype under `record/notes/<subtype>/YYYY-MM-DD.jsonl` with a day manifest, shape `schema/note.schema.json`, built and written only by `backend/shared/src/notes.js`. Each subtype has one writer:
- `entry`: `NewsProjectInvokeAgentLambda-dev`;
- `story_analysis`: `newsThreadAnalysis`;
- `drift`: `newsDriftCorrector`;
- `country`: `newsCountryIntelligence`;
- `link` and `web`: `newsSystemsAnalysis`;
- `daily_brief` and `weekly_brief` (decision 0048): `newsPostDevTo` and `newsWeeklyBrief`;
- `country_facts` (decision 0053): `newsCountryFactsUpdater`, weekly, no model (Wikidata and ACLED); `story_history` (0053): no writer, backfill copies of `THREAD_HISTORY#` rows (every `story_analysis` note already carries the day's scalars). The read API and the Lambdas that used to read these DynamoDB families read these notes through shared `noteReads.js` (`NOTES_READS`).

The writer's env `NOTES_PREFIX` decides where it writes. Live: `record/` on the first five Lambdas. The two brief writers have no `NOTES_PREFIX`, so they write no note, and their roles have no S3 write statement yet (the operator adds it, then sets the env). Until then the briefs reach the record only through `cli/backfill-brief-notes.mjs`. The backfill scripts in [cli](cli/README.md) wrote everything that existed before the writers. `newsStoryRecord` reads notes to build the views and writes none. Nothing in `record/notes/` is a fact; a view prefers an exact note over an archive copy (`model` null).

## What it never writes

DynamoDB, `record/pairs/*`, `weekly/*`, user tables. Duplicate detection reports proposals; it never merges or splits threads (a merge is a review proposal, applied through the inbox).

## Other prefixes under `record/`

- `legacy/predictions/`: whole copies of old forecast rows that no story could be found for (decision 0047); written by the history copy; no Lambda or page reads it.
- `shadow/` and `shadow-history/`: rehearsal copies of the record (a manual `shadow:true` invoke writes under `record/shadow/`; `shadow-history/` held the history rehearsal). Not read by the site.
- `operator/`: the operator-owned `aliases.json`.

## Schema

`newsStoryRecord/schema/fact.schema.json` and `run.schema.json` (draft-07) with examples; view schemas are in `newsStoryRecord/schema/views/`. Notes are in `schema/note.schema.json`. Review schemas are in `newsRecordReview/schema/`. See the Lambda READMEs for formats, tests and the local runners.

## Operator tools

`cli/` holds scripts that run from a laptop, not Lambdas: day recovery, the note backfills, the history copy (decision 0047), benchmark assignments and actor reconciliation. See [cli/README.md](cli/README.md).

## How to check it

    aws events list-rules --region ap-northeast-1 --name-prefix TriggerStoryRecord --query 'Rules[].[Name,State,ScheduleExpression]' --output text
    aws events list-rules --region ap-northeast-1 --name-prefix TriggerRecordReview --query 'Rules[].[Name,State,ScheduleExpression]' --output text
    aws s3 cp s3://globalperspective-world-280362093938/record/views/manifest.json -
    aws s3 ls s3://globalperspective-world-280362093938/record/runs/ | tail -3

A Run left at `started` with no `finishedAt`, or a `record/views/manifest.json` whose `builtAt` is more than a few hours old, means a run did not finish. What is waiting or stopped is in `project-docs/START_HERE.md`.
