# board

The personal layer: a signed-in member's pins, strings, weights, dismissed suggestions and summaries. It serves the member who owns the board and nobody else.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the board's Lambda (boards, follows, presets, connect). Timeline: writes no facts or readings; reads the record views (story, links and counts; the settled past from readings, the unsettled present from daily counts), with world/ for what the views do not hold yet. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory: one dated, append-only account per story | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | weekly run, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, DynamoDB board items + prefs fields, `features/board/` |

An agent working on the board does not write `record/` or `weekly/`. See `project-docs/architecture/ARCHITECTURE_TIMELINE.md` §6.

## What the group owns

- `newsBoard` ([README](newsBoard/README.md)): the board Lambda, a Function URL with Firebase JWT auth, no schedule.
- `GlobalPerspectiveSavedItems` items `kind:'board'` (shape: `schema/board.schema.json`).
- `GlobalPerspectiveUserPrefs` fields `followedThreads[]`, `followedActors[]` (`followedCountries` stays with `newsRecommend`).

## What it never writes

`record/`, `weekly/`, `followedCountries`, any pipeline table, any other member's items. There is no `newsConnect` Lambda: `connect` is a `newsBoard` action and writes nothing.

## Pin identifiers

Thread pin `refId` = `threadId`; country = ISO3 (`backend/shared/src/resolveIso3.js`); actor = the name as written in `WEB#INDEX` (trimmed, whitespace collapsed, compared case-insensitively).

## Schema

`schema/board.schema.json` (draft-07), examples in `schema/examples/`, check with `node --test backend/board/schema/validate.test.mjs` (uses the frontend's ajv).

## Design and status

Design: `project-docs/architecture/ARCHITECTURE_BOARD.md`. Board pins and the arrivals tray read the record views, so readings (line, chapters, confirmed links) are `null` or empty for a story until the weekly review has read it. Live state: `aws lambda get-function-configuration --function-name newsBoard`.
