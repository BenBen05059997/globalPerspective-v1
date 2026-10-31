# newsFreshnessMonitor

Dead-man's switch for content freshness. It calls the public proxy `?action=topics` and SNS-alerts when the proxy errors or can't be reached, when the response has no or an unparseable `asOf`, or when the newest topics are older than `STALE_HOURS` (default 9; audited live value 9). Before that, a separate settle check (`src/settleCheck.js`) reads `?action=prediction_track_record` and alerts when the weekly prediction-settling flow is behind (draw missed, commitment missing, tick stale, verdicts overdue, board stale).

## Deployment
- Deployed name `newsFreshnessMonitor` · runtime `nodejs24.x` · group `monitoring` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerFreshnessMonitor` `cron(30 0/2 * * ? *)` (UTC; paused 2026-10-20 during the DeepSeek outage, re-enabled 2026-10-31 with dedupe state)
- Deploy: `scripts/lambda.sh newsFreshnessMonitor diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules.

## Reads / writes
- HTTP: `PROXY_URL` with `action=topics` and `action=prediction_track_record` (no direct table access).
- SNS: publishes to `SNS_TOPIC_ARN` on unhealthy/recovered transitions.
- Private S3 dedupe marker: `monitoring/freshness/state.json` in the world bucket (`FRESHNESS_STATE_BUCKET`); role inline policy `freshnessStateMarker` grants GetObject/PutObject on that key only (2026-10-31). Without ListBucket a missing key reads as AccessDenied, so the marker was seeded with `{"health":"healthy","revision":0}` (the code's default for no state); do not delete it.
- Env: `PROXY_URL`, `SNS_TOPIC_ARN`, `STALE_HOURS`, `FRESHNESS_STATE_BUCKET`, `SITE_URL` (origin override; the settle alert's track record link comes from `src/_shared/links.js`, a symlink to `backend/shared/src` that `scripts/lambda.sh` zips as real files).

## Gotchas
- The settle alert is sent only on the 12:30 UTC run (at most once a day). It runs first, in its own try/catch, and never blocks the freshness check.
- Test event flags: `dryRun` (never sends, returns the message), `fixture` (made-up board), `forceSend`, `settleCheckOnly`, `now`.
- The settle fetch has an 8 s timeout and the topics fetch 15 s, because the function's own timeout is 30 s.
- Not a Function URL; the code emits no CORS headers.

## Tests
- `cd backend/monitoring/newsFreshnessMonitor/src && npm test` (node --test ../test/*.test.js). Passed 5/5 on 2026-10-19 (after the links switch).

Last verified: 2026-10-19


Freshness alerts are persistent transitions: one unhealthy incident alert, one recovery, quiet on repeated failures or
healthy startup. Conditional reservations prevent overlapping runs from sending twice. Delivery failure throws and is
retried without marking delivered; a crash after SNS acceptance can repeat a transition (standard SNS/S3 is not atomic).
The existing settle check is separate. Missing state configuration fails rather than falling back to repeated alerts.
`dryRun` never reads/writes the marker or sends SNS. See [alarm proposal](../alarms/README.md) for exact coordinator
configuration requests, topic migration and the live 9h threshold. Unit tests include overlap, failed delivery/retry,
recovery and dry-run behavior; no AWS calls occur in tests.


The operator paused `TriggerFreshnessMonitor` on 2026-10-20 to stop repeated stale emails during the outage. Re-enabled
2026-10-31 after the marker bucket env, the one-key IAM grant and the seeded marker were in place; the first real run
answered healthy with `suppressed: unchanged` (no email). Do not delete the marker on re-enable.
