# briefings

`/briefings`: the daily and weekly briefs in briefing mode (map + horizontal slides + an editions
strip, the same console pattern as story mode). Desktop and phone layouts; a plain-text view of
the current edition. Slides are built only from fields the brief payload actually carries.

## Routes
- `/briefings` -> `BriefingsPage` (`?mode=weekly`, `?date=YYYY-MM-DD` for a daily edition)
- `/weekly-markets` redirects here as `/briefings?from=markets` (`MarketsRedirect`, src/app/LegacyRedirects.jsx)

## Entry files
- `BriefingsPage.jsx` - reads URL params, picks `BriefingMode` or `PhoneBriefingMode` via `useIsPhone`
- `components/BriefingMode.jsx` (desktop: map, slides, editions strip), `PhoneBriefingMode.jsx` (phone: READ / MAP / EDITIONS tabs)
- `components/BriefingSlides.jsx` - slide bodies (daily, weekly); next open question per story
- `components/EditionsStrip.jsx` - one mark per daily edition + pause range; `WeeklyEditionNote`
- `components/ReadAsText.jsx` - printable text version of the edition
- `lib/briefingSlides.js` (slide builders, link paths), `lib/editions.js` (pure date helpers)

## Data
- `useDailyBrief(date)` (daily feature) -> restProxy `daily_brief` / `latest_daily_brief`
- `useWeeklyBrief()` (weekly-brief feature) -> restProxy `weekly_brief`
- `useDailyEditionsIndex` -> restProxy `daily_brief` probes, at most 14 days (`LOOKBACK_DAYS`), cached in sessionStorage `gp_briefings_daily_editions_v1`
- `useStoryQuestion(threadId)` -> restProxy `prediction_snapshot` with `{ threadId }`

## Shared blocks used
- `@/shared/ui/StoryPeek`, `@/shared/ui/StoryLink` (with `usePeek`, `peekData`)

## Imports from other features
- `@/shared/hooks/useDailyBrief`, `@/features/weekly-brief/hooks/useWeeklyBrief` -> the briefs
- `@/features/threads/components/StoryMode.jsx` (`StoryMap`), `components/QuestionChip.jsx`, `lib/questionChips.js` (`hasOwnProbability`)
- `@/shared/lib/situationLabels.js` -> `iso3ForName`

## Gotchas
- `?from=markets` shows a one-line "markets briefings paused" note; no markets line while economy is parked.
- Weekly has a single edition only: the `weekly_brief` action returns just the latest, so no week strip.
- An editions probe that fails stays "unknown", never "no edition"; it is reported once via `reportFetchError`.
- Story links are built only when a `threadId` exists (daily topStories carry one since 2026-09-30).
- `lib/briefingSlides.js` is also imported by `DailyPage.jsx` (`storyLinkPath`, `peekInputForStory`).

Last verified: 2026-10-19
