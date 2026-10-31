# newsCountryIntelligence

Daily country briefings. Reads 30 days of topic archive (`today-archive` filtered by the day-zero rule,
then `archive#<date>`), joins thread analyses, groups by country, and asks `src/refreshPolicy.js` which
countries to re-brief (new / weekly baseline 156 h / open alert in the public world file / coverage jump;
never twice a UTC day; top `COUNTRY_TOP_N` plus up to `COUNTRY_MAX_ALERT_EXTRAS` alert-only countries).
Each refresh grounds the LLM with editorial facts, `FACTS#` records, prior `DRIFT#` notes,
then writes a 4-axis risk read (`src/_shared/riskDimensions.js`). `{ "dryRun": true }` returns the plan only.

## Deployment
- Deployed name `newsCountryIntelligence` · runtime `nodejs24.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge Scheduler `countryIntelliegence` (sic) `cron(15 5 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh newsCountryIntelligence diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB read: `TOPICS_DDB_TABLE` (`id` = `today-archive` / `archive#YYYY-MM-DD`); `SUMMARIZE_PREDICT_TABLE` `THREAD#<id>`/`THREAD_ANALYSIS`, `FACTS#<country>`/`COUNTRY_FACTS`, `COUNTRY#<c>` query `DRIFT#*`.
- DynamoDB write: `SUMMARIZE_PREDICT_TABLE` `COUNTRY#<c>`/`COUNTRY_INTELLIGENCE` and `COUNTRY#<c>`/`HISTORY#<date>` (`ttl` 90 days).
- S3 `WORLD_BUCKET`, country notes (decision 0042): each `COUNTRY_INTELLIGENCE` item written is also written as a `country` note to `<NOTES_PREFIX>notes/country/DAY.jsonl` through shared `notes.js` (`src/recordNotes.js`; subject = the country's ISO3 from the shared `resolveIso3`, a name with no ISO3 is skipped and logged; payload = the stored item minus keys, `ttl`, `generatedAt` and `model`). The `HISTORY#<date>` row is a subset of the same item, so it is not a second note. Best-effort: a failure logs `[notes]` and never fails the run. `NOTES_PREFIX` defaults to `record/shadow/`; set `record/` to go live. Needs role access: Get/Put on `record/notes/country/*` and `record/shadow/notes/country/*`, plus `s3:ListBucket` on the world bucket so a new day file reads as missing.
- External: `WORLD_LATEST_URL` (default `https://globalperspective.net/data/world/latest.json`). Bundled: `src/country_facts.json` (editorial facts).

## Models
- `XAI_API_KEY` / `GROK_API_URL` (fallback `https://api.deepseek.com`) / `GROK_MODEL` (fallback `deepseek-v4-pro`) through the shared client `src/_shared/llm.js`: legacy names; the live model is DeepSeek. Thinking is disabled. Tunables `MAX_TOKENS` (5000), `TEMPERATURE`, `TOP_P`, `LLM_CONCURRENCY` (4).

## Gotchas
- A failed world-file fetch means no alert refreshes; the weekly baseline still runs. Region / aggregate keys are not briefed (`isCountryName`); aliases (USA/US) canonicalize for alerts only, record keys stay verbatim.
- `dayZero`, `riskDimensions`, `llm` and the name tables come from `backend/shared/src` through the `src/_shared` symlink (zipped as real files by `scripts/lambda.sh`). `src/refreshPolicy.js` `isCountryName` must match shared `placeFilter.js`; `scripts/check-shared-sync.mjs` checks it.

## Tests
- `cd backend/pipeline/newsCountryIntelligence/src && npm test` (`node --test ../test/*.test.js`).
