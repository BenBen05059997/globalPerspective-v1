# Claude Instructions — <PROJECT NAME>

> Standing instructions for autonomous and interactive work on this **solo-dev** repo.
> Read at the start of every session. Companion playbooks live in `agent-kit/playbooks/`.

## Project facts (fill these in once)

| Key | Value |
|---|---|
| App directory | `<APP_DIR>` |
| Verify (pre-commit gate) | `<VERIFY_CMD>` |
| Verify-full (pre-deploy gate) | `<VERIFY_FULL_CMD>` |
| Smoke (post-deploy) | `<SMOKE_CMD>` |
| Deploy command | `<DEPLOY_CMD>` |
| Production URL | `<PROD_URL>` |
| Default branch | `<DEFAULT_BRANCH>` |
| Build dirs to clear before deploy | `<CLEAN_BUILD_DIRS>` |

---

## Default mode: keep going

When the user says "go", "do all", "auto run", "finish on your own", or similar — and
during any autonomous chain:

- **Don't stop to confirm scope** mid-chain. A task that "looks bigger than expected" is still the task.
- **Don't ask for design decisions** that are recoverable via `git revert`. Make a defensible call and ship; the user redirects if needed.
- **Don't stop to check "is the user still watching."** They're not. They're trusting you to be done when they come back.
- **Report what + why after every change**, not batched to the end.

## When to actually halt

Halt only on:
1. **Real verify failure** — `<VERIFY_CMD>` exits non-zero and re-running doesn't fix it.
2. **Type/build error** that needs understanding outside the changed file.
3. **Genuine ambiguity** — two valid interpretations with non-recoverable outcomes (data loss, irreversible API call, billing change).
4. **Destructive / outward-facing action** the user must authorize (see the never-without-auth list).
5. **Business decision** with no defensible default (pricing, legal copy, strategic positioning).
6. **Queue empty** — every item in scope is shipped.

**Not a halt condition:** file count > 5 (commit in chunks) · "this looks complicated" (read carefully, then do it) · "I might be over-extending" (you have verify; let it tell you) · a stale audit (mark and move on).

## What you can NEVER do without explicit authorization

Each of these needs a fresh "yes" **in the current message** — a prior "yes" does NOT carry forward:

- `git push` (any flavor) — commit locally; the user pushes (unless told "push as you go").
- `<DEPLOY_CMD>` — production deploy. See the deploy gate below.
- Any **destructive data op** — delete rows, drop tables, force-overwrite.
- Touch **payment / billing / subscription** code.
- Touch **auth provider config** (project settings, OAuth client IDs).
- Edit **`.env*`** files or anything in `<NEVER_TOUCH>`.
- Add a **new external dependency / paid API** integration.
- `git push --force`, `git reset --hard`, or rewriting a branch another session may be on.

## Deploy gate (hard rule)

**NEVER run `<DEPLOY_CMD>` (or anything that publishes) unless the user types an explicit
deploy authorization in the current message.** A prior "yes" does NOT carry forward — wait
for fresh authorization each time.

- Local verification builds (build + run on localhost for e2e) are fine without per-run auth,
  **provided nothing is published** and no other build is already running.
- Before deploy: `rm -rf <CLEAN_BUILD_DIRS>` (a stale build dir → no-op deploy that ships old
  code while smoke still passes), then build, then `<DEPLOY_CMD>`.
- **After EVERY deploy:** `curl -s -o /dev/null -w "%{http_code}" <PROD_URL>` — MUST be `200`.
  Smoke alone is not enough; it often skips the logged-out landing page.

## Solo dev — the merge gate is LOCAL, never GitHub CI

This is a solo-dev repo. **The gate is local:** `<VERIFY_CMD>` passing. Once it's green and
the change is ready, **land it immediately** — do not wait for, poll, or watch any GitHub
Action (`gh run watch`, `gh pr checks` as a *blocker* are forbidden). CI is informational and
post-hoc, never a merge blocker. (Only real serialization need: don't run two deploys at once.)

## Default decisions (apply without asking)

- **Conventional commits** — `feat|fix|chore(scope): description`, body explains *why*.
- **i18n / config keys** — add to all locale/config files at once; pick reasonable wording, user fixes copy in review.
- **Tests** — write one when you add a non-trivial helper; skip for pure rendering/copy changes.
- **Commit cadence** — one commit per coherent unit of work; don't bundle unrelated changes.
- **UI placement** — match existing patterns; put it where a user would look.
- **No fallback values** for missing data — surface `—`/null so gaps stay visible, never invent a guess.
- **No comments** unless the surrounding code has them or the user asks.
- **Match the surrounding code** — naming, idiom, comment density.

## Verify before you commit (see `playbooks/VERIFY.md`)

- `<VERIFY_CMD>` before a normal commit (~fast gate).
- `<VERIFY_FULL_CMD>` before any deploy.
- `<SMOKE_CMD>` after any deploy.
- Diffs ≥ ~100 net lines, page rewrites, cross-cutting refactors → spawn an **independent
  agent audit** before landing (it reads the actual files and cites `file:line`).

## Commit safely (see `playbooks/COMMIT_PUSH.md`)

- **Stage explicit paths, never `git add -A` / `git add .`** — review `git diff --cached --name-only`
  before committing; abort if a foreign or generated file appears.
- Land to `<DEFAULT_BRANCH>` via a PR when the branch may have diverged.
- **Merged ≠ deployed** — deploy is always a separate, gated step.

## Concurrency (see `playbooks/WORKTREE_CONCURRENCY.md`)

The git tangles (HEAD moving under you, staged files vanishing) come from **two sessions
sharing one folder**, not from having two people. Fix it structurally: **one worktree per
line of work**. Inside a worktree, plain `git add -A && git commit` is safe again.

## Diagnose before fixing

"Why is X not working" / "check this" = **diagnose first, report, then wait for go-ahead.**
Don't rewrite unprompted. But when the user **shows a concrete defect**, that IS the
go-ahead — fix all demonstrated problems in one pass.

## End-of-chain report

Always close an autonomous chain with: **what shipped** (bullets + SHAs) · **what was already
fine** · **what's deferred** (with the real reason) · **verify status** · **what needs the
user** (push / deploy / decide). Then stop — don't ask "should I continue with X?".
