# home

"Today's Global Topics" (the old home; `/today` since the 2026-10-01 S6 swap): topics by region with
sources and on-demand Summary / Predict / Trace Cause cards, a deterministic lede band, a trust strip,
an earlier-today archive rail and a topic nav rail.

## Routes
- `/today` -> `Home` (eager import in src/app/App.jsx, not lazy)

## Entry files
- `Home.jsx` - page; per-topic AI buttons, retry loop, trust strip, region grouping
- `components/LedeBand.jsx` + `lib/composeTopicsLede.js` - pure, no-LLM "Today's lede" band
- `components/SummaryDisplay.jsx`, `PredictionDisplay.jsx`, `TraceCauseDisplay.jsx` - AI result cards
- `components/AiUnavailable.jsx` - honest "unavailable" card with Retry/Close; reports to error sink
- `components/TodayArchiveSidebar.jsx` + `ArchiveTopicModal.jsx` - archive rail and modal; `TopicNav.jsx` - right rail

## Data
- `useGeminiTopics()` (`@/shared/data`) -> restProxy `topics`, 1-hour cache.
- `useTodayArchive()` -> `contentService.getTodayArchive()` -> restProxy `today`; localStorage key
  `today_archive_cache_v1`, 10-minute TTL; an empty day is not cached.
- On click: `contentService.getTopicSummary`/`Prediction`/`TraceCause` -> `summary`/`prediction`/`trace_cause`.
- `useTrackRecord()` -> `prediction_track_record`; `useCorrectionsFeed(100)` -> `corrections_feed`.
- `useDisruptionsList({ limit: 100 })` -> economy disruption list, only when `!ECONOMY_PARKED`.

## Shared blocks used
- `EditorialShell`, `StatusStrip`, `SeverityBadge`, `SourceRobustness`, `StoryLink`, `boot/BootLoader`

## Public API (`index.js`)
- `Home` — the one page `app/App.jsx` imports eagerly

## Imports from other features
- `@/features/breaking` -> `BreakingStrip`; `@/features/track-record` -> `useTrackRecord`, `useCorrectionsFeed`
- From shared: `@/shared/ui/SubscribeCard`, `@/shared/hooks/useDisruptionsList`

## Gotchas
- `ECONOMY_PARKED` hides severity badges and "Economic impact" links; topics link to the story arc.
- Failures render inline (no modal) and go to `reportFetchError`; `__tests__/todayErrors.test.jsx`.
- Summary and Predict retry on cache miss/503 up to `MAX_RETRIES` (6), 10 s apart; Trace does not.
- Trust strip uses the server's corrections `total`, not `notes.length` (ledger is member-gated).
- `composeTopicsLede.js` keeps relative imports: `quality/briefing/verify_lede.mjs` loads it in Node.
- Masthead links to `/weekly-markets`, a retired route that redirects to `/briefings?from=markets`.

Last verified: 2026-10-19
