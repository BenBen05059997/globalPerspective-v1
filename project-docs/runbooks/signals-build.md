# Signal API build (newsSignals)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerSignalsBuild`, `cron(0 10 * * ? *)` UTC, input `{"action":"build"}`.
Repo source: `backend/read-api/newsSignals/src/`.

## What it means
Builds S3 `signals/latest.json` and `signals/snapshots/<date>.json` from economic-impact records, the prediction log, country briefings and sent breaking alerts. No LLM. The Signals API is parked (decisions/0032): the build rule is to be disabled and the code stays; see [parked-jobs](parked-jobs.md). Until the rule is disabled it still runs daily (ENABLED on 2026-10-19).

## Check
- Schedule state: `aws events describe-rule --name TriggerSignalsBuild --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsSignals --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsSignals --since 2d --region ap-northeast-1 --filter-pattern '"signals build complete"'`
- Known failures: `breaking scan skipped:`, `serve error` — `aws logs tail /aws/lambda/newsSignals --since 2d --region ap-northeast-1 --filter-pattern '"breaking scan skipped:"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsSignals --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Idempotent (deterministic ids); re-run with payload `{"action":"build"}`. Any other non-HTTP payload returns `unknown_invoke`.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
