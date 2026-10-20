# record

The world's memory: one dated, append-only account per story. The weekly, story tree, board and track-record page read it.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Analysis → 4 One reader → **5 Timeline** → 6 Views → 7 Delivery → 8 Watch
This folder is stage 5: newsStoryRecord, the only writer of the timeline and its stored views. Timeline: writes the timeline (record/timeline) and the story, index and corrections views. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | `backend/weekly/`, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, user DynamoDB items, `features/board/` |

An agent working on the record does not write the other groups. Design: `project-docs/architecture/ARCHITECTURE_RECORD.md`.

## What the group will own

`newsStoryRecord` is the sole writer of `record/stories/*`, `record/index.json`, `record/corrections/*`. During the dry-run week, use `record/shadow/` instead. Dated snapshots are create-only; latest and index objects are replaceable pointers.

## What it never writes

DynamoDB, `record/pairs/*`, `weekly/*`, user tables. Duplicate detection reports proposals; it never merges or splits threads.

## Schema

`newsStoryRecord/schema/story-record.schema.json` (draft-07) defines stories, index bundles and index rows. Valid and invalid examples live beside it. See [newsStoryRecord](newsStoryRecord/README.md) for tests and the local runner.

## Status

Code and local read-only dry run only. Deployment: not created. Coordinator owns registration, AWS resources and deployment.
