# briefings

`/briefings`: the daily and weekly briefs in briefing mode (map + horizontal slides + an editions
strip, the same console pattern as story mode). Desktop and phone layouts; a plain-text view of
the current edition. Slides are built only from fields the brief payload actually carries.

## Status
- Live, public. Weekly markets briefings are paused with economy (`?from=markets` shows a one-line
  "paused" note; no markets line is ever shown).

## Routes
- `/briefings` -> `BriefingsPage` (`?mode=weekly`, `?date=YYYY-MM-DD` for a daily edition, `?from=markets`)
- `/weekly-markets` redirects here as `/briefings?from=markets` (`MarketsRedirect`, src/app/LegacyRedirects.jsx)

## Frontend
- `BriefingsPage.jsx` - reads URL params, picks `BriefingMode` or `PhoneBriefingMode` via `useIsPhone`
- `components/BriefingMode.jsx` (desktop: map, slides, editions strip), `PhoneBriefingMode.jsx` (phone tabs)
- `components/BriefingSlides.jsx` - slide bodies (daily, weekly); next open question per story
- `components/EditionsStrip.jsx` - one mark per daily edition + pause range; `components/ReadAsText.jsx` - text version
- `lib/briefingSlides.js` (slide builders, link paths), `lib/editions.js` (pure date helpers)
- CSS: `BriefingsPage.css`, `components/BriefingMode.css`, `PhoneBriefingMode.css` over the shared deck shell `@/shared/ui/deck.css`
- Public API (`index.js`): `storyLinkPath`, `peekInputForStory` — used by `daily`
- Imports from other features: `@/features/weekly-brief` -> `useWeeklyBrief`. Shared: `@/shared/hooks/useDailyBrief`,
  `@/shared/map/StoryMap.jsx`, `StoryPeek`/`StoryLink` with `usePeek` + `@/shared/lib/peekData.js`
- Story links are built only when a `threadId` exists (daily topStories carry one since 2026-09-30).

## Backend
- Generated row: [reference/features.md#briefings](../../../../../project-docs/reference/features.md#briefings)
- `newsPostDevTo` (daily brief, 23:00 Asia/Tokyo) and `newsWeeklyBrief` (Sun 06:00 UTC) write the briefs to
  `SummarizeAndPredict`; `newsSensitiveData-dev` serves them.

## Data
- `useDailyBrief(date)` (`@/shared/hooks`) -> restProxy `daily_brief` / `latest_daily_brief` (localStorage `gp_daily_brief_v1`).
- `useWeeklyBrief()` -> `weekly_brief`: only the latest edition, so weekly has no editions strip.
- `useDailyEditionsIndex` -> `daily_brief` probes, at most 14 days (`LOOKBACK_DAYS`); sessionStorage
  `gp_briefings_daily_editions_v1`. A failed probe stays "unknown", never "no edition", and is reported once via `reportFetchError`.
- `useStoryQuestion(threadId)` -> `prediction_snapshot` with `{ threadId }`.

## Docs
- Decisions: [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md) (`/weekly-markets` redirect),
  [0013](../../../../../project-docs/decisions/0013-ds1-design-system-tier-never-a-colour.md)
- Plans: [consistency](../../../../../project-docs/plans/PLAN_2026-10-19_consistency_and_modernisation.md)
- Runbooks: [daily-brief.md](../../../../../project-docs/runbooks/daily-brief.md), [weekly-brief.md](../../../../../project-docs/runbooks/weekly-brief.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/briefings`
- Latest daily brief (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"latest_daily_brief","payload":{"lookbackDays":7}}' | head -c 300`
- Weekly: same command with `-d '{"action":"weekly_brief"}'`
- Daily job: `aws scheduler get-schedule --name InvokeDev --region ap-northeast-1 --query State`

Last verified: 2026-10-19
