# newsCountryIntelligence

Daily country briefings. Reads 30 days of topic archive (`today-archive` filtered by the day-zero rule,
then `archive#<date>`), joins thread analyses, groups by country, and asks `src/refreshPolicy.js` which
countries to re-brief (new / weekly baseline 156 h / open alert in the public world file / coverage jump;
never twice a UTC day; top `COUNTRY_TOP_N` plus up to `COUNTRY_MAX_ALERT_EXTRAS` alert-only countries).
Each refresh grounds the LLM with editorial facts, `FACTS#` records, prior `DRIFT#` notes and Brave news,
then writes a 4-axis risk read (`src/riskDimensions.js`). `{ "dryRun": true }` returns the plan only.

## Deployment
- Deployed name `newsCountryIntelligence` · runtime `nodejs24.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge Scheduler `countryIntelliegence` (sic) `cron(15 5 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh newsCountryIntelligence diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB read: `TOPICS_DDB_TABLE` (`id` = `today-archive` / `archive#YYYY-MM-DD`); `SUMMARIZE_PREDICT_TABLE` `THREAD#<id>`/`THREAD_ANALYSIS`, `FACTS#<country>`/`COUNTRY_FACTS`, `COUNTRY#<c>` query `DRIFT#*`.
- DynamoDB write: `SUMMARIZE_PREDICT_TABLE` `COUNTRY#<c>`/`COUNTRY_INTELLIGENCE` and `COUNTRY#<c>`/`HISTORY#<date>` (`ttl` 90 days).
- External: `WORLD_LATEST_URL` (default `https://globalperspective.net/data/world/latest.json`), Brave `api.search.brave.com` (`BRAVE_SEARCH_API_KEY`; skipped when unset). Bundled: `src/country_facts.json` (editorial facts).

## Models
- `XAI_API_KEY` / `GROK_API_URL` / `GROK_MODEL` (fallback `deepseek-v4-pro`): legacy names; the live model is DeepSeek. Sends `thinking: { type: 'disabled' }`. Tunables `MAX_TOKENS` (5000), `TEMPERATURE`, `TOP_P`, `LLM_CONCURRENCY` (4).

## Gotchas
- A failed world-file fetch means no alert refreshes; the weekly baseline still runs. Region / aggregate keys are not briefed (`isCountryName`); aliases (USA/US) canonicalize for alerts only, record keys stay verbatim.
- `src/dayZero.js` is a byte-identical copy shared with other Lambdas (`scripts/check-shared-sync.mjs`).

## Tests
- `cd amplify/backend/function/newsCountryIntelligence/src && npm test` (`node --test ../test/*.test.js`): 15 pass.

Last verified: 2026-10-19
