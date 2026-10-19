# Weekly brief email (newsEmailSender, mode weekly)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerWeeklyEmailSend`, `cron(0 14 ? * SUN *)` UTC, input `{"mode":"weekly"}`. Live env `EMAIL_SEND_DRY_RUN=false` (real sends).
Repo source: `backend/distribution/newsEmailSender/src/`.

## What it means
Emails the newest published weekly brief to `digestOptIn` subscribers via Resend and writes `EMAILLOG#weekly#<weekOf>` in `SUMMARIZE_PREDICT_TABLE`. User-facing sends.

## Check
- Schedule state: `aws events describe-rule --name TriggerWeeklyEmailSend --region ap-northeast-1`
- No logs: the log group `/aws/lambda/newsEmailSender` does not exist (its role cannot write logs; adding that is an IAM change, operator's fresh yes), so `aws logs tail` fails with `ResourceNotFoundException`.
- Was it sent: the marker row for the brief's week (`weekOf` = the brief's Sunday): `aws dynamodb get-item --table-name SummarizeAndPredict --region ap-northeast-1 --key '{"PK":{"S":"EMAILLOG#weekly#YYYY-MM-DD"},"SK":{"S":"EMAIL_LOG"}}'` → `recipients`, `sentAt`. No row after Sunday 14:00 UTC = not sent.
- Did it run: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations --dimensions Name=FunctionName,Value=newsEmailSender --start-time $(date -u -v-8d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 86400 --statistics Sum --region ap-northeast-1`
- Code paths that would log, if logs existed: `[email:weekly] no published brief; nothing to send`, `[email] send failed`, `Resend send failed`.
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsEmailSender --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
The EMAILLOG marker stops a second send for the same week, so a re-run after a failure only sends if nothing was sent: payload `{"mode":"weekly"}`. Never pass `{"force":true}` (it re-sends to everyone) without the operator's yes.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
