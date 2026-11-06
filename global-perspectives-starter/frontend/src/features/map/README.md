# map

The front page of the site (`/`). This folder is called `map` because the page is a world-map console: a globe (deck.gl) or
radar (d3) of tracked situations, with a status line, alert stack (Alerts), intel feed (Intel), story card and legend. Visitors use it to see
what is happening now and open a story or country from it. On phones it becomes tabs plus a bottom sheet.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the home map (/). Timeline: reads world/latest.json from the map pipeline; target: a map view of the facts. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live, public; map data never gates on sign-in. No feature flag. The SITUATIONS / COUNTRY RISK layer switch and the Globe / Radar switch are both live. Radar behaviour: decision 0023.

## Routes
- `/` -> `SituationHome` (lazy; the route fallback is `BootLoader` with `WAITING_SENSORS`)
- `/map` -> `/` keeping query and hash (`src/app/MapRedirect.jsx`); `/breaking` -> `/` the same way (route in `app/App.jsx`, `MapRedirect`)
- Query (built by `mapHref` in `@/shared/lib/links.js`, read in `lib/deepLinks.js`): `?focus=<situation id>`, `?story=<threadId>`,
  `?country=<ISO3, ISO2 or name>` (an unknown code says so), `?layer=` (followed on every URL change). "Not on the map" / "no longer
  tracked" show only after the data really loaded without the id; while loading it says loading, after a failed load "unavailable".
  The detail file is fetched for the resolved situation id. A grouped situation answers to `aliases[]` for `?focus=` and every `threadIds[]` entry for `?story=` (`lib/threadKeys.js`).
## Frontend
- `SituationHome.jsx` - the console: selection, boot sensors, layer and view state. Globe: `@/shared/map/SituationMap3D.jsx`
  (lazy); radar: `@/shared/map/RadarMap.jsx`
- `components/` - `Hud*` panels (status line, brief, sensor, intel feed, compact line, country-risk feed), `AlertStack`,
  `StoryCard`, `MapLegend`, `MapAbout`, `OrientationBanner`; phone uses `@/shared/ui/Tabs` and `BottomSheet`
- `api/worldData.js` - the only fetch of the world bundle; `hooks/` - `useWorld`, `useSituationDetail`,
  `useStoryCardData`, `useCountryRiskLayer`, `useGdacsStatus`, `usePausedSince`
