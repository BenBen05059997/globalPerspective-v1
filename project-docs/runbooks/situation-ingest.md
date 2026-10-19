# Hourly story ingest (newsSituationIngest)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge rule `TriggerSituationIngest`, `rate(1 hour)`, no input.
Repo source: `backend/situations/newsSituationIngest/src/`.

## What it means
Fetches RSS, classifies only uncached articles with the LLM (`GROK_MODEL`), clusters stories and writes S3 `stories/classify-cache.json`, `corpus/YYYY/MM/DD/HH.jsonl`, `stories/state/<id>.json` and `stories/index.json`; emits `IngestArticles`, `IngestStories`, `ClassifierLLMCallsToday`, `IngestCacheHits` to `GlobalPerspective/Situations`.

## Check
- Schedule state: `aws events describe-rule --name TriggerSituationIngest --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsSituationIngest --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsSituationIngest --since 2d --region ap-northeast-1 --filter-pattern '"[ingest] {"ok":true"'`
- Known failures: `[ingest] no XAI_API_KEY`, `[ingest] batch failed:`, `cache write failed:` — `aws logs tail /aws/lambda/newsSituationIngest --since 2d --region ap-northeast-1 --filter-pattern '"[ingest] no XAI_API_KEY"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsSituationIngest --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
The classify cache means a re-run only pays for new articles; safe with payload `{}`.

## Escalate
- Alarm/alert: Indirect: `situation-tracker-stalled` if the map stops updating.
- LLM errors (`Grok API error:`, `OpenAI error:`, `DeepSeek <status>:`, `llm <status>:`) with HTTP 402 mean the DeepSeek balance ran out: topping up is the operator's call (decisions/0014). Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
