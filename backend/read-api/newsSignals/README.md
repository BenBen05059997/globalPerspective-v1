# newsSignals

PARKED (decision 0032): the key-gated Signal API; no key issued, no page reads it. Code, Function URL and key table stay; `TriggerSignalsBuild` is to be disabled (still ENABLED when checked 2026-10-19). BUILD (`{ action: 'build' }`) maps economic-impact records, the prediction log, country intelligence and confirmed breaking alerts into the v1 signal envelope (`src/signalAdapter.js`) and writes one S3 document. SERVE (HTTP GET) answers `/v1/signals`, `/v1/signals/{signal_id}` and `/v1/track-record` for a valid API key, with a per-minute rate limit; free keys see signals delayed by `FREE_DELAY_HOURS` (default 24).

## Deployment
- Deployed name `newsSignals` · runtime `nodejs22.x` · group `read-api` (scripts/functions.json)
- Trigger: `TriggerSignalsBuild` `cron(0 10 * * ? *)` UTC, ENABLED until the 0032 disable is run, EventBridge rule, input `{"action":"build"}`; SERVE via Function URL
- Deploy: `scripts/lambda.sh newsSignals diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- S3: `WORLD_BUCKET`, writes `signals/latest.json` + `signals/snapshots/<YYYY-MM-DD>.json` (prefix `SIGNALS_PREFIX`); SERVE reads latest.json, cached by ETag. Not exposed via the Worker `/data/*` route.
- DynamoDB: `SUMMARIZE_PREDICT_TABLE` scans `ECON#THREAD#`/`ECONOMIC_IMPACT` (hasImpact) and `COUNTRY#`/`COUNTRY_INTELLIGENCE`; `PREDICTION_LOG_TABLE` full scan; `BREAKING_ALERTS_TABLE` status confirmed|sent; `API_KEYS_TABLE` (GlobalPerspectiveApiKeys) GetItem on `keyHash` plus `RL#<hash>#<minute>` rate-limit counters (TTL 120s)
- Other env names: `SITE_URL`, `SIGNAL_TTL_DAYS` (default 120, event_time retention)

## Minting a key
- `node backend/read-api/newsSignals/mint-key.mjs "<label>" paid|free [ratePerMin]` prints a `gpsk_` key once plus an `aws dynamodb put-item --table-name GlobalPerspectiveApiKeys` command that stores only its sha256 hash. Running that put-item activates the key. The raw key cannot be recovered.
- Clients send `Authorization: Bearer <key>` or `x-api-key`.

## Gotchas
- Code emits no `Access-Control-Allow-Origin`; any browser CORS would come from the Function-URL config.
- Rate limiter fails open if the DynamoDB update errors.
- Country records that are regions or older than 30 days are skipped (`usableCountryRecord`, `src/_shared/placeFilter.js`).
- The forecast track record URL comes from `links.js` (`forecastHref`); env `SITE_URL` only overrides the origin.
- `placeFilter` and its name tables come from `backend/shared/src` through the `src/_shared` symlink; `scripts/lambda.sh` zips them as real files. Shared-module tests live in `backend/shared/test`.

## Tests
- `cd backend/read-api/newsSignals/src && npm test` runs `node test-adapter.mjs` - 59 passed 2026-10-19 (the `node --test ../test/*.test.js` half finds no files since the placeFilter tests moved to `backend/shared/test`)

Last verified: 2026-10-19
