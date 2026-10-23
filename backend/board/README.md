# board

The personal layer: a signed-in member's pins, strings, weights, dismissed suggestions and summaries. It serves the member who owns the board and nobody else.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the board's Lambda (boards, follows, presets, connect). Timeline: writes no facts or readings; reads the record views (settled past from readings, unsettled present from daily counts), with world/ for what the views do not hold yet. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory: one dated, append-only account per story | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | weekly run, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, DynamoDB board items + prefs fields, `features/board/` |

An agent working on the board does not write `record/` or `weekly/`. See `project-docs/architecture/ARCHITECTURE_TIMELINE.md` §6.

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

Slice 1 live 2026-10-20: `newsBoard` deployed (Function URL, role `newsBoard-role`; deployed zip last updated 2026-10-21, before the view-reading change below); `newsConnect` not built. Plan: `project-docs/plans/PLAN_2026-10-20_board.md`.

Record views (0037, deployed 2026-10-22: `newsBoard` CodeSha256 0aVv97o4... (last modified 2026-10-22 07:04Z); `newsBoard-role` policy `newsBoard-record` reads `record/views/index/active.json`, `index/all.json` and `links/*`, and the old `record/index.json` / `record/stories/*` grants are gone). `newsBoard` reads `record/views/index/active.json` (fallback `index/all.json`) and `record/views/links/*` only; story views, links and daily counts reach the browser through the Worker's `/data/record/views/` once the Worker is uploaded (the live Worker, version cc57a42f, cannot serve them yet). `record/index.json` and `record/stories/*` are no longer read, and the `story_view` action is removed. Readings (line, chapters, confirmed links, risk) are `null` until the weekly review.
