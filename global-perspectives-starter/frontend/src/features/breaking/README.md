# breaking

No page of its own: the breaking-alert pieces other surfaces embed. The nav bell lists the public alert
feed with a client-side unread count; the Today page strip shows the latest alert from the last 24 hours;
a hook resolves one alert id for the `/breaking/:id` redirect. Readers see a short headline that leads to
the story or the map; they never see a "breaking" page.

## Status
- Live (bell and strip). The feed shows rows whose status is `confirmed` or `sent` (`newsRecommend` `listAlerts`).
- Live config differs from the older docs: `newsBreakingAlert` runs with `DRY_RUN=false` and a mail key set, so a
  detection is emailed to one operator address and marked `sent` with no human step, which also makes it public
  (code: `markSent` in `backend/distribution/newsBreakingAlert/src/index.js`). The table holds one row, `sent`,
  alerted 2026-10-09. `review.js` (`proposed` -> `confirmed`) is only used when a proposal is held back.
- Subscriber breaking emails are off: `TriggerBreakingEmailSend` is DISABLED (enabling sends needs an operator yes).

## Routes
- None owned. `/breaking` -> `BreakingFeedRedirect` (to `/`) and `/breaking/:id` -> `BreakingDetailRedirect`
  (`src/app/LegacyRedirects.jsx`) use `useBreakingAlert`: to the story `/weekly/thread/:threadId` when the alert has
  an arc, else `/`.

## Frontend
- `components/NotificationBell.jsx` - nav bell and dropdown (mounted by `src/app/layout/Layout.jsx`)
- `components/BreakingStrip.jsx` - "BREAKING" strip (mounted by `src/features/home/Home.jsx`); one fresh alert links
  through `breakingHref()` (`@/shared/lib/links.js`), several link to the map (`mapHref()`)
- `hooks/useNotifications.js` - alert feed, 5-minute poll, unread count; `hooks/useBreakingAlert.js` - one alert by id
- Public API (`index.js`): `BreakingStrip` (home), `NotificationBell` (app layout), `useBreakingAlert` (app `LegacyRedirects`)
- Imports from other features: none. Shared: `restProxy.js` (`fetchAlerts`, `fetchAlert`), `links.js`.

## Backend
- Generated row: [reference/features.md#breaking](../../../../../project-docs/reference/features.md#breaking)
- Guides: [distribution](../../../../../backend/distribution/README.md) (`newsBreakingAlert`, `newsEmailSender`),
  [read-api](../../../../../backend/read-api/README.md) (`newsRecommend`)
- `newsBreakingAlert` (rule `TriggerBreakingAlert`, `cron(35 4/8 * * ? *)`, ENABLED) writes rows to `GlobalPerspectiveBreakingAlerts`;
  `newsRecommend` (Function URL) serves `confirmed` and `sent` rows; `newsEmailSender` would email subscribers (cron disabled).

## Data
- `fetchAlerts()` -> `window.USER_PREFS_ENDPOINT` (newsRecommend) action `list_alerts`, no sign-in; newest 30 rows.
- `fetchAlert(id)` -> same endpoint, action `get_alert`, no sign-in; null unless the row is `confirmed` or `sent`.
- localStorage `gp_notif_read_at` holds the last time the bell was opened (unread = newer alerts).
- Without `USER_PREFS_ENDPOINT` the bell renders nothing and both hooks skip the fetch; feed errors are swallowed
  (no error UI in the nav). Alert rows carry only the alert key (`threadId` is a legacy alias), so links go through
  the `/breaking/:id` resolver.

## Pipeline
1. The pipeline writes the latest topics to `NewsCache` (key `latest`) and thread records to `SummarizeAndPredict`.
2. `newsBreakingAlert` (every 8 hours) loads them, groups topics by story and scores each (`significance.js`).
3. A story over the threshold is written as a `proposed` row; with `DRY_RUN=false` it is emailed and marked `sent`.
4. The browser polls `list_alerts` every 5 minutes (`useNotifications`); `newsRecommend` scans the table for `confirmed` or `sent`.
5. `NotificationBell` counts alerts newer than `gp_notif_read_at`; `BreakingStrip` shows the newest one under 24 hours old.
6. A click goes to `/breaking/:id`; `BreakingDetailRedirect` calls `get_alert` and sends the reader to the story or the map.

## Docs
- Decisions: [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md) (`/breaking` redirects)
- Rules: [DATA_STRATEGY.md](../../../../../project-docs/rules/DATA_STRATEGY.md)
- Runbooks: [breaking-alert.md](../../../../../project-docs/runbooks/breaking-alert.md), [parked-jobs.md](../../../../../project-docs/runbooks/parked-jobs.md)

## How to check it
- Tests: none cover this feature (`home/__tests__/todayErrors.test.jsx` mocks the strip out); lint only:
  `cd global-perspectives-starter/frontend && npx eslint src/features/breaking`
- Public feed (from the repo root):
  `U=$(sed -n "s/^window.USER_PREFS_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$U" -H 'Content-Type: application/json' -d '{"action":"list_alerts"}' | head -c 300`
- Detection job: `aws events describe-rule --name TriggerBreakingAlert --region ap-northeast-1 --query State`
- Email cron (expect DISABLED): `aws events describe-rule --name TriggerBreakingEmailSend --region ap-northeast-1 --query State`
- Live mode (expect `false` for DRY_RUN): `aws lambda get-function-configuration --function-name newsBreakingAlert --region ap-northeast-1 --query 'Environment.Variables.DRY_RUN'`

Last verified: 2026-10-20
