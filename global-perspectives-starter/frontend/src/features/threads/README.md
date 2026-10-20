# threads

Story arcs ("Stories"). `/weekly`: threads from the 30-day archive as list, board, timeline, map or
story web, with filters, a "changed since your last visit" rail and a Countries link (`/weekly/countries`). A thread page
opens in story mode; "Read in full" is the long tabbed page (Overview, Timeline, Actors, Sources).

## Status
- Live, public (signed-out reads work; member depth caps are server-side).
- `ECONOMY_PARKED` (`@/shared/lib/economyFlag.js`) drops the Economy tab; `?tab=economy` falls back to Overview.

## Routes
- `/weekly` -> `WeeklyPage` (`?view=list|board|timeline|map|web|changes`, `?category=`)
- `/weekly/thread/:threadId` -> `ThreadPage` (`?tab=` opens Read in full; `?from=country&country=`)
- Redirects (src/app/LegacyRedirects.jsx): `/weekly?section=countries` -> `/weekly/countries`; `/spider-demo` -> `/weekly?view=web`; `/breaking/:id` -> its thread when it has one

## Frontend
- `WeeklyPage.jsx` - Stories page; `components/Stories*.jsx` are its header, filters and views
- `ThreadPage.jsx` - arc page; `components/StoryMode.jsx` (desktop) / `PhoneStoryMode.jsx` (phone)
- `components/WeeklyMap.jsx` - map view (lazy); Google Maps when `window.GOOGLE_MAPS_API_KEY`, else `WeeklyFallbackMap`
- `lib/storyGroups.js` (threads, groups, filters, sorts, `VISIT_KEY`); `storyWeb`, `webIndexLinks`, `storyLinks`, `linkStates` (links)
- Public API (`index.js`): `useWeeklyArchive` (analysis-studio, countries), `useThreadAnalyses`, `buildDeadlines` (countries), `useWebIndex`,
  `deriveFromIndex` (map). `WeeklyMap` is not exported: countries lazy-imports it by path (own chunk). Country
  positions (`COUNTRY_COORDINATES`) live in `@/shared/map/countryCoordinates.js`.
- Imports `@/features/economy` (`MechanismCard`, `useEconomicImpact`), never countries. Links: addresses from
  `@/shared/lib/links.js`; stories, countries (non-countries plain) and forecasts via `EntityLink`.
  Story page: forecast questions link to `/track-record?q=<qid>` (anchor `q-<qid>`), "Show on map" -> `/?story=`,
  "Analyze this arc" -> `/analyze?stories=<threadId>`. Stories map detail links the story and the live map.
- CSS: threads' `*.css` are imported only inside threads (ThreadPage and WeeklyMap import `WeeklyPage.css` for
  cold loads). The deck shell shared with analysis-studio and briefings is `@/shared/ui/deck.css`.

## Backend
- Generated row: [reference/features.md#threads](../../../../../project-docs/reference/features.md#threads)
- `NewsProjectInvokeAgentLambda-dev` (summaries, forecasts, archive), `newsThreadAnalysis` (thread analyses),
  `newsSystemsAnalysis` (story web: `WEB#INDEX` / `THREAD#<id>` `WEB`), `newsSituationTracker`; all served by `newsSensitiveData-dev`.

## Data
- `useWeeklyArchive()` -> restProxy `archive_range` (30 days; auth header when signed in); localStorage `gp_weekly_archive_v1`,
  30 min. It stores `uid` but does not check it on read.
- `useNarrativeThread(id)` -> `narrative_thread`; sessionStorage `gp_narrative_thread_<id>`, 30 min.
- `useThreadAnalyses(ids)` -> `thread_analysis`; localStorage `gp_thread_analyses_v2`, 30 min.
- `useThreadForecast(topicIds)` -> `prediction_snapshot`; `useWebIndex()` -> `web_index` (memory cache, 30 min).
- `useStoryLinks` calls `systems_analysis` (max 3 regions) only if `web_index` fails; `useLastVisit` is localStorage only.

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

Last verified: 2026-10-19
