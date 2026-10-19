# Social posts (newsPostLinkedin)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge Scheduler `InvokeLinkedIn`, `cron(20 */3 * * ? *)` Asia/Tokyo, no input.
Repo source: `backend/distribution/newsPostLinkedIn/src/`.

## What it means
Posts up to 5 new `latest` topics per run to LinkedIn and/or Bluesky (whichever credentials are set), deduped by a `POSTED#<PLATFORM>#<fingerprint>` row in `SOCIAL_POSTS_TABLE`. Public posts.

## Check
- Schedule state: `aws scheduler get-schedule --name InvokeLinkedIn --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsPostLinkedin --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsPostLinkedin --since 2d --region ap-northeast-1 --filter-pattern '"Complete:"'`
- Known failures: `Auth failed, stopping further posts`, `Rate limited, stopping further posts`, `newsPostLinkedIn error:` — `aws logs tail /aws/lambda/newsPostLinkedin --since 2d --region ap-northeast-1 --filter-pattern '"Auth failed, stopping further posts"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsPostLinkedin --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
`Auth failed` on LinkedIn means the 60-day access token expired: the operator regenerates it (secret: fresh yes) and env is updated fetch → merge → write. Fingerprint rows prevent double posts, but a failed marker write is only logged, so check the feed before re-running.

## Escalate
- Alarm/alert: `lambda-errors-newsPostLinkedin` (→ SNS `GlobalPerspectivesAlerts`).
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
