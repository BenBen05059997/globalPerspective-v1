# newsErrorDigest

**Switched off 2026-11-06 (about 00:15 JST, operator): the rule `TriggerErrorDigest` is DISABLED, so this Lambda does not run and sends nothing.** The `/ops` Quality panel (newsHealth phase 3, `clientErrors` check: client errors per page against the 14-day median) covers the same ground ([ARCHITECTURE_OPS.md](../../../project-docs/architecture/ARCHITECTURE_OPS.md)). The code, the function and its `DIGEST#STATE` baseline row stay, and the rule can be enabled again.

Alerting layer over the client-error sink (newsClientErrors). When enabled, each run scans the client-errors table, folds rows into per-fingerprint totals, diffs them against the previous run's totals, and SNS-alerts only on NEW fingerprints or SPIKING ones (grew by >= `SPIKE_MIN_DELTA`, default 5). A quiet run sends nothing; there is no "all clear" message.

## Deployment
- Deployed name `newsErrorDigest` · runtime `nodejs24.x` · group `monitoring` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerErrorDigest` `cron(15 0/6 * * ? *)` (UTC, **DISABLED** since 2026-11-06 about 00:15 JST)
- Deploy: `scripts/lambda.sh newsErrorDigest diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules.

## Reads / writes
- DynamoDB: table from `CLIENT_ERRORS_TABLE` (GlobalPerspectiveClientErrors). Scans all rows (`errKey` = `<day>#<hash>`); reads/writes its own baseline row `errKey = DIGEST#STATE` (`counts` map, 90-day `ttl`).
- SNS: publishes to `SNS_TOPIC_ARN`.
- Env: `CLIENT_ERRORS_TABLE`, `SNS_TOPIC_ARN`, `SPIKE_MIN_DELTA`.

## Gotchas
- The first run (no `DIGEST#STATE` row) only writes the baseline and never alerts. The baseline row expires after 90 days, so after a long pause (the rule is off since 2026-11-06) the first run after enabling it again may only store a new baseline, or compare against old totals.
- Missing `CLIENT_ERRORS_TABLE` or `SNS_TOPIC_ARN` returns `misconfigured` without alerting.
- Full table scan every run. The alert points to `node scripts/errors.mjs --days 3` for source-map-resolved detail.
- Not a Function URL; the code emits no CORS headers.

## Tests
- `cd backend/monitoring/newsErrorDigest/src && npm test` (or `node --test "backend/monitoring/newsErrorDigest/test/*.test.js"` from the repo root). Offline: the AWS SDK is stubbed and DynamoDB and SNS are fakes. Covers the paged scan, fingerprint folding, the baseline / quiet / spike-threshold paths, the SNS subject and body (no stacks or user fields), the misconfigured guard, and DynamoDB/SNS failures.
