# weekly

The analyst's weekly: one brief per week, the same for every reader. It is the one backend source of truth for the weekly's content: schema, section model, and (later) the pull, check, publish and hold scripts. The weekly agent procedure is not in the repo yet; every rule, field and path will come from here.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → **8 Weekly report** → 9 Delivery → 10 Watch
This folder is stage 8: the analyst's weekly: schema, section model, pull, check, publish. Timeline: writes the weekly report (weekly/), a view of the week's readings; today only the content model exists, the pull, check and publish scripts are on unmerged branches. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory: one dated, append-only account per story | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | `backend/weekly/`, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, DynamoDB board items + prefs fields, `features/board/` |

An agent working on the weekly does not write `record/` or board data. See `project-docs/architecture/ARCHITECTURE_TIMELINE.md` §6.

## Owns

S3 `weekly/` only: `weekly/YYYY-MM-DD.json` (week ending; status `draft`, `published` or `held` is carried in the file) and `weekly/latest.json` (the newest published week).

## Reads (planned; the pull is not written)

NewsCache `archive#` (7 days, plus 30 for story births), `THREAD_ANALYSIS`, `DRIFT#` / `DRIFTLOG#` (thread and country), `PRED#` scenarios with triggers, `Q#` due dates and verdicts, `web/latest.json` (S3). This live-table pull is interim; final design: the weekly is a view of the week's readings (`record/readings/`), run after the review (stage 8). It does not write `record/` or board data.

## Read by

- `features/weekly/`, through a mirrored copy of the sections core block, kept identical by `scripts/check-shared-sync.mjs`.
- Planned, not built: `newsEmailSender` (it still renders the old `WEEKLY_BRIEF` row today) and the board.

## Files

| File | What it does | Stage |
|---|---|---|
| `schema/weekly.schema.json` | JSON Schema (draft-07) for one week's file; item caps equal `sections.js` | W0, frozen |
| `schema/examples/` | one valid example (week ending 2026-10-18, reshaped from the hand-run draft 2) and four invalid ones | W0 |
| `sections.js` | the section model: keys, order, titles, required, item caps, email word caps, empty texts, label and confidence words, `orderedSections(weekly)` | W0, frozen |
| `test/` | `sections.test.js`, `schema.test.mjs` | W0 |
| `pull.mjs` | reads the live tables (interim; becomes a read of the week's readings after the review), applies the frozen selection rules, writes the inputs JSON | W1, not yet written |
| `check.mjs` | schema plus honesty rules against the inputs | W2, not yet written |
| `publish.mjs` | writes `weekly/YYYY-MM-DD.json` create-only and `weekly/latest.json` | W2, not yet written |
| `hold.mjs` | sets a week to `held` | W2, not yet written |

## How to run

Tests: `node --test backend/weekly/test/*.test.*` (the schema test borrows ajv from the frontend). Pull, check, publish and hold: to be filled in when W1 and W2 land.

## Status

Schema and section model are frozen; pull, check, publish and hold are not written (nothing writes `weekly/` from this folder yet). Design: `project-docs/architecture/ARCHITECTURE_WEEKLY_REVIEW.md` section 9.
