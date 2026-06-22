# agent-kit — portable solo-dev agent discipline

A copy-paste bundle that teaches Claude Code (or any coding agent) to operate on a
**solo-dev repo** the way it has been operating on Pro-Co: autonomous when it should be,
gated where it must be, and disciplined about verify / git / worktrees / deploy.

This folder is **project-agnostic**. Everything Pro-Co-specific (Firebase, SUUMO, AWS
region, exact npm scripts) has been stripped out and replaced with `<PLACEHOLDERS>`.
Fill those in once per project and the rules apply.

---

## What's in here

| File | What it gives you |
|---|---|
| `CLAUDE.template.md` | The **standing instructions** — drop into the new repo as `CLAUDE.md`. Autonomy rules, halt conditions, the never-without-auth list, deploy gate, no-CI-merge-gate. |
| `playbooks/VERIFY.md` | The 4-layer verification ladder (pre-commit → pre-deploy → post-deploy smoke → reviewer eyeball) + the independent-agent-audit pattern. |
| `playbooks/COMMIT_PUSH.md` | Safe staging discipline, conventional commits, landing to main via PR. |
| `playbooks/WORKTREE_CONCURRENCY.md` | One worktree per line of work — kills the "two sessions, one folder" git tangle class. |
| `playbooks/AUTOMATION_LOOP.md` | Running the agent autonomously for hours: Ralph loop, budget + kill switches, halt rules. |
| `MEMORY_SYSTEM.md` | The file-based persistent-memory convention (categories, frontmatter, the index file). |

---

## How to adopt in a new project (10 minutes)

1. **Copy the folder** into the new repo root:
   ```bash
   cp -R /path/to/agent-kit ./agent-kit
   ```
2. **Create `CLAUDE.md`** from the template and fill the placeholder table at the top:
   ```bash
   cp agent-kit/CLAUDE.template.md ./CLAUDE.md
   # then edit the "Project facts" table — see the placeholder map below
   ```
3. **Wire your verify command.** Pick the single command that means "this change is safe
   to commit" (e.g. `npm run verify`, `make check`, `cargo test`). Put it in the table.
   If you don't have one, create it — the whole kit hangs off a one-command pass/fail gate.
4. **Decide your deploy command + its gate.** What ships to prod, and the one rule that it
   only runs on the user's explicit say-so.
5. **(Optional) Seed memory.** If your agent supports file-based memory, create the memory
   dir and an empty `MEMORY.md` index per `MEMORY_SYSTEM.md`.

That's it. The agent reads `CLAUDE.md` at session start; the playbooks are referenced from it.

---

## Placeholder map (find-and-replace in `CLAUDE.md`)

| Placeholder | Meaning | Pro-Co example |
|---|---|---|
| `<APP_DIR>` | Subfolder the app lives in (`.` if repo root) | `jp-property-app` |
| `<VERIFY_CMD>` | One command = "safe to commit" (tsc + lint + tests) | `npm run verify` |
| `<VERIFY_FULL_CMD>` | Stricter pre-deploy gate | `npm run verify:full` |
| `<SMOKE_CMD>` | Post-deploy smoke check | `npm run smoke` |
| `<DEPLOY_CMD>` | What publishes to production | `npm run deploy` |
| `<PROD_URL>` | Public URL to curl for 200 after deploy | `https://www.pro-co.net/` |
| `<DEFAULT_BRANCH>` | Trunk | `main` |
| `<CLEAN_BUILD_DIRS>` | Stale build dirs to `rm -rf` before deploy | `.next .open-next` |
| `<NEVER_TOUCH>` | Files/systems that need explicit auth (env, billing, auth config) | `.env*`, billing, Firebase config |

---

## The philosophy in one paragraph

Solo dev means **no second human is the safety net** — so the agent provides its own.
The gate is **local and fast** (one verify command), not a CI queue you wait on. The agent
**keeps going** on recoverable work (anything `git revert` can undo) and **stops cold** on
the irreversible (push, deploy, destructive data ops, money, auth). Concurrency pain is
solved structurally (worktrees), not with heroics. Every irreversible step is confirmed,
every reversible step is just done. That balance is the whole kit.
