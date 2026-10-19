# breaking

No page of its own: the breaking-alert pieces other surfaces embed. The nav bell lists the public
alert feed with a client-side unread count; the Home strip shows the latest alert from the last 24h;
a hook resolves one alert id for the `/breaking/:id` redirect.

## Status
- Live (bell + strip). Alerts appear only after the operator confirms a proposal
  (`backend/distribution/cli/breaking/review.js`: `proposed` -> `confirmed` -> `sent`).
- Subscriber breaking emails are off: `TriggerBreakingEmailSend` is DISABLED (enabling sends needs an operator yes).

## Routes
- None owned. `/breaking` -> `BreakingFeedRedirect` (to `/`) and `/breaking/:id` -> `BreakingDetailRedirect`
  (src/app/LegacyRedirects.jsx) use `useBreakingAlert`: to `/weekly/thread/:threadId` when the alert has an arc, else `/`.

## Frontend
- `components/NotificationBell.jsx` - nav bell + dropdown (mounted by `src/app/layout/Layout.jsx`)
- `components/BreakingStrip.jsx` - "BREAKING" strip (mounted by `src/features/home/Home.jsx`); links to the alert's
  resolver (`lib/alertPath.js`, shared with the bell) for one fresh alert, to the map (`mapHref()`) for several
- `hooks/useNotifications.js` - alert feed, 5-minute poll, unread count; `hooks/useBreakingAlert.js` - one alert by id
- Public API (`index.js`): `BreakingStrip` (home), `NotificationBell` (app layout), `useBreakingAlert` (app `LegacyRedirects`)
- Imports from other features: none.

## Backend
- Generated row: [reference/features.md#breaking](../../../../../project-docs/reference/features.md#breaking)
- `newsBreakingAlert` (`TriggerBreakingAlert`, every 8 h) writes `proposed` rows to `GlobalPerspectiveBreakingAlerts`;
  `newsRecommend` serves `confirmed`/`sent` rows; `newsEmailSender` would send them (cron disabled).

## Data
- `fetchAlerts()` -> `window.USER_PREFS_ENDPOINT` (newsRecommend Function URL) action `list_alerts`, no auth.
- `fetchAlert(id)` -> same endpoint, action `get_alert`, no auth.
- localStorage `gp_notif_read_at` holds the last time the bell was opened (unread = newer alerts).
- Without `USER_PREFS_ENDPOINT` the bell renders nothing and both hooks skip the fetch; feed errors are swallowed
  (no error UI in the nav). Alert rows carry only the alert key (`threadId` is a legacy alias), so links go through
  the `/breaking/:id` resolver.

## Docs
- Decisions: [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md) (`/breaking` redirects)
- Rules: [DATA_STRATEGY.md](../../../../../project-docs/rules/DATA_STRATEGY.md)
- Runbooks: [breaking-alert.md](../../../../../project-docs/runbooks/breaking-alert.md),
  [parked-jobs.md](../../../../../project-docs/runbooks/parked-jobs.md)

## How to check it
- Tests: none cover this feature (`home/__tests__/todayErrors.test.jsx` mocks the strip out); lint only:
  `cd global-perspectives-starter/frontend && npx eslint src/features/breaking`
- Public feed (from the repo root):
  `U=$(sed -n "s/^window.USER_PREFS_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$U" -H 'Content-Type: application/json' -d '{"action":"list_alerts"}' | head -c 300`
- Detection job: `aws events describe-rule --name TriggerBreakingAlert --region ap-northeast-1 --query State`
- Email cron (expect DISABLED): `aws events describe-rule --name TriggerBreakingEmailSend --region ap-northeast-1 --query State`

Last verified: 2026-10-19
