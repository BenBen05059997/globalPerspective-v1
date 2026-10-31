# briefings

The briefings page (`/briefings`), merged on 2026-10-19 from the old `/daily`, `/weekly-brief` and slide-deck pages. Readers use it
for the day's brief or the weekly signals brief. Three modes: **read** (default, the daily brief as a long-form read), **weekly**
(the Weekly Signals Brief) and **present** (a slide deck with a map, slides and an editions strip). Every section is built only from
fields the brief carries, and links are built only to real ids.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the daily and weekly briefs page. Timeline: reads the briefs views (record/views/briefs/, index/briefs.json) with the actions as fallback; target: daily facts and the weekly report. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live, public. No markets line (economy retired, decision 0049); `/weekly-markets` no longer exists.
- The briefs are in the record (decision 0048): the hooks read `record/views/` first and ask the `daily_brief`, `latest_daily_brief` and
  `weekly_brief` actions only for what the views lack. The brief writers' own notes are not switched on yet (`NOTES_PREFIX` is unset on
  `newsPostDevTo` and `newsWeeklyBrief`): the views hold the backfilled briefs and the actions still serve every new one.
- The weekly brief is written `status: 'published'` with no review step (`newsWeeklyBrief/src/index.js`); the action and the views serve
  only published briefs, so a bad one is held back by setting its status to `draft`.

## Routes
- `/briefings?mode=read|weekly|present` -> `BriefingsPage` (no or unknown `mode` = read). `&date=YYYY-MM-DD` picks the daily edition
  (read, present); `&week=YYYY-MM-DD` the weekly edition (weekly, present); `&deck=weekly` the weekly deck.
- Redirects (`src/app/LegacyRedirects.jsx`; real 301s in `cloudflare/front-worker/production/worker.mjs`, decision 0028):
  `/daily` -> `?mode=read`, `/daily/:date` -> `?mode=read&date=`, `/weekly-brief` -> `?mode=weekly`.

## Frontend
- `BriefingsPage.jsx` - URL parsing, mode switch (`Tabs`), `PresentMode` (`BriefingMode` desktop / `PhoneBriefingMode` phone)
- `components/ReadMode.jsx` - date prev/next, fallback note, takeaways, stats, top stories, rising thread, country to watch,
  Share / Copy / Save (`itemType: daily`), empty state
- `components/WeeklyMode.jsx` - KPIs, signal cards, watch list, method note, `SubscribeCard`, Save (`itemType: weekly`), week navigation
- `components/BriefingSlides.jsx` (slide bodies; the weekly deck ends with `SubscribeCard`), `EditionsStrip.jsx`, `BriefingError.jsx`
  (failed request: reported, with retry), `Trajectory.jsx`, `PlaceLinks.jsx`
- `lib/dateKey.js`, `lib/briefingSlides.js` (slide builders, map focus), `lib/editions.js` (date helpers)
- `hooks/` - `useWeeklyBrief`, `useDailyEditionsIndex`, `useStoryQuestion`; the daily brief hook is shared (`@/shared/hooks/useDailyBrief.js`).
  Both brief hooks read the record through `@/shared/api/briefViews.js`.
- Public API (`index.js`): `useWeeklyBrief` (used by `account` and `map`; keep its return shape). Imports from other features: none.
- Shared: `useDailyBrief`, `StoryMap`, `EntityLink`, `SubscribeCard`, `SaveButton`, `@/shared/lib/links.js` (`briefingHref`, `storyHref`,
  `countryHref`). A story links only with a real `threadId`; a region or bloc is plain text.

## Backend
- Group guide: [distribution](../../../../../backend/distribution/README.md); inputs come from [pipeline](../../../../../backend/pipeline/README.md)
- `newsPostDevTo` (Scheduler `InvokeDev`, 23:00 Asia/Tokyo daily) writes `DAILY_BRIEF#<date>`; `newsWeeklyBrief` (rule `TriggerWeeklyBrief`,
  Sunday 06:00 UTC) writes `WEEKLY_BRIEF#<weekOf>`. Both also call `writeBriefNote`, a no-op until `NOTES_PREFIX` is set.
