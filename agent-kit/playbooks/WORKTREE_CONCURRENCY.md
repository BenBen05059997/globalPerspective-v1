# Worktree & Concurrency Playbook

> The git tangles — HEAD moving under you, a `git add -A` sweep stealing your staged files, a
> build reading another session's half-saved file — are **not** caused by having two people.
> They're caused by **two sessions sharing one folder on disk.** Even solo, the moment you run
> two agent/terminal sessions on the same checkout, you get the contention. Fix it structurally.

## The mental model

A **git worktree** is a second working folder attached to the same repo. Each worktree has its
**own files, own branch, own index (staging area)**; they share one `.git` history + objects +
remote-tracking refs.

```
my-project/            ← main worktree   (branch: main)
../proj-feature-a/     ← worktree #2     (branch: feat/a)
../proj-feature-b/     ← worktree #3     (branch: feat/b)
```

`cd` is per-shell, so: A's edits/saves/typecheck never see B's files; A's `git add`/`commit` touch
only A's index; A checking out a branch never moves B's HEAD. That is the entire fix.

## Setup — one worktree per line of work

```bash
git worktree add ../proj-feature-a -b feat/a <DEFAULT_BRANCH>   # new branch in its own folder
# or attach an existing branch:
git worktree add ../proj-feature-b feat/b
```

Each new worktree starts with **no dependencies installed** — give it some:

```bash
# macOS/APFS copy-on-write (near-instant, same volume, REAL dir not a symlink):
cp -Rc ./<APP_DIR>/node_modules ../proj-feature-a/<APP_DIR>/node_modules
# or a clean install:
cd ../proj-feature-a/<APP_DIR> && npm ci
```

Copy any **gitignored env files** too, or the build bakes wrong/empty config:

```bash
cp <APP_DIR>/.env.local ../proj-feature-a/<APP_DIR>/.env.local
```

> ⚠️ Dependencies must be a **real directory on the same volume, never a symlink** — symlinked
> `node_modules` breaks some bundlers ("points out of the filesystem root"). `cp -Rc` (APFS clone)
> avoids it.

## Daily procedure (each worktree, independently)

Because the index is yours alone, **plain git is safe again** — no staging gymnastics.

1. Work + save — only in your own folder.
2. `<VERIFY_CMD>` — reflects only your edits.
3. `git add -A && git commit -m "feat(scope): …"` — your index, your commit.
4. `git fetch && git rebase origin/<DEFAULT_BRANCH>` before pushing.
5. `git push -u origin <branch>` → PR (or land when ready).

## The 3 gotchas that remain (real, even with worktrees)

1. **Two worktrees can't check out the same branch** — git refuses. Each needs its own branch.
   (A feature: it forces separation.)
2. **Shared `.git` = shared remote refs.** A `git fetch` in *any* worktree updates `origin/*` for
   *all* of them. Never assume HEAD is pinned while another worktree is active — `git log --oneline -1`
   before acting on HEAD.
3. **Each worktree needs its own deps + env files** (see setup); they aren't shared or branch-tracked.

## Solo deploy — no CI required

You don't need CI to deploy. The only rule that matters solo: **never run `<DEPLOY_CMD>` from two
sessions at once** ("last deploy wins"). Build in the worktree that has the change
(`rm -rf <CLEAN_BUILD_DIRS>` → build → `<DEPLOY_CMD>` → `curl <PROD_URL>` for 200). Each worktree has
its own build dirs, so two can *build* concurrently — they just must not *deploy* concurrently.

## Teardown

```bash
git worktree remove ../proj-feature-a   # when merged/abandoned
git worktree list                       # see active worktrees
git worktree prune                      # clean stale entries
```

## Already tangled in one shared folder? (reactive firefight)

If you're *already* in the mess (both sessions in one checkout, HEAD moving, staged files
vanishing), don't fight it:

- **Detect:** `ps aux | grep -iE "build|dev" | grep -v grep` (>0), `.git/index.lock` present, or
  typecheck failing in files you didn't touch (someone editing).
- **Never** kill its processes, `rm .git/index.lock`, or overwrite its commits/deploys.
- Wait for a clean window (verify passes + no build running), use guarded atomic git (verify staged
  paths, `git fetch` + rebase before push), and confirm the result.
- **The real fix is to migrate this line of work into its own worktree** so it can't recur.
- If it never settles, surface it — the other session must close. Don't burn cycles retrying into a
  moving target.

## TL;DR

- Pain isn't "team" — it's **two sessions, one folder.** Solo still hits it.
- **One worktree per line of work**, each with its own deps (`cp -Rc`, not symlink) + copied `.env*`.
- Inside a worktree, **plain `git add -A && git commit` is safe again.**
- **No CI needed** — just never deploy from two sessions at once.
- A fetch anywhere updates `origin/*` everywhere — check `git log --oneline -1` before acting on HEAD.
