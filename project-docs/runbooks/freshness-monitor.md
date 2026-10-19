# Freshness monitor (newsFreshnessMonitor)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerFreshnessMonitor`, `cron(30 0/2 * * ? *)` UTC, no input.
Repo source: `backend/monitoring/newsFreshnessMonitor/src/`.

## What it means
Calls the proxy (`PROXY_URL?action=topics`) and alerts SNS `GlobalPerspectiveAlerts` with `[GP] Content STALE — <h>h old` when topics are older than `STALE_HOURS`, or `[GP] Freshness probe FAILED — …` when the proxy fails; on the 12 UTC run also `[GP] Prediction settling overdue` (see `prediction-resolver.md`).

## Check
- Schedule state: `aws events describe-rule --name TriggerFreshnessMonitor --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsFreshnessMonitor --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsFreshnessMonitor --since 2d --region ap-northeast-1 --filter-pattern '"newsFreshnessMonitor OK"'`
- Known failures: `misconfigured`, `settle check failed (non-fatal):` — `aws logs tail /aws/lambda/newsFreshnessMonitor --since 2d --region ap-northeast-1 --filter-pattern '"misconfigured"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsFreshnessMonitor --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
STALE: the topics pipeline stalled — work through `topic-selection.md` then `news-agent.md` (most often a DeepSeek 402). FAILED: check the proxy `newsSensitiveData-dev` (`alarms.md`). Test without sending: payload `{"dryRun":true}`.

## Escalate
- Alarm/alert: It is the alert. Each failing run alerts again (no marker).
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
