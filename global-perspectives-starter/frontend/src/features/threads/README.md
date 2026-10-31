# threads

The Stories pages. A "thread" is one story arc followed across days. This folder holds the Stories page (`/weekly`, the name is
historical) and the story page (`/weekly/thread/:threadId`). Readers use `/weekly` to browse the last 30 days of stories as a list,
board, timeline, map or story web, and a story page to read one arc (story mode first, "Read in full" for the long tabbed page).

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the story page and the stories list. Timeline: rebuilds story history from raw tables; target: the story view (facts plus readings). See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live, public; signed-out reads work (no tier cap in the archive, thread or analysis reads).
- `ECONOMY_PARKED` (`@/shared/lib/economyFlag.js`) drops the Economy tab; `?tab=economy` falls back to Overview.

## Routes
- `/weekly` -> `WeeklyPage` (`?view=list|board|timeline|map|web|changes`, `?category=`; no `view` means list)
- `/weekly/thread/:threadId` -> `ThreadPage` (`?tab=` opens Read in full; `?from=country&country=`)
- Redirects (`src/app/LegacyRedirects.jsx`): `/weekly?section=countries` -> `/weekly/countries`; `/spider-demo` -> `/weekly?view=web`;
  `/breaking/:id` -> its thread when the alert has one

## Frontend
- `WeeklyPage.jsx` - Stories page; `components/Stories*.jsx` are its header, filters and the views (feed, board, timeline, web, changed-since-visit)
- `ThreadPage.jsx` - arc page; `components/StoryMode.jsx` (desktop) and `PhoneStoryMode.jsx` (phone); tabs Overview, Timeline, Actors, Sources
- `components/WeeklyMap.jsx` - map view (lazy); Google Maps when `window.GOOGLE_MAPS_API_KEY` is set, else `WeeklyFallbackMap`
- `components/ThreadForecast.jsx` (outcome wording: open / happened / not reported / awaiting check; the intro promises no check by a deadline, 0038), `ThreadIntelligence.jsx`, `FedIntoList.jsx`, `SharedActorsList.jsx` - forecast, analysis and story-link blocks
- `lib/storyGroups.js` (threads, groups, filters, sorts, `VISIT_KEY`); `storyWeb`, `webIndexLinks`, `linksFromView`, `storyLinks`, `linkStates` (story links)
- Public API (`index.js`): `useWeeklyArchive`, `useThreadAnalyses`, `useWebIndex`,
  `deriveFromIndex` (used by map). `WeeklyMap` is not exported: countries lazy-imports it by path.
- Imports from other features: `@/features/economy` -> `MechanismCard`, `useEconomicImpact` (ThreadPage only; never countries).
- Shared: `@/shared/lib/links.js` addresses, `EntityLink`, `@/shared/ui/deck.css` (deck shell shared with briefings).
  Country positions live in `@/shared/map/countryCoordinates.js`.
- Story page links: forecast questions -> `/track-record?q=<qid>`, "Show on map" -> `/?story=`. There is no link into the retired Studio.

## Backend
- Group guides: [pipeline](../../../../../backend/pipeline/README.md), [situations](../../../../../backend/situations/README.md),
  [predictions](../../../../../backend/predictions/README.md)
- `NewsProjectInvokeAgentLambda-dev` (Scheduler `InvokeNewsAgent`, 3x a day) writes topics, archive rows and thread ids;
  `newsThreadAnalysis` (rule `TriggerDailyAnalysis`, 04:40 UTC) writes thread analyses; `newsSystemsAnalysis`
  (`TriggerNewsSystemsAnalysis`, 05:00 UTC) writes the story web; `newsDriftCorrector` (`TriggerDriftCorrector`, 05:30 UTC) writes change notes.
  All are served by `newsSensitiveData-dev`.

## Data
- `useWeeklyArchive()` -> `archive_range` (30 days, auth header sent when signed in); localStorage `gp_weekly_archive_v1`, 30 min.
  It stores `uid` but does not check it on read. It needs `AuthProvider`.
