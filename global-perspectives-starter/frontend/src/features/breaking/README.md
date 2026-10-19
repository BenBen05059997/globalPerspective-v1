# breaking

No page of its own: the breaking-alert pieces other surfaces embed. The nav bell lists the
public alert feed with a client-side unread count; the Home strip shows the latest alert from
the last 24h; a hook resolves one alert id for the `/breaking/:id` redirect.

## Routes
- None owned. `/breaking` -> `BreakingFeedRedirect` (to `/`) and `/breaking/:id` ->
  `BreakingDetailRedirect` (src/app/LegacyRedirects.jsx) use `useBreakingAlert`: to the
  story `/weekly/thread/:threadId` when the alert has an arc, else `/`.

## Entry files
- `components/NotificationBell.jsx` - nav bell + dropdown (mounted in src/app/layout/Layout.jsx)
- `components/BreakingStrip.jsx` - "BREAKING" strip (mounted in src/features/home/Home.jsx)
- `hooks/useNotifications.js` - alert feed, 5-minute poll, unread count
- `hooks/useBreakingAlert.js` - one alert by id

## Data
- `fetchAlerts()` -> `window.USER_PREFS_ENDPOINT` (newsRecommend) action `list_alerts`, no auth
- `fetchAlert(id)` -> same endpoint, action `get_alert`, no auth
- localStorage `gp_notif_read_at` holds the last time the bell was opened (unread = newer alerts)

## Shared blocks used
- None.

## Public API (`index.js`)
- `BreakingStrip` (home), `NotificationBell` (app layout), `useBreakingAlert` (app `LegacyRedirects`)

## Imports from other features
- None.

## Gotchas
- Without `USER_PREFS_ENDPOINT` the bell renders nothing and both hooks skip the fetch.
- Feed fetch errors are swallowed (no error UI in the nav); the feed stays as it was.
- The strip links to `/breaking/<id>` for one fresh alert, to `/` (the map's alert stack) for several.
- Alert rows carry only the alert key (`threadId` is a legacy alias), so links go through the
  `/breaking/:id` resolver rather than straight to a story.
- `BreakingStrip`'s header comment says Home + Map, but only `Home.jsx` imports it today.

Last verified: 2026-10-19
