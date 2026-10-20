# newsSensitiveData

The site's public REST read proxy. Supports topics, per-topic SUMMARY/PREDICTION/TRACE_CAUSE, today/archive/story reads,
thread/country facts and history, corrections, web/systems analysis, briefs, forecasts/track record, previews, RSS and the
parked economy/markets actions. G3 removes event_dossier, dossier_analysis, pair_analysis, pair_analyses_list,
world_overview, research_briefing and geocode; unsupported actions return400 without data or network work.

## Deployment
- Deployed name `newsSensitiveData-dev` (the `-dev` name is prod) · runtime `nodejs22.x` · group `read-api` (scripts/functions.json)
- Trigger: API Gateway (`window.SENSITIVE_PROXY_ENDPOINT` is an `execute-api` URL; frontend via `shared/api/restProxy.js`); no schedule
- Deploy: `scripts/lambda.sh newsSensitiveData diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes (read-only: no DynamoDB or S3 writes)
- DynamoDB `TOPICS_DDB_TABLE`: `latest` (`TOPICS_CACHE_ITEM_ID`), `today-archive`, `archive#YYYY-MM-DD`
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: `TOPIC#`, `THREAD#`, `COUNTRY#` (SKs incl. `DRIFT#`, `DRIFTLOG#`), `FACTS#`, `SYSTEMS#`, `ECON#THREAD#`, `DAILY_BRIEF#`, `WEB#INDEX`; weekly brief/markets via paginated Scan for published rows
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): `PRED#`, `SEED#`, `SAMPLE#`, `Q#`; `GlobalPerspectiveMarkets` (hard-coded name); `USERS_DDB_TABLE` (`tier` only)
- S3 `WORLD_BUCKET`: `TRACK_RECORD_KEY` (default `predictions/track_record.json`, built by newsPredictionsSnapshot)
- External API: Google securetoken certs (`FIREBASE_PROJECT_ID`) for optional member-depth checks

## Models

None. The only on-demand LLM call belonged to the removed dossier analysis. No model key is needed by this Lambda.

## Gotchas
- CORS: code emits `Access-Control-Allow-Origin` (own allow-list; `rss` sends `*`) and answers OPTIONS itself.
- Tier is a depth cap, never an auth gate: no/invalid token or any error means `free`, still 200. Capped: `country_history` drift notes (1) and `corrections_feed`.
- `prediction_track_record` serves the S3 cache and falls back to a live Scan; that fallback must stay in sync with `newsPredictionsSnapshot/src/trackRecord.js`.
- Links (L2-IDS), derived here, never from a model: briefs, weekly signals, web index/records and light archive entries get `iso3[]` (`resolveIso3`, TODO L1-LINKS) when the stored row lacks it; drift notes carry `threadId`; prediction items carry `qid` and `clusterKey`; a question trigger's verdict comes from its `Q#` VERDICT row (yes = fired, no = not_fired). `weekly_brief` takes `week=YYYY-MM-DD` for a past published brief. Country/facts/history/systems lookups try the canonical short name first, then the requested spelling.
- `archive_range` returns light entries (6 MB payload limit). `resolveIso3` and links come from `backend/shared/src` through the `src/_shared` symlink. The `lib.js` week helpers are still a copy, kept equal by `backend/predictions/newsPredictionResolver/test/weeksParity.test.js`.

## Tests
- `cd backend/read-api/newsSensitiveData/src && npm test` (`node --test ../test/*.test.js`, offline): 43/43 passed 2026-10-19.

Last verified: 2026-10-19


## G3 caller evidence and configuration cleanup

Searched the seven exact action names across `global-perspectives-starter/frontend/src`,
`cloudflare/front-worker/production/worker.mjs` and `scripts/`. The first six have no caller matches. Geocode matches only
`restProxy.js`'s exported wrapper and `bootstrapProxy.js`'s manual `window.testProxyGeocode` console hook; no page control,
Worker request generator or script calls it. The bootstrap module is imported, but the hook does not run a geocode at
startup. Coordinator was asked to remove those stale frontend test hooks; this lane does not edit the frontend.
Repository import search found dossier.js used only by the removed routes; its pure helper and the obsolete overview
endpoint test are removed. Tests now assert all seven rejected actions perform no database/network work and that parked
economy routes and current summary/web reads remain available. External untracked API clients were not measured.

Environment names no longer read (names only, coordinator removal request; never edit secret values here):
`MAPBOX_GEOCODING_KEY`, `GROK_MODEL`, `GROK_API_URL`, `XAI_API_KEY`, `OPENROUTER_API_KEY`,
`SUMMARY_PREDICT_MAX_AGE_SECONDS` (the last was already ineffective because cached content freshness always returned true).
Verify deployed code before pruning; do not remove AWS runtime keys, database/cache keys or Firebase configuration.

`corrections_feed` still scans the summary table. G3 explicitly permits requesting a shared reader instead of a false
bounded query: world.driftNotes currently requires a single story/country partition. A global ledger needs a complete
manifest/materialized dated feed or approved index before Query can preserve full totals and member/free depth caps.
Coordinator REQUEST: a world/ global drift reader with from/to/cursor/limit, honest total/asOf and original source
provenance. Do not cap Scan pages or use only current WEB/latest story ids and silently omit older notes. Wire the
reader after it exists; no new raw parser is introduced here. This performance limitation remains explicit.
