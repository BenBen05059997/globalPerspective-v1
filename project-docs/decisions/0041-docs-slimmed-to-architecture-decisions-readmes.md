# 0041. Docs slimmed to architecture, decisions, READMEs and one start file

Status: accepted (supersedes the plans, runbooks, reference and rules layout of 0025)
Date: 2026-10-26

## Context
Plans, per-job runbooks, generated reference tables and a dated STATUS file went stale within days of being written, and an old agent-kit and marketing folder were never read by this project. Code, live AWS and `git log` already answer what is deployed, what runs when and what changed (0021).

## Decision
We keep only: `CLAUDE.md`; `project-docs/START_HERE.md` (a map plus a short "where we left off"); `project-docs/architecture/` (system overview, area designs, storage and world-model rules); `project-docs/decisions/`; and READMEs next to code. Lasting design from the deleted plans moved into the architecture docs; the rest is in git history (0026). Generated reference tables, per-job runbooks, plans and STATUS.md are not kept. Pointers to schedules, Lambdas, routes and S3 prefixes name the command that reads them.

## Consequences
- `quality/check_docs.mjs` checks START_HERE.md (exists, links resolve, at most 80 lines), CLAUDE.md size, the README rules, and `pipeline.json` coverage. It no longer checks plans or the reference.
- New design work is recorded in the fitting architecture doc or a decision; there is no plan folder.
- `scripts/gen-reference.mjs` is deleted.

Source: operator approval 2026-10-26 (docs-slim lane).
