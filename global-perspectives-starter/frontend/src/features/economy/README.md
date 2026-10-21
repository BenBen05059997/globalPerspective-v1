# economy

`/economy` is the instrument-first markets-meets-news page: which instruments current stories are repricing
(leaderboard, dormant drawer, by-story bridge, live market context), plus a "This week" markets wrap. It is
for readers who want to see price moves next to the stories behind them. The feature also owns the economic
hooks and atoms that the story page reuses (through `index.js`); `useDisruptionsList` lives in `@/shared/hooks`.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → 9 Delivery → 10 Watch
This folder is outside the pipeline: parked economy page. Timeline: parked; reads none. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- PARKED (decision 0009, 0031). `ECONOMY_PARKED = true` (`@/shared/lib/economyFlag.js`): the daily economic-impact
  job is off, so those records are frozen. Callers outside this folder pass `enabled: !ECONOMY_PARKED` and hide their
  surface; `EconomyPage` itself does not check the flag.
- `/economy` is soft-hidden: no nav link, reachable by direct URL only.
- Live schedules (checked 2026-10-20): `TriggerNewsEconomicImpact`, `TriggerNewsEconomicQuality`, `TriggerWeeklyMarkets`
  DISABLED. The markets job is still running: `MarketsDataHourly` `rate(1 hour)`, `MarketsYieldsDaily`
  `cron(0 6 ? * MON-FRI *)` and `MarketsMacrosWeekly` `cron(0 2 ? * SUN *)` are ENABLED; a run was logged 2026-10-19 23:36 UTC.
  It is left running pending an operator decision.

## Routes
- `/economy` -> `EconomyPage` (`?view=week`, `?sev=`, `?hor=`, `?instrument=`, `?country=`, `?sort=`, `?dir=`, `?open=`)
- `/weekly-markets` redirects to `/briefings?from=markets` (`MarketsRedirect`), not here.

## Frontend
- `EconomyPage.jsx` - masthead and 3-column shell; URL-synced filters and sort; deliberately no `EditorialShell`
- `components/WeeklyMarketsView.jsx` - the "This week" wrap
- Atoms (`components/economyBlocks.css`): `InstrumentChip.jsx`, `MechanismCard.jsx`, `QualityFlag.jsx`, `Sparkline.jsx`
- `lib/composeEconomyBriefing.js` (deterministic briefing text, loaded by `quality/briefing/verify_*.mjs`),
  `lib/disruptionGate.js` (hides unreliable FX arrows and analogs), `data/economicAnalogs.js(on)`: keep relative imports
- Public API (`index.js`): `InstrumentChip`, `MechanismCard`, `useEconomicImpact`; the only outside importer today is
  `features/threads/ThreadPage.jsx` (`MechanismCard`, `useEconomicImpact`).
- Imports from other features: none. Shared: `SeverityBadge`, `DirectionArrow`, `EntityLink`, `useDisruptionsList`,
  `useCachedQuery`, `@/shared/lib/links.js` (`storyHref`, `ROUTE`).

## Backend
- Generated row: [reference/features.md#economy](../../../../../project-docs/reference/features.md#economy)
- Guides: [economy-parked](../../../../../backend/economy-parked/README.md) (all four jobs),
  [read-api](../../../../../backend/read-api/README.md) (`newsSensitiveData-dev`, serves every action below)
- `newsEconomicImpact`, `newsEconomicQuality`, `newsWeeklyMarkets` (parked; write `SummarizeAndPredict`);
  `newsMarketsData` writes `GlobalPerspectiveMarkets` from free sources (Frankfurter, FRED, World Bank, Yahoo Finance).

## Data
All through `useCachedQuery`, all public reads (no sign-in).
- `useMarketsGlobal` -> `markets_global` (localStorage `gp_markets_global_v1`); `useMarketsHistory` -> `markets_history` (per symbol)
- `useTopMovers` -> `economic_top_movers`; `useWeeklyMarkets` -> `weekly_markets` (latest published report)
- `useEconomicImpact` -> `economic_impact` (takes `{ enabled }`); `useDisruptionsList` (`@/shared/hooks`) -> `economic_impact_list`

## Pipeline
1. `newsMarketsData` (hourly, plus weekday yields and weekly macros) pulls prices from the free sources above.
2. It writes `GlobalPerspectiveMarkets` rows: `LATEST` plus daily `HISTORY#` rows per category (FX, rates, commodities, equities, crypto, macro).
3. `newsSensitiveData-dev` (`markets_global`, `markets_history`) reads those rows and returns them as one public payload.
4. Separately, the parked impact job wrote per-story economic records to `SummarizeAndPredict`; `economic_impact`, `economic_impact_list` and `economic_top_movers` read the frozen copies.
5. `restProxy.js` fetches the actions; the hooks cache them in localStorage.
6. `disruptionGate.js` drops unreliable rows; `composeBriefing` writes the briefing line.
7. `EconomyPage` lays out the leaderboard, `Sparkline` draws history, and `WeeklyMarketsView` shows the latest published weekly wrap.

## Docs
- Decisions: [0009](../../../../../project-docs/decisions/0009-economy-parked.md) (economy parked),
  [0031](../../../../../project-docs/decisions/0031-economy-parked-fx-box-labelled.md) (FX box labelled),
  [0015](../../../../../project-docs/decisions/0015-park-jobs-that-feed-nothing-shown.md) (park jobs that feed nothing shown)
- Runbooks: [markets-data.md](../../../../../project-docs/runbooks/markets-data.md), [parked-jobs.md](../../../../../project-docs/runbooks/parked-jobs.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/economy`
- Market data served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"markets_global"}' | head -c 300`
- Impact job still parked: `aws events describe-rule --name TriggerNewsEconomicImpact --region ap-northeast-1 --query State`
- Markets job running: `aws logs tail /aws/lambda/newsMarketsData --since 2h --region ap-northeast-1 --format short`

Last verified: 2026-10-20
