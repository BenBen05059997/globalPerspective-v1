# board

The personal layer: a signed-in member's pins, strings, weights, dismissed suggestions and summaries. It serves the member who owns the board and nobody else.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Analysis → 4 One reader → 5 Timeline → **6 Views** → 7 Delivery → 8 Watch
This folder is stage 6: the board's Lambda (boards, follows, presets, connect). Timeline: writes no events; reads the Index and Story views (record/), with world/ for what the views do not hold yet. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory: one dated, append-only account per story | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | weekly run, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, DynamoDB board items + prefs fields, `features/board/` |

An agent working on the board does not write `record/` or `weekly/`. See `project-docs/architecture/ARCHITECTURE_RECORD.md` §0.

## What the group will own

- `GlobalPerspectiveSavedItems` items `kind:'board'` (shape: `schema/board.schema.json`).
- `GlobalPerspectiveUserPrefs` fields `followedThreads[]`, `followedActors[]` (`followedCountries` stays with `newsRecommend`).
- S3 `record/pairs/` later, written through `newsConnect` (not before the record exists).

## What it never writes

`record/` (other than `record/pairs/` via `newsConnect`), `weekly/`, `followedCountries`, any pipeline table, any other member's items.

## Pin identifiers

Thread pin `refId` = `threadId`; country = ISO3 (`backend/shared/src/resolveIso3.js`); actor = the name as written in `WEB#INDEX` (trimmed, whitespace collapsed, compared case-insensitively).

## Schema

`schema/board.schema.json` (draft-07), examples in `schema/examples/`, check with `node --test backend/board/schema/validate.test.mjs` (uses the frontend's ajv).

## Status

Slice 1 live 2026-10-20: `newsBoard` deployed (Function URL, role `newsBoard-role`); `newsConnect` not built. Plan: `project-docs/plans/PLAN_2026-10-20_board.md`.
