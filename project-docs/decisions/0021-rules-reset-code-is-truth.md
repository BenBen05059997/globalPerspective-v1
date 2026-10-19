# 21. Rules reset: code and live AWS are the truth; docs only on architecture changes

Status: accepted
Date: 2026-10-19

## Context
Docs had drifted from the code and live AWS (ARCHITECTURE.md contradicted itself and live state),
while hooks required a CHANGES.md entry and task-file bookkeeping on every code commit.

## Decision
We will:
- take facts from code and live AWS, never from docs (Lambdas and env from
  `aws lambda`, schedules from `aws events` + `aws scheduler`, routes from `App.jsx`);
- update `ARCHITECTURE.md` (and `INDEX.md` for a new doc) only when the architecture changes: a
  Lambda, store/S3 prefix, schedule, route, feature or data flow is added or removed;
- treat git log as the change log; `CHANGES.md` is a frozen archive;
- keep pre-commit to fast checks: block a staged `docs/config.js` and run the
  `quality/check_*.mjs` style ratchets when frontend source is staged; pre-push runs
  `npm run verify` when the frontend changed.

## Consequences
- Plans keep design decisions; routine code changes need no doc edit.
- The Stop hook (`scripts/hooks/docs-reminder.sh`) reminds on architecture changes only.

Source: `CLAUDE.md` ("Facts come from code and live AWS", "Docs"); `project-docs/rules/TASK_WORKFLOW.md`;
`.githooks/pre-commit`; `git show a5c0de8:project-docs/plans/PLAN_2026-10-19_docs_storage.md` (deleted 2026-10-19)
