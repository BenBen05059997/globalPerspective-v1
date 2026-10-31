# 0049. The economy product is retired

Status: accepted (operator, 2026-10-31); supersedes 0009 and 0031; trims 0032
Date: 2026-10-31

## Context
Economy was parked in September 2026 (0009, 0031): the economic-impact, quality-judge, pair and weekly-markets jobs were switched off and the surfaces
hidden behind `ECONOMY_PARKED`. What stayed live: `/economy` by URL, the hourly `newsMarketsData` feed, the country page's macro baseline and FX box,
the story page's Economy tab code, and four readers of the frozen `ECON#THREAD#` rows (`newsBreakingAlert`, `newsWeeklyBrief`, `newsSignals`, the read
proxy). The rows are not in the record in any form. The step 5 audit (`STEP5_AUDIT.md` step 12) could not delete them while those readers existed.

## Decision
The operator retired the product (2026-10-31) so its data can be deleted later (DynamoDB table `GlobalPerspectiveMarkets`; SummarizeAndPredict families
`ECON#THREAD#`, `PAIR#`, `WEEKLY_MARKETS#`). The coordinator had already DISABLED `MarketsDataHourly`, `MarketsMacrosWeekly` and `MarketsYieldsDaily`.
This change removes it from the code; nothing is deleted in AWS here.

- Frontend: the `/economy` route and `features/economy`, the story page Economy tab, the Today and country-list disruption badges and sort, the country
  page disruption rail, macro baseline and FX box, the country card's macro and FX facts, `ECONOMY_PARKED`, `useDisruptionsList`, the markets and
  economic-impact calls in `restProxy.js`, the `/weekly-markets` redirect and the briefings paused note, the Economic Disruption disclosure section, the
  economy-only Playwright spec, smoke and contract cases, and the economy verification scripts and eval set in `quality/`.
- Old addresses: `/economy` and `/weekly-markets` match no route and fall through to the app's `*` route, the "Page not found" page (links to the map and
  Stories). The Worker no longer 301s `/weekly-markets`. An old story link with `?tab=economy` opens the story's Overview (any unknown tab does).
- Read proxy (`newsSensitiveData`): `economic_impact`, `economic_impact_list`, `economic_top_movers`, `weekly_markets`, `markets_global`, `markets_country`
  and `markets_history` are gone and answer 400 `Unsupported action` without database work (the pair actions were already gone).
- `newsBreakingAlert`: no `ECON#` read; the economic-magnitude score term (weight 1.5), the "market impact" reason and the Market impact block of the alert email
  and of the stored story are removed. A story's score drops only if its thread had an `ECON#` row (none is written since 2026-09-28).
- `newsWeeklyBrief`: no `ECON#` read; the prompt no longer carries the "Economic read (already computed)" line for threads that had a row. The brief's fields
  (lede, fact, soWhat, related, risk, region, sources, watch) never contained economy data, so the stored brief and the Sunday weekly email keep their shape.
  The only change a reader can see is whatever wording the model drew from that line for an older thread that had a row; the model is told to ground each
  signal in its own block only, and new threads have had no row since September.
- `newsSignals` (Signals API, 0032) stays parked, without the `economic_impact` signal type (forecast, geopolitical_risk and breaking signals unchanged).
- Lambdas deleted from the repo and `scripts/functions.json`: `newsMarketsData`, `newsEconomicImpact`, `newsEconomicQuality`, `newsPairIntelligence`,
  `newsWeeklyMarkets` (`backend/economy-parked/`, including the weekly-markets review CLI). Nothing imported them. `newsSignals` is kept (above).

## Consequences
- AWS still holds the five Lambdas, their rules, roles, log groups and the data until the coordinator deletes them, each under a fresh operator yes.
  `quality/check_aws_inventory.mjs` reports the five as deployed but unlisted until then.
- Deploy list: `newsSensitiveData-dev`, `newsBreakingAlert`, `newsWeeklyBrief`, `newsSignals` (parked; optional), the front Worker (root page entry and the
  `/weekly-markets` redirect), and a frontend release.
- The "Economic Disruption Analysis" disclosure section is gone with the feature; the operator should review the remaining legal copy.
- Reviving economy means a new design and new decision, not re-enabling rules.

Source: operator decision 2026-10-31; `architecture/STEP5_AUDIT.md` section 6 step 12.
