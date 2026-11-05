# ops

The operator's page (`/ops`): what the pipeline did each day and what it cost. A monitoring page, not a reader feature; it writes nothing.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → **10 Watch**
This folder is stage 10: the operator page (/ops): money and pipeline health. Timeline: reads the public record/views/health.json through the Worker and the gated ops action for the private money file; writes nothing. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
Phase 1 (money and pipeline panels) is live: released in bundle `index-CYeE3t3L` (2026-11-04); `newsHealth` writes `record/views/health.json` and `monitoring/ops.json` hourly and the deployed `newsReadApi` has the `ops` action. A missing file still reads honestly ("The pipeline view has not been generated yet.", "The money file has not been written yet."). The Readers panel (phase 2) is built, not deployed: it reads `readers` in `ops.json` and says "Not connected" with the token steps until the operator sets the Cloudflare token on `newsHealth`. The Quality panel (phase 3) is built, not deployed: it reads `quality` in `ops.json` (needs the two IAM grants on `newsHealth`, `ARCHITECTURE_OPS.md` "Phase 3 as built").

## Routes
- `/ops` (`OPS_ROUTE` in `index.js`; lazy in `app/App.jsx`; noindex). Not in `shared/lib/links.js`, whose core is mirrored into the Lambdas' link code.
- Signed out or a guest: one sign-in line, no request. Signed in: the `ops` action decides; a 403 gives one line, "The ops page is not available for this account.", and nothing else is fetched. A failed call says it could not be loaded and goes to the error sink.
- The account-area **Ops** link (`app/layout/Layout.jsx`, next to Board) shows only after `ops` answered 200 once this session (`useOpsAccess`, in memory per uid). Each signed-in non-guest account makes that one probe at load, so a non-operator's network log shows one 403.

## Frontend
- `OpsPage.jsx` holds the states. `MoneyPanel`: DeepSeek yesterday and month to date (labelled estimate), AWS yesterday and month to date, 14 daily bars (a day with no data has no bar), DeepSeek by Lambda (a model with no price reads "unpriced"), unit costs, the weekly review's spend; a source that failed on the last run is named above the numbers.
- `PipelinePanel`: one row per stage, one cell per UTC day for 14 days: ok `✓`, thin `~`, missing `✕`, failed `!`, no data `·` (colour plus glyph). Hover, focus or tap shows the day's numbers, source, the source's time, or the error text. A stage with no data on any day reads "no run". The grid scrolls inside its own box on a phone.
- `ReadersPanel` (third): page views over 14 days (without /ops, shown apart), views per family with a 14-day bar row each (each row scaled to its own tallest day), top stories (title, or the thread id when there is none), top country pages, visitor countries, referrers, our own counts (accounts, boards, saved items, shares), the attention-vs-effort table (views next to model spend, split rule in the panel note). States: not connected (the steps), Cloudflare error (its text), own-table error, section missing (older file). Our own testing is included in the counts and the note says so.
- `QualityPanel` (fourth): six checks, each with its day and source, numbers, and examples; a check with no source reads "Not available." and says what is missing (pins outside their country, dead outlets today), a failed read shows its error, a verdict day with no file says nothing was settled. Old file without the section: one line.
- Libs: `quality.js`, `readers.js`, `pipeline.js` (pivot, no-run rule, fact lines), `money.js`, `opsApi.js` (the one door). Styles: `ops.css`, tokens and shared Card, SectionHeader, AsOf only.

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
- Dev harness (dev builds only, `dev/fixtures.js` cut from a live `newsHealth` dry run): `/ops?devOps=1` runs as the operator, `?devOps=nc` is the same with Cloudflare not connected, `?devOps=cferr` a Cloudflare error, `?devOps=403` the not-the-operator answer.
- Browser: click a strip cell, tab to the grid, check 390px (no page-level sideways scroll).
