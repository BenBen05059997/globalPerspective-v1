# economy-parked

This group is PARKED: it holds the economy features (market data, economic impact, bilateral pairs, weekly markets
report) that the operator switched off in September 2026. The site hides the surfaces that read them behind the
frontend `ECONOMY_PARKED` flag. Only one Lambda still runs live: newsMarketsData keeps collecting market prices.

## Architecture

| Lambda | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsMarketsData | Collects FX, commodities, equities, crypto, bond yields and country macros. No LLM. | EventBridge, all ENABLED: `MarketsDataHourly` every hour; `MarketsYieldsDaily` Mon-Fri 06:00 UTC; `MarketsMacrosWeekly` Sun 02:00 UTC | `api.frankfurter.app`, Yahoo Finance, CoinGecko, `api.stlouisfed.org` (FRED), `api.worldbank.org` | GlobalPerspectiveMarkets (`pk`/`sk`: `FX#`, `RATES#`, `COMMODITIES#`, `EQUITIES#`, `CRYPTO#`, `MACRO#`) | [README](newsMarketsData/README.md) |
| newsEconomicImpact | Writes a per-thread economic disruption record using a closed list of instruments. | EventBridge `TriggerNewsEconomicImpact`, 07:30 UTC, DISABLED | NewsCache archives; SummarizeAndPredict `THREAD#`, `TOPIC#`; GlobalPerspectiveMarkets; DeepSeek | SummarizeAndPredict `ECON#THREAD#<id>` | [README](newsEconomicImpact/README.md) |
| newsEconomicQuality | Judges economic impact records on five axes with a different model family. | EventBridge `TriggerNewsEconomicQuality`, 08:00 UTC, DISABLED | SummarizeAndPredict `ECON#THREAD#`, `THREAD#`, `TOPIC#`; Gemini | Quality fields on the same `ECON#` records | [README](newsEconomicQuality/README.md) |
| newsPairIntelligence | Writes AI analysis of country pairs from 30 days of archive. | EventBridge `TriggerPairIntelligenceWeekly`, Mon 08:00 UTC, DISABLED | NewsCache archives; SummarizeAndPredict thread, country, `FACTS#`; Brave search; DeepSeek | SummarizeAndPredict `PAIR#<slug>` | [README](newsPairIntelligence/README.md) |
| newsWeeklyMarkets | Writes the weekly "what moved and why" report from price history. | EventBridge `TriggerWeeklyMarkets`, Sun 08:30 UTC, DISABLED | GlobalPerspectiveMarkets history; SummarizeAndPredict `ECON#` records; DeepSeek, Perplexity, Gemini judge | SummarizeAndPredict `WEEKLY_MARKETS#<weekKey>` | [README](newsWeeklyMarkets/README.md) |

## Pipeline

1. Live: newsMarketsData writes price rows to GlobalPerspectiveMarkets every hour, with extra yield and macro runs on the schedules above.
2. Parked: newsEconomicImpact would read the day's threads and market prices and write `ECON#THREAD#` records. Records on file are frozen at their last run.
3. Parked: newsEconomicQuality would score those records. newsPairIntelligence and newsWeeklyMarkets would add pair analyses and the weekly report.
4. The read proxy serves all of it through actions such as `economic_impact_list`, `markets_global`, `weekly_markets` and `pair_analysis`. The `/economy` page still exists as a direct URL; other surfaces skip these fetches.
5. Other Lambdas still read the frozen `ECON#` rows: newsBreakingAlert (magnitude), newsWeeklyBrief and newsSignals.

## Shared code

- None of these Lambdas uses `backend/shared/src`. See the [shared README](../shared/README.md).
- Operator script: [cli](cli/README.md).

## Known limits

- Reviving the economy needs an operator decision and enabling four rules; do not enable them without one.
- newsMarketsData's `all` run overlaps the dedicated yield and macro rules, so those feeds run twice at those times.
- newsEconomicQuality uses a Gemini key under the legacy `XAI_API_KEY` name; check live env before assuming the provider.
- newsWeeklyMarkets writes `published` directly; its file header and `package.json` still say draft.
- No frontend reference was found for the `pair_analysis` and `pair_analyses_list` actions.

## How to check it

```
aws events list-rules --region ap-northeast-1 --query 'Rules[?contains(Name,`Markets`)||contains(Name,`Economic`)||contains(Name,`PairIntelligence`)].[Name,State]' --output text
aws dynamodb describe-table --table-name GlobalPerspectiveMarkets --region ap-northeast-1 --query 'Table.[TableStatus,ItemCount]'
grep -n "ECONOMY_PARKED =" global-perspectives-starter/frontend/src/shared/lib/economyFlag.js
```

Last verified: 2026-10-20 against code @14dd450d and live AWS.
