# analysis-studio

The Analysis Studio: a signed-in reader picks up to 4 stories (today's or the last 30 days), a lens or
free-form question, and runs an LLM analysis over our stored material. Runs go to the reader's own key
(BYOK, browser-only) or, for members / credit holders, to our compute (`newsAnalyze`). Output is checked
by a validator, rendered as a deck, and can be shared.

## Status
- Live but out of the nav menu (decision 0030, 2026-10-19; it returns when its [redesign plan](../../../../../project-docs/plans/PLAN_2026-10-19_studio_redesign.md) criteria are met). `/analyze` and shared runs stay routed; the country card and Account still link to it. Server path only when `analyzeConfigured()` (`window.NEWS_ANALYZE_ENDPOINT` set) and (member or
  credits > 0); credits are parked (decision 0002). Deep research always stays BYOK (needs web search).
- The `economic` lens is `hidden: true` (economy parked): filtered from the picker, still in `LENSES`.
- Signed-out / anonymous users get a sign-in gate; `SignedOutExample` shows `EXAMPLE_SHARE_ID`
  (`lib/sharedExample.js`, currently `null` -> "not ready yet"). Share UI hidden while `NEWS_SHARE_ENDPOINT` is unset.

## Routes
- `/analyze` -> `AnalysisStudio` (`?stories=` thread or topic ids, max 4: `studioHref`, `lib/requestedStories.js`)
- `/analyze/s/:id` -> `SharedAnalysisPage` (read-only, noindex; owner can delete). Address: `shareApi.js` `sharePath(id)`;
  "Run your own" reopens the Studio on its stories (`studioHref`).

## Frontend
- `AnalysisStudio.jsx` - picker, lens/mode, quote before the run, run, stacked sections
- `SharedAnalysisPage.jsx`; `components/StudioDeck.jsx` (map + slide card + time bar), `StudioRunResult.jsx`,
  `StudioPictures.jsx`, `AnalysisVisuals.jsx` (`gp-struct` visuals), `ShareControl.jsx`,
  `SignedOutExample.jsx`, `SharedAnalysisView.jsx`
- `lib/analysisPrompt.js` (`LENSES`, prompts), `analysis.js` (fetch layer), `analysisContext.js`,
  `analysisValidator.js`, `llm.js` (`runChat`), `shareApi.js`. Many `lib/` files are loaded by
  Node tooling (`quality/analysis/`): keep their relative imports (header comment says so).
- Public API: none (no `index.js`). Imports from other features: `@/features/threads` -> `useWeeklyArchive`.
  Shared: BYOK `lib/byok.js`, `llmProviders.js`, `ui/ProviderModal.jsx`; `useMembership`,
  `@/shared/map/StoryMap.jsx`, `@/shared/ui/deck.css`, `@/shared/lib/countries.js`, `links.js`, `trFormatDate.js`, `dropRedatedRepeats.js`

## Backend
- Generated row: [reference/features.md#analysis-studio](../../../../../project-docs/reference/features.md#analysis-studio)
- `newsAnalyze` (member runs, Function URL): the deployed zip is prompt-patched and differs from the repo
  (repo carries parked credits code) — never deploy the repo file over it without a go-live decision.
- `newsSharedAnalysis` (shares, Function URL); `newsSensitiveData-dev` serves the story context; context is
  written by `NewsProjectInvokeAgentLambda-dev`, `newsThreadAnalysis`, `newsDriftCorrector`.

## Data
- Topics: `useGeminiTopics` (restProxy `topics`); archive: `useWeeklyArchive` (`archive_range`, 30 days, auth)
- Context per story: restProxy `narrative_thread`, `thread_analysis`, `prediction_snapshot`; fallback `summary`,
  `prediction`, `trace_cause`. What-changed picture: `country_history`.
- Member runs: `runMemberAnalysis` (`@/shared/api/restProxy`) -> `window.NEWS_ANALYZE_ENDPOINT`
- BYOK: the browser calls the provider directly (`lib/llm.js`, catalog in `shared/lib/llmProviders.js`); key in localStorage `gp_analyze_byok_v1`
- Shares: `fetchShare` / `deleteShare` (`lib/shareApi.js`) -> `window.NEWS_SHARE_ENDPOINT` with the Firebase token

## Docs
- Decisions: [0011](../../../../../project-docs/decisions/0011-track-record-and-studio.md) (Studio stays a page),
  [0002](../../../../../project-docs/decisions/0002-analysis-credits-parked.md),
  [0014](../../../../../project-docs/decisions/0014-deepseek-replaces-gemini-no-fallback.md) (DeepSeek, no fallback)
- Rules: [WORLD_MODEL.md](../../../../../project-docs/rules/WORLD_MODEL.md)
- Eval harness: `quality/analysis/` (README there)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/analysis-studio`
- Deployed newsAnalyze (zip, not repo): `aws lambda get-function-configuration --function-name newsAnalyze --region ap-northeast-1 --query '[LastModified,CodeSha256]'`
- Function URLs present: `aws lambda get-function-url-config --function-name newsSharedAnalysis --region ap-northeast-1 --query AuthType`
  (same for `newsAnalyze`)

Last verified: 2026-10-19
