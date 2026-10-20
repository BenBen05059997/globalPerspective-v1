# analysis-studio

What is left of the Analysis Studio, which was retired on 2026-10-20 (decision 0033). The lens Studio screens
(story picker, lens runs on the reader's own key or on our compute, the slide deck) are gone; `/analyze` now only
redirects. What stays is the read-only page for a run someone already shared (`/analyze/s/:id`, so old links keep
working) and the analysis libraries that the share Lambda and the offline eval harness (`quality/analysis/`) use.
Readers of an old share link see it; nobody creates new ones from the site.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Analysis → 4 One reader → 5 Timeline → **6 Views** → 7 Delivery → 8 Watch
This folder is stage 6: shared-run pages of the retired Studio. Timeline: reads none of the timeline. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Retired 2026-10-20. Only the shared-run page is a screen. The country page (`features/countries`) is the
  "sheet" that replaced the Studio's role for analysts.
- The shared page needs `window.NEWS_SHARE_ENDPOINT` (`shareConfigured()`); without it the page says shared
  analyses are not available yet. The site cannot create a share any more (`createShare` is deleted); the owner of an
  old share can still delete it.
- The libraries below have no page caller. They stay because other code imports them (see Frontend).

## Routes
- `/analyze/s/:id` -> `SharedAnalysisPage` (read-only, noindex; the owner can delete). Lazy-loaded by `app/App.jsx`.
- `/analyze` -> not this feature: `AnalyzeRedirect` in `app/LegacyRedirects.jsx` (first thread id in `?stories=` goes to
  its story page, anything else to the countries list). The front Worker sends the same as a 301 and never
  bot-renders `/analyze/s/*`.

## Frontend
- Screen: `SharedAnalysisPage.jsx` (+ `SharedAnalysis.css`), `components/SharedAnalysisView.jsx`,
  `components/AnalysisVisuals.jsx` (`gp-struct` visuals), `components/SharedTimeBar.jsx`.
- `lib/shareApi.js` (`fetchShare`, `deleteShare`, `shareConfigured`, `httpOnly`), `formatDate.js`, `webCitations.js`.
- Kept for other code, no page uses them: `lib/analysisPrompt.js` (`LENSES`, prompts, source typing),
  `analysisValidator.js`, `analysisStruct.js`, `analysisContext.js` (pure context builder) and `llm.js`
  (`runChat`, with `shared/lib/llmProviders.js`). `quality/analysis/*.mjs` import prompt, validator, struct and
  `llm.js`; five of them are byte-identical copies in `backend/read-api/newsSharedAnalysis/src/`
  (`scripts/check-shared-sync.mjs`): keep their relative imports and change both sides together.
- `__tests__/fixtures/contextGolden.json` is the canonical copy of the context golden; the Lambda's test and
  the sync check compare against it.
- Public API: none (no `index.js`). Shared: `shared/ui/Markdown.jsx`, `SectionHeader`, `EntityLink`, `Button`,
  `shared/lib/links.js`, `shared/hooks/useNoIndex.js`.

## Backend
- Generated row: [reference/features.md#analysis-studio](../../../../../project-docs/reference/features.md#analysis-studio)
- Guides: [membership-studio](../../../../../backend/membership-studio/README.md) (`newsAnalyze`),
  [read-api](../../../../../backend/read-api/README.md) (`newsSharedAnalysis`)
- `newsSharedAnalysis` (Function URL): serves and deletes shares in `GlobalPerspectiveShares`; its create path is
  no longer called by the site.
- `newsAnalyze` (Function URL, auth NONE, verifies the Firebase token in code) is deployed but nothing in the site
  calls it. The deployed zip differs from the repo (the repo carries parked credits code): never deploy the repo file
  over it without a go-live decision.

## Data
- Shares: `fetchShare` is public (the token only marks the owner); `deleteShare` needs the Firebase token.
- A share holds frozen sources (verbatim text), the reader's prose, an optional `gp-struct` block and the checks it
  passed; nothing is fetched live.

## Pipeline
1. A share was written once by `newsSharedAnalysis` after it re-fetched the sources and re-ran the checks.
2. `/analyze/s/:id`: `SharedAnalysisPage` -> `fetchShare` -> `SharedAnalysisView`.

## Docs
- Decisions: [0033](../../../../../project-docs/decisions/0033-lens-studio-retired.md) (retired),
  [0030](../../../../../project-docs/decisions/0030-studio-out-of-menu.md) (superseded),
  [0011](../../../../../project-docs/decisions/0011-track-record-and-studio.md),
  [0002](../../../../../project-docs/decisions/0002-analysis-credits-parked.md),
  [0014](../../../../../project-docs/decisions/0014-deepseek-replaces-gemini-no-fallback.md) (DeepSeek, no fallback)
- Rules: [WORLD_MODEL.md](../../../../../project-docs/rules/WORLD_MODEL.md); eval harness: [quality/analysis](../../../../../quality/analysis/README.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/analysis-studio`
- Sync with the share Lambda: `node scripts/check-shared-sync.mjs`
- Function URL exists: `aws lambda get-function-url-config --function-name newsSharedAnalysis --region ap-northeast-1 --query AuthType`

Last verified: 2026-10-20
