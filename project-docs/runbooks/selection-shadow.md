# Selection shadow (newsSelectionShadow)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerSelectionShadow`, `cron(20 4,12,20 * * ? *)` UTC, no input.
Repo source: `amplify/backend/function/newsSelectionShadow/src/`.

## What it means
Shadow run of the layered story selector (plans/TASK_2026-10-17_grounded_forecast_and_cost.md P7c): reads the latest ingest capture (skips if older than 30 min), 8 h of corpus and GDACS state, asks Jev (`JEV_API_KEY`, paid) per story/headline, and writes S3 `audit/selection-shadow/<date>/<HHMM>.json` + `latest.json`. Nothing on the site reads it.

## Check
- Schedule state: `aws events describe-rule --name TriggerSelectionShadow --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsSelectionShadow --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsSelectionShadow --since 2d --region ap-northeast-1 --filter-pattern '"[shadow]"'`
- Known failures: `no topic-selection run in the last 30 min; skipped`, `JEV_API_KEY not set`, `Jev guard:` — `aws logs tail /aws/lambda/newsSelectionShadow --since 2d --region ap-northeast-1 --filter-pattern '"no topic-selection run in the last 30 min; skipped"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsSelectionShadow --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
A skip after a failed topic selection is expected. Each manual run writes a new file and spends Jev calls; re-run only right after a successful topic selection.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike` counts all Lambda errors.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
