# threads

The Stories pages. A "thread" is one story arc followed across days. This folder holds the Stories page (`/weekly`, the name is
historical) and the story page (`/weekly/thread/:threadId`). Readers use `/weekly` to browse the last 30 days of stories as a list,
board, timeline, map or story web, and a story page to read one arc (story mode first, "Read in full" for the long tabbed page).

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the story page and the stories list. Timeline: reads the story view (timeline, analysis, forecast, links) and the index views for the lists; the actions fill the newest days and what no view holds yet. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live, public; signed-out reads work (no tier cap in the archive, thread or analysis reads); neither page waits for sign-in.
- No Economy tab (retired, decision 0049); an old `?tab=economy` link falls back to Overview.

## Routes
- `/weekly` -> `WeeklyPage` (`?view=list|board|timeline|map|web|changes`, `?category=`, filters `?q= ?crisis= ?tiers= ?region= ?window= ?sort=`; no `view` means list; a view change pushes a history entry, everything else replaces)
- `/weekly/thread/:threadId` -> `ThreadPage` (`?tab=` opens Read in full; `?from=country&country=`)
- Redirects (`src/app/LegacyRedirects.jsx`): `/weekly?section=countries` -> `/weekly/countries`; `/spider-demo` -> `/weekly?view=web`;
  `/breaking/:id` -> its thread when the alert has one

