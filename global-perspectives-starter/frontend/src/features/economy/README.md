# economy

`/economy` is the instrument-first markets-meets-news page: which instruments current stories are
repricing (leaderboard, dormant drawer, by-story bridge, live market context), plus a "This week"
markets wrap. The feature also owns the economic hooks and atoms that threads, countries and daily reuse
(through `index.js`); `useDisruptionsList` lives in `@/shared/hooks`.

## Status
- PARKED (decision 0009). `ECONOMY_PARKED = true` (`@/shared/lib/economyFlag.js`): the daily economic-impact
  job is off, so records are frozen. Callers outside this folder must pass `enabled: !ECONOMY_PARKED` and hide
  their surface; `EconomyPage` itself does not check the flag.
- `/economy` is soft-hidden: no nav link, reachable by direct URL.
- Live schedules: `newsEconomicImpact`, `newsEconomicQuality`, `newsWeeklyMarkets` DISABLED; `newsMarketsData`
  (hourly / daily yields / weekly macros) still ENABLED — left running pending an operator decision.

## Routes
- `/economy` -> `EconomyPage` (`?view=week`, `?sev=`, `?hor=`, `?instrument=`, `?country=`, `?sort=`, `?dir=`, `?open=`)
- `/weekly-markets` redirects to `/briefings?from=markets`, not here (the `WeeklyMarketsView` header comment is stale on that).

## Frontend
- `EconomyPage.jsx` - masthead + 3-column shell; URL-synced filters and sort; deliberately no `EditorialShell`
- `components/WeeklyMarketsView.jsx` - the "This week" wrap
- Atoms (`components/economyBlocks.css`): `InstrumentChip.jsx`, `MechanismCard.jsx`, `QualityFlag.jsx`, `Sparkline.jsx`
  (`DisruptionRow`/`DisruptionPreview` deleted 2026-10-19: only tests used them)
- `lib/composeEconomyBriefing.js` (deterministic briefing text, loaded by `quality/briefing/verify_*.mjs`),
  `lib/disruptionGate.js` (hides unreliable FX arrows / analogs), `data/economicAnalogs.js(on)` — keep relative imports
- Public API (`index.js`): `InstrumentChip` (daily), `MechanismCard`, `useEconomicImpact` (threads), `useMarketsCountry` (countries)
- Imports from other features: none. Shared: `SeverityBadge`, `DirectionArrow`, `EntityLink`, `@/shared/lib/links.js` (`storyHref`, `ROUTE`)

## Backend
- Generated row: [reference/features.md#economy](../../../../../project-docs/reference/features.md#economy)
- `newsEconomicImpact`, `newsEconomicQuality`, `newsWeeklyMarkets` (parked, write `SummarizeAndPredict`);
  `newsMarketsData` writes `GlobalPerspectiveMarkets`; `newsSensitiveData-dev` serves every action below.

## Data
- `useDisruptionsList` (`@/shared/hooks`) -> restProxy `economic_impact_list`; `useEconomicImpact` -> `economic_impact`;
  `useTopMovers` -> `economic_top_movers`
- `useMarketsGlobal` -> `markets_global`, `useMarketsHistory` -> `markets_history`, `useMarketsCountry` -> `markets_country`,
  `useWeeklyMarkets` -> `weekly_markets`
- All through `useCachedQuery`; `useDisruptionsList` and `useEconomicImpact` take `{ enabled }`

## Docs
- Decisions: [0009](../../../../../project-docs/decisions/0009-economy-parked.md) (economy parked),
  [0015](../../../../../project-docs/decisions/0015-park-jobs-that-feed-nothing-shown.md) (park jobs that feed nothing shown)
- Runbooks: [markets-data.md](../../../../../project-docs/runbooks/markets-data.md),
  [parked-jobs.md](../../../../../project-docs/runbooks/parked-jobs.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/economy`
- Market data served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"markets_global"}' | head -c 300`
- Impact job still parked: `aws events describe-rule --name TriggerNewsEconomicImpact --region ap-northeast-1 --query State`
- Markets job running: `aws logs tail /aws/lambda/newsMarketsData --since 2h --region ap-northeast-1 --format short`

Last verified: 2026-10-19
