# analysis-studio

The Analysis Studio: a signed-in reader picks up to 4 stories (today's or the last 30 days), a lens
or free-form question, and runs an LLM analysis over our stored material. Runs go to the reader's
own key (BYOK, browser-only) or, for members / credit holders, to our compute (newsAnalyze).
Output is checked by a validator, rendered as a deck, and can be shared.

## Routes
- `/analyze` -> `AnalysisStudio` (`?stories=id1,id2` pre-selects known topic ids, max 4)
- `/analyze/s/:id` -> `SharedAnalysisPage` (read-only, noindex shared run)

## Entry files
- `AnalysisStudio.jsx` - picker, lens/mode, quote before the run, run, stacked sections
- `SharedAnalysisPage.jsx` - loads one share; owner can delete it. `components/StudioDeck.jsx` (map + slide card + time bar), `StudioRunResult.jsx` (one section)
- `components/StudioPictures.jsx`, `AnalysisVisuals.jsx` - one picture per lens; `gp-struct` visuals
- `components/ProviderModal.jsx` (BYOK chooser), `ShareControl.jsx`, `SignedOutExample.jsx`, `SharedAnalysisView.jsx`
- `lib/analysisPrompt.js` (`LENSES`, prompts), `analysis.js` (fetch layer), `analysisContext.js`, `analysisValidator.js`, `llm.js` (providers), `byok.js`, `shareApi.js`

## Data
- `useGeminiTopics` (today's topics), `useWeeklyArchive` (restProxy `archive_range`, 30 days)
- Context per story: restProxy `narrative_thread`, `thread_analysis`, `prediction_snapshot`; fallback `summary`, `prediction`, `trace_cause`
- What-changed picture: restProxy `country_history`; member runs: `runMemberAnalysis` -> `window.NEWS_ANALYZE_ENDPOINT`
- BYOK: browser calls the provider directly (DeepSeek, Perplexity, OpenAI, Gemini, Qwen, Anthropic in `lib/llm.js`); key in localStorage `gp_analyze_byok_v1`
- Shares: `window.NEWS_SHARE_ENDPOINT` (newsSharedAnalysis) with the Firebase token

## Shared blocks used
- `@/shared/ui/Markdown`, `@/shared/ui/StoryLink`, `@/shared/ui/boot/BootLoader`

## Imports from other features
- `@/shared/hooks/useMembership` -> member / credit balance; `@/features/threads/hooks/useWeeklyArchive`, `hooks/useNarrativeThread`, `components/StoryMode` (`StoryMap`)
- `@/shared/lib/situationLabels.js` -> `iso3ForName`; `@/features/track-record/lib/trFormatDate.js` -> `fmtDay`

## Gotchas
- Signed-out and anonymous users get a modal sign-in gate; `SignedOutExample` shows `EXAMPLE_SHARE_ID` (`lib/sharedExample.js`, currently `null` -> "not ready yet").
- Server path only when `analyzeConfigured()` and (member or credits > 0); deep research always stays BYOK (needs a web-search provider).
- The `economic` lens is `hidden: true` (parked): filtered from the picker, still in `LENSES`. `compare` needs 2+ stories.
- Many `lib/` files are imported by Node tooling (`quality/analysis/`): keep their relative imports (header comment says so).
- Share UI is hidden while `NEWS_SHARE_ENDPOINT` is unset; `/analyze/s/:id` then says sharing is not on.

Last verified: 2026-10-19