## Frontend
- `WeeklyPage.jsx` - Stories page; `components/Stories*.jsx` are its header, filters and the views (feed, board, timeline, web, changed-since-visit)
- `ThreadPage.jsx` - arc page; `components/StoryMode.jsx` (desktop) and `PhoneStoryMode.jsx` (phone); tabs Overview, Timeline, Actors, Sources
- `components/WeeklyMap.jsx` - map view (lazy); Google Maps when `window.GOOGLE_MAPS_API_KEY` is set, else `WeeklyFallbackMap`
- `components/ThreadForecast.jsx` (outcome wording: open / happened / not reported / awaiting check; the intro promises no check by a deadline, 0038), `ThreadIntelligence.jsx`, `FedIntoList.jsx`, `SharedActorsList.jsx` - forecast, analysis and story-link blocks
- `lib/storyGroups.js` (threads, groups, filters, sorts, `VISIT_KEY`; day maths is on the UTC calendar because archive day keys are UTC days; `buildThreads(dayMap, sortedDates, now, titles)` sets `latestTitle` to the record's `titles[threadId]`; only on the `archive_range` action path (no titles) it falls back to the story's newest day's first entry, the one place the frontend picks a title; it drops re-dated repeats with the shared `dropRedatedRepeats`, as the story page does). The story page's title is the story view's `title`, else the list's, else the humanised id; `storyWeb`, `webIndexLinks`, `linksFromView`, `storyLinks`, `linkStates` (story links)
- Day counts: one measure, one wording (`daysWithNews`: "N days with news" = distinct days that carry a headline) on the list, timeline, map, story mode and Read in full; the date range is shown separately. The lists count only the weekly index's 30 days and say so once for both counts (`listCounts`: "In 30 days: 25 events, 13 days with news"; the timeline shows days only, "13 days with news in 30 days", `ARCHIVE_DAYS`); the story page counts all the story's days ("24 days with news"). The list counts the weekly index's archive days, the story page counts the story view's entry dates; the two key the same headline on different days (a headline filed on archive day D can carry record date D-1 to D-3), so the same story can differ by 1 to 3 until the index is keyed like the view.
- Public API (`index.js`): `useWeeklyArchive`, `useThreadAnalyses`, `useWebIndex`,
  `deriveFromIndex` (used by map). `WeeklyMap` is not exported: countries lazy-imports it by path.
- Shared: `@/shared/lib/links.js` addresses, `EntityLink`, `@/shared/ui/deck.css` (deck shell shared with briefings).
  Country positions live in `@/shared/map/countryCoordinates.js`.
- Story page links: forecast questions -> `/track-record?q=<qid>`, "Show on map" -> `/?story=`. There is no link into the retired Studio.

## Backend
- Group guides: [pipeline](../../../../../backend/pipeline/README.md), [situations](../../../../../backend/situations/README.md),
  [predictions](../../../../../backend/predictions/README.md)
- `newsAgent` (Scheduler `InvokeNewsAgent`, 3x a day) writes topics, archive rows and thread ids;
  `newsThreadAnalysis` (rule `TriggerDailyAnalysis`, 04:40 UTC) writes thread analyses; `newsSystemsAnalysis`
  (`TriggerNewsSystemsAnalysis`, 05:00 UTC) writes the story web; `newsDriftCorrector` (`TriggerDriftCorrector`, 05:30 UTC) writes change notes.
  All are served by `newsSensitiveData-dev`.

## Data
- `useWeeklyArchive()` -> `loadArchive` (`shared/api/archiveRange.js`, decision 0046; `loadArchiveDayMap` is its day map alone, for the countries and map readers): the record's weekly index (`/data/record/views/index/weekly.json`) for every day, today included (decision 0050: the views are rebuilt after each ingest). Only when the views are not fresh (`shared/api/viewsFresh.js`: manifest `builtAt` over 9 h old, missing or unreadable; reported) does it ask `archive_range` for the newest recorded day and after; all 30 days come from the action when the index is missing or unreadable (reported); localStorage `gp_weekly_archive_v4` (`useCachedQuery`; the cached value is `{ dayMap, titles }`), 30 min. It reads no sign-in state and needs no `AuthProvider`; the page does not wait for sign-in. A failed load is reported (`weekly-archive`), not cached, and `/weekly` says the archive is unavailable with a retry. `titles` is the index's `{ threadId: title }` (the record's one title per story, `titleOf` in newsStoryRecord), null when the index has none or the action answered. Returns `{ dayMap, titles, sortedDates, loading, error, dataUpdatedAt, refetch }`.
- `useNarrativeThread(id)` -> the record's story view (`/data/record/views/stories/<id>.json`, decision 0042 step 4) alone while the views are fresh (they carry today's entries, `provisional` until the nightly run, decision 0050); no view for the story, or stale views, add `narrative_thread` for the days after the view's `factsThrough`/`provisionalThrough` (or answer alone with no view). `lib/viewEntries.js` maps view entries to the archive shape (entry notes become `ai` text as the archive held it). Returns `title` too, the story view's own `title` (null with no view or no entries). sessionStorage `gp_narrative_thread_v3_<id>` (`{ entries, title }`), 30 min; an empty answer is not cached. A failed read is reported (`narrative-thread`) and the page says the story could not be loaded (with Try again); "Story arc not found" only after a successful empty answer.
- `useStoryAnalysis(id)` (the story page) -> the record's story view `analysis` (decision 0042 step 4: the latest story analysis note, in the shape `thread_analysis` returns, `@/shared/api/storyAnalysis.js`); no view or no analysis yet falls back to `thread_analysis`. sessionStorage `gp_story_analysis_v1_<id>`, 30 min; a failed read is reported (`story-analysis`). The map's story card reads the same way.
- `useThreadAnalyses(ids, { light })` (returns `{ analyses, loading, failed }`; `failed` = the action could not be read, reported as `thread-analyses`; the Stories header then says "scores unavailable" instead of "not yet scored") -> `thread_analysis` (max 20 ids per call; the server slices longer lists), for many stories at once; localStorage `gp_thread_analyses_v2`, 30 min. `light` (Stories page, country page's arc list: they read only threadTitle, storyArc, watchQuestions, dimensions, riskScore, riskLevel) reads the record's analyses index instead (`/data/record/views/index/analyses.json`, one request for every story, no 20-id cap; `lib/analysesFromIndex.js`; memory 30 min) and falls back to the action when the index is missing or unreadable (reported). The map's thread panel (also reads trajectory, rootCauseChain, entryShortTitles) stays on the action. The index follows the record's `story_analysis` notes, so it can be one analysis generation behind the action until the analysis writer's notes go live.
- `useThreadForecast(topicIds, threadId)` -> the record only (decision 0052): `recordForecast` (`shared/api/forecastViews.js`) reads the story's `forecasts/<threadId>.json` view while the views are fresh and maps its forks (question, scoring, state; today's forecasts are provisional forks) to the snapshot shape for the page's topicIds (`shared/lib/forecastFromView.js`). Stale views, an unreadable file or a story with no thread give no forecast (reported by `viewsFresh` / `forecastViews`); no `prediction_snapshot` fallback. `topicIds` null asks for the story's forecast whole: a story with a forecast but no entries on record (no topics) shows it under the humanised id with "No news entries are on record for this story", never "Story arc not found". Since 2026-10-31 (operator) a forecast stays with the story it was drawn for: a topic moved in from another story no longer brings that story's forecast (15 of 207 compared stories changed this way; the other 192 are identical).
- `useWebIndex(enabled, { source })` (Stories web view, the map's story card and arcs, the country page) -> the record's web view (`/data/record/views/index/web.json`: the whole story web in `web_index` shape, `lib/webIndexFromView.js`), the `web_index` action when the view is missing or unreadable (reported); memory 30 min. The view has no run `targets`, so `source: 'action'` (used by `useStoryLinks`, whose country_not_analysed wording needs the count) reads the action. Differences from the action, measured 2026-10-31: titles, entry counts and places follow the record's entries (a day behind the archive); `generatedAt` is the newest web's time; a pair judged both ways in one web may lose its second direction when the record's link note stores one (1 of 54 links); a pair two webs judge at the same strength shows the web that sorts first by country code.
- `useStoryLinks(id)` (the story page's "fed into": StoryMode, PhoneStoryMode, ThreadPage) -> the record's links view (`/data/record/views/links/<id>.json`: `judgedLinks` and `web`, decision 0042). `lib/linksFromView.js` (`indexFromView`) builds an index-shaped object from that one view so `deriveFromIndex` and `linkNote` run unchanged; tested against live captures (`lib/__tests__/fixtures/linksFromView.json`, 2026-10-31). A missing view (404), a failed read (reported as `links-view`) or a view without `web` falls back to `web_index`, and that to `systems_analysis` (max 3 regions) if it fails too. Known differences from the action: neighbour titles and the top place come from the record; the empty-state "Last refresh" date is the story's newest web (absent when it sits in no web); the view has no run-wide `targets.count`, so `web_index` is read only in the `country_not_analysed` state for the "N most-covered countries" wording; a story the record calls unknown (no web, no entry in 14 days) is "unknown" where the index said `single_update`; reverse-direction judged rows appear once the views are rebuilt. Still on `web_index`: the Stories web view (`StoriesWeb`) and the map (`SituationHome`) read the whole index (many stories at once). `useLastVisit` is localStorage only.

## Pipeline
1. RSS feeds -> `newsIngest` (3x a day) selects topics -> NewsCache `staging`.
2. `newsAgent` assigns each topic a `threadId`, copies `staging` to `latest`, writes `archive#<date>` rows.
3. `newsThreadAnalysis` (daily) reads 30 days of archive -> `THREAD#<id>` / `THREAD_ANALYSIS`.
4. `newsSystemsAnalysis` (daily) -> `WEB#INDEX` / `LATEST` and `THREAD#<id>` / `WEB`.
5. `newsSensitiveData-dev` actions `archive_range`, `narrative_thread`, `thread_analysis`, `web_index`.
6. Hooks `useWeeklyArchive`, `useNarrativeThread`, `useThreadAnalyses`, `useWebIndex`, `useThreadForecast`.
7. `WeeklyPage` on `/weekly` and `ThreadPage` on `/weekly/thread/:threadId`.

## Docs
- Decisions: [0012](../../../../../project-docs/decisions/0012-story-web-is-news-based.md) (story web is news-based),
  [0018](../../../../../project-docs/decisions/0018-spider-demo-retired-into-stories-web.md) (spider-demo -> WEB view),
  [0004](../../../../../project-docs/decisions/0004-developments-kept-demoted.md), [0013](../../../../../project-docs/decisions/0013-ds1-design-system-tier-never-a-colour.md)
- Rules: [WORLD_MODEL.md](../../../../../project-docs/architecture/WORLD_MODEL.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/threads`
- Archive served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"archive_range","payload":{"days":2}}' | head -c 300`
- Story web index: same command with `-d '{"action":"web_index"}'`
- Analysis job: `aws events describe-rule --name TriggerDailyAnalysis --region ap-northeast-1 --query State`

Last verified: 2026-10-31
