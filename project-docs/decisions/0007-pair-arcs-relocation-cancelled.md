# 7. Pair arcs are not moved onto the live map

Status: accepted
Date: 2026-09-24

## Context
The cleanup audit found the pair-intelligence arcs lived only on the legacy map, which was being
removed. The operator first chose to preserve the feature by porting the arcs onto the live `/map`
before removing the legacy map. Phase 1 of the port was built and render-verified.

## Decision
We will not build it (operator: "no build"). The port is preserved on branch
`archive/pair-arcs-port`; its code was reverted from `main` and the legacy map was removed.

## Consequences
- Pair intelligence has no frontend consumer; its unbuilt UI plan is archived.

Source: `project-docs/archive/redesign-ux/_active/TASK_2026-09-24_pair_arcs_relocation.md`;
`project-docs/archive/redesign-ux/_active/PAIR_ARCS_RELOCATION_PLAN.md`;
`project-docs/archive/architecture/CLEANUP_AUDIT_2026-09-24.md` (§4 D3)
