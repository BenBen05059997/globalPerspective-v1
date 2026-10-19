# weekly-brief

Data only: `useWeeklyBrief(week?)`, the published Weekly Signals Brief (the latest, or one week's). The page
moved into `features/briefings` (`/briefings?mode=weekly`, 2026-10-19). This folder can go once its three
importers (`briefings`, `account`, `map`) read the hook from `@/features/briefings`.

## Status
- Live. Public (no sign-in). Published by the Sunday job without a review step.

## Routes
- None. `/weekly-brief` redirects to `/briefings?mode=weekly` (`src/app/LegacyRedirects.jsx`; a 301 in the Worker).

## Frontend
- `hooks/useWeeklyBrief.js` - fetch + cache of a published brief
- Public API (`index.js`): `useWeeklyBrief` — used by `account`, `briefings`, `map`; change its return shape with care

## Backend
- Generated row: [reference/features.md#weekly-brief](../../../../../project-docs/reference/features.md#weekly-brief)
- `newsWeeklyBrief` (Sun 06:00 UTC) writes `WEEKLY_BRIEF#<weekKey>` / `WEEKLY_BRIEF` (`status: published`) to
  `SummarizeAndPredict`; `newsEmailSender` (weekly mode, Sun 14:00 UTC) emails it; `newsSensitiveData-dev` serves it.

## Data
- `useWeeklyBrief(week)` -> `fetchWeeklyBrief(week)` -> restProxy `weekly_brief` (public) with `{ week }` when
  given: that week's published row (or null); without it the newest published row. A read API without the
  per-week lookup returns the latest; callers compare `brief.weekOf` with the week asked for.
- `useCachedQuery` localStorage `gp_weekly_brief_v1` (`:<week>` per past week), 30-minute TTL. Returns
  `{ brief, loading, error, refetch }`; `brief` is null when nothing is published.

## Docs
- Runbooks: [weekly-brief.md](../../../../../project-docs/runbooks/weekly-brief.md),
  [weekly-email.md](../../../../../project-docs/runbooks/weekly-email.md)
- Page: [features/briefings/README.md](../briefings/README.md)

## How to check it
- Tests: `cd global-perspectives-starter/frontend && npx vitest run src/features/briefings` (weekly mode)
- Latest brief served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"weekly_brief"}' | head -c 300`
- Job ran: `aws logs tail /aws/lambda/newsWeeklyBrief --since 7d --region ap-northeast-1 --filter-pattern '"[weekly] published:"'`

Last verified: 2026-10-19
