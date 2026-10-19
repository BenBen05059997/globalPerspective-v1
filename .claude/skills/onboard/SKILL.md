---
name: onboard
description: Read project documentation to understand the Global Perspectives architecture. Use when asked to orient, "read the docs", "get context", or "what is this project" — not automatically at every session start.
allowed-tools: Read, Glob, Grep
---

# Onboard: Understand the Global Perspectives Project

## Read, in order

1. `project-docs/INDEX.md` — the map of living docs (architecture, decisions, plans, runbooks,
   rules).
2. `project-docs/architecture/ARCHITECTURE.md` — the system overview, linked from INDEX.

Code and live AWS are the truth; docs describe intent and can be stale (`CLAUDE.md`, "Facts come
from code and live AWS"). Check the code or AWS before acting on a fact from any doc.

If a task touches active work, open the relevant plan in `project-docs/plans/` and the decision
records in `project-docs/decisions/` before proposing next steps.

## Related skills

- `deploy-frontend` — build and deploy frontend changes to production.
