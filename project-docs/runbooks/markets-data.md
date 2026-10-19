# Market data (newsMarketsData; economy parked)

Last verified: 2026-10-19 (schedule, target, input and alarm settings read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh <name> diff`).

## Trigger
Three EventBridge rules: `MarketsDataHourly` `rate(1 hour)` input `{"source":"all"}`; `MarketsYieldsDaily` `cron(0 6 ? * MON-FRI *)` input `{"source":"yields"}`; `MarketsMacrosWeekly` `cron(0 2 ? * SUN *)` input `{"source":"macros"}`.
Repo source: `backend/economy-parked/newsMarketsData/src/`.

## What it means
Free sources (Frankfurter, Yahoo, CoinGecko, FRED, World Bank) into `MARKETS_DDB_TABLE` `LATEST` + `HISTORY#<date>` rows (FX, rates, commodities, equities, crypto, macros). No LLM. Kept running while economy is parked because country pages read it (decisions/0009).

## Check
- Schedule state: `aws events describe-rule --name MarketsDataHourly --region ap-northeast-1`
- Last runs: `aws logs tail /aws/lambda/newsMarketsData --since 1d --region ap-northeast-1`
- Success line: `aws logs tail /aws/lambda/newsMarketsData --since 2d --region ap-northeast-1 --filter-pattern '"[newsMarketsData] done:"'`
- Known failures: `] failed:`, `FRED_API_KEY not set` — `aws logs tail /aws/lambda/newsMarketsData --since 2d --region ap-northeast-1 --filter-pattern '"] failed:"'`
- Errors per hour: `aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=newsMarketsData --start-time $(date -u -v-1d +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 3600 --statistics Sum --region ap-northeast-1`

## Fix
Rows are overwritten by key; safe to re-run one source: payload `{"source":"fx"}` (fx, commodities, equities, crypto, yields, macros).

## Escalate
- Alarm/alert: None specific; `Lambda-Errors-Spike`.
- Code or env changes: operator-asked work only (CLAUDE.md, Authorization).
