# GDACS disaster ingest (newsGdacsIngest)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerGdacsIngest`, `rate(20 minutes)`, no input.
Repo source: `backend/situations/newsGdacsIngest/src/`.

## What it means
Fetches the GDACS feed (free, no key, no LLM) and writes S3 `corpus/gdacs/latest.json` and the tracker inbox `situations/inbox/gdacs-latest.json` (Orange/Red events). Keeps map alerts alive even when the AI pipeline is down.

## Check
- Schedule state: `aws events describe-rule --name TriggerGdacsIngest --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsGdacsIngest --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsGdacsIngest --since 2d --region ap-northeast-1 --filter-pattern '"[gdacs]"'`
- Known failures: `[gdacs] fetch failed:`, `snapshot failed:`, `disabled via SITUATIONS_INBOX_DISABLED` — `aws logs tail /aws/lambda/newsGdacsIngest --since 2d --region ap-northeast-1 --filter-pattern '"[gdacs] fetch failed:"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsGdacsIngest --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Overwrites stable keys; safe to re-run with payload `{}`. A fetch failure is usually GDACS-side; the next run (20 min) retries.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
