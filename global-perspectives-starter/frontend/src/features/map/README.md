# map

The home page console (`/` since the 2026-10-01 S6 swap): a globe (deck.gl) or radar (d3) world map
of tracked situations, with a status line, alert stack, intel feed, story card, legend, a
SITUATIONS / COUNTRY RISK layer switch and, on phones, tabs plus a bottom sheet.

## Routes
- `/` -> `SituationHome` (lazy; route fallback is `BootLoader` with `WAITING_SENSORS`)
- Redirects: `/map` -> `/` keeping query + hash (src/app/MapRedirect.jsx); `/breaking` -> `/`
- Query: `?focus=` (situation), `?story=` (topic), `?country=` (card), `?layer=`, `?about=1` (About drawer)

## Entry files
- `SituationHome.jsx` - the console; selection state, boot sensors, layer/view switches
- Map kit in `@/shared/map/` (shared with threads, track-record, analysis-studio, briefings): `SituationMap3D.jsx` (globe, lazy,
  WebGL only), `RadarMap.jsx` (radar), `StoryMap.jsx` (deck map pane), `mapKit.css`, libs (`legend`, `pulse`, `radar`, `globe*`,
  `storyLinkArcs`, `landGeometry`, `countryGeo`, `countryRiskLayer`, `gdacsLevel`, `mapLabels`) + `countries-110m.json`
- `components/Hud*`, `AlertStack`, `StoryCard`, `MapLegend`, `MapAbout`, `OrientationBanner`; phone: `MapPhoneTabs`, `@/shared/ui/BottomSheet`
- `lib/*.js` - page helpers (alert stack, boot sensors, card mentions, HUD compact line, layer mode, phone sheet, story shading)

## Data
- `useWorld()` -> `api/worldData.js` -> `/data/world/latest.json` (Worker `/data/*`, S3), polled 5 min;
  `useSituationDetail(id)` -> `/data/situations/state/<id>.json`. 404 = empty, not error. Dev: `VITE_WORLD_URL`.
- `useGeminiTopics()` (restProxy `topics`); `useStoryCardData` -> `summary` + `thread_analysis`.
- `useCountryRiskLayer` -> `country_intelligence` (15 names per call) over `useArchiveDayMap`.
- `useDailyBrief()`, `useWeeklyBrief()`, `useWebIndex()` (`web_index`, only once a story is selected).
- localStorage: `gp_map_last_seen`, `gp_map_layer`, `gp_map_view`, `gp_map_legend_open`.

## Shared blocks used
- `StoryPeek`, `StoryLink`, `StoryRow`, `boot/BootLoader`, `boot/staticBoot` (`endFullBoot`); `usePeek`, `useIsPhone`

## Public API (`index.js`)
- `HudStatusLine`, `useGdacsStatus`, `usePausedSince` (app layout), `WAITING_SENSORS` (app route fallback)

## Imports from other features
- `@/features/weekly-brief` -> `useWeeklyBrief`; `@/features/countries` -> `CountryCardV2`
- `@/features/threads` -> `useWebIndex`, `deriveFromIndex`
- From shared: `@/shared/hooks/useDailyBrief`, `@/shared/ui/BottomSheet.jsx`, the map kit in `@/shared/map/` (see Entry files)

## Gotchas
- Situations not updated in 30+ days are hidden and counted, never dropped silently.
- `useCountryRiskLayer` avoids `useWeeklyArchive` (needs AuthProvider); map data never gates on auth.
- Boot sensors tick only on real data; the boot screen shows once per page load (`bootShown`).
- Only app/ imports this feature (through `index.js`); what other features reused moved to `@/shared/map` and `@/shared/lib`.

Last verified: 2026-10-19
