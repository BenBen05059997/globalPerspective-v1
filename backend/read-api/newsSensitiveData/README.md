# newsSensitiveData

The site's public REST read proxy: one handler, many `action` values. It serves topics, per-topic SUMMARY / PREDICTION / TRACE_CAUSE, today / archive / story reads, thread and country facts and history, corrections, web and systems analysis, briefs, previews, RSS. It is read-only. The economy and markets actions are removed (decision 0049), and so are `prediction_snapshot` and `prediction_track_record` (2026-11-01, decision 0052: forecasts and the track record are read from the record views); all of them answer 400 "Unsupported action". Any action not in the code answers 400 without database or network work.

Actions: `topics`, `summary` / `prediction` / `trace_cause`, `today`, `rss`, `daily_brief`, `latest_daily_brief`, `weekly_brief` (`week=YYYY-MM-DD` for a past published brief), `narrative_thread`, `archive_range`, `thread_analysis`, `country_intelligence`, `country_facts`, `country_history`, `corrections_feed`, `systems_analysis`, `web_index`, `country_preview`, `thread_preview`, `ops` (the operator's money file, gated: see Gotchas). Which page calls which is in the group README.

## Deployment
- Deployed name `newsReadApi` since 2026-11-04 (was `newsSensitiveData-dev`, kept for rollback until its removal; env cut to the 8 keys the code reads) · runtime `nodejs22.x` · 85 s · 512 MB · group `read-api` (scripts/functions.json)
- Trigger: API Gateway REST API, path `/proxy` (`window.SENSITIVE_PROXY_ENDPOINT` is its `execute-api` URL; frontend via `shared/api/restProxy.js`); no schedule, no Function URL
- Deploy: `scripts/lambda.sh newsReadApi diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes (read-only: no DynamoDB or S3 writes)
- DynamoDB `TOPICS_DDB_TABLE`: `latest` (`TOPICS_CACHE_ITEM_ID`), `today-archive`, `archive#YYYY-MM-DD`
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: `TOPIC#`, `THREAD#`, `COUNTRY#` (SKs incl. `DRIFT#`, `DRIFTLOG#`), `FACTS#`, `SYSTEMS#`, `DAILY_BRIEF#`, `WEB#INDEX`; weekly brief via paginated Scan for published rows
- DynamoDB `USERS_DDB_TABLE` (`tier` only). The PredictionLog is no longer read here.
- S3 `WORLD_BUCKET`: `ops` reads `monitoring/ops.json` (the role needs `s3:GetObject` on that key: `backend/monitoring/newsHealth/iam/read-api-ops-read.json`); with `NOTES_READS=notes|compare` `record/notes/{country,drift,story_analysis,story_history,country_facts}/` (decision 0053)
- Env `OPS_OPERATOR_UIDS`: comma-separated Firebase uids allowed to call `ops`; unset or empty means nobody. Added at the newsHealth deploy (the live function had 8 env keys before it).
- External: Google securetoken certs (`FIREBASE_PROJECT_ID`) for optional member-depth checks
- No model key is needed. The live env still carries many names the code no longer reads (for example `GROK_*`, `XAI_API_KEY`, `MAPBOX_GEOCODING_KEY`, Firebase service-account fields); pruning them is an operator change after checking the deployed code.
- `rss`: env `RECORD_READS` = `ddb` (default, unset = this) | `record` | `compare` (decision 0054). `record` builds the feed from `index/today.json` (the entries of the last 24 h, then the latest run when there are none) while the views are under 9 h old; the XML is byte-identical to the DynamoDB feed (live check 2026-10-31: 26 items, 31,923 bytes, equal to the served `/rss`). Needs `s3:GetObject` on `record/views/*` on the shared role `newsprojectLambdaRolefcb19312-dev`. The other actions are unchanged.

## Gotchas
- `ops` is the one action that is an auth gate (`src/ops.js`): a valid Firebase token whose uid is in `OPS_OPERATOR_UIDS`, else 403 `The ops page is not available for this account.` with no S3 read. 200 with `data: null` when newsHealth has not written the file yet; a read failure is 502. Reply is `Cache-Control: no-store`.
- CORS: code emits `Access-Control-Allow-Origin` (own allow-list; `rss` sends `*`) and answers OPTIONS itself.
- Tier is a depth cap, never an auth gate: no or invalid token, or any error, means `free`, still 200. Capped: `country_history` drift notes (1) and `corrections_feed`.
- Links are derived here, never from a model: briefs, weekly signals, web index and records and light archive entries get `iso3[]` (`resolveIso3`) when the stored row lacks it; drift notes carry `threadId`; Country, facts, history and systems lookups try the canonical short name first, then the requested spelling.
- Country and story rows (decision 0053): `thread_analysis`, `country_intelligence`, `country_facts`, `country_history`, `corrections_feed`, `country_preview`, `thread_preview` go through `src/records.js`, which reads DynamoDB (`NOTES_READS` unset or `ddb`), the record's notes (`notes`, via shared `noteReads.js`; cache `NOTES_CACHE_SECONDS` 300, prefix `NOTES_READ_PREFIX`) or DynamoDB with `[notes-compare]` log lines (`compare`). It returns full ungated rows; `capForTier` and the 5-note ledger teaser are applied in `index.js` afterwards, so gated depth is never in a view and the response bodies do not change. The role needs `s3:GetObject` on the five prefixes and `s3:ListBucket`. `corrections_feed` still scans the summary table in `ddb` mode (the DRIFT# rows never expire: TTL is off on the table).
- `archive_range` returns light entries (6 MB payload limit). `resolveIso3` and links come from `backend/shared/src` through the `src/_shared` symlink.

## Tests
`cd backend/read-api/newsSensitiveData/src && npm test` (`node --test ../test/*.test.js`, offline). Includes that removed actions do no database or network work.
