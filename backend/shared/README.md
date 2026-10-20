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
- `countries.js` + `iso3Names.json`: the one country table (`{ISO3: {name, iso2, aliases[], places?[]}}`,
  short display names such as "UAE", "DR Congo") and its resolver: `resolveCountry(text) -> {iso3, name} | null`,
  `isCountry`, `parentCountry` (West Bank -> Palestine). Frontend copy: `shared/lib/countries.js` + `shared/data`.
- `resolveIso3.js`: `resolveIso3(text) -> {iso3, name}` (a place resolves to its country) / `iso3List(names)` for
  the Lambda writers; a thin wrapper over `countries.js`.
- `links.js`: the site's page addresses for emails and posts, same rules as the frontend
  `shared/lib/links.js` (`storyHref`, `countryHref`, `mapHref`, `briefingHref`, `forecastHref`,
  `todayHref`, `entityHref`, `ROUTE`) plus `absoluteUrl(path, site)`.
- `placeFilter.js`: real-country rule (`isCountryName` = the resolver), `canonicalName`, `usableCountryRecord`.
  `placeNames.json` is still in `src/` but no backend code reads it any more.
- `riskDimensions.js`: 4-axis risk vector -> headline score/level (worst axis leads).
- `situations-core.js`: GDACS observation + situation fold (`buildSituation`, `coolSituation`,
  `buildStorySituation`; a threaded story's situation is `news#<ISO3>#<threadId>` with absorbed old ids in `aliases[]`). Pure, no AWS.

Who uses what: `git grep "_shared/" -- backend`.

## Checks
- Tests: `cd backend/shared && node --test test/dayZero.test.js test/llm.test.js test/placeFilter.test.js test/countries.test.js test/links.test.js test/resolveIso3.test.js test/situations-core.test.mjs`.
- Copies that cross the frontend/Lambda boundary (name tables, the country resolver core, the link rules core) are compared
  by `node scripts/check-shared-sync.mjs`.
