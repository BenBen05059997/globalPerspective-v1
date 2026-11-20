# 15. Park scheduled AI jobs whose output no page shows

Status: accepted (the resolver part superseded by 0027; Signals parked by 0032)
Date: 2026-09-28
Amended 2026-11-17: the forecast-resolver part is superseded by 0027. `newsSignals`, left running here, was parked by 0032 and its Lambda was later removed (see 0032).

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

Source: `git show a5c0de8:project-docs/plans/TASK_2026-09-27_parking.md` (deleted 2026-10-19); `git show a5c0de8:project-docs/plans/BACKEND_PLAN_2026-09-27.md` (deleted 2026-10-19)
