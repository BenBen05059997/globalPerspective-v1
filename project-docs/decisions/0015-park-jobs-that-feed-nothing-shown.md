# 15. Park scheduled AI jobs whose output no page shows

Status: accepted
Date: 2026-09-28

## Context
Each DeepSeek top-up was being spent on jobs whose output no current page needed, which also kept
parked features producing stale or unconfirmed data.

## Decision
We will park such jobs by disabling their schedule and keeping the code (each step reversible with
one command). Parked on 2026-09-28: economic impact and its quality judge, the forecast resolver,
and the impact audit (operator: "yes you can part the four daily job"). The signals job
(`newsSignals`) is not parked: the operator wants to rethink its algorithm first.

## Consequences
- The economy surfaces were hidden at the same time (see 0009).
- A parked job's rule state is the live truth: check `aws events describe-rule` before assuming.

Source: `project-docs/plans/TASK_2026-09-27_parking.md`; `project-docs/plans/BACKEND_PLAN_2026-09-27.md`
