# newsSensitiveData

The site's read-only REST proxy (despite the name, all content is public). One handler, 36 `action`s from the POST body or `?action=` query: topics and per-topic SUMMARY/PREDICTION/TRACE_CAUSE/RESEARCH_BRIEFING, `today`, `archive_range`, `narrative_thread`, thread/country intelligence, `country_facts`, `country_history`, `corrections_feed`, `world_overview`, `web_index`, `systems_analysis`, `event_dossier`/`dossier_analysis`, daily/weekly briefs, `weekly_markets`, pair, economic and markets actions, prediction actions, previews, `geocode`, `rss` (GET). The full action table is in `project-docs/architecture/ARCHITECTURE.md` section 5.

## Deployment
- Deployed name `newsSensitiveData-dev` (the `-dev` name is prod) · runtime `nodejs22.x` · group `read-api` (scripts/functions.json)
- Trigger: API Gateway (`window.SENSITIVE_PROXY_ENDPOINT` is an `execute-api` URL; frontend via `shared/api/restProxy.js`); no schedule
- Deploy: `scripts/lambda.sh newsSensitiveData diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes (read-only: no DynamoDB or S3 writes)
- DynamoDB `TOPICS_DDB_TABLE`: `latest` (`TOPICS_CACHE_ITEM_ID`), `today-archive`, `archive#YYYY-MM-DD`
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: `TOPIC#`, `THREAD#`, `COUNTRY#` (SKs incl. `DRIFT#`, `DRIFTLOG#`), `FACTS#`, `SYSTEMS#`, `PAIR#`, `ECON#THREAD#`, `DAILY_BRIEF#`, `WEB#INDEX`; weekly brief/markets via paginated Scan for published rows
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): `PRED#`, `SEED#`, `SAMPLE#`, `Q#`; `GlobalPerspectiveMarkets` (hard-coded name); `USERS_DDB_TABLE` (`tier` only)
- S3 `WORLD_BUCKET`: `TRACK_RECORD_KEY` (default `predictions/track_record.json`, built by newsPredictionsSnapshot)
- External APIs: Mapbox geocoding (`MAPBOX_GEOCODING_KEY`); LLM for `dossier_analysis`; Google securetoken certs (`FIREBASE_PROJECT_ID`)

## Models
- `dossier_analysis` only: `GROK_MODEL` (fallback `deepseek-flash`), key `XAI_API_KEY`, URL `GROK_API_URL` (default `api.deepseek.com`); the GROK_*/XAI_* names hold the DeepSeek config.

## Gotchas
- CORS: code emits `Access-Control-Allow-Origin` (own allow-list; `rss` sends `*`) and answers OPTIONS itself.
- Tier is a depth cap, never an auth gate: no/invalid token or any error means `free`, still 200. Capped: `country_history` drift notes (1) and `corrections_feed`.
- `prediction_track_record` serves the S3 cache and falls back to a live Scan; that fallback must stay in sync with `newsPredictionsSnapshot/src/trackRecord.js`.
- `archive_range` returns light entries (6 MB payload limit). `placeFilter.js` + `placeNames.json`/`iso3Names.json` and `lib.js` week helpers are shared copies (`scripts/check-shared-sync.mjs`, `newsPredictionResolver/test/weeksParity.test.js`).

## Tests
- `cd backend/read-api/newsSensitiveData/src && npm test` (`node --test ../test/*.test.js`, offline): 41/41 passed 2026-10-19.

Last verified: 2026-10-19
