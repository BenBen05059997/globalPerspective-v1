# Breaking-alert detection (newsBreakingAlert)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerBreakingAlert`, `cron(35 4/8 * * ? *)` UTC, no input. Live env `DRY_RUN=false`.
Repo source: `amplify/backend/function/newsBreakingAlert/src/`.

## What it means
Scores the `latest` topics against `SIGNIFICANCE_THRESHOLD`, proposes at most one story not alerted within `DEDUPE_DAYS`, writes it to `BREAKING_ALERTS_TABLE` and, with `DRY_RUN=false` and `RESEND_API_KEY` set, emails it to `ALERT_EMAIL_TO` (the operator address in env; subscriber sends are the separate, disabled `TriggerBreakingEmailSend`).

## Check
- Schedule state: `aws events describe-rule --name TriggerBreakingAlert --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsBreakingAlert --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsBreakingAlert --since 2d --region ap-northeast-1 --filter-pattern '"[breaking]"'`
- Known failures: `[breaking] send failed (proposal kept):`, `[breaking] run failed`, `writeProposal failed for` — `aws logs tail /aws/lambda/newsBreakingAlert --since 2d --region ap-northeast-1 --filter-pattern '"[breaking] send failed (proposal kept):"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsBreakingAlert --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
"nothing significant this cycle — sending nothing (correct)" is normal. Dedupe prevents re-alerting the same story within the window; a manual re-run can still email a different candidate.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
