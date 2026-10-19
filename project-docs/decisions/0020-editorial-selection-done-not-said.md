# 20. Story selection counts things done, not things said

Status: accepted
Date: 2026-10-18

## Context
Backtests of the layered story selector lost blind-review pairs to stories whose headline was only
a reaction, an attributed claim, an announced intention or an anniversary.

## Decision
We will apply the operator's editorial rule: only things DONE count; things SAID do not. It is judged on the headline's main clause, so "X blasts Y as
strikes kill 78" counts as said; attributed claims, announced or future intentions and
anniversaries are said too.

## Consequences
- The rule is the `done_or_said` question in the layered selector
  (`newsSelectionShadow`, running as a shadow job since 2026-10-18).
- Making the layered selector the live selector is a separate operator go (plan step P7d).

Source: `amplify/backend/function/newsSelectionShadow/src/selection-core.js` (operator editorial
rule comment); `project-docs/plans/TASK_2026-10-17_grounded_forecast_and_cost.md` (P6, P7);
`predictions/jev-backtest/REPORT.md`
