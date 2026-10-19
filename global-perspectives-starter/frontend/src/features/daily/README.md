# daily

`/daily`: the Daily Intelligence Brief as a long-form page (big picture, top stories, story and
country to watch, shape of the day, full analysis) with previous/next date navigation. Also owns
`useDailyBrief`, the shared hook many other surfaces use to read the latest brief.

## Routes
- `/daily` -> `DailyPage` (latest available brief)
- `/daily/:dateKey` -> `DailyPage` (a specific date)

## Entry files
- `DailyPage.jsx` - date nav, masthead, numbered sections, share / copy / save controls
- `hooks/useDailyBrief.js` - `useDailyBrief(dateKey)`, `loadLatestDailyBrief()`, `MAX_LOOKBACK_DAYS` (30)

## Data
- No date: restProxy `latest_daily_brief` (one call, server walks back `MAX_LOOKBACK_DAYS`)
- Explicit date: restProxy `daily_brief`, walking back in batches of 10; past dates are sent with the auth token when there is one
- Cache: localStorage `gp_daily_brief_v1` (30-minute TTL, last 7 dates) and `gp_daily_brief_last_found_v1`; one in-flight promise per date shared across hook instances
- Economic footprint block: `useDisruptionsList` (restProxy `economic_impact_list`), disabled while `ECONOMY_PARKED`

## Shared blocks used
- `@/shared/ui/SectionHeader`, `ShareButtons`, `CopyBriefing`, `StoryLink`, `SeverityBadge`, `TierChip`, `boot/BootLoader`

## Imports from other features
- `@/features/briefings/lib/briefingSlides.js` -> `storyLinkPath`, `peekInputForStory`
- `@/shared/hooks/useDisruptionsList`, `components/InstrumentChip` -> economic footprint
- `@/shared/ui/SaveButton` -> save this daily brief

## Gotchas
- `useDailyBrief` is also used by the map console, `usePausedSince` (map, used by Layout), About, Account / Desk, and briefings: a change here hits them all.
- "Nothing found" is cached too, so an outage does not rescan on every page load.
- The served brief may be older than the requested date; date arrows step from the served date, and the page says when the edition is not today's.
- `EconomicFootprint` is not mounted while `ECONOMY_PARKED` (`@/shared/lib/economyFlag`) is true.
- The rising-thread card uses `StoryLink` only for ids starting `thread-`, else a plain `Link`.

Last verified: 2026-10-19
