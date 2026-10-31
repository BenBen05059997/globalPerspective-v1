# newsFreshnessMonitor

Dead-man's switch for content freshness. It calls the public proxy `?action=topics` and SNS-alerts when the proxy errors or can't be reached, when the response has no or an unparseable `asOf`, or when the newest topics are older than `STALE_HOURS` (code default 9; live value 9). Before that, a separate settle check (`src/settleCheck.js`) reads `?action=prediction_track_record` (or, with `SETTLE_SOURCE=record`, the record's files below) and alerts when the weekly prediction-settling flow is behind (draw missed, commitment missing, tick stale, verdicts overdue, board stale).

Freshness alerts are persistent transitions: one alert when it turns unhealthy, one on recovery, nothing on repeated failures or a healthy start. A conditional reservation in the marker stops overlapping runs from sending twice. A delivery failure throws (so `Errors` counts it) and is retried after a 60 s lease without marking the transition delivered; a crash after SNS accepted the message but before the marker is saved can repeat that transition (standard SNS plus S3 is not atomic). Missing marker configuration fails loudly instead of falling back to repeated alerts. The settle check has its own once-a-day cadence and is not part of this dedupe.

## Deployment
- Deployed name `newsFreshnessMonitor` · runtime `nodejs24.x` · 30 s · 128 MB · group `monitoring` (scripts/functions.json). The zip ships node_modules.
- Trigger: EventBridge rule `TriggerFreshnessMonitor`, `cron(30 0/2 * * ? *)` (UTC, ENABLED), no input.
- Deploy: `scripts/lambda.sh newsFreshnessMonitor diff|package|deploy` (deploy needs operator authorization per CLAUDE.md).

## Reads / writes
- HTTP: `PROXY_URL` with `action=topics` (15 s timeout) and `action=prediction_track_record` (8 s timeout); with `SETTLE_SOURCE=record` the three `SITE_URL/data/record/views/` files instead of the second (8 s each); no direct table access.
- SNS: publishes to `SNS_TOPIC_ARN` on unhealthy and recovered transitions and for the settle alert.
- Private S3 dedupe marker `monitoring/freshness/state.json` in the world bucket (`FRESHNESS_STATE_BUCKET`). The role's inline policy `freshnessStateMarker` grants GetObject and PutObject on that key only. Without ListBucket a missing key reads as AccessDenied, so the marker is seeded with `{"health":"healthy","revision":0}` (the code's default for no state). Do not delete it and do not put a short expiration rule on it.
- Env: `SETTLE_SOURCE` (`action` default | `record`), `PROXY_URL`, `SNS_TOPIC_ARN`, `STALE_HOURS`, `FRESHNESS_STATE_BUCKET`, `SITE_URL` (origin override; the settle alert's track record link comes from `src/_shared/links.js`, a symlink to `backend/shared/src` that `scripts/lambda.sh` zips as real files).

## Settle check sources (decision 0052)
`SETTLE_SOURCE` = `action` (default: the proxy's `prediction_track_record`, the snapshot file) or `record`: `SITE_URL/data/record/views/track-record.json` (its `questions.settleHealth`, from the facts), `manifest.json` (`builtAt`) and `health/settle-tick.json` (the resolver's heartbeat), through `settleFromRecord`. In record mode the tick is stale after 3 days without a heartbeat and the board after 9 hours without a build (the views' own rhythm); with no heartbeat object yet, a missing or unreadable file, the check is `skipped` (logged), never an alert. No new IAM: the three files are public under `/data`.

## Gotchas
- The settle alert is sent only on the 12:30 UTC run (at most once a day). It runs first, in its own try/catch, and never blocks the freshness check.
- Test event flags: `dryRun` (never sends and never touches the marker, returns the message), `fixture` (made-up board), `forceSend`, `settleCheckOnly`, `now`.
- Not a Function URL; the code emits no CORS headers.

## Tests
`cd backend/monitoring/newsFreshnessMonitor/src && npm test` (`node --test ../test/*.test.js`; no AWS calls). Covers overlap, failed delivery and retry, recovery, dry run and the settle check.
