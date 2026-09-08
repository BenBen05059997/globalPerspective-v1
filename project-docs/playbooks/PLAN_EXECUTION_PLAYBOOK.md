# Plan Execution Playbook — the declare → do → update loop for a multi-phase plan

**How-to.** Extends `TASK_WORKFLOW.md` (single-task declare-then-update) to a **large plan worked task-by-task, possibly across sessions and across agents**. Born 2026-09-08 executing `redesign-ux/_active/MAP_HOME_SITUATION_PLAN.md`. Use this whenever a plan is big enough that "which task am I on and what did the last agent already touch?" is a real question.

## Why a ledger, not just TodoWrite

`TodoWrite` is in-session and evaporates. A multi-phase plan outlives the session and may pass between agents. So each such plan gets one **execution ledger** file that is the durable, single source of truth for *what's done, what's in flight, and exactly which files/docs each task touches*. An agent picking up the plan reads the ledger first and knows precisely where to resume.

## The loop (per task)

1. **DECLARE (before touching anything).** Add or flip a ledger row to `🔧 active` and fill its four columns: **Reads/refs**, **Changes (code/files)**, **Docs to update on completion**, **Verify/exit criterion**. Never start a task whose row is blank.
2. **DO.** Keep the row honest as scope shifts — if you touch a file you didn't list, add it. This is the anti-drift contract: the row must end true.
3. **UPDATE (same commit as the code).** Update every doc the row lists, add the `CHANGES.md` entry, run the verify/exit check, tick the done-boxes, set the row to `✅ done` with the commit hash. Then, and only then, pick the next task.

A task is not "done" until its listed docs are updated. Half a task (code shipped, docs stale) is a drift bug, not progress.

## The ledger file

- **Location:** next to the plan it executes, in the same `_active/` folder, named `<PLAN_BASENAME>_EXECUTION_LEDGER.md`.
- **Lifecycle:** created when the plan enters `_active/`; when the last task is `✅ done`, the plan and ledger move to `_shipped/` together and the ledger's final state is the build record.
- **One row per task**, grouped by the plan's phases. Row shape:

```
### <Phase> · <task id> — <task name>
Status: 🔭 todo | 🔧 active | ✅ done | ⛔ blocked (<why>)
Reads/refs:   <files, dirs, live AWS resources>
Changes:      <files created/edited, Lambda/table/schedule names>
Docs to update: <project-docs/... · ARCHITECTURE.md §… · BACKEND_GUIDE.md · CHANGES.md · memory>
Verify / exit: <the concrete check that says this task is really done>
Done-check: [ ] code/change  [ ] docs updated (same commit)  [ ] CHANGES.md  [ ] verify passed
Commit: <hash once done>
Notes: <surprises, decisions, numbers found — the hand-off breadcrumbs>
```

## Rules that keep it trustworthy

- **Declare before do.** A blank row means the task hasn't started. This is what lets another agent trust the ledger.
- **The row ends true.** If reality diverged from the declaration, edit the row to match what actually happened before marking done — the ledger is a record, not a wish.
- **Docs in the same commit as code** (the one drift-prevention that works; `TASK_WORKFLOW.md`). Doc-only tasks (like P0 measurement) still get a `CHANGES.md` line.
- **Respect the repo gates** (`agent-kit/CLAUDE.template.md`): reversible work proceeds; deploys and prod mutations wait for an explicit "yes" each time; frontend changes go through `npm run verify` and `./deploy.sh`; Lambda env is merge-don't-clobber; `aws` mutations are bare single commands.
- **Numbers go in the ledger `Notes`, then into the plan.** A measurement task (e.g. the Brave audit) is done when its numbers are written back into the plan's own tables — not when the query ran.
- **Blocked ≠ skipped.** A task that can't proceed (needs operator KYC, a dashboard number, a decision) goes `⛔ blocked` with the reason, and the next unblocked task is picked — the block stays visible.

## Picking up a plan you didn't start

1. Read the plan, then its ledger.
2. The first `🔧 active` row is where the last agent was — check its Done-check boxes to see how far it got.
3. If none is `🔧 active`, the first `🔭 todo` in phase order is next. Respect the plan's build order — phases are ordered for a reason (see the plan's "build order is load-bearing" note).
4. Declare the row, then work it.
