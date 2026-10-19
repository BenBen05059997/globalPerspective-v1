# home

"Today's Global Topics" (the old home; `/today` since the 2026-10-01 swap to the map console): topics
by region with sources and on-demand Summary / Predict / Trace Cause cards, a deterministic lede band,
a trust strip, an earlier-today archive rail and a topic nav rail.

## Status
- Live, public. `ECONOMY_PARKED` (`@/shared/lib/economyFlag`): severity badges and "Economic impact" links are
  hidden, topics link to the story arc instead, and the disruption list is not fetched.

## Routes
- `/today` -> `Home` (the one page `src/app/App.jsx` imports eagerly, through `index.js`)

## Frontend
- `Home.jsx` - page; per-topic AI buttons, retry loop, trust strip, region grouping
- `components/LedeBand.jsx` + `lib/composeTopicsLede.js` - pure, no-LLM "Today's lede" band (`composeTopicsLede.js`
  keeps relative imports: `quality/briefing/verify_lede.mjs` loads it in Node)
- `components/AiResultCard.jsx` - the one frame for a Summary / Prediction / Trace result (loading, unavailable, card);
  `SummaryDisplay`, `PredictionDisplay`, `TraceCauseDisplay` render inside it; `AiUnavailable` is the honest
  unavailable state with Retry/Close
- `components/TodayArchiveSidebar.jsx` + `ArchiveTopicModal.jsx` - archive rail and modal; `TopicNav.jsx` - right rail
- Public API (`index.js`): `Home`
- Imports from other features: `@/features/breaking` -> `BreakingStrip`; `@/features/track-record` -> `useTrackRecord`,
  `useCorrectionsFeed`
- Failures render inline (no modal) and go to `reportFetchError`. Summary and Predict retry on cache miss/503 up to
  `MAX_RETRIES` (6), `RETRY_DELAY_MS` 10 s apart; Trace does not retry.
- The masthead no longer links to `/weekly-markets` (economy parked; decision 0031). The map's About drawer links here
  ("Read today's topics →", decision 0029). Links go through `@/shared/lib/links.js` / `EntityLink`: "Story arc" and
  titles open the thread (only with a `threadId`), a country its page (a region stays plain text).

## Backend
- Generated row: [reference/features.md#home](../../../../../project-docs/reference/features.md#home)
- `newsInvokeGemini-dev` (topic selection, Scheduler `InvokeGoogleGemini`) writes the topics to `NewsCache`;
  `NewsProjectInvokeAgentLambda-dev` writes summaries / predictions / trace to `SummarizeAndPredict`;
  `newsPredictionsSnapshot` writes `predictions/track_record.json`; `newsSensitiveData-dev` serves all of it.

## Data
- `useGeminiTopics()` (`@/shared/data`) -> restProxy `topics`; localStorage `gemini_topics_cache_v2`, 1-hour TTL.
- `useTodayArchive()` -> `contentService.getTodayArchive()` -> restProxy `today` (`today-archive` row); localStorage
  `today_archive_cache_v1`, 10-minute TTL; an empty day is not cached.
- On click: `contentService.getTopicSummary` / `getTopicPrediction` / `getTopicTraceCause` -> `summary` / `prediction` /
  `trace_cause`.
- `useTrackRecord()` -> `prediction_track_record`; `useCorrectionsFeed(100)` -> `corrections_feed` (the trust strip uses
  the server's `total`, not `notes.length`).
- `useDisruptionsList({ limit: 100 })` -> `economic_impact_list`, only when `!ECONOMY_PARKED`.

## Docs
- Decisions: [0016](../../../../../project-docs/decisions/0016-map-console-is-home.md) (map is home, this moved to `/today`),
  [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md), [0009](../../../../../project-docs/decisions/0009-economy-parked.md)
- Runbooks: [topic-selection.md](../../../../../project-docs/runbooks/topic-selection.md),
  [news-agent.md](../../../../../project-docs/runbooks/news-agent.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/home` (+ `node quality/briefing/verify_lede.mjs`)
- Topics served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"topics"}' | head -c 300`
- Selection schedule: `aws scheduler get-schedule --name InvokeGoogleGemini --region ap-northeast-1 --query State`

Last verified: 2026-10-19