- `useNarrativeThread(id)` -> the record's story view (`/data/record/views/stories/<id>.json`, decision 0042 step 4) for every day up to its `factsThrough`, plus `narrative_thread` for later days (the views rebuild nightly, the archive each agent run); no view yet means `narrative_thread` alone. `lib/viewEntries.js` maps view entries to the archive shape (entry notes become `ai` text as the archive held it). sessionStorage `gp_narrative_thread_v2_<id>`, 30 min.
- `useStoryAnalysis(id)` (the story page) -> the record's story view `analysis` (decision 0042 step 4: the latest story analysis note, in the shape `thread_analysis` returns, `@/shared/api/storyAnalysis.js`); no view or no analysis yet falls back to `thread_analysis`. sessionStorage `gp_story_analysis_v1_<id>`, 30 min. The map's story card reads the same way.
- `useThreadAnalyses(ids, { light })` -> `thread_analysis` (max 20 ids per call; the server slices longer lists), for many stories at once; localStorage `gp_thread_analyses_v2`, 30 min. `light` (Stories page, country page's arc list: they read only threadTitle, storyArc, watchQuestions, dimensions, riskScore, riskLevel) reads the record's analyses index instead (`/data/record/views/index/analyses.json`, one request for every story, no 20-id cap; `lib/analysesFromIndex.js`; memory 30 min) and falls back to the action when the index is missing or unreadable (reported). The map's thread panel (also reads trajectory, rootCauseChain, entryShortTitles) stays on the action. The index follows the record's `story_analysis` notes, so it can be one analysis generation behind the action until the analysis writer's notes go live.
- `useThreadForecast(topicIds, threadId)` -> the record's story view first (`lib/viewForecast.js` maps its forks, with question, scoring and state from decisions 0042/0043, to the snapshot shape for the page's topicIds), `prediction_snapshot` when the view yields nothing. Since 2026-10-31 (operator) a forecast stays with the story it was drawn for: a topic moved in from another story no longer brings that story's forecast (15 of 207 compared stories changed this way; the other 192 are identical).
- `useWebIndex(enabled, { source })` (Stories web view, the map's story card and arcs, the country page) -> the record's web view (`/data/record/views/index/web.json`: the whole story web in `web_index` shape, `lib/webIndexFromView.js`), the `web_index` action when the view is missing or unreadable (reported); memory 30 min. The view has no run `targets`, so `source: 'action'` (used by `useStoryLinks`, whose country_not_analysed wording needs the count) reads the action. Differences from the action, measured 2026-10-31: titles, entry counts and places follow the record's entries (a day behind the archive); `generatedAt` is the newest web's time; a pair judged both ways in one web may lose its second direction when the record's link note stores one (1 of 54 links); a pair two webs judge at the same strength shows the web that sorts first by country code.
- `useStoryLinks(id)` (the story page's "fed into": StoryMode, PhoneStoryMode, ThreadPage) -> the record's links view (`/data/record/views/links/<id>.json`: `judgedLinks` and `web`, decision 0042). `lib/linksFromView.js` (`indexFromView`) builds an index-shaped object from that one view so `deriveFromIndex` and `linkNote` run unchanged; tested against live captures (`lib/__tests__/fixtures/linksFromView.json`, 2026-10-31). A missing view (404), a failed read (reported as `links-view`) or a view without `web` falls back to `web_index`, and that to `systems_analysis` (max 3 regions) if it fails too. Known differences from the action: neighbour titles and the top place come from the record; the empty-state "Last refresh" date is the story's newest web (absent when it sits in no web); the view has no run-wide `targets.count`, so `web_index` is read only in the `country_not_analysed` state for the "N most-covered countries" wording; a story the record calls unknown (no web, no entry in 14 days) is "unknown" where the index said `single_update`; reverse-direction judged rows appear once the views are rebuilt. Still on `web_index`: the Stories web view (`StoriesWeb`) and the map (`SituationHome`) read the whole index (many stories at once). `useLastVisit` is localStorage only.

## Pipeline
1. RSS feeds -> `newsInvokeGemini-dev` (3x a day) selects topics -> NewsCache `staging`.
2. `NewsProjectInvokeAgentLambda-dev` assigns each topic a `threadId`, copies `staging` to `latest`, writes `archive#<date>` rows.
3. `newsThreadAnalysis` (daily) reads 30 days of archive -> `THREAD#<id>` / `THREAD_ANALYSIS`.
4. `newsSystemsAnalysis` (daily) -> `WEB#INDEX` / `LATEST` and `THREAD#<id>` / `WEB`.
5. `newsSensitiveData-dev` actions `archive_range`, `narrative_thread`, `thread_analysis`, `web_index`, `prediction_snapshot`.
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
