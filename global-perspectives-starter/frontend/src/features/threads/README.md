# threads

Story arcs. `/weekly`: threads from the 30-day archive as list, board, timeline, map or story web,
with filters, a "changed since your last visit" rail and a Countries tab. A thread page opens in
story mode; "Read in full" is the long tabbed page (Overview, Timeline, Actors, Sources).

## Routes
- `/weekly` -> `WeeklyPage` (`?section=countries`, `?view=list|board|timeline|map|web|changes`, `?category=`)
- `/weekly/thread/:threadId` -> `ThreadPage` (`?tab=`, `?from=country&country=`)
- Redirect: `/spider-demo` -> `/weekly?view=web`; `/breaking/:id` -> its thread when it has an arc

## Entry files
- `WeeklyPage.jsx` - Stories page; `components/Stories*.jsx` are its header, filters and views
- `ThreadPage.jsx` - arc page; `components/StoryMode.jsx` (desktop) / `PhoneStoryMode.jsx` (phone)
- `components/WeeklyMap.jsx` - map view (lazy); Google Maps when `window.GOOGLE_MAPS_API_KEY`, else `WeeklyFallbackMap`
- `lib/storyGroups.js` (threads, groups, filters, sorts); `storyWeb`, `webIndexLinks`, `storyLinks`, `linkStates` (links)

## Data
- `useWeeklyArchive()` -> restProxy `archive_range` (auth, 30 days); localStorage `gp_weekly_archive_v1`, 30 min.
- `useNarrativeThread(id)` -> `narrative_thread` (90-day by-ID rebuild); sessionStorage, 30 min.
- `useThreadAnalyses(ids)` -> `thread_analysis`; localStorage `gp_thread_analyses_v2`, 30 min.
- `useThreadForecast(topicIds)` -> `prediction_snapshot`; `useWebIndex()` -> `web_index` (memory, 30 min).
- `useStoryLinks` uses `systems_analysis` (max 3 regions) only if `web_index` fails; `useLastVisit` is localStorage only.

## Shared blocks used
- `EditorialShell`, `StatusStrip`, `StoryLink`, `StoryPeek`, `StoryRow`, `CategoryTag`, `TierChip`,
  `FilterGroup`, `SectionHeader`, `ShareButtons`, `CopyBriefing`, `SourceRobustness`, `risk/RiskScorecard`, `boot/BootLoader`

## Public API (`index.js`)
- `useWeeklyArchive` (analysis-studio, countries), `useThreadAnalyses`, `buildDeadlines`, `COUNTRY_COORDINATES` (countries),
  `useWebIndex`, `deriveFromIndex` (map). Not exported: `WeeklyMap` (countries lazy-imports it by path).

## Imports from other features
- `@/features/economy` -> `MechanismCard`, `useEconomicImpact`
- From shared: `@/shared/map/StoryMap.jsx`, `storyLinkArcs.js`, `landGeometry.js`; `@/shared/ui/BottomSheet.jsx`, `deck.css`, `SaveButton`,
  `QuestionChip`; `@/shared/lib/situationLabels.js`, `cardText.js`, `questionChips.js`, `questionStates.js`, `trFormatDate.js`
- The Countries section of `/weekly` arrives as the `countriesView` prop from `app/App.jsx`, so threads never imports countries.

## Gotchas
- ECONOMY_PARKED drops the Economy tab; `?tab=economy` falls back to Overview. Any `?tab=` opens Read in full.
- ThreadPage imports `WeeklyPage.css` on purpose (shared timeline/share classes on cold loads).
- `gp_weekly_archive_v1` stores `uid` but does not check it on read.
- Reused through `index.js` by `countries`, `analysis-studio` and `map`; the deck shell CSS is `@/shared/ui/deck.css`.

Last verified: 2026-10-19
