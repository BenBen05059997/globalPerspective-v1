# newsErrorDigest

Alerting layer over the client-error sink (newsClientErrors). Each run scans the client-errors table, folds rows into per-fingerprint totals, diffs them against the previous run's totals, and SNS-alerts only on NEW fingerprints or SPIKING ones (grew by >= `SPIKE_MIN_DELTA`, default 5). A quiet run sends nothing; there is no "all clear" message.

## Deployment
- Deployed name `newsErrorDigest` · runtime `nodejs24.x` · group `monitoring` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerErrorDigest` `cron(15 0/6 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh newsErrorDigest diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules.

## Reads / writes
- DynamoDB: table from `CLIENT_ERRORS_TABLE` (GlobalPerspectiveClientErrors). Scans all rows (`errKey` = `<day>#<hash>`); reads/writes its own baseline row `errKey = DIGEST#STATE` (`counts` map, 90-day `ttl`).
- SNS: publishes to `SNS_TOPIC_ARN`.
- Env: `CLIENT_ERRORS_TABLE`, `SNS_TOPIC_ARN`, `SPIKE_MIN_DELTA`.

## Gotchas
- The first run (no `DIGEST#STATE` row) only writes the baseline and never alerts.
- Missing `CLIENT_ERRORS_TABLE` or `SNS_TOPIC_ARN` returns `misconfigured` without alerting.
- Full table scan every run. The alert points to `node scripts/errors.mjs --days 3` for source-map-resolved detail.
- Not a Function URL; the code emits no CORS headers.

## Tests
- None.

Last verified: 2026-10-19
