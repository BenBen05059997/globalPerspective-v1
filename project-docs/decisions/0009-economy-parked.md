# 9. Economy is parked

Status: superseded by 0049 (economy retired 2026-10-31)
Date: 2026-09-25 (surfaces hidden behind a flag 2026-09-28)

## Context
The DeepSeek balance ran out on 12 Sep, so economic-impact analysis froze while `/economy` still
presented 12-Sep analysis as "today". The operator: "We can hide it right now, since it is not that
important at the moment."

## Decision
We will park economy: remove it from the nav, footer, tour, map-home teaser and Daily links;
disable EventBridge `TriggerWeeklyMarkets` (2026-09-25); then disable the daily economic-impact
and quality-judge jobs and hide the remaining economy surfaces behind `ECONOMY_PARKED`
(`shared/lib/economyFlag.js`, 2026-09-28). `/economy` stays reachable by URL. The hourly price
feed `newsMarketsData` keeps running (no LLM, also used by country pages).

## Consequences
- Economy design decisions E1–E8 wait until economy returns.
- Re-enabling is reversible: `aws events enable-rule --name <rule>` and flipping the flag.

Source: `git show 120de90:project-docs/archive/redesign-ux/_active/ECONOMY_CONSOLE_DISCUSSION.md` (deleted 2026-10-19);
`git show a5c0de8:project-docs/plans/TASK_2026-09-27_parking.md` (deleted 2026-10-19)