- `newsStoryRecord` (rule `TriggerStoryRecord`, 23:45 UTC) builds the brief views from the notes; `newsSensitiveData-dev` serves the actions.
- `newsEmailSender` (rule `TriggerWeeklyEmailSend`, Sunday 14:00 UTC) emails the weekly brief from `WEEKLY_BRIEF#`; its text mirrors
  `?mode=weekly`. `newsSavedItems` accepts `daily` and `weekly` as saved item types.

## Data
- Record views (`/data/record/views/`): `index/briefs.json` (which briefs exist), `briefs/daily/<date>.json`, `briefs/weekly/<weekOf>.json`.
  Rebuilt nightly, so today's daily and a newer weekly are not in them yet. A failed read is reported and answers null, never "no brief".
- `useDailyBrief(date)` -> no date: the record's newest in the 30-day window plus `daily_brief` for today alone unless the record already
  has it, and `latest_daily_brief` when the record holds none; a date: the record, else `daily_brief`. localStorage `gp_daily_brief_v1`,
  30 min. A date with no edition falls back to the nearest earlier one and says so.
- `useWeeklyBrief(week)` -> the record's copy; the action when that week is missing or, for the latest, once the record's is a week old
  (the newer wins). localStorage `gp_weekly_brief_v1[:week]`, 30 min. A read API without the lookup answers latest and the page says so.
- `useDailyEditionsIndex` -> the record's index, then `latest_daily_brief` editions, then `daily_brief` probes for dates still unknown,
  at most 14 days (sessionStorage `gp_briefings_daily_editions_v1`); `useStoryQuestion(threadId)` -> the record's `forecasts/<threadId>.json` view while the views are fresh (`shared/api/forecastViews.js`, decision 0052), `prediction_snapshot` when the record cannot answer (memory). No sign-in.

## Pipeline
1. `newsPostDevTo` (23:00 Tokyo) builds the daily brief from `today-archive`, thread analyses and country rows ->
   `SummarizeAndPredict` `DAILY_BRIEF#<date>` (and a `daily_brief` note once `NOTES_PREFIX` is set).
2. `newsWeeklyBrief` (Sunday 06:00 UTC) builds the weekly brief from seven days of archives -> `WEEKLY_BRIEF#<weekOf>`, published.
3. `newsStoryRecord` (23:45 UTC) turns the brief notes into `briefs/` views and `index/briefs.json`.
4. `useDailyBrief`, `useWeeklyBrief`, `useDailyEditionsIndex` read the views, then the actions for what is newer -> `ReadMode`,
   `WeeklyMode`, `PresentMode` on `/briefings`.
5. Sunday 14:00 UTC `newsEmailSender` emails the weekly brief to opted-in subscribers, linking back to `?mode=weekly`.

## Docs
- Decisions: [0048](../../../../../project-docs/decisions/0048-briefs-in-the-record.md) (briefs in the record),
  [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md) (retired routes),
  [0028](../../../../../project-docs/decisions/0028-briefings-merge-real-301s.md) (Briefings merge, real 301s),
  [0013](../../../../../project-docs/decisions/0013-ds1-design-system-tier-never-a-colour.md); links: [ARCHITECTURE.md](../../../../../project-docs/architecture/ARCHITECTURE.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/briefings src/shared/api src/app`; Worker
  redirects: `node --test cloudflare/front-worker/production/worker.test.mjs`
- Brief views served: `curl -s https://globalperspective.net/data/record/views/index/briefs.json | head -c 300`
- Latest daily brief action (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"latest_daily_brief","payload":{"lookbackDays":7}}' | head -c 300`
- Weekly: same command with `-d '{"action":"weekly_brief","payload":{"week":"YYYY-MM-DD"}}'` (omit payload for latest)
- Weekly job ran: `aws logs tail /aws/lambda/newsWeeklyBrief --since 7d --region ap-northeast-1 --filter-pattern '"[weekly] published:"'`

Last verified: 2026-10-31
