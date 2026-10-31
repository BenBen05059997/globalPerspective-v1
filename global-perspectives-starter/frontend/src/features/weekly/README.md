# weekly

The analyst's weekly page (planned, not built): the shared report, the same for every reader.
It is the **weekly** of the three names in `project-docs/architecture/ARCHITECTURE_TIMELINE.md` §6; it never writes the
record or board data.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the weekly page (planned /briefings/weekly). Timeline: will render the weekly report (weekly/). See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Not built. This folder holds only the mirrored section model (`lib/sections.js`). There is no page, no route, no hook and no
  `index.js`. Today's weekly surface is Briefings' weekly mode (`features/briefings`, `/briefings?mode=weekly`), which still serves the
  old weekly brief. The page is stage W5 of `project-docs/architecture/ARCHITECTURE_WEEKLY_REVIEW.md` section 9.

## Routes
- None. Planned: `/briefings/weekly` (`/weekly/*` is taken by the Stories and countries pages).

## Frontend
- `lib/sections.js` - mirror of the core block of `backend/weekly/sections.js` (section order, titles, required, caps, empty texts,
  `orderedSections`). Never edit one copy alone: `scripts/check-shared-sync.mjs` section (g) fails on drift.
- Public API: none.

## Backend
- One source of truth: `backend/weekly/` (schema and section model today; the pull, check, publish and hold scripts are planned
  there, see its README). The page will read `weekly/latest.json` and `weekly/YYYY-MM-DD.json` through the Worker's `/data/*` once
  the Worker allowlist (`DATA_ALLOWED` in `cloudflare/front-worker/production/worker.mjs`) includes `weekly/`; it does not today.

## Data
- None yet. Planned: one public fetch of the week's JSON, no sign-in.

## Pipeline
1. The weekly is stage 8 (a view of the week's readings, run after the review); `backend/weekly/` writes S3 `weekly/` (planned).
2. `newsEmailSender` renders the email from the same section model (planned); this page will render the web view.

## Docs
- Design: [ARCHITECTURE_WEEKLY_REVIEW.md](../../../../../project-docs/architecture/ARCHITECTURE_WEEKLY_REVIEW.md) (section 9)
- Backend: [backend/weekly/README.md](../../../../../backend/weekly/README.md)

## How to check it
- `cd global-perspectives-starter/frontend && npx vitest run src/features/weekly`
- `node scripts/check-shared-sync.mjs` (section g: weekly sections)
