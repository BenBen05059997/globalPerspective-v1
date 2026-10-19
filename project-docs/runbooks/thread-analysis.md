# Story (thread) analysis (newsThreadAnalysis)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerDailyAnalysis`, `cron(40 4 * * ? *)` UTC, no input.
Repo source: `amplify/backend/function/newsThreadAnalysis/src/`.

## What it means
For multi-day story threads in the last 30 days of archive, writes `THREAD#<id>` / `THREAD_ANALYSIS` and `THREAD_HISTORY#<date>` in `SUMMARIZE_PREDICT_TABLE`; LLM (`GROK_MODEL`) plus two Brave calls per thread; at most `MAX_THREADS`.

## Check
- Schedule state: `aws events describe-rule --name TriggerDailyAnalysis --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsThreadAnalysis --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsThreadAnalysis --since 2d --region ap-northeast-1 --filter-pattern '"Thread analysis complete:"'`
- Known failures: `Failed to analyze`, `Grok API error:`, `Missing XAI_API_KEY` — `aws logs tail /aws/lambda/newsThreadAnalysis --since 2d --region ap-northeast-1 --filter-pattern '"Failed to analyze"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsThreadAnalysis --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Threads without new events are skipped, so a re-run only redoes threads that failed or changed: `aws lambda invoke --function-name newsThreadAnalysis --cli-binary-format raw-in-base64-out --payload '{}' --region ap-northeast-1 /tmp/out.json`. Plan only: `{"dryRun":true}`.

## Escalate
- Alarm/alert: `lambda-errors-newsThreadAnalysis` (Errors ≥ 1 in 5 min → SNS `GlobalPerspectivesAlerts`).
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
