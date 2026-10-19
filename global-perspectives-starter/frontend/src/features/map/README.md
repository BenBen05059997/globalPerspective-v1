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
- `components/SituationMap3D.jsx` (globe, lazy, WebGL only) / `RadarMap.jsx` (radar view)
- `components/Hud*`, `AlertStack`, `StoryCard`, `MapLegend`, `MapAbout`, `OrientationBanner`; phone: `MapPhoneTabs`, `BottomSheet`
- `components/SituationMap.jsx` - constants only (`AXIS_HUE`), re-exports `land`/`FRAME`
- `lib/*.js` - pure helpers (labels, legend, alert stack, radar, globe spin, boot sensors, risk layer)

## Data
- `useWorld()` -> `api/worldData.js` -> `/data/world/latest.json` (Worker `/data/*`, S3), polled 5 min;
  `useSituationDetail(id)` -> `/data/situations/state/<id>.json`. 404 = empty, not error. Dev: `VITE_WORLD_URL`.
- `useGeminiTopics()` (restProxy `topics`); `useStoryCardData` -> `summary` + `thread_analysis`.
- `useCountryRiskLayer` -> `country_intelligence` (15 names per call) over `useArchiveDayMap`.
- `useDailyBrief()`, `useWeeklyBrief()`, `useWebIndex()` (`web_index`, only once a story is selected).
- localStorage: `gp_map_last_seen`, `gp_map_layer`, `gp_map_view`, `gp_map_legend_open`.

## Shared blocks used
- `StoryPeek`, `StoryLink`, `StoryRow`, `boot/BootLoader`, `boot/staticBoot` (`endFullBoot`); `usePeek`, `useIsPhone`

## Imports from other features
- `daily/hooks/useDailyBrief`, `weekly-brief/hooks/useWeeklyBrief`, `countries/components/CountryCardV2`
- `threads/hooks/useWebIndex`, `threads/lib/webIndexLinks` (`deriveFromIndex`)

## Gotchas
- Situations not updated in 30+ days are hidden and counted, never dropped silently.
- `useCountryRiskLayer` avoids `useWeeklyArchive` (needs AuthProvider); map data never gates on auth.
- Boot sensors tick only on real data; the boot screen shows once per page load (`bootShown`).
- Imported widely: app layout (`HudStatusLine`, `useGdacsStatus`, `usePausedSince`), App (`bootSensors`), threads, track-record, countries, account, analysis-studio, briefings.

Last verified: 2026-10-19
