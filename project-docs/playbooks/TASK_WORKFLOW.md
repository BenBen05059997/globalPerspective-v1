# Task Workflow — declare-then-update (keeps docs from drifting)

A lightweight convention so documentation never falls behind the code. Born from the 2026-09-08 audit, which found ~20 docs that had silently gone stale because code changed and the docs didn't.

## The rule (docs-as-code)

1. **Before** a non-trivial task, write a task entry (template below) declaring: the goal, the files/dirs it will **read/reference**, the files it will **change**, and the docs to **update on completion**.
2. **While** working, keep those file lists honest as scope shifts.
3. **On finish**, update every listed doc **in the same commit** as the code change, then tick the done-check and add a `CHANGES.md` entry.

> Industry consensus (docs-as-code): updating the doc in the *same commit* as the code is the only drift-prevention that reliably works. This repo is CI-free by choice, so the enforcement is: (1) this convention, (2) a **`Stop` hook** in `.claude/settings.json` that prints a non-blocking reminder when a turn changed code (`amplify/**`, `frontend/src/**`) but touched no `project-docs/` doc or `CHANGES.md`, and (3) the on-demand `AGENT_REVIEW_METHOD.md` sweep. There is no pipeline to catch you — the hook only nudges.

## Task entry template

```
## <task name> — <YYYY-MM-DD> — <active | done>
Goal: <one line>
Reads / references: <files, dirs>
Changes (code): <files>
Docs to update on completion: <project-docs/... paths · ARCHITECTURE.md section · CHANGES.md>
Done-check: [ ] code  [ ] docs updated (same commit)  [ ] CHANGES.md entry  [ ] verify (npm run verify)
```

## Where task entries live

- **In-session / ephemeral:** the in-session task list (no file needed).
- **Cross-session / worth recording:** copy `TASK_TEMPLATE.md` (this folder) to
  `project-docs/<domain>/_active/TASK_<YYYY-MM-DD>_<slug>.md`, or append the entry to the relevant `project-docs/<domain>/_active/` plan doc.

## Task files + pre-commit doc-guard (mechanized enforcement)

The convention above is partially enforced mechanically:

- **Task files:** for any non-trivial multi-file goal, copy `TASK_TEMPLATE.md` to
  `project-docs/<domain>/_active/TASK_<YYYY-MM-DD>_<slug>.md` before starting. Fill in
  Goal / Reads / Changes (code) / Docs to update / Completion checklist. Flip the header's
  status from `active` to `done` when the task finishes, in the same commit as the last doc update.
- **`.githooks/pre-commit`** (active automatically — `core.hooksPath` is already `.githooks`,
  same mechanism as `pre-push`):
  - **Blocks** a commit that stages files under `amplify/backend/function/**`,
    `global-perspectives-starter/frontend/src/**`, `scripts/**`, or `quality/*.js` without also
    staging a `CHANGES.md` entry. Bypass with `SKIP_DOC_GUARD=1 git commit ...` or
    `git commit --no-verify` for genuine one-offs (WIP branches, reverts).
  - **Reminds (never blocks):** if a staged code file appears in an open (`active`, not `done`)
    task file's "Changes (code)" list, prints that task file's "Docs to update" entries which
    aren't staged — a nudge, not a gate. Best-effort grep heuristic; fails open on any parse error.
  - Regression self-test: `scripts/test_pre_commit_hook.sh` (throwaway repo, never touches this one).

## Doc lifecycle (our informal ADR model)

Every plan/spec carries a `Status:` header and lives in a status folder:
`_shipped` ✅ · `_active` 🔧 · `_proposed`/not-built 🔭 · `_reference` 📎 (superseded but cited).
**To supersede a decision:** don't silently edit — add a dated banner explaining what changed, and move the doc to `_reference/` or `_legacy/` (see `_legacy/TIERS.md` for the model). This mirrors the ADR "supersede, don't overwrite" convention.

## Diátaxis mapping (how to read the folders)

- `architecture/` = **reference** (facts about the system) — authoritative.
- `playbooks/` = **how-to** (repeatable procedures).
- `plans/` (the domain `_shipped/_active/_proposed` docs) = **explanation + decisions** (why + what).
- We have no *tutorials* (internal eng repo).
