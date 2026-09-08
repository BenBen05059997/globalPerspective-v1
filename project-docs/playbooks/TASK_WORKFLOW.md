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

- **In-session / ephemeral:** the `TodoWrite` tool (no file needed).
- **Cross-session / worth recording:** append the entry to the relevant `project-docs/<domain>/_active/` plan doc, or start a new one there.

## Doc lifecycle (our informal ADR model)

Every plan/spec carries a `Status:` header and lives in a status folder:
`_shipped` ✅ · `_active` 🔧 · `_proposed`/not-built 🔭 · `_reference` 📎 (superseded but cited).
**To supersede a decision:** don't silently edit — add a dated banner explaining what changed, and move the doc to `_reference/` or `_legacy/` (see `_legacy/TIERS.md` for the model). This mirrors the ADR "supersede, don't overwrite" convention.

## Diátaxis mapping (how to read the folders)

- `architecture/` = **reference** (facts about the system) — authoritative.
- `playbooks/` = **how-to** (repeatable procedures).
- `plans/` (the domain `_shipped/_active/_proposed` docs) = **explanation + decisions** (why + what).
- We have no *tutorials* (internal eng repo).
