# home

Today, the page at `/today`: the news of the latest edition, one card per story. Each card shows the story the item starts or
moves, with its kind (starts a story, moves a story, measured change), how many steps the story has, and what we watch next. This
folder is called `home` because it was the home page until the map console took `/` on 2026-10-01 (the map lives in `features/map`).
Readers use it to scan the edition by kind and open a stored Summary, Prediction or Trace Cause for any item.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the today page (/today). Timeline: reads the record's today view (index/today.json) first and falls back to the topics and today actions when the view is missing, stale or cannot answer (decision 0051). See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live, public; nothing gates on sign-in. Today is a tab in the top bar and the phone tab bar, between Map and Stories (decision 0064, amends 0029).
- The economy product is retired (decision 0049): topics link to the story page, and the lede is picked from urgency, trending and source count.

## Routes
- `/today` -> `Home` (the one page `src/app/App.jsx` imports eagerly, through `index.js`)
- No redirects point here. The masthead has no markets link (economy retired, decision 0049).

## Frontend
- `Home.jsx` - the page: the promise sentence as its title (`ReaderPromise`), the count line, then cards grouped by kind, per-card Summary / Predict / Trace buttons, retry loop, trust strip. A card is one story (`StoryCard` pieces from `@/shared/ui`): kind chip, "since {date} · {n} steps", the story's first step, the steps in between and "Also today", the newest step, and "What we watch next" with a Track record link. The story's `name` (decision 0065), when set, is the title and the newest headline closes the step list; with no name the headline is the title. Groups: stories that moved, new stories that began, measured changes, then other items with no kind; on a phone a link jumps to the new stories. The old tagline and the figure boxes sit below the first group. Region grouping feeds the right rail only.
- `lib/composeTopicsLede.js` - a pure function with no LLM call that picks the lead story and the lede meta line. It keeps relative imports because `quality/briefing/verify_lede.mjs` loads it in Node
- `components/AiResultCard.jsx` - the one frame for a result (loading, unavailable, card); `SummaryDisplay`,
  `PredictionDisplay`, `TraceCauseDisplay` render inside it; `AiUnavailable` is the honest unavailable state with Retry / Close
- `components/TodayArchiveSidebar.jsx` + `ArchiveTopicModal.jsx` - the earlier-today rail and its modal (the archive keeps 1,500
  chars of a forecast / trace cause, so a cut note is read in full by topicId; none -> the tab is left out); `TopicNav.jsx` - right rail
- `lib/topics.js` - topic ids and region order (Home, TopicNav) and the stored-JSON parse of the result cards
- `lib/noForecast.js` - Predict says "no new forecast" at once when the today view shows the latest run wrote the topic without one (0038)
- `hooks/useTodayArchive.js` - the only hook in this folder
- Public API (`index.js`): `Home`
- Imports from other features: `@/features/track-record` -> `useTrackRecord`,
  `useCorrectionsFeed` (trust strip)
- Shared: `useGeminiTopics`, `contentService`, `EntityLink`, `@/shared/lib/links.js`
- Every count and card fact (`role`, `storyId`, `stories[storyId]`, `latest.roles`) is the builder's stamp from `index/today.json`; the page counts and derives nothing. Without the stamps (older view, or no view) the page shows one list in edition order with no step or watch lines.
- Failures render inline (no modal) and go to `reportFetchError` (an empty result counts as a failure; the archive rail says it could
  not load, with Retry). Summary and Predict retry on cache miss or 503 up to `MAX_RETRIES` (6), `RETRY_DELAY_MS` 10 s apart, stopped
  on Close and unmount; Trace Cause does not retry. Not reported: a failed topics fetch while a cached list is held (`useGeminiTopics`, shared).
- Links: a card title opens its story only with a real `threadId`; a country opens its page.

## Backend
- Group guides: [pipeline](../../../../../backend/pipeline/README.md), [predictions](../../../../../backend/predictions/README.md)
- `newsIngest` (Scheduler `InvokeGoogleGemini`, 04:15 / 12:15 / 20:15 UTC) picks the topics;
  `newsAgent` (Scheduler `InvokeNewsAgent`, 25 min later) writes summaries, trace causes and forecasts and
  publishes the list; `newsReadApi` serves the list data (forecasts and the track record come from the record views, not the proxy).

## Data
- The five calls below (`topics`, `today`, `summary`, `prediction`, `trace_cause`) go through `contentService`, which answers from the record's today view (`index/today.json`, `@/shared/api/todayView.js`, decision 0051) while the views are fresh (0050) and asks the action when the view is missing, stale, unreadable (reported as `today-view`) or cannot answer that call (a topic outside the latest run, a note the run did not write).
- `useGeminiTopics()` (`@/shared/data`) -> `topics` (asks for 13), plus the edition's `stories` (card per storyId) and `roles` (stories counted by kind) from the today view, null when the view has none; localStorage `gemini_topics_cache_v2`, 1-hour TTL, read only to flag staleness: the page waits for the network answer before showing topics.
- `useTodayArchive()` -> `contentService.getTodayArchive()` -> `today`; localStorage `today_archive_cache_v1`, 10 min; an empty day is not cached.
- On click: `contentService.getTopicSummary` / `getTopicPrediction` / `getTopicTraceCause` -> `summary` / `prediction` / `trace_cause`.
  These read stored results by `topicId`; nothing is generated on view.
- `useTrackRecord()` -> the record's `track-record.json` view only (decision 0044); `useCorrectionsFeed(100)` ->
  `corrections_feed` (the trust strip uses the server's `total`). Both hooks belong to `features/track-record`.

## Pipeline
1. RSS feeds -> `newsIngest` (3x a day) picks topics -> NewsCache `staging`.
2. `newsAgent` writes per-topic summary, trace cause and forecast to `SummarizeAndPredict` (`TOPIC#`), gives each topic a `threadId`.
3. It copies `staging` to NewsCache `latest` and adds the entries to `today-archive`.
4. `newsReadApi` action `topics` returns `latest`; action `today` returns `today-archive` entries from the last 24 hours.
5. `useGeminiTopics` -> `Home.jsx` merges the items of one story into one card, groups the cards by kind and renders them on `/today`.
6. A click calls `summary`, `prediction` or `trace_cause` -> `SummaryDisplay` / `PredictionDisplay` / `TraceCauseDisplay`.
7. Trust strip: `newsStoryRecord` builds `record/views/track-record.json` from the forecast facts -> `useTrackRecord` (no fallback).

## Docs
- Decisions: [0016](../../../../../project-docs/decisions/0016-map-console-is-home.md) (map is home, this moved to `/today`),
  [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md), [0049](../../../../../project-docs/decisions/0049-retire-economy.md),
  [0029](../../../../../project-docs/decisions/0029-today-kept-linked-from-map.md) (amended by 0064: Today is a tab),
  [0063](../../../../../project-docs/decisions/0063-story-kinds-start-move-measure.md), [0064](../../../../../project-docs/decisions/0064-reader-promise-story-and-step-today-tab.md), [0065](../../../../../project-docs/decisions/0065-story-name-from-the-weekly-review.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/home` (+ `node quality/briefing/verify_lede.mjs`)
- Topics served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"topics"}' | head -c 300`
- Selection schedule: `aws scheduler get-schedule --name InvokeGoogleGemini --region ap-northeast-1 --query State`

Last verified: 2026-11-20 (against the code)
