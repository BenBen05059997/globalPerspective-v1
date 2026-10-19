# Topic selection (newsInvokeGemini-dev)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge Scheduler `InvokeGoogleGemini`, `cron(15 4/8 * * ? *)` UTC (04:15, 12:15, 20:15), no input.
Repo source: `amplify/backend/function/newsInvokeGemini/src/`.

## What it means
Fetches the RSS feeds, makes one LLM call (`GROK_MODEL` on `GROK_API_URL`) to pick up to `TOPICS_LIMIT` topics, and writes them to `TOPICS_DDB_TABLE` item `staging` (`status: pending`, new `generationId`) plus `seen-today`; captures what it saw and chose to S3 `audit/ingest-capture/latest.json` and `audit/ingest-capture/<date>/<HHMM>.json`. The news agent (runbook `news-agent.md`) publishes `staging` 10 minutes later; the selection shadow reads the capture.

## Check
- Schedule state: `aws scheduler get-schedule --name InvokeGoogleGemini --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsInvokeGemini-dev --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsInvokeGemini-dev --since 2d --region ap-northeast-1 --filter-pattern '"DynamoDB write OK: generationId="'`
- Known failures: `Missing XAI_API_KEY environment variable`, `Empty response from Grok model`, `Lambda error:` — `aws logs tail /aws/lambda/newsInvokeGemini-dev --since 2d --region ap-northeast-1 --filter-pattern '"Missing XAI_API_KEY environment variable"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsInvokeGemini-dev --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
No run guard: a manual run makes a paid LLM call and replaces `staging` with a new generation (which the next news-agent run then processes). Re-run only when the scheduled run failed: `aws lambda invoke --function-name newsInvokeGemini-dev --cli-binary-format raw-in-base64-out --payload '{"source":"aws.events"}' --region ap-northeast-1 /tmp/out.json`, then run the news agent (its runbook).

## Escalate
- Alarm/alert: `lambda-errors-newsInvokeGemini-dev` (Errors ≥ 1 in 5 min → SNS `GlobalPerspectivesAlerts`); the freshness monitor reports stale topics.
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
