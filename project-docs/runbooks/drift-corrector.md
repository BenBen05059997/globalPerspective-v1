# Drift notes (newsDriftCorrector)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerDriftCorrector`, `cron(30 5 * * ? *)` UTC, no input.
Repo source: `backend/pipeline/newsDriftCorrector/src/`.

## What it means
When a country or thread HISTORY# snapshot moved, writes a grounded `DRIFT#<date>` note and a `DRIFTLOG#<date>` row (never overwrites the analysis); DeepSeek, up to 2 calls per move (direction check retry).

## Check
- Schedule state: `aws events describe-rule --name TriggerDriftCorrector --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsDriftCorrector --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsDriftCorrector --since 2d --region ap-northeast-1 --filter-pattern '"drift-corrector"'`
- Known failures: `parse-fail`, `llm `, `rejected retry` — `aws logs tail /aws/lambda/newsDriftCorrector --since 2d --region ap-northeast-1 --filter-pattern '"parse-fail"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsDriftCorrector --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Moves already noted today are skipped, so a re-run is safe; single target: payload `{"country":"Iran"}` or `{"threadId":"…"}`; `{"dryRun":true}` counts pending moves. Read the `drift-corrector {json}` line for per-item status.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
