# 0026. Delete old docs instead of archiving them

Status: accepted (supersedes the archive/ parts of 0021 and 0025)
Date: 2026-10-19

## Context
The docs migration (0025) moved 183 finished plans, reports and legacy docs into `project-docs/archive/`, kept
CHANGES.md as a frozen archive, and left four hand-written inventories (BACKEND_GUIDE, SYSTEM_WIRING,
PAGES_GUIDE, ARCHITECTURE_VERIFICATION_LOG) next to the generated `reference/`. The operator judged that old
material left in the tree is searched and read and can mislead decisions.

## Decision
We will delete finished plans, reports, legacy docs and superseded inventories instead of archiving them, and
we deleted CHANGES.md. Git history keeps every file: `git show 120de90:<path>` returns the last version of
anything removed on 2026-10-19. A finished plan's lasting decisions become a record here before it is deleted.

## Consequences
- The tree holds only living docs: INDEX, ARCHITECTURE, decisions, plans, rules, runbooks, generated reference,
  and READMEs next to code. Links to deleted docs were rewritten as `git show` references.
- `quality/check_docs.mjs` asks for a done plan to be recorded and deleted, not moved.
- Git log is the only change log.

Source: operator instruction 2026-10-19 (this session).
