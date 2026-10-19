# daily

`/daily`: the Daily Intelligence Brief as a long-form page (big picture, top stories, story and
country to watch, shape of the day, full analysis) with previous/next date navigation. Its data hook
`useDailyBrief` lives in `@/shared/hooks` because many other surfaces read the latest brief.

## Status
- Live; public for the latest brief (past dates send the auth token when there is one).
- `ECONOMY_PARKED` (`@/shared/lib/economyFlag`): the Economic footprint block is not mounted.

## Routes
- `/daily` -> `DailyPage` (lazy; latest available brief)
- `/daily/:dateKey` -> `DailyPage` (a specific date)

## Frontend
- `DailyPage.jsx` - date nav, masthead, numbered sections, share / copy / save controls; local `EconomicFootprint`
- `@/shared/hooks/useDailyBrief.js` - `useDailyBrief(dateKey)`, `loadLatestDailyBrief()`, `MAX_LOOKBACK_DAYS` (30);
  also used by map (`SituationHome`, `usePausedSince`), static About, account (Account, DeskPanel) and briefings —
  a change there hits them all.
- Public API: no `index.js`; only `app/App.jsx` imports the page (lazy, by path).
- Imports from other features: `@/features/briefings` -> `storyLinkPath`, `peekInputForStory`; `@/features/economy` ->
  `InstrumentChip`. Trajectory comes from `@/shared/lib/trajectory` (`trajectoryOf`), not from countries.
- The served brief may be older than the requested date; date arrows step from the served date and the page says
  when the edition is not today's. The rising-thread card uses `StoryLink` only for ids starting `thread-`.

## Backend
- Generated row: [reference/features.md#daily](../../../../../project-docs/reference/features.md#daily)
- `newsPostDevTo` (Scheduler `InvokeDev`, 23:00 Asia/Tokyo; it no longer posts to dev.to) writes `DAILY_BRIEF#<date>` /
  `DAILY_BRIEF` to `SummarizeAndPredict`; `newsSensitiveData-dev` serves it.

## Data
- No date: restProxy `latest_daily_brief` (one call; the server walks back `lookbackDays`, 30).
- Explicit date: restProxy `daily_brief`, walking back in batches of 10.
- Cache: localStorage `gp_daily_brief_v1` (30-minute TTL, last 7 dates) and `gp_daily_brief_last_found_v1`; one
  in-flight promise per date shared across hook instances; "nothing found" is cached too (no rescan per page load).
- Economic footprint: `useDisruptionsList` (restProxy `economic_impact_list`), disabled while `ECONOMY_PARKED`.

## Docs
- Runbook: [daily-brief.md](../../../../../project-docs/runbooks/daily-brief.md)
- Decisions: [0009](../../../../../project-docs/decisions/0009-economy-parked.md) (economy parked: footprint hidden)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/daily src/shared/hooks/__tests__/useDailyBrief.test.js`
- Latest brief served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"latest_daily_brief","payload":{"lookbackDays":30}}' | head -c 300`
- Job ran: `aws logs tail /aws/lambda/newsPostDevTo --since 2d --region ap-northeast-1 --filter-pattern '"[DAILY_BRIEF] Stored for"'`
- Schedule: `aws scheduler get-schedule --name InvokeDev --region ap-northeast-1 --query State`

Last verified: 2026-10-19
