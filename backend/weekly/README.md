# weekly

The analyst's weekly: one brief per week, the same for every reader. It is the one backend source of truth for the weekly's content: schema, section model, and (later) the pull, check, publish and hold scripts. The agent procedure lives in `.claude/skills/weekly-brief/SKILL.md` and holds only the steps; every rule, field and path comes from here.

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory: one dated, append-only account per story | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | `backend/weekly/`, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, DynamoDB board items + prefs fields, `features/board/` |

An agent working on the weekly does not write `record/` or board data. See `project-docs/architecture/ARCHITECTURE_RECORD.md` §0.

## Owns

S3 `weekly/` only: `weekly/YYYY-MM-DD.json` (week ending; status `draft`, `published` or `held` is carried in the file) and `weekly/latest.json` (the newest published week).

## Reads (W1, not yet written)

NewsCache `archive#` (7 days, plus 30 for story births), `THREAD_ANALYSIS`, `DRIFT#` / `DRIFTLOG#` (thread and country), `PRED#` scenarios with triggers, `Q#` due dates and verdicts, `web/latest.json` (S3). Later `record/` replaces the direct table reads (record plan, step 2).

## Read by

- `newsEmailSender` (`backend/distribution/newsEmailSender`), through the `src/_weekly` symlink (W3): renders the email from `sections.js` and `weekly/latest.json`.
- `features/weekly/` (W5), through a mirrored copy of the sections core block, kept identical by `scripts/check-shared-sync.mjs`.
- The board, later.

## Files

| File | What it does | Stage |
|---|---|---|
| `schema/weekly.schema.json` | JSON Schema (draft-07) for one week's file; item caps equal `sections.js` | W0, frozen |
| `schema/examples/` | one valid example (week ending 2026-10-18, reshaped from the hand-run draft 2) and four invalid ones | W0 |
| `sections.js` | the section model: keys, order, titles, required, item caps, email word caps, empty texts, label and confidence words, `orderedSections(weekly)` | W0, frozen |
| `test/` | `sections.test.js`, `schema.test.mjs` | W0 |
| `pull.mjs` | reads the tables, applies the frozen selection rules, writes the inputs JSON | W1, not yet written |
| `check.mjs` | schema plus honesty rules against the inputs | W2, not yet written |
| `publish.mjs` | writes `weekly/YYYY-MM-DD.json` create-only and `weekly/latest.json` | W2, not yet written |
| `hold.mjs` | sets a week to `held` | W2, not yet written |

## How to run

Tests: `node --test backend/weekly/test/*.test.*` (the schema test borrows ajv from the frontend). Pull, check, publish and hold: to be filled in when W1 and W2 land.

## Status

W0: schema and section model frozen. Plan: `project-docs/plans/PLAN_2026-10-20_analyst_weekly.md`.
