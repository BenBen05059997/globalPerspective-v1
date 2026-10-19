# Country facts (newsCountryFactsUpdater)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
EventBridge Scheduler `Fact`, `cron(0 5 ? * MON *)` Asia/Tokyo (Monday 05:00 JST), no input.
Repo source: `amplify/backend/function/newsCountryFactsUpdater/src/`.

## What it means
Refreshes `FACTS#<name>` / `COUNTRY_FACTS` for 40 countries from Wikidata (leaders, capital, population) and ACLED conflict counts for the first 12. No LLM.

## Check
- Schedule state: `aws scheduler get-schedule --name Fact --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsCountryFactsUpdater --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsCountryFactsUpdater --since 2d --region ap-northeast-1 --filter-pattern '"newsCountryFactsUpdater complete:"'`
- Known failures: `Failed to update`, `ACLED auth failed:`, `ACLED read failed for` — `aws logs tail /aws/lambda/newsCountryFactsUpdater --since 2d --region ap-northeast-1 --filter-pattern '"Failed to update"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsCountryFactsUpdater --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Overwrites each record; a failed sub-query keeps the old value. Re-run for named countries: payload `{"countries":["Iran"]}`. Countries cut by the time budget are listed as skipped.

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
