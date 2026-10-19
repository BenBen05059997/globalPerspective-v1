# weekly-brief

The latest published Weekly Signals Brief: the week's signals ranked by risk, with KPIs (signals,
highest risk, high-risk count, items to watch), one card per signal (lede, region, fact, "so what",
source outlets, link to the story arc) and a "What to watch" list.

## Routes
- `/weekly-brief` -> `WeeklyBriefPage`

## Entry files
- `WeeklyBriefPage.jsx` - the page; local `SignalCard`, `SignalChip`, `sourceOutlets`, `formatWeekOf`
- `hooks/useWeeklyBrief.js` - fetch + cache of the latest brief

## Data
- `useWeeklyBrief()` -> `fetchWeeklyBrief()` -> restProxy action `weekly_brief` (public, no auth).
- Cached via `useCachedQuery` under localStorage key `gp_weekly_brief_v1`, 30-minute TTL.
- Returns `{ brief, loading, error, refetch }`; `brief` is null when nothing is published.

## Shared blocks used
- `@/shared/ui/Markdown`, `TierChip`, `SectionHeader`, `StoryLink`, `boot/BootLoader`

## Imports from other features
- `@/shared/ui/SubscribeCard` -> `SubscribeCard variant="weekly"`

## Gotchas
- KPIs count threat signals only: `kind === 'development'` signals get a neutral "Development"
  chip, not a risk tier. "Highest risk" is read from `threats[0]` (assumes server ordering).
- Honest empty state ("No brief published yet") when `brief` is null; error shows a retry message.
- Backward-compatible branch renders an older prose brief (`headline`, `dek`, `brief` markdown)
  when `signals` is not an array.
- Signal cards are keyed by `threadId`.
- `useWeeklyBrief` is also imported by `features/map`, `features/briefings` and
  `features/account`; change its return shape with care.

Last verified: 2026-10-19
