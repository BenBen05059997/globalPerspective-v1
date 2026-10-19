# Client error digest (newsErrorDigest)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerErrorDigest`, `cron(15 0/6 * * ? *)` UTC, no input.
Repo source: `amplify/backend/function/newsErrorDigest/src/`.

## What it means
Folds browser error reports in `CLIENT_ERRORS_TABLE` per fingerprint and sends `[GP] Client errors: <n> new, <m> spiking` to SNS `GlobalPerspectiveAlerts` for new fingerprints or ones that grew by ≥ `SPIKE_MIN_DELTA`; saves the baseline `DIGEST#STATE` each run.

## Check
- Schedule state: `aws events describe-rule --name TriggerErrorDigest --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsErrorDigest --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsErrorDigest --since 2d --region ap-northeast-1 --filter-pattern '"newsErrorDigest"'`
- Known failures: `misconfigured` — `aws logs tail /aws/lambda/newsErrorDigest --since 2d --region ap-northeast-1 --filter-pattern '"misconfigured"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsErrorDigest --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Read full, source-map-resolved detail with `node scripts/errors.mjs --days 3` (named in the alert body) and fix the page. A quick re-run sees no change (baseline already saved).

## Escalate
- Alarm/alert: It is the alert.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