- `lib/` - pure helpers: alert stack, boot sensors, deep links, card mentions, layer mode, phone sheet, story shading, `threadKeys` (a situation's `threadId` plus `threadIds[]`; used by deep links and story shading, so a grouped situation shades its countries and hides its topics once)
- Public API (`index.js`): `HudStatusLine`, `useGdacsStatus`, `usePausedSince` (used by `app/layout/Layout.jsx`),
  `WAITING_SENSORS` (used by `app/App.jsx`)
- Imports from other features: `@/features/briefings` -> `useWeeklyBrief`; `@/features/countries` -> `CountryCardV2`;
  `@/features/threads` -> `useWebIndex`, `deriveFromIndex`
- Shared: `@/shared/map/*` (legend, radar, globe, country-risk layer), `useGeminiTopics`, `useDailyBrief`, `useArchiveDayMap`
- Situations with no change for 30+ days are hidden and counted, never dropped silently (`situationFreshness`). Exception: a GDACS alert the feed still lists (`listed: true` in the bundle) stays drawn as "older" however long since it changed; it leaves the map only when GDACS stops listing it and the tracker closes it.

## Backend
- Group guides: [situations](../../../../../backend/situations/README.md), [pipeline](../../../../../backend/pipeline/README.md)
- `newsGdacsIngest` (rule `TriggerGdacsIngest`, every 20 min) and `newsSituationIngest` (`TriggerSituationIngest`, hourly) feed
  `newsSituationTracker` (`TriggerSituationTracker`, every 30 min, live `DRY_RUN=false`), which writes `world/latest.json`.
- `newsIngest` and `newsAgent` (Scheduler, 04:15 and 04:25 UTC then every 8 h) write the topics;
  `newsCountryIntelligence` (Scheduler `countryIntelliegence`, 05:15 UTC daily) writes the country briefings.

## Data
- `useWorld()` -> `/data/world/latest.json`, polled every 5 min while the tab is visible; `useSituationDetail(id)` ->
  `/data/situations/state/<id>.json`. A 404 reads as unavailable. The one freshness stamp is the map file's age. Dev override: `VITE_WORLD_URL`. No sign-in.
- `useGdacsStatus` re-reads the same file (memory cache 5 min), only while analysis is paused.
- `useGeminiTopics()` -> `topics`; `useStoryCardData` -> `summary` and the story analysis (the record's story view `analysis`, `thread_analysis` as fallback, `@/shared/api/storyAnalysis.js`); `useWebIndex()` -> the record's web view (`index/web.json`), `web_index` as fallback
  (only once `?story=` is set); `useDailyBrief()` and `useWeeklyBrief()` -> the record's brief views, the `latest_daily_brief` / `weekly_brief` actions for what is newer (decision 0048).
- `useCountryRiskLayer` -> the 30-day archive (via `useArchiveDayMap`, the record's weekly index with `archive_range` for the newest days, decision 0046) for the candidate names, then the record's countries index
  (`index/countries.json`, one request; `@/shared/api/countryBriefingsIndex.js`), `country_intelligence` (15 names per call) only when the index is missing or unreadable (reported), up to 60
  countries, only once the COUNTRY RISK layer is selected. Session cache; public data, no sign-in.
- localStorage: `gp_map_last_seen`, `gp_map_layer`, `gp_map_view`, `gp_map_legend_open`.

## Pipeline
1. gdacs.org -> `newsGdacsIngest` (20 min) -> S3 `situations/inbox/gdacs-latest.json`.
2. RSS feeds -> `newsSituationIngest` (hourly) -> S3 `stories/index.json` and `stories/state/`.
3. `newsAgent` writes `threads/story-map.json`, which links situations to story threads.
4. `newsSituationTracker` (30 min) folds 1-3 into `situations/state/<id>.json` and `world/latest.json`.
5. The Worker (`cloudflare/front-worker/production/worker.mjs`) serves `/data/*` from the private S3 bucket.
6. `fetchWorld` -> `useWorld` -> `SituationHome` -> globe or radar map, Alerts and Intel on `/`. A first-load world failure (after one 1.5 s retry; hidden, leaving and automated pages are filtered in the sink) and every detail failure go to the error sink; a failed poll while a bundle is held stays silent (stale banner).

## Radar labels
`@/shared/map/mapLabels.js` places them, `RadarMap.jsx` draws them outside the zoomed group in screen pixels. Rule: HIGH and ELEVATED situations only, most severe first, then escalating, then newest change, at most 8 drawn. Each takes the first free spot (right, left, above, below the marker) that is inside the map, clear of other labels and of every marker; text width is measured with a canvas; labels over 220 px are ellipsized (full text in a `<title>`). The layout runs again on every zoom and pan. A label with no free spot is dropped; the pin and its Alerts row still carry the name.

## The two lists
- **Alerts** (`AlertStack.jsx`): the one list of situations; each plotted one is a real button (the keyboard twin of the pins). One row per situation (the tracker merges one event reported per country; situations that only share a story thread stay separate rows). One count everywhere: `openCount` in `SituationHome.jsx` is the number of Alerts rows, and the Alerts header, every "All situations (N)" button, the About list and the phone ALERTS badge all use it.
- **Grouped situations** (tracker `NEWS_GROUPING`): the card shows the lead title, then the other member titles (`also_reported_as[]`) under "Also reported as", a collapsed-by-default `aria-expanded` button, drawn only when non-empty and never on GDACS situations (`AlsoReported` in `SituationHome.jsx`). Grouping is live (`NEWS_GROUPING=true` since 2026-11-04); the rules live in the [tracker README](../../../../../backend/situations/newsSituationTracker/README.md).
- **Escape** (desktop): closes the open card and returns focus to its Alerts row (`data-situation-id`); the Key legend, About drawer, inputs and dialogs keep their own Escape. On phones the `BottomSheet` closes itself.
- **Intel** (`HudIntelFeed.jsx`): today's stories only, under the dated header, minus topics a situation carries (`topicsWithoutSituation`, the map shading's rule). A quiet day is fewer rows, no placeholder. Phone: LIST = Intel, ALERTS = Alerts.

## Docs
- Decisions: [0016](../../../../../project-docs/decisions/0016-map-console-is-home.md), [0023](../../../../../project-docs/decisions/0023-radar-one-sweep-12h-window.md),
  [0022](../../../../../project-docs/decisions/0022-crisis-hues-option-a.md), [0013](../../../../../project-docs/decisions/0013-ds1-design-system-tier-never-a-colour.md)
- Rules: [DATA_STRATEGY.md](../../../../../project-docs/architecture/DATA_STRATEGY.md), [WORLD_MODEL.md](../../../../../project-docs/architecture/WORLD_MODEL.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/map src/shared/map`
- Bundle fresh: `curl -s https://globalperspective.net/data/world/latest.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['generated_at'], d['stale'], len(d['situations']))"`
- Tracker: `aws events describe-rule --name TriggerSituationTracker --region ap-northeast-1 --query State`;
  `aws logs tail /aws/lambda/newsSituationTracker --since 1h --region ap-northeast-1`

Last verified: 2026-11-04 (news grouping live; 2026-11-03 round 2 fixes: counts, labels, wrapping; spread rule in `backend/situations/newsSituationIngest/README.md`)
