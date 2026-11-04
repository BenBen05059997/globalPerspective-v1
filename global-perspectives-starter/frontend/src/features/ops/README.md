# ops

The operator's page (`/ops`): what the pipeline did each day and what it cost. A monitoring page, not a reader feature; it writes nothing.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → **10 Watch**
This folder is stage 10: the operator page (/ops): money and pipeline health. Timeline: reads the public record/views/health.json through the Worker and the gated ops action for the private money file; writes nothing. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
Phase 1 (money and pipeline panels) built 2026-11-04, not deployed: `newsHealth` does not exist in AWS yet, so `record/views/health.json` and `monitoring/ops.json` are not written, and the `ops` action is not in the deployed `newsReadApi`. Until then the page says so honestly ("The pipeline view has not been generated yet.", "The money file has not been written yet."). Readers and quality panels are later phases (`ARCHITECTURE_OPS.md`).

## Routes
- `/ops` (`OPS_ROUTE` in `index.js`; lazy in `app/App.jsx`; noindex). Not in `shared/lib/links.js`, whose core is mirrored into the Lambdas' link code.
- Signed out or a guest: one sign-in line, no request. Signed in: the `ops` action decides; a 403 gives one line, "The ops page is not available for this account.", and nothing else is fetched. A failed call says it could not be loaded and goes to the error sink.
- The account-area **Ops** link (`app/layout/Layout.jsx`, next to Board) shows only after `ops` answered 200 once this session (`useOpsAccess`, in memory per uid). Each signed-in non-guest account makes that one probe at load, so a non-operator's network log shows one 403.

## Frontend
- `OpsPage.jsx` holds the states. `MoneyPanel`: DeepSeek yesterday and month to date (labelled estimate), AWS yesterday and month to date, 14 daily bars (a day with no data has no bar), DeepSeek by Lambda (a model with no price reads "unpriced"), unit costs, the weekly review's spend; a source that failed on the last run is named above the numbers.
- `PipelinePanel`: one row per stage, one cell per UTC day for 14 days: ok `✓`, thin `~`, missing `✕`, failed `!`, no data `·` (colour plus glyph). Hover, focus or tap shows the day's numbers, source, the source's time, or the error text. A stage with no data on any day reads "no run". The grid scrolls inside its own box on a phone.
- Libs: `pipeline.js` (pivot, no-run rule, fact lines), `money.js`, `opsApi.js` (the one door). Styles: `ops.css`, tokens and shared Card, SectionHeader, AsOf only.

## Backend
`newsHealth` (`backend/monitoring/newsHealth/`, hourly, no model) writes both files. `newsReadApi` action `ops` (`backend/read-api/newsSensitiveData/src/ops.js`) serves the money file to the uids in `OPS_OPERATOR_UIDS`.

## Data
- `record/views/health.json` through the Worker (`fetchRecordView('health.json')`, public, 404 = not generated); schema `backend/record/schema/health.schema.json`.
- `ops` via `fetchOps` in `@/shared/api/restProxy`, which returns `monitoring/ops.json`. No local cache; the page reads on open.

## Pipeline
1. `newsHealth` reads the record's files, CloudWatch, Logs Insights, the resolver status and Cost Explorer; writes `health.json` and `ops.json`.
2. The Worker serves `health.json`; `newsReadApi` serves `ops.json` to the operator.
3. `OpsPage` renders both; nothing else reads them.

## Docs
[ARCHITECTURE_OPS.md](../../../../../project-docs/architecture/ARCHITECTURE_OPS.md), [newsHealth README](../../../../../backend/monitoring/newsHealth/README.md), [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).

## How to check it
- `cd global-perspectives-starter/frontend && npm run verify`; this feature only: `npx vitest run src/features/ops` (access states, both panels, hover and tap, errors, no-run rows, the nav-link hook).
- Dev harness (dev builds only, `dev/fixtures.js` cut from a live `newsHealth` dry run): `/ops?devOps=1` runs as the operator, `?devOps=403` shows the not-the-operator answer.
- Browser: click a strip cell, tab to the grid, check 390px (no page-level sideways scroll).
