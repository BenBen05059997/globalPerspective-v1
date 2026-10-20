# analysis-studio

The Analysis Studio. A signed-in reader picks up to 4 stories (today's or the last 30 days), a lens or a
free-form question, and runs an LLM analysis over our stored material for those stories. The run goes to
the reader's own key (BYOK, browser-only) or, for members, to our compute (`newsAnalyze`). The answer is
checked by a validator, shown as a deck, and can be shared as a frozen link. Used by analysts who want a
thesis on top of our data.

## Status
- Live but out of the nav menu since 2026-10-19 (decision 0030); it returns when its
  [redesign plan](../../../../../project-docs/plans/PLAN_2026-10-19_studio_redesign.md) criteria are met.
  `/analyze` and shared runs stay routed; the country card and Account still link to it.
- Server path only when `analyzeConfigured()` (`window.NEWS_ANALYZE_ENDPOINT`, set in `docs/config.js`) and
  (member or credits > 0); credits are parked (decision 0002). Deep research always stays BYOK (needs web search).
- The `economic` lens is `hidden: true` (economy parked): filtered from the picker, still in `LENSES`.
- Signed-out or anonymous users get a sign-in gate (`isRegistered` in `AnalysisStudio.jsx`). `SignedOutExample`
  shows `EXAMPLE_SHARE_ID` (`lib/sharedExample.js`, currently `null`, so it says "not ready yet").
- Share UI and shared pages need `window.NEWS_SHARE_ENDPOINT` (`shareConfigured()`); without it they are off.

## Routes
- `/analyze` -> `AnalysisStudio` (`?stories=` thread or topic ids, max 4: `studioHref`, `lib/requestedStories.js`)
- `/analyze/s/:id` -> `SharedAnalysisPage` (read-only, noindex; the owner can delete). Address: `sharePath(id)` in
  `lib/shareApi.js`; "Run your own" reopens the Studio on its stories.

## Frontend
- `AnalysisStudio.jsx` - picker, lens and mode, quote before the run, run, stacked sections
- `SharedAnalysisPage.jsx`; `components/StudioDeck.jsx` (map + slide card + time bar), `StudioRunResult.jsx`,
  `StudioPictures.jsx`, `AnalysisVisuals.jsx` (`gp-struct` visuals), `ShareControl.jsx`, `SignedOutExample.jsx`,
  `SharedAnalysisView.jsx`
- `lib/analysisPrompt.js` (`LENSES`, prompts), `analysis.js` (fetch layer), `analysisContext.js` (pure context
  builder), `analysisValidator.js`, `analysisStruct.js`, `llm.js` (`runChat`), `shareApi.js`. Many `lib/` files are
  loaded by Node tooling (`quality/analysis/`) and by the share Lambda: keep their relative imports.
- Public API: none (no `index.js`); `app/App.jsx` lazy-loads both pages by path.
- Other features: `@/features/threads` -> `useWeeklyArchive`. Shared: BYOK storage `shared/lib/byok.js`, provider
  catalog `shared/lib/llmProviders.js`, picker `shared/ui/ProviderModal.jsx`; `useMembership`, `useGeminiTopics`,
  `shared/map/StoryMap.jsx`, `shared/ui/deck.css`, `shared/lib/countries.js`, `links.js`, `dropRedatedRepeats.js`.

## Backend
- Generated row: [reference/features.md#analysis-studio](../../../../../project-docs/reference/features.md#analysis-studio)
- Guides: [membership-studio](../../../../../backend/membership-studio/README.md) (`newsAnalyze`),
  [read-api](../../../../../backend/read-api/README.md) (`newsSharedAnalysis`, `newsSensitiveData-dev`)
- `newsAnalyze` (Function URL, auth NONE, verifies the Firebase token in code): live runtime nodejs20.x, last
  modified 2026-07-10, DeepSeek key in env. The deployed zip is prompt-patched and differs from the repo (the repo
  carries parked credits code): never deploy the repo file over it without a go-live decision.
- `newsSharedAnalysis` (Function URL): stores shares in `GlobalPerspectiveShares`. `newsSensitiveData-dev` serves the
  story material. That material is written by the pipeline (see the story pages' READMEs for the writers).

## Data
- Topics: `useGeminiTopics` (restProxy `topics`, localStorage `gemini_topics_cache_v2`, 1 h); archive: `useWeeklyArchive` (`archive_range`, 30 days, auth header)
- Context per story (`lib/analysis.js`): `narrative_thread`, `thread_analysis`, `prediction_snapshot`; fallback `summary`,
  `prediction`, `trace_cause`. What-changed picture: `country_history`. All public reads through restProxy.
- Member runs: `runMemberAnalysis` -> `window.NEWS_ANALYZE_ENDPOINT` with the Firebase token (sign-in required)
- BYOK: the browser calls the provider directly (`lib/llm.js`); the key stays in localStorage `gp_analyze_byok_v1`
- Shares: `createShare` and `deleteShare` need the token; `fetchShare` is public (the token only marks the owner)

## Pipeline
1. The pipeline Lambdas write stories, thread analyses and forecast snapshots into DynamoDB (`NewsCache`, `SummarizeAndPredict`).
2. `newsSensitiveData-dev` (the proxy) serves them as public actions.
3. `restProxy.js` fetches them: `useGeminiTopics` for the story list, `useWeeklyArchive` for the 30-day archive.
4. The reader picks stories, mode and lens; `buildAnalysisContext` (`lib/analysis.js`) pulls each story's stored material.
5. `buildQuote` shows what the run will cost before it starts; `buildUserMessage` assembles the prompt.
6. Run: `runMemberAnalysis` (server, DeepSeek, server-pinned system prompt) or `runChat` (the reader's own provider).
7. `extractStruct` and `validateStruct` split the optional `gp-struct` block from the prose; `validateAnalysis` checks the prose.
8. `buildLensPicture` and `addSection` build the picture and stack the run as a section; `StudioDeck` draws it.
9. Share: `ShareControl` -> `createShare` -> `newsSharedAnalysis` re-fetches the sources, re-runs the checks, stores the share.
10. `/analyze/s/:id`: `SharedAnalysisPage` -> `fetchShare` -> `SharedAnalysisView`.

## Docs
- Decisions: [0030](../../../../../project-docs/decisions/0030-studio-out-of-menu.md) (out of the menu),
  [0011](../../../../../project-docs/decisions/0011-track-record-and-studio.md) (Studio stays a page),
  [0002](../../../../../project-docs/decisions/0002-analysis-credits-parked.md),
  [0014](../../../../../project-docs/decisions/0014-deepseek-replaces-gemini-no-fallback.md) (DeepSeek, no fallback)
- Rules: [WORLD_MODEL.md](../../../../../project-docs/rules/WORLD_MODEL.md); eval harness: [quality/analysis](../../../../../quality/analysis/README.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/analysis-studio`
- Deployed newsAnalyze (zip, not repo): `aws lambda get-function-configuration --function-name newsAnalyze --region ap-northeast-1 --query '[LastModified,CodeSha256]'`
- Function URLs exist: `aws lambda get-function-url-config --function-name newsSharedAnalysis --region ap-northeast-1 --query AuthType` (same for `newsAnalyze`)

Last verified: 2026-10-20
