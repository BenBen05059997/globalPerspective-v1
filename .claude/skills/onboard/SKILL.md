---
name: onboard
description: Read project documentation to understand the Global Perspectives architecture. Use when asked to orient, "read the docs", "get context", or "what is this project" — not automatically at every session start.
allowed-tools: Read, Glob, Grep
---

# Onboard: Understand the Global Perspectives Project

## Read, in order

1. `README.md` (repo root) — the router.
2. `project-docs/INDEX.md` — the full doc map, grouped by domain and status.
3. `project-docs/architecture/ARCHITECTURE.md` — authoritative system reference (Lambda
   inventory, DDB schemas, frontend routes/components/hooks). Trust it over any other doc on
   drift; deployed AWS state beats even this.

If a task touches active work, also open the relevant `_active/` plan named in INDEX before
proposing next steps.

## Related skills

- `deploy-frontend` — build and deploy frontend changes to production.
