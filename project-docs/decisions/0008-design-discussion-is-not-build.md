# 8. A design discussion is not a build go-ahead

Status: accepted
Date: 2026-09-25

## Context
During the redesign, design rounds and debates produced many approved designs. Building straight
from a discussion risked shipping work the operator had not asked for, or dropping features.

## Decision
We will record design decisions first (in the plan) and start code only on the operator's explicit
"build". Existing features are not removed without an operator yes.

## Consequences
- Design-only tasks touch docs and canvases, not product code.
- Plans carry their decisions; build tasks cite the approved design.

Source: `project-docs/plans/REDESIGN_MASTER_PLAN.md` (§1 "Design is not build");
`project-docs/archive/redesign-ux/_active/TASK_2026-09-26_remaining_design.md` (operator rule
2026-09-25); `CLAUDE.md` (Working style)
