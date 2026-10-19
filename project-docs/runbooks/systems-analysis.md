# Systems analysis / story web (newsSystemsAnalysis)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerNewsSystemsAnalysis`, `cron(0 5 * * ? *)` UTC, no input.
Repo source: `backend/pipeline/newsSystemsAnalysis/src/`.

## What it means
Per top country (`SYSTEMS_TOP_N`), one LLM call builds the causal graph between story threads; writes `SYSTEMS#<country>` / `SYSTEMS_ANALYSIS`, `THREAD#<id>` / `WEB` and `WEB#INDEX` / `LATEST` in `SUMMARIZE_PREDICT_TABLE`.

## Check
- Schedule state: `aws events describe-rule --name TriggerNewsSystemsAnalysis --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsSystemsAnalysis --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsSystemsAnalysis --since 2d --region ap-northeast-1 --filter-pattern '"Systems analysis complete:"'`
- Known failures: `Failed for`, `Grok API error:`, `Web index build failed` — `aws logs tail /aws/lambda/newsSystemsAnalysis --since 2d --region ap-northeast-1 --filter-pattern '"Failed for"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsSystemsAnalysis --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
No run guard: every run pays one LLM call per country and overwrites the same keys. Re-run for chosen countries only: payload `{"countries":["Iran"]}`; preview `{"dryRun":true}`.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
