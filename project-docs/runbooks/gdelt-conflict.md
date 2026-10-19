# GDELT conflict shadow ingest (newsGdeltConflict)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerGdeltConflict`, `cron(0 */6 * * ? *)` UTC, no input.
Repo source: `amplify/backend/function/newsGdeltConflict/src/`.

## What it means
Aggregates the latest GDELT 2.0 material-conflict export by country and writes S3 `corpus/gdelt/<date>.json` (last run of the day wins). No LLM, no key.

## Check
- Schedule state: `aws events describe-rule --name TriggerGdeltConflict --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsGdeltConflict --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsGdeltConflict --since 2d --region ap-northeast-1 --filter-pattern '"[gdelt]"'`
- Known failures: `[gdelt] fetch failed:`, `[gdelt] unzip failed:`, `write failed:` — `aws logs tail /aws/lambda/newsGdeltConflict --since 2d --region ap-northeast-1 --filter-pattern '"[gdelt] fetch failed:"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsGdeltConflict --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Safe to re-run with payload `{}`; GDELT-side failures clear on the next run.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
