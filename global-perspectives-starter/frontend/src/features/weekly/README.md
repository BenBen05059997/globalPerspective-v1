# weekly

The analyst's weekly page (planned `/briefings/weekly?week=YYYY-MM-DD`): the shared report, the same for every reader.
It is the **weekly** of the three names in `project-docs/architecture/ARCHITECTURE_RECORD.md` §0; it never writes the
record or board data.

## Status
- W0 only (2026-10-20): the mirrored section model. No page, no route, no hook yet; the page is stage W5 of
  `project-docs/plans/PLAN_2026-10-20_analyst_weekly.md`. Briefings' `WeeklyMode` still serves the old brief.

## Routes
- None yet. Planned: `/briefings/weekly` (`/weekly/*` is taken by the countries list).

## Frontend
- `lib/sections.js` — mirror of the core block of `backend/weekly/sections.js` (section order, titles, required, caps,
  empty texts, `orderedSections`). Never edit one copy alone: `scripts/check-shared-sync.mjs` section (g) fails on drift.
- Public API: none yet (no `index.js` until the page exists).

## Backend
- One source of truth: `backend/weekly/` (schema, section model; pull, check, publish, hold from W1-W2). The page will
  read `weekly/latest.json` and `weekly/YYYY-MM-DD.json` through the Worker's `/data/*` once its allowlist includes `weekly/`.

## Data
- None yet. Planned: one public fetch of the week's JSON; no sign-in.

## Pipeline
1. `backend/weekly/pull.mjs` selects from the live tables (W1).
2. The headless run writes the week to the schema; `check.mjs` validates; `publish.mjs` writes S3 `weekly/` (W2).
3. `newsEmailSender` renders the email from the same section model (W3); this page renders the web view (W5).

## Docs
- Generated reference: [features.md#weekly](../../../../../project-docs/reference/features.md#weekly)
- Plan: [PLAN_2026-10-20_analyst_weekly.md](../../../../../project-docs/plans/PLAN_2026-10-20_analyst_weekly.md)
- Backend: [backend/weekly/README.md](../../../../../backend/weekly/README.md)

## How to check it
- `cd global-perspectives-starter/frontend && npx vitest run src/features/weekly`
- `node scripts/check-shared-sync.mjs` (section g: weekly sections)

Last verified: 2026-10-20
