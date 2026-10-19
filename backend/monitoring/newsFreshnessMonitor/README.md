# newsFreshnessMonitor

Dead-man's switch for content freshness. It calls the public proxy `?action=topics` and SNS-alerts when the proxy errors or can't be reached, when the response has no or an unparseable `asOf`, or when the newest topics are older than `STALE_HOURS` (default 5). Before that, a separate settle check (`src/settleCheck.js`) reads `?action=prediction_track_record` and alerts when the weekly prediction-settling flow is behind (draw missed, commitment missing, tick stale, verdicts overdue, board stale).

## Deployment
- Deployed name `newsFreshnessMonitor` · runtime `nodejs24.x` · group `monitoring` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerFreshnessMonitor` `cron(30 0/2 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh newsFreshnessMonitor diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules.

## Reads / writes
- HTTP: `PROXY_URL` with `action=topics` and `action=prediction_track_record` (no direct table access).
- SNS: publishes to `SNS_TOPIC_ARN`.
- Env: `PROXY_URL`, `SNS_TOPIC_ARN`, `STALE_HOURS`, `SITE_URL` (origin override; the settle alert's track record link comes from `src/_shared/links.js`, a symlink to `backend/shared/src` that `scripts/lambda.sh` zips as real files).

## Gotchas
- The settle alert is sent only on the 12:30 UTC run (at most once a day). It runs first, in its own try/catch, and never blocks the freshness check.
- Test event flags: `dryRun` (never sends, returns the message), `fixture` (made-up board), `forceSend`, `settleCheckOnly`, `now`.
- The settle fetch has an 8 s timeout and the topics fetch 15 s, because the function's own timeout is 30 s.
- Not a Function URL; the code emits no CORS headers.

## Tests
- `cd backend/monitoring/newsFreshnessMonitor/src && npm test` (node --test ../test/*.test.js). Passed 5/5 on 2026-10-19 (after the links switch).

Last verified: 2026-10-19
