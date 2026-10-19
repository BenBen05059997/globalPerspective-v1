# Daily brief (newsPostDevTo)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge Scheduler `InvokeDev`, `cron(0 23 * * ? *)` Asia/Tokyo, no input.
Repo source: `backend/distribution/newsPostDevTo/src/`.

## What it means
Despite the name, it no longer posts to dev.to (path removed 2026-05-18): it generates the day's brief from `today-archive`, thread analyses and country briefings with one LLM call and writes `DAILY_BRIEF#<date>` / `DAILY_BRIEF` in `SUMMARIZE_PREDICT_TABLE`.

## Check
- Schedule state: `aws scheduler get-schedule --name InvokeDev --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsPostDevTo --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsPostDevTo --since 2d --region ap-northeast-1 --filter-pattern '"[DAILY_BRIEF] Stored for"'`
- Known failures: `[DAILY_BRIEF] No archive entries, skipping`, `[DAILY_BRIEF] Generation failed:`, `Grok API error` — `aws logs tail /aws/lambda/newsPostDevTo --since 2d --region ap-northeast-1 --filter-pattern '"[DAILY_BRIEF] No archive entries, skipping"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsPostDevTo --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
No guard: a re-run overwrites the day's brief and pays one LLM call; safe with payload `{}`.

## Escalate
- Alarm/alert: `lambda-errors-newsPostDevTo` (→ SNS `GlobalPerspectivesAlerts`).
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
