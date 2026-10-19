# Model and DeepSeek balance guard (newsModelGuard)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerModelGuard`, `cron(0 12 * * ? *)` UTC, no input.
Repo source: `backend/monitoring/newsModelGuard/src/`.

## What it means
Checks the DeepSeek balance (`/user/balance`) and every Lambda's model env vars against DeepSeek `/models`; alerts SNS `GlobalPerspectiveAlerts` with `[GP] Model-retirement guard: …` or `DeepSeek balance low: $X` (threshold `DEEPSEEK_BALANCE_ALERT_USD`, default 3). Measured spend per job: `DEEPSEEK_COST_ESTIMATE.md`.

## Check
- Schedule state: `aws events describe-rule --name TriggerModelGuard --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsModelGuard --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsModelGuard --since 2d --region ap-northeast-1 --filter-pattern '"deepseekBalanceUsd"'`
- Known failures: `balance fetch failed`, `no DEEPSEEK_API_KEY` — `aws logs tail /aws/lambda/newsModelGuard --since 2d --region ap-northeast-1 --filter-pattern '"balance fetch failed"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsModelGuard --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Balance low: the operator tops up DeepSeek. Retired model: change that Lambda's model env var (fetch → merge → write the full map) to a model listed by `/models`.

## Escalate
- Alarm/alert: It is the alert. Each run re-alerts while the condition holds.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
