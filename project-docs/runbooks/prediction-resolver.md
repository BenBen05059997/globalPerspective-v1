# Forecast settling (newsPredictionResolver)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerPredictionResolver`, `cron(30 10 * * ? *)` UTC, input `{"action":"tick"}`.
Repo source: `backend/predictions/newsPredictionResolver/src/`.

## What it means
`tick`: commits seeds two weeks ahead, draws each ended week's sample, runs the verdict-draft pass on Mondays (LLM `DRAFT_MODEL` + Brave), and writes a `SETTLE#<week>/TICK#<iso>` heartbeat in `PREDICTION_LOG_TABLE`. The operator confirms verdicts on Mondays.

## Check
- Schedule state: `aws events describe-rule --name TriggerPredictionResolver --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsPredictionResolver --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsPredictionResolver --since 2d --region ap-northeast-1 --filter-pattern '"settle {"'`
- Known failures: `settle errors`, `brave status` — `aws logs tail /aws/lambda/newsPredictionResolver --since 2d --region ap-northeast-1 --filter-pattern '"settle errors"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsPredictionResolver --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
All writes are conditional (never overwrite) and drafts newer than 5 days are skipped, so a re-run is safe: `aws lambda invoke --function-name newsPredictionResolver --cli-binary-format raw-in-base64-out --payload '{"action":"tick"}' --region ap-northeast-1 /tmp/out.json`. Read-only state: `{"action":"status"}`; no LLM and no writes: add `"dryRun":true`.

## Escalate
- Alarm/alert: The freshness monitor sends `[GP] Prediction settling overdue` (12 UTC run) when a draw or commit is missed, the tick is stale, or due questions are unsettled for 10+ days.
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
