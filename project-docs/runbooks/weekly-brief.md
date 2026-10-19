# Weekly brief (newsWeeklyBrief)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerWeeklyBrief`, `cron(0 6 ? * SUN *)` UTC, no input. (The code comment still says "no EventBridge schedule"; the live rule exists.)
Repo source: `backend/distribution/newsWeeklyBrief/src/`.

## What it means
Builds the week's signals brief from 8 archive days, thread analyses and country briefings with one LLM call; writes `WEEKLY_BRIEF#<weekKey>` / `WEEKLY_BRIEF` (`status: published`) in `SUMMARIZE_PREDICT_TABLE`. The Sunday 14:00 email (`weekly-email.md`) sends it.

## Check
- Schedule state: `aws events describe-rule --name TriggerWeeklyBrief --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsWeeklyBrief --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsWeeklyBrief --since 2d --region ap-northeast-1 --filter-pattern '"[weekly] published:"'`
- Known failures: `[weekly] No archive entries this week`, `[weekly] No usable signals produced`, `LLM error:` — `aws logs tail /aws/lambda/newsWeeklyBrief --since 2d --region ap-northeast-1 --filter-pattern '"[weekly] No archive entries this week"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsWeeklyBrief --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
No guard: a re-run with the same `weekKey` overwrites the brief and pays one LLM call. Re-run before 14:00 UTC Sunday so the email picks it up: payload `{}` (or `{"weekKey":"YYYY-MM-DD"}`).

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
