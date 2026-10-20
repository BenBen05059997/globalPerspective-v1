# threads

The Stories pages. A "thread" is one story arc followed across days. This folder holds the Stories page (`/weekly`, the name is
historical) and the story page (`/weekly/thread/:threadId`). Readers use `/weekly` to browse the last 30 days of stories as a list,
board, timeline, map or story web, and a story page to read one arc (story mode first, "Read in full" for the long tabbed page).

Timeline: writes none; rebuilds story history from raw tables (`narrative_thread`, `archive_range`); target: Story view. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).

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
- `components/ThreadForecast.jsx`, `ThreadIntelligence.jsx`, `FedIntoList.jsx`, `SharedActorsList.jsx` - forecast, analysis and story-link blocks
- `lib/storyGroups.js` (threads, groups, filters, sorts, `VISIT_KEY`); `storyWeb`, `webIndexLinks`, `storyLinks`, `linkStates` (story links)
- Public API (`index.js`): `useWeeklyArchive`, `useThreadAnalyses`, `useWebIndex`,
  `deriveFromIndex` (used by map). `WeeklyMap` is not exported: countries lazy-imports it by path.
- Imports from other features: `@/features/economy` -> `MechanismCard`, `useEconomicImpact` (ThreadPage only; never countries).
- Shared: `@/shared/lib/links.js` addresses, `EntityLink`, `@/shared/ui/deck.css` (deck shell shared with briefings).
  Country positions live in `@/shared/map/countryCoordinates.js`.
- Story page links: forecast questions -> `/track-record?q=<qid>`, "Show on map" -> `/?story=`. There is no link into the retired Studio.

## Backend
- Generated row: [reference/features.md#threads](../../../../../project-docs/reference/features.md#threads)
- Group guides: [pipeline](../../../../../backend/pipeline/README.md), [situations](../../../../../backend/situations/README.md),
  [predictions](../../../../../backend/predictions/README.md)
- `NewsProjectInvokeAgentLambda-dev` (Scheduler `InvokeNewsAgent`, 3x a day) writes topics, archive rows and thread ids;
  `newsThreadAnalysis` (rule `TriggerDailyAnalysis`, 04:40 UTC) writes thread analyses; `newsSystemsAnalysis`
  (`TriggerNewsSystemsAnalysis`, 05:00 UTC) writes the story web; `newsDriftCorrector` (`TriggerDriftCorrector`, 05:30 UTC) writes change notes.
  All are served by `newsSensitiveData-dev`.

## Data
- `useWeeklyArchive()` -> `archive_range` (30 days, auth header sent when signed in); localStorage `gp_weekly_archive_v1`, 30 min.
  It stores `uid` but does not check it on read. It needs `AuthProvider`.
- `useNarrativeThread(id)` -> `narrative_thread`; sessionStorage `gp_narrative_thread_<id>`, 30 min.
- `useThreadAnalyses(ids)` -> `thread_analysis` (max 20 ids per call); localStorage `gp_thread_analyses_v2`, 30 min.
- `useThreadForecast(topicIds)` -> `prediction_snapshot`; `useWebIndex()` -> `web_index` (memory cache, 30 min).
- `useStoryLinks` calls `systems_analysis` (max 3 regions) only if `web_index` fails; `useLastVisit` is localStorage only.

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
- Plans: [consistency](../../../../../project-docs/plans/PLAN_2026-10-19_consistency_and_modernisation.md), [colour](../../../../../project-docs/plans/PLAN_2026-10-19_colour_consistency.md)
- Rules: [WORLD_MODEL.md](../../../../../project-docs/rules/WORLD_MODEL.md)
- Runbooks: [news-agent.md](../../../../../project-docs/runbooks/news-agent.md), [thread-analysis.md](../../../../../project-docs/runbooks/thread-analysis.md),
  [systems-analysis.md](../../../../../project-docs/runbooks/systems-analysis.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/threads`
- Archive served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"archive_range","payload":{"days":2}}' | head -c 300`
- Story web index: same command with `-d '{"action":"web_index"}'`
- Analysis job: `aws events describe-rule --name TriggerDailyAnalysis --region ap-northeast-1 --query State`

Last verified: 2026-10-20
