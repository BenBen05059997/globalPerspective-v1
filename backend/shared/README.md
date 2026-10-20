# backend/shared

One copy of the helpers several news Lambdas use. Not a Lambda and not a layer: each Lambda reaches
these files through its committed `src/_shared -> ../../../shared/src` symlink, and
`scripts/lambda.sh package|diff` stages `src` with links followed, so the zip carries real files
under `_shared/`. An edit here changes every Lambda that requires the file on its next deploy.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Analysis → **4 One reader** → 5 Timeline → 6 Views → 7 Delivery → 8 Watch
This folder is stage 4: world/, the only reader of the raw tables, plus the shared rules and the S3 helpers. Timeline: writes no events; every other stage reads raw tables only through world/. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

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
- `record.js`: the board's pure rules (`pairKey`, `normalizeActor`, `stringTexture`, `PIN_BUDGET`, `pinBudgetOk`,
  `normalizeBoard`, `cheapGrounds`: shared actors/places/outlets and score co-movement, never 'strong'). Used by
  `newsBoard` now, by the record writer later. Frontend mirror of the core block: `shared/lib/board.js`.
- `s3json.js`: `makeS3Json({client, GetObjectCommand, PutObjectCommand, bucket})` -> `getJson`, `putOnce`
  (`If-None-Match: *`), `putLatest`; client injected so it tests without the SDK. Unused until the record writes.
- `world/`: the one reader of the world's raw tables (`archive#` days, `THREAD_ANALYSIS`, `THREAD_HISTORY#`,
  `COUNTRY# HISTORY#`, `DRIFT#`/`DRIFTLOG#`, `PRED#` scenarios, `Q#` verdicts, `WEB#INDEX`, `web/latest.json`, the `latest`
  topic pool) plus the shared derivations (story birth, branches, coverage and missing days, `tierFromScore`, outlets).
  **Rule: nobody else parses these rows**; consumers (`newsStoryRecord`, the weekly pull, `newsBoard`, later `newsConnect`)
  require `./_shared/world` and pass an injected client (`makeDynamoClient` / `makeS3Client`, no SDK import, no aws CLI).
  Front door: `src/world/README.md` (row table, exact derivation rules, decisions).
- `placeFilter.js`: real-country rule (`isCountryName` = the resolver), `canonicalName`, `usableCountryRecord`.
  `placeNames.json` is still in `src/` but no backend code reads it any more.
- `riskDimensions.js`: 4-axis risk vector -> headline score/level (worst axis leads).
- `situations-core.js`: GDACS observation + situation fold (`buildSituation`, `coolSituation`,
  `buildStorySituation`; a threaded story's situation is `news#<ISO3>#<threadId>` with absorbed old ids in `aliases[]`). Pure, no AWS.

Who uses what: `git grep "_shared/" -- backend`.

## Checks
- Tests: `cd backend/shared && node --test test/dayZero.test.js test/llm.test.js test/placeFilter.test.js test/countries.test.js test/links.test.js test/resolveIso3.test.js test/situations-core.test.mjs test/record.test.js test/s3json.test.js test/world.*.test.js`.
- Copies that cross the frontend/Lambda boundary (name tables, the country resolver core, the link rules core, the board rules core) are compared
  by `node scripts/check-shared-sync.mjs`.
