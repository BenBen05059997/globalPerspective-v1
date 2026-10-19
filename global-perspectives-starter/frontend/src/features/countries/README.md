# countries

Country views built from stored data only (no AI run on view): the country list with an overview
map, the per-country page (Situation / Story arcs / Coverage tabs), and `CountryCardV2`, the
one-screen country card the map console also mounts.

## Routes
- `/weekly/countries` -> `CountryListPage` (also embedded in `WeeklyPage` at `/weekly?section=countries`)
- `/weekly/country/:countryName` -> `CountryPage`

## Entry files
- `CountryListPage.jsx` - sortable country list (risk, coverage, A-Z; disruption sort only when economy is not parked)
- `CountryPage.jsx` - hero + map band, `CountryCardV2`, tabs, rails; phone READ / MAP tabs
- `components/CountryCardV2.jsx` - facts, summary, risk + direction, latest change, stories, triggers, FX
- `components/CountryWhatChanged.jsx`, `BackgroundTimeline.jsx`, `CountryOverviewMap.jsx` (Google Maps)
- `lib/` - pure helpers: `countryDirection`, `countryDrift`, `countryFacts`, `countryMacro`, `countryCurrency`, `countryTriggers`, `countryWatch`

## Data
- `useCountryIntelligence` -> restProxy `country_intelligence` (auth header when signed in), chunked per the backend's 15-name cap; localStorage `gp_country_intel_v1`, 30 min
- `useCountryHistory` -> `country_history`; `useCountryFacts` -> `country_facts`; `useCountryStories` -> `useArchiveDayMap` + `prediction_snapshot`
- `useWeeklyArchive` -> `archive_range`; `useThreadAnalyses` -> `thread_analysis`; `useMarketsCountry` -> `markets_country`; `useDisruptionsList` -> `economic_impact_list` (off while `ECONOMY_PARKED`)

## Shared blocks used
- `@/shared/ui/`: `EditorialShell`, `StatusStrip`, `SectionHeader`, `TierChip`, `CategoryTag`, `SeverityBadge`, `DirectionArrow`, `PhoneTabs`, `ShareButtons`, `CopyBriefing`, `StoryLink`, `risk/RiskScorecard`, `risk/RiskDeltaPill`, `boot/BootLoader`

## Imports from other features
- `@/features/threads/`: `hooks/useWeeklyArchive`, `hooks/useThreadAnalyses`, `components/WeeklyMap` (lazy), `components/QuestionChip`, `lib/questionChips`, `lib/storyMode` (`buildDeadlines`), `lib/mapConstants`, `WeeklyPage.css`
- `@/features/economy/hooks/useMarketsCountry`, `hooks/useDisruptionsList`
- `@/features/account/components/SaveButton`, `FollowButton`
- `@/features/map/lib/situationLabels.js` (`iso3ForName`), `lib/countryRiskLayer.js` (chunking constants)

## Gotchas
- `useParams()` already decodes `:countryName`; decoding again throws on names with `%`.
- `WeeklyMap` is lazy on purpose: a static import pulled it into the main chunk.
- `CountryCardV2` gets `situations` (watch flag) only from SituationHome; on `CountryPage` the flag is omitted.
- Economy disruption blocks and sort are hidden while `ECONOMY_PARKED`; `useMarketsCountry` is not gated.
- `CountryOverviewMap` needs `window.GOOGLE_MAPS_API_KEY`; without it it shows "Map unavailable".
- `hooks/useSystemsAnalysis.js` (`systems_analysis`) has no consumer outside its test.

Last verified: 2026-10-19
