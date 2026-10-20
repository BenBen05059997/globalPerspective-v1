# home

"Today's Global Topics", the page at `/today`. This folder is called `home` because it was the home page until the map console took
`/` on 2026-10-01 (the map lives in `features/map`). Readers use it to scan the day's topics grouped by region, with their sources,
and to open a stored Summary, Prediction or Trace Cause for any topic.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Analysis → 4 One reader → 5 Timeline → **6 Views** → 7 Delivery → 8 Watch
This folder is stage 6: the today page (/today). Timeline: reads today's topics from raw tables; target: Today view. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live, public; nothing gates on sign-in. The map's About drawer links here (decision 0029).
- `ECONOMY_PARKED` (`@/shared/lib/economyFlag`, currently `true`): severity badges and "Economic impact" links are hidden, topics link
  to the story arc instead, and the disruption list is not fetched.

## Routes
- `/today` -> `Home` (the one page `src/app/App.jsx` imports eagerly, through `index.js`)
- No redirects point here. The masthead no longer links to `/weekly-markets` (economy parked, decision 0031).

## Frontend
- `Home.jsx` - the page: region grouping, per-topic Summary / Predict / Trace buttons, retry loop, trust strip
- `components/LedeBand.jsx` + `lib/composeTopicsLede.js` - the "Today's lede" band, a pure function with no LLM call.
  `composeTopicsLede.js` keeps relative imports because `quality/briefing/verify_lede.mjs` loads it in Node
- `components/AiResultCard.jsx` - the one frame for a result (loading, unavailable, card); `SummaryDisplay`,
  `PredictionDisplay`, `TraceCauseDisplay` render inside it; `AiUnavailable` is the honest unavailable state with Retry / Close
- `components/TodayArchiveSidebar.jsx` + `ArchiveTopicModal.jsx` - the earlier-today rail and its modal; `TopicNav.jsx` - right rail
- `hooks/useTodayArchive.js` - the only hook in this folder
- Public API (`index.js`): `Home`
- Imports from other features: `@/features/breaking` -> `BreakingStrip`; `@/features/track-record` -> `useTrackRecord`,
  `useCorrectionsFeed` (trust strip)
- Shared: `useGeminiTopics`, `contentService`, `useDisruptionsList`, `EntityLink`, `@/shared/lib/links.js`
- Failures render inline (no modal) and go to `reportFetchError`. Summary and Predict retry on cache miss or 503 up to `MAX_RETRIES`
  (6), `RETRY_DELAY_MS` 10 s apart; Trace Cause does not retry.
- Links: a topic title opens its story only with a real `threadId`; a country opens its page.

## Backend
- Generated row: [reference/features.md#home](../../../../../project-docs/reference/features.md#home)
- Group guides: [pipeline](../../../../../backend/pipeline/README.md), [predictions](../../../../../backend/predictions/README.md)
- `newsInvokeGemini-dev` (Scheduler `InvokeGoogleGemini`, 04:15 / 12:15 / 20:15 UTC) picks the topics;
  `NewsProjectInvokeAgentLambda-dev` (Scheduler `InvokeNewsAgent`, 25 min later) writes summaries, trace causes and forecasts and
  publishes the list; `newsPredictionsSnapshot` (every 30 min) writes the track record; `newsSensitiveData-dev` serves all of it.

## Data
- `useGeminiTopics()` (`@/shared/data`) -> `topics` (asks for 13); localStorage `gemini_topics_cache_v2`, 1-hour TTL. A stale cache is served and flagged.
- `useTodayArchive()` -> `contentService.getTodayArchive()` -> `today`; localStorage `today_archive_cache_v1`, 10 min; an empty day is not cached.
- On click: `contentService.getTopicSummary` / `getTopicPrediction` / `getTopicTraceCause` -> `summary` / `prediction` / `trace_cause`.
  These read stored results by `topicId`; nothing is generated on view.
- `useTrackRecord()` -> `prediction_track_record`; `useCorrectionsFeed(100)` -> `corrections_feed` (the trust strip uses the server's `total`).
- `useDisruptionsList({ limit: 100 })` -> `economic_impact_list`, only when `!ECONOMY_PARKED`.

## Pipeline
1. RSS feeds -> `newsInvokeGemini-dev` (3x a day) picks topics -> NewsCache `staging`.
2. `NewsProjectInvokeAgentLambda-dev` writes per-topic summary, trace cause and forecast to `SummarizeAndPredict` (`TOPIC#`), gives each topic a `threadId`.
3. It copies `staging` to NewsCache `latest` and adds the entries to `today-archive`.
4. `newsSensitiveData-dev` action `topics` returns `latest`; action `today` returns `today-archive` entries from the last 24 hours.
5. `useGeminiTopics` -> `Home.jsx` groups by region and renders the topic cards on `/today`.
6. A click calls `summary`, `prediction` or `trace_cause` -> `SummaryDisplay` / `PredictionDisplay` / `TraceCauseDisplay`.
7. Trust strip: `newsPredictionsSnapshot` -> S3 `predictions/track_record.json` -> `prediction_track_record` -> `useTrackRecord`.

## Docs
- Decisions: [0016](../../../../../project-docs/decisions/0016-map-console-is-home.md) (map is home, this moved to `/today`),
  [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md), [0009](../../../../../project-docs/decisions/0009-economy-parked.md),
  [0029](../../../../../project-docs/decisions/0029-today-kept-linked-from-map.md)
- Runbooks: [topic-selection.md](../../../../../project-docs/runbooks/topic-selection.md),
  [news-agent.md](../../../../../project-docs/runbooks/news-agent.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/home` (+ `node quality/briefing/verify_lede.mjs`)
- Topics served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"topics"}' | head -c 300`
- Selection schedule: `aws scheduler get-schedule --name InvokeGoogleGemini --region ap-northeast-1 --query State`

Last verified: 2026-10-20
