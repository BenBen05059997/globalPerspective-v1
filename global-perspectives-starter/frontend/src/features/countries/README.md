# countries

Country views built from stored data only (no AI run on view): the country list with an overview
map, the per-country page (Situation / Story Arcs / Coverage tabs), and `CountryCardV2`, the
one-screen country card the map console also mounts.

## Status
- Live, public (signed-out reads work).
- `ECONOMY_PARKED` (`@/shared/lib/economyFlag.js`) hides the disruption sort and blocks and turns off
  `useDisruptionsList` (`enabled: !ECONOMY_PARKED`); `useMarketsCountry` is not gated (FX box labelled "Market prices · raw quotes · as of <time>", no story link; decision 0031).

## Routes
- `/weekly/countries` -> `CountryListPage` (also the Countries section of `/weekly?section=countries`:
  `app/App.jsx` passes it to `WeeklyPage` as `countriesView`)
- `/weekly/country/:countryName` -> `CountryPage` (`useParams()` already decodes; decoding again throws on `%`)

## Frontend
- `CountryListPage.jsx` - sortable list (risk, coverage, A-Z; disruption only when economy is not parked)
- `CountryPage.jsx` - hero + map band, `CountryCardV2`, tabs, rails; phone Read / Map tabs
- `components/CountryCardV2.jsx` - facts, summary, risk + direction, latest change, stories, triggers, FX
- `components/CountryWhatChanged.jsx`, `BackgroundTimeline.jsx`, `CountryOverviewMap.jsx` (Google Maps;
  "Map unavailable" without `window.GOOGLE_MAPS_API_KEY`)
- `lib/` - pure helpers: `countryCurrency`, `countryDirection`, `countryDrift`, `countryFacts`, `countryMacro`,
  `countryTier`, `countryTriggers`, `countryWatch`
- CSS: `CountryListPage.css`, `CountryPage.css`, `CountryCoverage.css`, `components/*.css` (no threads CSS)
- Public API (`index.js`): `CountryCardV2` — used by `map` (gets `situations` for the watch flag there; not on CountryPage)
- Imports from other features: `@/features/threads` -> `useWeeklyArchive`, `useThreadAnalyses`, `buildDeadlines`,
  `COUNTRY_COORDINATES`, plus a lazy `import()` of `threads/components/WeeklyMap` (a static import pulled it into
  the main chunk); `@/features/economy` -> `useMarketsCountry`

## Backend
- Generated row: [reference/features.md#countries](../../../../../project-docs/reference/features.md#countries)
- `newsCountryIntelligence` (daily `COUNTRY#<name>` / `COUNTRY_INTELLIGENCE`), `newsCountryFactsUpdater` (weekly
  `FACTS#<name>` / `COUNTRY_FACTS` from Wikidata), `newsDriftCorrector`, `newsSystemsAnalysis`; served by `newsSensitiveData-dev`.

## Data
- `useCountryIntelligence` -> restProxy `country_intelligence` (auth header when signed in), chunked to the backend's
  15-name cap (`@/shared/map/countryRiskLayer.js`); localStorage `gp_country_intel_v1`, 30 min.
- `useCountryHistory` -> `country_history` (localStorage `gp_country_history_<name>`, 1 h); `useCountryFacts` ->
  `country_facts` (memory, 30 min); `useCountryStories` -> `useArchiveDayMap` + `prediction_snapshot`.
- `useWeeklyArchive` -> `archive_range`; `useThreadAnalyses` -> `thread_analysis`; `useMarketsCountry` -> `markets_country`;
  `useDisruptionsList` -> `economic_impact_list` (off while parked).

## Docs
- Decisions: [0010](../../../../../project-docs/decisions/0010-country-view-split.md) (country view split by job),
  [0005](../../../../../project-docs/decisions/0005-one-importance-scale.md), [0009](../../../../../project-docs/decisions/0009-economy-parked.md)
- Plans: [colour](../../../../../project-docs/plans/PLAN_2026-10-19_colour_consistency.md)
- Rules: [SEVERITY_CODEBOOK.md](../../../../../project-docs/rules/SEVERITY_CODEBOOK.md)
- Runbooks: [country-intelligence.md](../../../../../project-docs/runbooks/country-intelligence.md), [country-facts.md](../../../../../project-docs/runbooks/country-facts.md),
  [drift-corrector.md](../../../../../project-docs/runbooks/drift-corrector.md), [systems-analysis.md](../../../../../project-docs/runbooks/systems-analysis.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/countries`
- One country served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"country_intelligence","payload":{"countryNames":["Japan"]}}' | head -c 300`
- Facts: same command with `-d '{"action":"country_facts","payload":{"countryNames":["Japan"]}}'`
- Daily job: `aws scheduler get-schedule --name countryIntelliegence --region ap-northeast-1 --query State`

Last verified: 2026-10-19
