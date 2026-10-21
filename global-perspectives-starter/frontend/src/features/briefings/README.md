# briefings

The briefings page (`/briefings`), merged on 2026-10-19 from the old `/daily`, `/weekly-brief` and slide-deck pages. Readers use it
for the day's brief or the weekly signals brief. Three modes: **read** (default, the daily brief as a long-form read), **weekly**
(the Weekly Signals Brief) and **present** (a slide deck with a map, slides and an editions strip). Every section is built only from
fields the brief carries, and links are built only to real ids.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the daily and weekly briefs page. Timeline: reads the briefs; target: daily facts and the weekly report. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- Live, public. Markets are paused with economy: `?from=markets` shows a one-line note and nothing else.
- The weekly brief is written with `status: 'published'` and no review step (`newsWeeklyBrief/src/index.js`); the read action
  serves only published briefs, so a bad one is held back by setting its status to `draft`.

## Routes
- `/briefings?mode=read|weekly|present` -> `BriefingsPage` (no or unknown `mode` = read). `&date=YYYY-MM-DD` picks the daily edition
  (read, present); `&week=YYYY-MM-DD` the weekly edition (weekly, present); `&deck=weekly` the weekly deck.
- Redirects (`src/app/LegacyRedirects.jsx`; real 301s in `cloudflare/front-worker/production/worker.mjs`, decision 0028):
  `/daily` -> `?mode=read`, `/daily/:date` -> `?mode=read&date=`, `/weekly-brief` -> `?mode=weekly`, `/weekly-markets` -> `?from=markets`.

## Frontend
- `BriefingsPage.jsx` - URL parsing, mode switch (`Tabs`), `PresentMode` (`BriefingMode` desktop / `PhoneBriefingMode` phone)
- `components/ReadMode.jsx` - date prev/next, fallback note, takeaways, stats, top stories, rising thread, country to watch,
  Share / Copy / Save (`itemType: daily`), empty state
- `components/WeeklyMode.jsx` - KPIs, signal cards, watch list, method note, `SubscribeCard`, Save (`itemType: weekly`), week navigation
- `components/BriefingSlides.jsx` (slide bodies; the weekly deck ends with `SubscribeCard`), `EditionsStrip.jsx`, `BriefingError.jsx`
  (failed request: reported, with retry), `Trajectory.jsx`, `PlaceLinks.jsx`
- `lib/dateKey.js`, `lib/briefingSlides.js` (slide builders, map focus), `lib/editions.js` (date helpers)
- `hooks/` - `useWeeklyBrief`, `useDailyEditionsIndex`, `useStoryQuestion`; the daily brief hook is shared (`@/shared/hooks/useDailyBrief.js`)
- Public API (`index.js`): `useWeeklyBrief` (used by `account` and `map`; keep its return shape). Imports from other features: none.
- Shared: `useDailyBrief`, `StoryMap`, `EntityLink`, `SubscribeCard`, `SaveButton`, `@/shared/lib/links.js` (`briefingHref`, `storyHref`,
  `countryHref`). A story links only with a real `threadId`; a region or bloc is plain text.

## Backend
- Generated row: [reference/features.md#briefings](../../../../../project-docs/reference/features.md#briefings)
- Group guide: [distribution](../../../../../backend/distribution/README.md); inputs come from [pipeline](../../../../../backend/pipeline/README.md)
- `newsPostDevTo` (Scheduler `InvokeDev`, 23:00 Asia/Tokyo daily) writes `DAILY_BRIEF#<date>`; `newsWeeklyBrief` (rule
  `TriggerWeeklyBrief`, Sunday 06:00 UTC) writes `WEEKLY_BRIEF#<weekOf>`; `newsSensitiveData-dev` serves both.
- `newsEmailSender` (rule `TriggerWeeklyEmailSend`, Sunday 14:00 UTC) emails the weekly brief; its text mirrors `?mode=weekly`.
  `newsSavedItems` accepts `daily` and `weekly` as saved item types.

## Data
- `useDailyBrief(date)` -> `latest_daily_brief` (one call, also lists the editions of the last 30 days) when no date is given, else
  `daily_brief`; localStorage `gp_daily_brief_v1`, 30 min. A date with no edition falls back to the nearest earlier one and says so.
- `useWeeklyBrief(week)` -> `weekly_brief` with `{ week }` (that week or null), or latest with no week; localStorage
  `gp_weekly_brief_v1[:week]`, 30 min. A read API without the lookup answers latest and the page says so.
- `useDailyEditionsIndex` -> editions from `latest_daily_brief`, then `daily_brief` probes for dates outside it, at most 14 days
  (sessionStorage `gp_briefings_daily_editions_v1`); `useStoryQuestion(threadId)` -> `prediction_snapshot` by thread (memory).
- No sign-in is needed to read. `daily_brief` for a past date is sent with the auth header when signed in.

## Pipeline
1. `newsInvokeGemini-dev` and `NewsProjectInvokeAgentLambda-dev` (3x a day) fill NewsCache `today-archive`; `newsThreadAnalysis` and
   `newsCountryIntelligence` fill `THREAD#` and `COUNTRY#` rows.
2. `newsPostDevTo` (23:00 Tokyo) builds the daily brief from `today-archive` plus those rows -> `SummarizeAndPredict` `DAILY_BRIEF#<date>`.
3. `newsWeeklyBrief` (Sunday 06:00 UTC) builds the weekly brief from seven days of archives -> `WEEKLY_BRIEF#<weekOf>`, published.
4. `newsSensitiveData-dev` actions `latest_daily_brief`, `daily_brief`, `weekly_brief`.
5. Hooks `useDailyBrief` and `useWeeklyBrief` -> `ReadMode`, `WeeklyMode`, `PresentMode` on `/briefings`.
6. Sunday 14:00 UTC `newsEmailSender` emails the weekly brief to opted-in subscribers, linking back to `?mode=weekly`.

## Docs
- Decisions: [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md) (retired routes),
  [0028](../../../../../project-docs/decisions/0028-briefings-merge-real-301s.md) (Briefings merge, real 301s),
  [0013](../../../../../project-docs/decisions/0013-ds1-design-system-tier-never-a-colour.md)
- Plans: [linking and pages](../../../../../project-docs/plans/PLAN_2026-10-19_linking_and_pages.md)
- Runbooks: [daily-brief.md](../../../../../project-docs/runbooks/daily-brief.md), [weekly-brief.md](../../../../../project-docs/runbooks/weekly-brief.md), [weekly-email.md](../../../../../project-docs/runbooks/weekly-email.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/briefings src/app`; Worker
  redirects: `node --test cloudflare/front-worker/production/worker.test.mjs`
- Latest daily brief (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"latest_daily_brief","payload":{"lookbackDays":7}}' | head -c 300`
- Weekly: same command with `-d '{"action":"weekly_brief","payload":{"week":"YYYY-MM-DD"}}'` (omit payload for latest)
- Weekly job ran: `aws logs tail /aws/lambda/newsWeeklyBrief --since 7d --region ap-northeast-1 --filter-pattern '"[weekly] published:"'`

Last verified: 2026-10-20
