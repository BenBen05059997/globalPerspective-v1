<!--
Lives next to TASK_WORKFLOW.md (which links to it). See TASK_WORKFLOW.md's
"Task files + pre-commit doc-guard" section.

HOW TO USE: copy this file to project-docs/<domain>/_active/TASK_<YYYY-MM-DD>_<slug>.md
before starting a non-trivial multi-file task. Fill in every section BEFORE writing code.
Keep the file lists honest as scope shifts. On finish, update every doc listed under
"Docs to update" in the SAME commit as the code change, tick the checklist, flip the status
in the header from `active` to `done`, and add the CHANGES.md entry.
-->

## <task name> — <YYYY-MM-DD> — <active | done>

<!-- One line: what outcome does this task produce, and why now. -->
**Goal:**

<!-- Files/dirs this task reads or relies on for context — not modified, just referenced. -->
**Reads / references:**

<!-- Every file this task will create, edit, or delete. Be exhaustive — this list is what
     the pre-commit doc-guard hook's reminder checks staged files against. Update as scope shifts. -->
**Changes (code):**

<!-- Every doc that goes stale if the above lands without it: which project-docs/ file(s),
     which ARCHITECTURE.md section/line, README.md line, CHANGES.md entry, INDEX.md row, etc.
     This is the list the pre-commit hook's reminder prints when it finds a staged code file
     matching this task's "Changes (code)" list. -->
**Docs to update on completion:**

<!-- One line per concrete, checkable outcome. Always include: code done, docs updated in the
     same commit, CHANGES.md entry, verify/tests pass, and (if relevant) "no deploy — deferred
     to next gated deploy". -->
**Completion checklist:**
- [ ] code
- [ ] docs updated (same commit)
- [ ] CHANGES.md entry
- [ ] verify (`npm run verify` / relevant quality script)
- [ ] status header flipped to `done`
