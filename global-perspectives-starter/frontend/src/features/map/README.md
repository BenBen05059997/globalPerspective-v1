# map

The front page of the site (`/`). This folder is called `map` because the page is a world-map console: a globe (deck.gl) or
radar (d3) of tracked situations, with a status line, alert stack, intel feed, story card and legend. Visitors use it to see
what is happening now and open a story or country from it. On phones it becomes tabs plus a bottom sheet.

## Status
- Live, public; map data never gates on sign-in. No feature flag and no economy gate in this folder.
- The SITUATIONS / COUNTRY RISK layer switch and the Globe / Radar switch are both live. Radar behaviour: decision 0023.

## Routes
- `/` -> `SituationHome` (lazy; the route fallback is `BootLoader` with `WAITING_SENSORS`)
- `/map` -> `/` keeping query and hash (`src/app/MapRedirect.jsx`); `/breaking` -> `/` (`app/LegacyRedirects.jsx`)
- Query (built by `mapHref` in `@/shared/lib/links.js`, read in `lib/deepLinks.js`): `?focus=<situation id>`, `?story=<threadId>`,
  `?country=<ISO3 or name>`, `?layer=`, `?about=`. An unknown story shows an honest "not on the map".

## Frontend
- `SituationHome.jsx` - the console: selection, boot sensors, layer and view state. Globe: `@/shared/map/SituationMap3D.jsx`
  (lazy); radar: `@/shared/map/RadarMap.jsx`
- `components/` - `Hud*` panels (status line, brief, sensor, intel feed, compact line, country-risk feed), `AlertStack`,
  `StoryCard`, `MapLegend`, `MapAbout`, `OrientationBanner`; phone uses `@/shared/ui/Tabs` and `BottomSheet`
- `api/worldData.js` - the only fetch of the world bundle; `hooks/` - `useWorld`, `useSituationDetail`,
  `useStoryCardData`, `useCountryRiskLayer`, `useGdacsStatus`, `usePausedSince`
- `lib/` - pure helpers: alert stack, boot sensors, deep links, card mentions, layer mode, phone sheet, story shading
- Public API (`index.js`): `HudStatusLine`, `useGdacsStatus`, `usePausedSince` (used by `app/layout/Layout.jsx`),
  `WAITING_SENSORS` (used by `app/App.jsx`)
- Imports from other features: `@/features/briefings` -> `useWeeklyBrief`; `@/features/countries` -> `CountryCardV2`;
  `@/features/threads` -> `useWebIndex`, `deriveFromIndex`
- Shared: `@/shared/map/*` (legend, radar, globe, country-risk layer), `useGeminiTopics`, `useDailyBrief`, `useArchiveDayMap`
- Situations with no change for 30+ days are hidden and counted, never dropped silently (`situationFreshness`).

## Backend
- Generated row: [reference/features.md#map](../../../../../project-docs/reference/features.md#map)
- Group guides: [situations](../../../../../backend/situations/README.md), [pipeline](../../../../../backend/pipeline/README.md)
- `newsGdacsIngest` (rule `TriggerGdacsIngest`, every 20 min) and `newsSituationIngest` (`TriggerSituationIngest`, hourly) feed
  `newsSituationTracker` (`TriggerSituationTracker`, every 30 min, live `DRY_RUN=false`), which writes `world/latest.json`.
- `newsInvokeGemini-dev` and `NewsProjectInvokeAgentLambda-dev` (Scheduler, 04:15 and 04:25 UTC then every 8 h) write the topics;
  `newsCountryIntelligence` (Scheduler `countryIntelliegence`, 05:15 UTC daily) writes the country briefings.

## Data
- `useWorld()` -> `/data/world/latest.json`, polled every 5 min while the tab is visible; `useSituationDetail(id)` ->
  `/data/situations/state/<id>.json`. A 404 is an empty state, not an error. Dev override: `VITE_WORLD_URL`. No sign-in.
- `useGdacsStatus` re-reads the same file (memory cache 5 min), only while analysis is paused.
- `useGeminiTopics()` -> `topics`; `useStoryCardData` -> `summary` and `thread_analysis`; `useWebIndex()` -> `web_index`
  (only once `?story=` is set); `useDailyBrief()` -> `latest_daily_brief`; `useWeeklyBrief()` -> `weekly_brief`.
- `useCountryRiskLayer` -> `archive_range` (via `useArchiveDayMap`) then `country_intelligence`, 15 names per call, up to 60
  countries, only once the COUNTRY RISK layer is selected. Session cache; it avoids `useWeeklyArchive`, which needs sign-in.
- localStorage: `gp_map_last_seen`, `gp_map_layer`, `gp_map_view`, `gp_map_legend_open`.

## Pipeline
1. gdacs.org -> `newsGdacsIngest` (20 min) -> S3 `situations/inbox/gdacs-latest.json`.
2. RSS feeds -> `newsSituationIngest` (hourly) -> S3 `stories/index.json` and `stories/state/`.
3. `NewsProjectInvokeAgentLambda-dev` writes `threads/story-map.json`, which links situations to story threads.
4. `newsSituationTracker` (30 min) folds 1-3 into `situations/state/<id>.json` and `world/latest.json`.
5. The Worker (`cloudflare/front-worker/production/worker.mjs`) serves `/data/*` from the private S3 bucket.
6. `fetchWorld` -> `useWorld` -> `SituationHome` -> globe or radar map, alert stack and intel feed on `/`.
7. Story shading: `newsInvokeGemini-dev` -> NewsCache `latest` -> `newsSensitiveData-dev` action `topics` -> `useGeminiTopics`.
8. Country risk layer: `newsCountryIntelligence` -> `COUNTRY#<name>` rows -> `country_intelligence` -> `useCountryRiskLayer`.

## Docs
- Decisions: [0016](../../../../../project-docs/decisions/0016-map-console-is-home.md), [0023](../../../../../project-docs/decisions/0023-radar-one-sweep-12h-window.md),
  [0022](../../../../../project-docs/decisions/0022-crisis-hues-option-a.md), [0013](../../../../../project-docs/decisions/0013-ds1-design-system-tier-never-a-colour.md)
- Plan: [colour consistency](../../../../../project-docs/plans/PLAN_2026-10-19_colour_consistency.md)
- Rules: [DATA_STRATEGY.md](../../../../../project-docs/rules/DATA_STRATEGY.md), [WORLD_MODEL.md](../../../../../project-docs/rules/WORLD_MODEL.md)
- Runbooks: [situation-tracker.md](../../../../../project-docs/runbooks/situation-tracker.md),
  [situation-ingest.md](../../../../../project-docs/runbooks/situation-ingest.md), [gdacs-ingest.md](../../../../../project-docs/runbooks/gdacs-ingest.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/map src/shared/map`
- Bundle fresh: `curl -s https://globalperspective.net/data/world/latest.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['generated_at'], d['stale'], len(d['situations']))"`
- Tracker: `aws events describe-rule --name TriggerSituationTracker --region ap-northeast-1 --query State`;
  `aws logs tail /aws/lambda/newsSituationTracker --since 1h --region ap-northeast-1`

Last verified: 2026-10-20
