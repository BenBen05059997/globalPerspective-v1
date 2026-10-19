# economy

PARKED. `/economy` is the instrument-first markets-meets-news page: which instruments current
stories are repricing (leaderboard, dormant drawer, by-story bridge, live market context), plus
a "This week" markets wrap. The feature also owns the economic hooks and atoms that threads,
countries, daily and home reuse.

## Routes
- `/economy` -> `EconomyPage` (`?view=week`, `?sev=`, `?hor=`, `?instrument=`, `?country=`, `?sort=`, `?dir=`, `?open=`)

## Entry files
- `EconomyPage.jsx` - masthead + 3-column shell; URL-synced filters and sort
- `components/WeeklyMarketsView.jsx` - the "This week" wrap
- `components/InstrumentChip.jsx` (also used by `DailyPage`), `MechanismCard.jsx` (also used by `ThreadPage`), `QualityFlag.jsx`, `Sparkline.jsx` - atoms
- `components/DisruptionRow.jsx`, `DisruptionPreview.jsx` - only referenced by tests today
- `lib/composeEconomyBriefing.js` (deterministic briefing text), `lib/disruptionGate.js` (hides unreliable FX arrows / analogs), `data/economicAnalogs.js(on)`

## Data
- restProxy actions via hooks: `useDisruptionsList` -> `economic_impact_list`, `useEconomicImpact` -> `economic_impact`, `useTopMovers` -> `economic_top_movers`
- `useMarketsGlobal` -> `markets_global`, `useMarketsHistory` -> `markets_history`, `useMarketsCountry` -> `markets_country`, `useWeeklyMarkets` -> `weekly_markets`
- All through `useCachedQuery`; `useDisruptionsList` and `useEconomicImpact` take `{ enabled }`

## Shared blocks used
- `@/shared/ui/SeverityBadge`, `@/shared/ui/DirectionArrow`

## Imports from other features
- None.

## Gotchas
- `ECONOMY_PARKED = true` (`@/shared/lib/economyFlag.js`): the daily economic-impact job is off, so records are frozen. Callers outside this folder must pass `enabled: !ECONOMY_PARKED` and hide their surface. `EconomyPage` itself does not check the flag.
- `/economy` is soft-hidden: no nav link, reachable by direct URL.
- `/weekly-markets` now redirects to `/briefings?from=markets`, not here; the `WeeklyMarketsView` header comment is stale on that.
- `lib/composeEconomyBriefing.js` is loaded by Node tooling (`quality/briefing/verify_*.mjs`); it, `lib/disruptionGate.js` and `data/economicAnalogs.js` carry a "keep relative imports" header.
- `EconomyPage` deliberately does not use `EditorialShell`.

Last verified: 2026-10-19
