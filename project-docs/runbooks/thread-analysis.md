# Story (thread) analysis (newsThreadAnalysis)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerDailyAnalysis`, `cron(40 4 * * ? *)` UTC, no input.
Repo source: `backend/pipeline/newsThreadAnalysis/src/`.

## What it means
For multi-day story threads in the last 30 days of archive, writes `THREAD#<id>` / `THREAD_ANALYSIS` and `THREAD_HISTORY#<date>` in `SUMMARIZE_PREDICT_TABLE` (`THREAD_ANALYSIS` carries `iso3[]`); LLM (`GROK_MODEL`), no web search; at most `MAX_THREADS`.

## Check
- Schedule state: `aws events describe-rule --name TriggerDailyAnalysis --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsThreadAnalysis --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsThreadAnalysis --since 2d --region ap-northeast-1 --filter-pattern '"Thread analysis complete:"'`
- Known failures: `Failed to analyze` (followed by the LLM error below), `Missing XAI_API_KEY` — `aws logs tail /aws/lambda/newsThreadAnalysis --since 2d --region ap-northeast-1 --filter-pattern '"Failed to analyze"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsThreadAnalysis --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Threads without new events are skipped, so a re-run only redoes threads that failed or changed: `aws lambda invoke --function-name newsThreadAnalysis --cli-binary-format raw-in-base64-out --payload '{}' --region ap-northeast-1 /tmp/out.json`. Plan only: `{"dryRun":true}`.

## Escalate
- Alarm/alert: `lambda-errors-newsThreadAnalysis` (Errors ≥ 1 in 5 min → SNS `GlobalPerspectivesAlerts`).
- LLM errors: the deployed zip (checked 2026-10-19) logs `Grok API error: <message>`; the repo code logs `LLM <status>: <message>` or `LLM timeout after <ms>ms` (`backend/shared/src/llm.js`) once it is deployed (`bash scripts/lambda.sh newsThreadAnalysis diff` shows the gap). Status 402 / `Insufficient Balance` means the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
