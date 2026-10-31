# record

The world's memory, on two clocks: facts appended daily with no model, readings written weekly with hindsight. The weekly, story tree, board and track-record page read views of it.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → **5 Facts** → **6 Review** → **7 Views** → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 5, 6, 7: newsStoryRecord appends the daily facts (5) and rebuilds the views (7); newsRecordReview writes the weekly readings (6). Timeline: newsStoryRecord is the only writer of record/facts, record/runs (daily) and record/views; newsRecordReview is the only writer of record/readings and record/runs/review-*; views are rebuilt from both. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
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
| newsStoryRecord | The facts writer and the only view builder. Appends the day's facts to `record/facts/YYYY-MM-DD.jsonl` (no model), writes the Run in `record/runs/YYYY-MM-DD.json`, then rebuilds `record/views/` from all facts and readings. | EventBridge `TriggerStoryRecord`, 23:45 UTC daily, ENABLED, input `{"shadow":false}` | [README](newsStoryRecord/README.md) |
| newsRecordReview | The weekly review. One boxed model call per active story; checked answers become readings with hindsight in `record/readings/YYYY-Www.jsonl`, plus the review Run `record/runs/review-YYYY-Www.json` and auto-merges in `record/inbox/merges/`. | EventBridge `TriggerRecordReview`, Monday 01:00 UTC, ENABLED, input `{"shadow":false}` | [README](newsRecordReview/README.md) |

Each is the only writer of its keys. Neither has a Function URL. Inboxes under `record/inbox/` are how other writers hand input to the facts writer: `articles/` (the selector's raw capture), `verdicts/` (the resolver), `merges/` (the review), `assignments/` and `splits/` (operator or review). The operator-owned who's who file `record/operator/aliases.json` is applied to actor ids in the views only (canonical ids are `wd:Q...`; entries marked generic never ground a link).

Views are rebuilt in full after each daily append and the manifest is written last. Dated objects are create-only; latest and index objects are replaceable pointers.

## What it never writes

DynamoDB, `record/pairs/*`, `weekly/*`, user tables. Duplicate detection reports proposals; it never merges or splits threads (a merge is a review proposal, applied through the inbox).

## Schema

`newsStoryRecord/schema/fact.schema.json` and `run.schema.json` (draft-07) with examples; view schemas are in `newsStoryRecord/schema/views/`. Review schemas are in `newsRecordReview/schema/`. See the Lambda READMEs for formats, tests and the local runners.

## Operator tools

`cli/` holds scripts that run from a laptop, not Lambdas: day recovery, benchmark assignments and actor reconciliation. See [cli/README.md](cli/README.md).

## How to check it

    aws events list-rules --region ap-northeast-1 --name-prefix TriggerStoryRecord --query 'Rules[].[Name,State,ScheduleExpression]' --output text
    aws events list-rules --region ap-northeast-1 --name-prefix TriggerRecordReview --query 'Rules[].[Name,State,ScheduleExpression]' --output text
    aws s3 ls s3://globalperspective-world-280362093938/record/runs/ | tail -3

A Run left at `started` with no `finishedAt`, or an old `record/views/manifest.json`, means a run did not finish. What is waiting or stopped is in `project-docs/START_HERE.md`.
