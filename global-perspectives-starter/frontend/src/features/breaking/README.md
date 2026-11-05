# breaking

No page of its own: the breaking-alert pieces other surfaces embed. **Switched off** (see Status): nothing
mounts them now. When mounted, the nav bell lists the public alert feed with a client-side unread count and
the Today page strip shows the latest alert from the last 24 hours; a hook resolves one alert id for the
`/breaking/:id` redirect, which is the one piece still live. Readers never see a "breaking" page.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: breaking-alert redirects and the bell. Timeline: reads breaking alerts; not a record view. See [ARCHITECTURE_TIMELINE.md](../../../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Status
- **Switched off 2026-11-06 by the operator** ("switch it off fully and since that is a good time we rethink it later"). To be
  redesigned later. No alert was ever confirmed, so the bell and strip were always empty while every open page polled the feed
  every 5 minutes (about 18.9k `newsRecommend` calls in 14 days).
- **Unmounted:** `NotificationBell` from `src/app/layout/Layout.jsx` (nav bar) and `BreakingStrip` from `src/features/home/Home.jsx`
  (top of `/today`). Nothing else calls `fetchAlerts`, so no page requests the alert feed. The components, `useNotifications`,
  their CSS and tests stay in this folder, and `index.js` still exports `BreakingStrip` and `NotificationBell`.
- **Still live:** the `/breaking` and `/breaking/:id` redirects (old shared links) through `useBreakingAlert` / `fetchAlert`.
- **To mount again:** restore `import { NotificationBell } from '@/features/breaking'` and `<NotificationBell />` after the "?" link
  in `Layout.jsx` (the `.gp-nav .gp-bell` rule in `Layout.css` is still there), and `import { BreakingStrip } from '@/features/breaking'`
  and `<BreakingStrip />` as the first child of `EditorialShell` in `Home.jsx`; then re-enable the detection schedule and decide
  `DRY_RUN` (below). `git show 09571cca:global-perspectives-starter/frontend/src/features/home/Home.jsx` shows the old mount point.
- Live config (set 2026-11-06 about 00:25 JST by the coordinator): detection rule `TriggerBreakingAlert` DISABLED, so
  `newsBreakingAlert` does not run; its `DRY_RUN=true`, so a detection would only be logged and written as `proposed`, nothing
  emailed. Before, with `DRY_RUN=false`, it was emailed to one operator address and marked `sent` (7 rows, none confirmed; code:
  `markSent` in `backend/distribution/newsBreakingAlert/src/index.js`). When it runs, neither state is public: the operator runs
  `node backend/distribution/cli/breaking/review.js` (`proposed`/`sent` -> `confirmed`) to publish a row to the feed.
- Subscriber breaking emails are off: `TriggerBreakingEmailSend` is DISABLED (enabling sends needs an operator yes).

## Routes
- None owned. `/breaking` -> `MapRedirect` (to `/`, keeping query and hash) and `/breaking/:id` -> `BreakingDetailRedirect`
  (`src/app/LegacyRedirects.jsx`) use `useBreakingAlert`: to the story `/weekly/thread/:threadId` when the alert has
  an arc, else `/`.

## Frontend
- `components/NotificationBell.jsx` - nav bell and dropdown (unmounted; was mounted by `src/app/layout/Layout.jsx`)
- `components/BreakingStrip.jsx` - "BREAKING" strip (unmounted; was mounted by `src/features/home/Home.jsx`); one fresh alert links
  through `breakingHref()` (`@/shared/lib/links.js`), several link to the map (`mapHref()`)
- `hooks/useNotifications.js` - alert feed, 5-minute poll, unread count; `hooks/useBreakingAlert.js` - one alert by id
- Public API (`index.js`): `useBreakingAlert` (app `LegacyRedirects`, in use); `BreakingStrip` and `NotificationBell` (exported, no importer while switched off)
- Imports from other features: none. Shared: `restProxy.js` (`fetchAlerts`, `fetchAlert`), `links.js`.

## Backend
- Guides: [distribution](../../../../../backend/distribution/README.md) (`newsBreakingAlert`, `newsEmailSender`),
  [read-api](../../../../../backend/read-api/README.md) (`newsRecommend`)
- `newsBreakingAlert` (rule `TriggerBreakingAlert`, `cron(35 4/8 * * ? *)`, DISABLED since 2026-11-06) writes rows to `GlobalPerspectiveBreakingAlerts`;
  `newsRecommend` (Function URL) serves `confirmed` rows only; `newsEmailSender` would email subscribers (cron disabled).

## Data
- `fetchAlerts()` -> `window.USER_PREFS_ENDPOINT` (newsRecommend) action `list_alerts`, no sign-in; newest 30 rows.
- `fetchAlert(id)` -> same endpoint, action `get_alert`, no sign-in; null unless the row is `confirmed` (newsRecommend withholds `proposed`, `sent` and `rejected`).
- localStorage `gp_notif_read_at` holds the last time the bell was opened (unread = newer alerts).
- Without `USER_PREFS_ENDPOINT` the bell renders nothing and both hooks skip the fetch; feed errors are swallowed
  (no error UI in the nav). Alert rows carry only the alert key (`threadId` is a legacy alias), so links go through
  the `/breaking/:id` resolver.

## Pipeline
This is the flow when switched on; nothing runs it now.

1. The pipeline writes the latest topics to `NewsCache` (key `latest`) and thread records to `SummarizeAndPredict`.
2. `newsBreakingAlert` (every 8 hours) loads them, groups topics by story and scores each (`significance.js`).
3. A story over the threshold is written as a `proposed` row; with `DRY_RUN=false` it is emailed to the operator and marked `sent`; neither is public.
4. The browser polls `list_alerts` every 5 minutes (`useNotifications`); `newsRecommend` scans the table for `confirmed` only (set by the operator in `review.js`).
5. `NotificationBell` counts alerts newer than `gp_notif_read_at`; `BreakingStrip` shows the newest one under 24 hours old.
6. A click goes to `/breaking/:id`; `BreakingDetailRedirect` calls `get_alert` and sends the reader to the story or the map.

## Docs
- Decisions: [0017](../../../../../project-docs/decisions/0017-retired-routes-and-tours.md) (`/breaking` redirects)
- Rules: [DATA_STRATEGY.md](../../../../../project-docs/architecture/DATA_STRATEGY.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/breaking` (bell, strip, both hooks;
  `fetchAlerts` / `fetchAlert` faked), plus `npx eslint src/features/breaking`
- Public feed (from the repo root):
  `U=$(sed -n "s/^window.USER_PREFS_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$U" -H 'Content-Type: application/json' -d '{"action":"list_alerts"}' | head -c 300`
- Detection job (expect DISABLED): `aws events describe-rule --name TriggerBreakingAlert --region ap-northeast-1 --query State`
- Email cron (expect DISABLED): `aws events describe-rule --name TriggerBreakingEmailSend --region ap-northeast-1 --query State`
- Mode (expect `true` for DRY_RUN): `aws lambda get-function-configuration --function-name newsBreakingAlert --region ap-northeast-1 --query 'Environment.Variables.DRY_RUN'`

Last verified: 2026-11-06
