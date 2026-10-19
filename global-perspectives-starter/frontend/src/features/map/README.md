# map

The home page console (`/` since the 2026-10-01 swap): a globe (deck.gl) or radar (d3) world map of
tracked situations, with a status line, alert stack, intel feed, story card, legend, a SITUATIONS /
COUNTRY RISK layer switch and, on phones, tabs plus a bottom sheet.

## Status
- Live, public; map data never gates on sign-in. No feature flag. Radar behaviour per decision 0023.

## Routes
- `/` -> `SituationHome` (lazy; route fallback is `BootLoader` with `WAITING_SENSORS`)
- Redirects: `/map` -> `/` keeping query + hash (`src/app/MapRedirect.jsx`); `/breaking` -> `/`
- Query: `?focus=` (situation), `?story=` (topic), `?country=` (card), `?layer=`, `?about=` (About drawer)

## Frontend
- `SituationHome.jsx` - the console; selection state, boot sensors, layer/view switches; the globe
  `@/shared/map/SituationMap3D.jsx` is lazy (WebGL), `@/shared/map/RadarMap.jsx` is the radar
- `components/Hud*` (status line, brief, sensor, intel feed, compact line, country-risk feed), `AlertStack`,
  `StoryCard`, `MapLegend`, `MapAbout`, `OrientationBanner`; phone: `@/shared/ui/Tabs` + `@/shared/ui/BottomSheet`
- `lib/*.js` - alert stack, boot sensors, card mentions, gdacs status, HUD compact line, layer mode, phone sheet, story shading
- Map kit in `@/shared/map/` (shared with threads, track-record, analysis-studio, briefings): `legend`, `pulse`, `radar`,
  `globeSpin`, `storyLinkArcs`, `countryRiskLayer`, `gdacsLevel`, `landGeometry` …
- Public API (`index.js`): `HudStatusLine`, `useGdacsStatus`, `usePausedSince` (app layout), `WAITING_SENSORS` (route fallback)
- Imports from other features: `@/features/weekly-brief` -> `useWeeklyBrief`; `@/features/countries` -> `CountryCardV2`;
  `@/features/threads` -> `useWebIndex`, `deriveFromIndex`
- Situations not updated in 30+ days are hidden and counted, never dropped silently (`situationFreshness`).
  Boot sensors tick only on real data; the boot screen shows once per page load (`bootShown`).

## Backend
- Generated row: [reference/features.md#map](../../../../../project-docs/reference/features.md#map)
- `newsSituationTracker` (every 30 min) writes `world/latest.json`, `situations/state/` and the rest of the bundle;
  its inputs: `newsSituationIngest` (hourly; `stories/`, `corpus/`) and `newsGdacsIngest` (20 min; `situations/inbox/`);
  `newsCountryIntelligence` (daily)
  writes the country briefings behind the COUNTRY RISK layer.

## Data
- `useWorld()` -> `api/worldData.js` -> `/data/world/latest.json` (Worker `/data/*` -> S3), polled every 5 min;
  `useSituationDetail(id)` -> `/data/situations/state/<id>.json`. 404 = empty, not error. Dev: `VITE_WORLD_URL`.
- `useGeminiTopics()` (restProxy `topics`); `useStoryCardData` -> `summary` + `thread_analysis`.
- `useCountryRiskLayer` -> `country_intelligence` (15 names per call) over `useArchiveDayMap` (`archive_range`),
  only once the layer is selected; it avoids `useWeeklyArchive` (needs AuthProvider).
- `useDailyBrief()`, `useWeeklyBrief()`, `useWebIndex()` (`web_index`, only once a story is selected).
- localStorage: `gp_map_last_seen`, `gp_map_layer`, `gp_map_view`, `gp_map_legend_open`.

## Docs
- Decisions: [0016](../../../../../project-docs/decisions/0016-map-console-is-home.md), [0023](../../../../../project-docs/decisions/0023-radar-one-sweep-12h-window.md),
  [0022](../../../../../project-docs/decisions/0022-crisis-hues-option-a.md), [0013](../../../../../project-docs/decisions/0013-ds1-design-system-tier-never-a-colour.md)
- Plan: [colour consistency](../../../../../project-docs/plans/PLAN_2026-10-19_colour_consistency.md) (radar C6)
- Rules: [DATA_STRATEGY.md](../../../../../project-docs/rules/DATA_STRATEGY.md), [WORLD_MODEL.md](../../../../../project-docs/rules/WORLD_MODEL.md)
- Runbooks: [situation-tracker.md](../../../../../project-docs/runbooks/situation-tracker.md),
  [situation-ingest.md](../../../../../project-docs/runbooks/situation-ingest.md), [gdacs-ingest.md](../../../../../project-docs/runbooks/gdacs-ingest.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/map src/shared/map`
- Bundle fresh: `curl -s https://globalperspective.net/data/world/latest.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['generated_at'], d['stale'], len(d['situations']))"`
- Tracker: `aws events describe-rule --name TriggerSituationTracker --region ap-northeast-1 --query State`;
  `aws logs tail /aws/lambda/newsSituationTracker --since 1h --region ap-northeast-1`

Last verified: 2026-10-19
