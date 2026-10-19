# briefings

`/briefings`: the one briefings page (merged from `/daily`, `/weekly-brief` and the old deck on
2026-10-19). Three modes: **read** (default) — the daily brief as a long-form read; **weekly** — the
Weekly Signals Brief; **present** — the slide deck (map + horizontal slides + editions strip). Every
section is built only from fields the brief payload carries; links are built only to real ids.

## Status
- Live, public. Markets briefings paused with economy (`?from=markets` shows a one-line note; no Economic Footprint).

## Routes
- `/briefings?mode=read|weekly|present` -> `BriefingsPage` (no `mode` = read). `&date=YYYY-MM-DD` daily
  edition (read, present); `&week=YYYY-MM-DD` weekly edition (weekly, present); `&deck=weekly` weekly deck.
- Redirects (`src/app/LegacyRedirects.jsx`; real 301s in `cloudflare/front-worker/production/worker.mjs`):
  `/daily` -> `?mode=read`, `/daily/:date` -> `?mode=read&date=`, `/weekly-brief` -> `?mode=weekly`,
  `/weekly-markets` -> `?from=markets`.

## Frontend
- `BriefingsPage.jsx` - reads the URL, the mode switch (shared `Tabs`), `PresentMode` (picks `BriefingMode` /
  `PhoneBriefingMode` via `useIsPhone`); one `document.title` per mode
- `components/ReadMode.jsx` - date prev/next (from the served edition), fallback note, relative-day tag, Key
  Takeaways, stat grid, top stories, rising thread, country to watch, Shape of the Day, Full Analysis, Share /
  Copy / Save, empty state
- `components/WeeklyMode.jsx` - KPIs, signal cards (sources, Related, story arc), watch list, method note,
  `SubscribeCard`, Save (`itemType: weekly`), `WeeklyEditionNav` (week before / latest)
- `components/BriefingSlides.jsx` (slide bodies; the weekly deck ends with `SubscribeCard`), `EditionsStrip.jsx`
  (daily marks + pause range; `WeeklyEditionNav`), `BriefingError.jsx` (failed request: reported, retry), `Trajectory.jsx`
- Addresses: `briefingHref({ mode, date, week, deck })` from `@/shared/lib/links.js`; `lib/dateKey.js` (`dateKeyOrNull`),
  `lib/briefingSlides.js` (slide builders, link paths), `lib/editions.js` (pure date helpers)
- Public API (`index.js`): nothing; `app` (redirects) and `account` (saved items) use `briefingHref`
- Imports from other features: `@/features/weekly-brief` -> `useWeeklyBrief`. Shared: `useDailyBrief`, `StoryMap`,
  `StoryLink`/`StoryPeek`, `SubscribeCard`, `SaveButton`, `ShareButtons`, `CopyBriefing`, `TierChip`, `SectionHeader`

## Backend
- Generated row: [reference/features.md#briefings](../../../../../project-docs/reference/features.md#briefings)
- `newsPostDevTo` (daily, 23:00 Asia/Tokyo) and `newsWeeklyBrief` (Sun 06:00 UTC) write to `SummarizeAndPredict`;
  `newsSensitiveData-dev` serves them; `newsEmailSender` links `?mode=weekly`; `newsSavedItems` saves `daily` / `weekly`.

## Data
- `useDailyBrief(date)` -> `daily_brief` / `latest_daily_brief` (localStorage `gp_daily_brief_v1`); a date
  with no edition falls back to the nearest earlier one and the page says so.
- `useWeeklyBrief(week)` -> `weekly_brief` with `{ week }` (exactly that week, or null); a read API without the
  lookup returns the latest, and the page says so. localStorage `gp_weekly_brief_v1[:week]`, 30 min.
- `useDailyEditionsIndex` -> `daily_brief` probes, at most 14 days (sessionStorage `gp_briefings_daily_editions_v1`);
  `useStoryQuestion(threadId)` -> `prediction_snapshot` with `{ threadId }`.

## Docs
- Decisions: [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md) (retired routes),
  [0013](../../../../../project-docs/decisions/0013-ds1-design-system-tier-never-a-colour.md); 0028 (Briefings 301s)
- Plans: [linking and pages](../../../../../project-docs/plans/PLAN_2026-10-19_linking_and_pages.md)
- Runbooks: [daily-brief.md](../../../../../project-docs/runbooks/daily-brief.md), [weekly-brief.md](../../../../../project-docs/runbooks/weekly-brief.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/briefings src/app`; Worker
  redirects + bot pre-render: `node --test cloudflare/front-worker/production/worker.test.mjs`
- Latest daily brief (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"latest_daily_brief","payload":{"lookbackDays":7}}' | head -c 300`
- Weekly: same command with `-d '{"action":"weekly_brief","payload":{"week":"YYYY-MM-DD"}}'` (omit payload for latest)

Last verified: 2026-10-19
