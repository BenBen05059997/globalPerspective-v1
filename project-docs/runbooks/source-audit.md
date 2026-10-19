# Source-truth audit (newsSourceAudit)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `newsSourceAuditDaily`, `cron(30 11 ? * MON,WED,FRI *)` UTC, no input.
Repo source: `backend/monitoring/newsSourceAudit/src/`.

## What it means
For the top `AUDIT_N` live topics, fetches source articles and asks DeepSeek (`AUDIT_MODEL`) whether the cached summary drifted; no writes. When drifted summaries ≥ `DRIFT_ALERT_THRESHOLD` it publishes `⚠ Source audit: N summaries drifted from sources` to SNS `GlobalPerspectiveAlerts`.

## Check
- Schedule state: `aws events describe-rule --name newsSourceAuditDaily --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsSourceAudit --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsSourceAudit --since 2d --region ap-northeast-1 --filter-pattern '"Source audit:"'`
- Known failures: `audit-error:`, `No topics — skipping audit.` — `aws logs tail /aws/lambda/newsSourceAudit --since 2d --region ap-northeast-1 --filter-pattern '"audit-error:"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsSourceAudit --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
An alert means summaries disagree with their sources: read the `[audit] … DRIFT` lines for the titles and check those summaries on the site. A manual re-run pays again and can re-send the alert.

## Escalate
- Alarm/alert: The job is itself the alert (SNS email).
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
