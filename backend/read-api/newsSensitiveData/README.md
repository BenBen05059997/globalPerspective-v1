# newsSensitiveData

The site's public REST read proxy: one handler, many `action` values. It serves topics, per-topic SUMMARY / PREDICTION / TRACE_CAUSE, today / archive / story reads, thread and country facts and history, corrections, web and systems analysis, briefs, forecasts and the track record, previews, RSS, and the parked economy and markets actions. It is read-only. Any action not in the code answers 400 without database or network work.

Actions: `topics`, `summary` / `prediction` / `trace_cause`, `today`, `rss`, `daily_brief`, `latest_daily_brief`, `weekly_brief` (`week=YYYY-MM-DD` for a past published brief), `weekly_markets`, `narrative_thread`, `archive_range`, `thread_analysis`, `country_intelligence`, `country_facts`, `country_history`, `corrections_feed`, `prediction_snapshot`, `systems_analysis`, `web_index`, `prediction_track_record`, `economic_impact`, `economic_impact_list`, `economic_top_movers`, `country_preview`, `thread_preview`, `markets_global`, `markets_country`, `markets_history`. Which page calls which is in the group README.

## Deployment
- Deployed name `newsSensitiveData-dev` (the `-dev` name is prod) · runtime `nodejs22.x` · 85 s · 512 MB · group `read-api` (scripts/functions.json)
- Trigger: API Gateway REST API, path `/proxy` (`window.SENSITIVE_PROXY_ENDPOINT` is its `execute-api` URL; frontend via `shared/api/restProxy.js`); no schedule, no Function URL
- Deploy: `scripts/lambda.sh newsSensitiveData-dev diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes (read-only: no DynamoDB or S3 writes)
- DynamoDB `TOPICS_DDB_TABLE`: `latest` (`TOPICS_CACHE_ITEM_ID`), `today-archive`, `archive#YYYY-MM-DD`
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: `TOPIC#`, `THREAD#`, `COUNTRY#` (SKs incl. `DRIFT#`, `DRIFTLOG#`), `FACTS#`, `SYSTEMS#`, `ECON#THREAD#`, `DAILY_BRIEF#`, `WEB#INDEX`; weekly brief and markets via paginated Scan for published rows
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): `PRED#`, `SEED#`, `SAMPLE#`, `Q#`; `GlobalPerspectiveMarkets` (hard-coded name); `USERS_DDB_TABLE` (`tier` only)
- S3 `WORLD_BUCKET`: `TRACK_RECORD_KEY` (default `predictions/track_record.json`, built by newsPredictionsSnapshot)
- External: Google securetoken certs (`FIREBASE_PROJECT_ID`) for optional member-depth checks
- No model key is needed. The live env still carries many names the code no longer reads (for example `GROK_*`, `XAI_API_KEY`, `MAPBOX_GEOCODING_KEY`, Firebase service-account fields); pruning them is an operator change after checking the deployed code.

## Gotchas
- CORS: code emits `Access-Control-Allow-Origin` (own allow-list; `rss` sends `*`) and answers OPTIONS itself.
- Tier is a depth cap, never an auth gate: no or invalid token, or any error, means `free`, still 200. Capped: `country_history` drift notes (1) and `corrections_feed`.
- `prediction_track_record` serves the S3 cache and falls back to a live Scan; that fallback must stay in sync with `newsPredictionsSnapshot/src/trackRecord.js`.
- Links are derived here, never from a model: briefs, weekly signals, web index and records and light archive entries get `iso3[]` (`resolveIso3`) when the stored row lacks it; drift notes carry `threadId`; prediction items carry `qid` and `clusterKey`; a question trigger's verdict comes from its `Q#` VERDICT row (yes = fired, no = not_fired). Country, facts, history and systems lookups try the canonical short name first, then the requested spelling.
- `corrections_feed` still scans the summary table; a bounded query needs a global drift reader in `shared/src/world/` that does not exist yet.
- `archive_range` returns light entries (6 MB payload limit). `resolveIso3` and links come from `backend/shared/src` through the `src/_shared` symlink. The `lib.js` week helpers are a copy, kept equal by `backend/predictions/newsPredictionResolver/test/weeksParity.test.js`.

## Tests
`cd backend/read-api/newsSensitiveData/src && npm test` (`node --test ../test/*.test.js`, offline). Includes that removed actions do no database or network work.
