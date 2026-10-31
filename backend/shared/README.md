# backend/shared

One copy of the helpers several news Lambdas use. Not a Lambda and not a layer: each Lambda reaches
these files through its committed `src/_shared -> ../../../shared/src` symlink, and
`scripts/lambda.sh package|diff` stages `src` with links followed, so the zip carries real files
under `_shared/`. An edit here changes every Lambda that requires the file on its next deploy.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → **4 One reader** → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 4: world/, the only reader of the raw tables, plus the shared rules, the actor table and the S3 helpers. Timeline: writes no facts or readings; every other stage reads raw tables only through world/. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
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
- `manifest.js`: `makeManifest(s3json).addDays(key, dates)`, the conditional day-manifest rewrite (412 re-read and union) for
  `record/facts/manifest.json` and each `record/notes/<subtype>/manifest.json`.
- `notes.js`: the one builder and writer of notes (decision 0042, schema `backend/record/schema/note.schema.json`):
  `buildNote` (throws on anything the schema rejects) and one builder per subtype (`entryNote`, `archiveEntryNotes`,
  `storyAnalysisNote`, `driftNote`, `storyDriftNote`, `countryNote`, `countryHistoryNote`, `linkNote`, `webNote`,
  `dailyBriefNote`, `weeklyBriefNote`), and `makeNoteWriter({s3json, prefix}).write(subtype, notes)` (manifest first, then
  `appendLines` deduped by `noteId`). Every note writer, Lambda or CLI, uses it.
- `briefNotes.js`: `writeBriefNote({subtype, item, lambda, runId})`, the brief writers' one helper (decision 0048). Gated by env
  `NOTES_PREFIX`: unset writes nothing; best-effort, a failure logs `[notes]` and never fails the run. Used by `newsPostDevTo`
  and `newsWeeklyBrief`.
- `briefs.js`: `briefWithIso3`, `weeklyWithIso3`, `briefCountries`: the countries every reader gets on the daily and weekly
  brief (filled from names when the stored row has no `iso3`). Used by the read API's brief actions, `notes.js` and the
  record's brief views, so they answer the same.
- `questionState.js`: where a forecast question stands in the weekly sample and in its outcome (decision 0043); pure, used by
  the record's views. `questionScoring.js`: Brier score, skill against the base rate and the cluster-bootstrap interval of the
  sampled questions; pure, used by `newsStoryRecord`'s track-record view.
- `record.js`: the record's and board's pure rules (`canonicalUrl`, `entryIdentity`, `sourceIdOf`, `actorIdOf`, `factId`, `noteId`,
  `pairKey`, `normalizeActor`, `stringTexture`, `PIN_BUDGET`, `pinBudgetOk`, `normalizeBoard`, `cheapGrounds`: shared
  actors/places/outlets and score co-movement, never 'strong'). Used by `newsBoard`, `newsStoryRecord` and the selector's raw
  capture. Frontend mirror of the board block: `shared/lib/board.js`.
- `placement.js`: where a fact sits in the record: `currentAssignments`, `placeEntries`, `resolveAliases` (latest assignment
  wins, merged stories fold into the survivor). One implementation for `newsStoryRecord` views, `newsPredictionResolver`
  gather and `newsRecordReview` select. Pure.
- `outlets.js`: the one outlet table (`OUTLET_METADATA`, `getOutletMeta`, `normalizeOutlet`) and `registrableDomain` /
  `TWO_LEVEL_SUFFIXES`. Unknown domains keep `outlet: null`.
- `rss.js`: RSS / Atom / RDF item parser (`parseRssXml`, `itemLink`, `tagText`, `stripMarkup`, `decodeEntities`), shared by
  `newsInvokeGemini` and `record/cli/recover-day.mjs` so a Wayback snapshot is read as the live feed is.
- `s3json.js`: `makeS3Json({client, GetObjectCommand, PutObjectCommand, bucket})` -> `getJson`, `getJsonEtag`, `putJsonIf`,
  `putOnce` (`If-None-Match: *`), `putLatest`, `getLines`, `appendLines` (JSONL append with eventId dedupe and an If-Match
  retry); client injected so it tests without the SDK. Used by the record writers, the resolver, the selector and `newsBoard`.
- `world/`: the one reader of the world's raw tables (`archive#` days, `THREAD_ANALYSIS`, `THREAD_HISTORY#`,
  `COUNTRY# HISTORY#`, `DRIFT#`/`DRIFTLOG#`, `PRED#` scenarios, `Q#` verdicts, `WEB#INDEX`, `web/latest.json`, the `latest`
  topic pool) plus the shared derivations (story birth, branches, coverage and missing days (which days have archive data; not the Run object's coverage), `tierFromScore`, outlets).
  **Rule: nobody else parses these rows**; consumers (`newsStoryRecord`, `newsBoard`, the weekly pull when it exists)
  require `./_shared/world` and pass an injected client (`makeDynamoClient` / `makeS3Client`, no SDK import, no aws CLI).
  Front door: `src/world/README.md` (row table, exact derivation rules, decisions).
- `placeFilter.js`: real-country rule (`isCountryName` = the resolver), `canonicalName`, `usableCountryRecord`.
  `placeNames.json` is still in `src/` but no backend code reads it any more.
- `riskDimensions.js`: 4-axis risk vector -> headline score/level (worst axis leads).
- `situations-core.js`: GDACS observation + situation fold (`buildSituation`, `coolSituation`,
  `buildStorySituation`; a threaded story's situation is `news#<ISO3>#<threadId>` with absorbed old ids in `aliases[]`). Pure, no AWS.

Who uses what: `git grep "_shared/" -- backend`.

## Checks
- Tests: `cd backend/shared && node --test test/*.test.*` (world fixtures are in `test/world.fake.js`).
- Copies that cross the frontend/Lambda boundary (name tables, the country resolver core, the link rules core, the board rules core) are compared
  by `node scripts/check-shared-sync.mjs`.
