# News agent: summaries, forecasts, publish (NewsProjectInvokeAgentLambda-dev)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge Scheduler `InvokeNewsAgent`, `cron(25 4/8 * * ? *)` UTC (04:25, 12:25, 20:25), no input.
Repo source: `backend/pipeline/NewsProjectInvokeAgentLambda/src/`.

## What it means
Reads `staging`, writes SUMMARY / TRACE_CAUSE / PREDICTION per topic (`SUMMARIZE_PREDICT_TABLE`, `TOPIC#<id>`), logs forecasts to `PREDICTION_LOG_TABLE`, swaps `staging` → `latest`, writes `today-archive` and `archive#<date>`, and writes S3 `threads/story-map.json`. Thread joins (`threading.js`): a topic joins an existing thread only if the composite score is ≥ 0.4 **and** keyword overlap is ≥ 0.15; titles are normalised and earlier runs of the same day are in the lookback. Every assignment logs one `[join] {topicId, threadId, via, score, kwScore}` line, and each thread has a pointer row `THREAD#<threadId>` / `TOPICS` (current `topicId`, all `topicIds`). Calls the LLM (`GROK_MODEL`, `PREDICTION_MODEL`); no web search.

## Check
- Schedule state: `aws scheduler get-schedule --name InvokeNewsAgent --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/NewsProjectInvokeAgentLambda-dev --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/NewsProjectInvokeAgentLambda-dev --since 2d --region ap-northeast-1 --filter-pattern '"Generation complete:"'`
- Known failures: `Topics cache empty or stale`, `OpenAI error:`, `Generation failed for topic`, `NewsProjectInvokeAgentLambda error:` — `aws logs tail /aws/lambda/NewsProjectInvokeAgentLambda-dev --since 2d --region ap-northeast-1 --filter-pattern '"Topics cache empty or stale"'`
- Join audit: `aws logs tail /aws/lambda/NewsProjectInvokeAgentLambda-dev --since 1d --region ap-northeast-1 --filter-pattern '"[join]"'`; list or repair wrong joins with `node backend/pipeline/cli/threads.mjs list-joins --since <date>` (read-only) and `merge` / `split` (print-only; `--apply` writes prod data and needs the operator's yes).
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=NewsProjectInvokeAgentLambda-dev --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
A run guard skips a `staging` generation already processed (`Skipping run: staging … already processed`); unchanged items are reused and forecasts are once per story per day, so a manual re-run after a failure is safe: `aws lambda invoke --function-name NewsProjectInvokeAgentLambda-dev --cli-binary-format raw-in-base64-out --payload '{}' --region ap-northeast-1 /tmp/out.json`. Preview without LLM calls or writes: payload `{"dryRun":true}`. `{"force":true}` regenerates everything (paid).

## Escalate
- Alarm/alert: `lambda-errors-NewsProjectInvokeAgentLambda-dev` (Errors ≥ 1 in 5 min → SNS `GlobalPerspectivesAlerts`).
- LLM errors: `OpenAI error: <message>` (this Lambda has its own client, not `backend/shared/src/llm.js`). Status 402 / `Insufficient Balance` means the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
