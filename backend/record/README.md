# record

The world's memory, on two clocks: facts appended daily with no model, readings written weekly with hindsight. The weekly, story tree, board and track-record page read views of it.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → **5 Facts** → **6 Review** → **7 Views** → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 5, 6, 7: newsStoryRecord appends the daily facts (5) and rebuilds the views (7); newsRecordReview (planned) writes the weekly readings (6). Timeline: newsStoryRecord is the only writer of record/facts; newsRecordReview (planned) is the only writer of record/readings and record/runs; views are rebuilt from both. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | `backend/weekly/`, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, user DynamoDB items, `features/board/` |

An agent working on the record does not write the other groups. Design: `project-docs/architecture/ARCHITECTURE_RECORD.md`.

## What the group will own

Two writers, each the only writer of its files (design decided 2026-10-21):
- `newsStoryRecord` (deployed): the facts writer. Target: appends `record/facts/YYYY-MM-DD.jsonl` and the facts-only views (active index, links, daily counts), no model. During the shadow period it writes only under `record/shadow/`. Its code still has per-day chapter, trigger and line model steps; they are to be removed in favour of the weekly review.
- `newsRecordReview` (planned): the weekly review, Friday night. Reads the week's facts per active story and writes `record/readings/YYYY-Www.jsonl` (chapters, branch status, lines, typed links, actor merges) and a Run object in `record/runs/YYYY-Www.json`. Each reading cites facts and may supersede an earlier one; it is accepted or rejected with a reason.

Views under `record/views/` are rebuilt from facts and readings. Dated objects are create-only; latest and index objects are replaceable pointers.

## What it never writes

DynamoDB, `record/pairs/*`, `weekly/*`, user tables. Duplicate detection reports proposals; it never merges or splits threads (a merge is an alias reading).

## Schema

`newsStoryRecord/schema/story-record.schema.json` (draft-07) defines the 2026-10-20 story, index bundle and index row shapes; it is replaced by fact and reading schemas as the design is built. See [newsStoryRecord](newsStoryRecord/README.md) for tests and the local runner.

## Status

`newsStoryRecord` deployed 2026-10-21 (reserved concurrency 1, no schedule, no model key); a shadow no-LLM run for 2026-10-20 covered 267 stories. `newsRecordReview` does not exist yet. Coordinator owns AWS resources and deployment.
