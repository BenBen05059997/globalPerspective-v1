# Weekly brief email (newsEmailSender, mode weekly)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerWeeklyEmailSend`, `cron(0 14 ? * SUN *)` UTC, input `{"mode":"weekly"}`. Live env `EMAIL_SEND_DRY_RUN=false` (real sends).
Repo source: `backend/distribution/newsEmailSender/src/`.

## What it means
Emails the newest published weekly brief to `digestOptIn` subscribers via Resend and writes `EMAILLOG#weekly#<weekOf>` in `SUMMARIZE_PREDICT_TABLE`. User-facing sends.

## Check
- Schedule state: `aws events describe-rule --name TriggerWeeklyEmailSend --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsEmailSender --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsEmailSender --since 2d --region ap-northeast-1 --filter-pattern '"[email:weekly] week"'`
- Known failures: `[email:weekly] no published brief; nothing to send`, `[email] send failed`, `Resend send failed` — `aws logs tail /aws/lambda/newsEmailSender --since 2d --region ap-northeast-1 --filter-pattern '"[email:weekly] no published brief; nothing to send"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsEmailSender --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
The EMAILLOG marker stops a second send for the same week, so a re-run after a failure only sends if nothing was sent: payload `{"mode":"weekly"}`. Never pass `{"force":true}` (it re-sends to everyone) without the operator's yes.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
