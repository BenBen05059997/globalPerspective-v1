# weekly-brief

The latest published Weekly Signals Brief: the week's signals ranked by risk, KPIs (signals, highest
risk, high-risk count, items to watch), one card per signal (lede, region, fact, "so what", source
outlets, link to the story arc) and a "What to watch" list.

## Status
- Live. No feature flag; public (no sign-in). Published by the Sunday job without a review step.

## Routes
- `/weekly-brief` -> `WeeklyBriefPage` (lazy)

## Frontend
- `WeeklyBriefPage.jsx` - the page; local `SignalCard`, `SignalChip`, `sourceOutlets`, `formatWeekOf`
- `hooks/useWeeklyBrief.js` - fetch + cache of the latest brief
- Public API (`index.js`): `useWeeklyBrief` — also used by `account`, `briefings`, `map`; change its return shape with care
- Imports from other features: none. Shared: `Markdown`, `SubscribeCard` (`variant="weekly"`), `TierChip`, `SectionHeader`,
  `Card`, `StoryLink`, `boot/BootLoader`; `@/shared/lib/riskTiers`
- KPIs count threat signals only: `kind === 'development'` gets a neutral "Development" chip, not a tier;
  "Highest risk" is `threats[0]` (assumes server ordering). An older prose brief (`headline`, `dek`, `brief`)
  still renders when `signals` is not an array.

## Backend
- Generated row: [reference/features.md#weekly-brief](../../../../../project-docs/reference/features.md#weekly-brief)
- `newsWeeklyBrief` (Sun 06:00 UTC) writes `WEEKLY_BRIEF#<weekKey>` / `WEEKLY_BRIEF` (`status: published`) to
  `SummarizeAndPredict`; `newsEmailSender` (weekly mode, Sun 14:00 UTC) emails it; `newsSensitiveData-dev` serves it.

## Data
- `useWeeklyBrief()` -> `fetchWeeklyBrief()` -> restProxy `weekly_brief` (public): newest `status = published` row.
- `useCachedQuery` localStorage `gp_weekly_brief_v1`, 30-minute TTL. Returns `{ brief, loading, error, refetch }`;
  `brief` is null when nothing is published (honest empty state "No brief published yet").

## Docs
- Runbooks: [weekly-brief.md](../../../../../project-docs/runbooks/weekly-brief.md),
  [weekly-email.md](../../../../../project-docs/runbooks/weekly-email.md)
- Rules: [SEVERITY_CODEBOOK.md](../../../../../project-docs/rules/SEVERITY_CODEBOOK.md) (the tier on each signal)
- Decisions: [0005](../../../../../project-docs/decisions/0005-one-importance-scale.md) (one importance scale)

## How to check it
- Tests: none in this folder; `account/__tests__/accountShell.test.jsx` covers the hook through the Alerts panel
  (`cd global-perspectives-starter/frontend && npx vitest run src/features/account/__tests__/accountShell.test.jsx`).
- Latest brief served (from the repo root):
  `P=$(sed -n "s/^window.SENSITIVE_PROXY_ENDPOINT = '\(.*\)';/\1/p" docs/config.js); curl -s -X POST "$P" -H 'Content-Type: application/json' -d '{"action":"weekly_brief"}' | head -c 300`
- Job ran: `aws logs tail /aws/lambda/newsWeeklyBrief --since 7d --region ap-northeast-1 --filter-pattern '"[weekly] published:"'`
- Schedule: `aws events describe-rule --name TriggerWeeklyBrief --region ap-northeast-1 --query State`

Last verified: 2026-10-19
