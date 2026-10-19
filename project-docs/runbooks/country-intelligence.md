# Country briefings (newsCountryIntelligence)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge Scheduler `countryIntelliegence` (sic), `cron(15 5 * * ? *)` UTC, no input.
Repo source: `backend/pipeline/newsCountryIntelligence/src/`.

## What it means
Plans which countries to refresh (top `COUNTRY_TOP_N`, weekly baseline, alert or coverage-jump extras) and writes `COUNTRY#<name>` / `COUNTRY_INTELLIGENCE` and `HISTORY#<date>` in `SUMMARIZE_PREDICT_TABLE`; LLM plus up to 4 Brave calls per country. Reads `WORLD_LATEST_URL` for alert countries.

## Check
- Schedule state: `aws scheduler get-schedule --name countryIntelliegence --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsCountryIntelligence --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsCountryIntelligence --since 2d --region ap-northeast-1 --filter-pattern '"Country intelligence complete:"'`
- Known failures: `Failed to analyze`, `Grok API error:`, `-> FAILED` — `aws logs tail /aws/lambda/newsCountryIntelligence --since 2d --region ap-northeast-1 --filter-pattern '"Failed to analyze"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsCountryIntelligence --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Countries already refreshed today or unchanged are skipped, so a re-run is cheap: `aws lambda invoke --function-name newsCountryIntelligence --cli-binary-format raw-in-base64-out --payload '{}' --region ap-northeast-1 /tmp/out.json`; plan only `{"dryRun":true}`.

## Escalate
- Alarm/alert: `lambda-errors-newsCountryIntelligence` (Errors ≥ 1 in 5 min → SNS `GlobalPerspectivesAlerts`).
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
