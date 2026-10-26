# 25. How documentation is stored

Status: accepted (archive/ part superseded by 0026; plans, runbooks, reference and rules superseded by 0041)
Date: 2026-10-19

## Context
`project-docs/` held 179 docs in 18 topic folders, each with its own status folders; about a
quarter of `_active/` was actually active, ARCHITECTURE.md had grown to 1,908 lines with wrong
facts, and the Lambda inventory was written four times.

## Decision
We will keep only these doc types: agent rules (`CLAUDE.md`, ≤80 lines); one architecture overview;
decision records (`project-docs/decisions/NNNN-slug.md`, append-only, superseded by a new record);
plans (`project-docs/plans/`, at most 10, each with one `Status:` line); runbooks (`project-docs/runbooks/`, with
"Last verified"); feature and Lambda READMEs next to the code; and a reference generated from code
and live AWS (`project-docs/reference/`). Rule docs that state how things must be done live in
`project-docs/rules/`. Finished plans, reports and legacy docs go to `project-docs/archive/`
(kept, not indexed). `INDEX.md` lists living docs only, in ≤60 lines.

## Consequences
- When a plan is done, its lasting decisions become records and the plan moves to `archive/` in
  the same commit.
- `quality/check_docs.mjs` enforces the INDEX size and links, at most 10 plans each with one
  `Status:` line, no done plans in `plans/`, and the CLAUDE.md size.

Source: `git show a5c0de8:project-docs/plans/PLAN_2026-10-19_docs_storage.md` (deleted 2026-10-19) (approved by the operator 2026-10-19)
