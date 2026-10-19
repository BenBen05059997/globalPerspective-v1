# backend/shared

One copy of the helpers several news Lambdas use. Not a Lambda and not a layer: each Lambda reaches
these files through its committed `src/_shared -> ../../../shared/src` symlink, and
`scripts/lambda.sh package|diff` stages `src` with links followed, so the zip carries real files
under `_shared/`. An edit here changes every Lambda that requires the file on its next deploy.

## Modules (`src/`)
- `llm.js`: OpenAI-compatible `chat()` over fetch, no deps. Providers `deepseek` (`GROK_API_URL`,
  fallback `https://api.deepseek.com`, key `XAI_API_KEY`; legacy names, DeepSeek values),
  `openrouter`, `gemini`, `other`. Thinking off unless asked; transport retries; prints `[usage]` lines.
- `dayZero.js`: `keepDayZero` (an entry counts as today only if it was archived today, UTC).
- `placeFilter.js` + `placeNames.json`, `iso3Names.json`: real-country rule, canonical names,
  `usableCountryRecord`.
- `resolveIso3.js`: TEMPORARY `resolveIso3(text) -> {iso3, name}` / `iso3List(names)` over `iso3Names.json` +
  the `placeFilter.js` aliases (canonical short names: United States, DR Congo, UAE, Palestine, Bosnia and
  Herzegovina). Replaced by L1-LINKS `resolveCountry`; callers are marked `TODO(L1-LINKS)`.
- `riskDimensions.js`: 4-axis risk vector -> headline score/level (worst axis leads).
- `situations-core.js`: GDACS observation + situation fold (`buildSituation`, `coolSituation`,
  `buildStorySituation`; a threaded story's situation is `news#<ISO3>#<threadId>` with absorbed old ids in `aliases[]`). Pure, no AWS.

Who uses what: `git grep "_shared/" -- backend`.

## Checks
- Tests: `cd backend/shared && node --test test/dayZero.test.js test/llm.test.js test/placeFilter.test.js test/resolveIso3.test.js test/situations-core.test.mjs`.
- Copies that cross the frontend/Lambda boundary (name tables, the real-country rule) are compared
  by `node scripts/check-shared-sync.mjs`.
