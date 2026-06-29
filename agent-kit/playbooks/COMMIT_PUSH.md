# Commit / Push / Land Playbook

> The git workflow for this repo — and the traps that actually bite. Companion to
> `WORKTREE_CONCURRENCY.md` and `VERIFY.md`.

## Golden rules (TL;DR)

1. **Stage explicit paths, never `git add -A` / `git add .`** — a concurrent session's bare
   `git add` can sweep your files into its commit, and you'll stage build/cache/env noise.
2. **Verify the staged set:** `git diff --cached --name-only` → abort if a foreign or generated
   file appears.
3. **`git commit -F -`** (heredoc), not `-m`, for messages with apostrophes / non-ASCII / long bodies.
4. **Never commit** generated artifacts, `.env*` secrets, build caches, or another session's files.
5. **Land to `<DEFAULT_BRANCH>` via a PR** when the branch may have diverged — it does the 3-way
   merge server-side; a raw `push branch:main` only works on a clean fast-forward.
6. **Merged ≠ live.** Deploy is a separate, gated `<DEPLOY_CMD>`.
7. Commit/push **only when the user asks**; if on `<DEFAULT_BRANCH>`, branch first.

## Commit safely

```bash
# Stage ONLY your files, explicitly.
git add path/to/a.ts path/to/b.tsx

# Verify before committing — abort if anything foreign appears.
git diff --cached --name-only

# Commit with -F (heredoc) — '-m' breaks on apostrophes; heredoc handles any text.
git commit -F - <<'EOF'
type(scope): subject

Body explaining why.

Co-Authored-By: <agent attribution if your workflow uses one>
EOF
```

> For paths containing glob metacharacters (e.g. `[bracketed]` route folders), set
> `GIT_LITERAL_PATHSPECS=1` so git treats the brackets literally.

## The shared-index trap (concurrency)

If a second agent session shares the same checkout, the git **index is shared**. Real failures:
a foreign `git add -A` steals your staged files; HEAD moves under you; your edit to a shared file
gets swept into their commit. **Mitigation:** stage explicit paths → `git diff --cached` → commit
immediately (small window). Detect a concurrent session first (`ps aux | grep -iE "build|dev"`,
`.git/index.lock` present, dirty unrelated files). Same-file co-edits can't be isolated — idle the
other session or move to a **worktree** (`WORKTREE_CONCURRENCY.md`). Never `git add -A` with a
session active.

## Push

```bash
git fetch origin
git push origin <branch>
```

Branch already on origin + you're ahead → clean fast-forward. Diverged → `git fetch` + rebase,
then push; on a shared branch, **don't force**. (If a large generated file is in history and push
fails with `HTTP 400 / RPC failed`, raise the buffer: `git -c http.postBuffer=524288000 push` — but
better: don't commit large generated files.)

## Landing to the default branch

Prefer a **PR** when the branch may have diverged:

```bash
gh pr create --base <DEFAULT_BRANCH> --head <branch> --title "…" --body "…"
gh pr view <n> --json mergeable,mergeStateStatus -q '.mergeable, .mergeStateStatus'  # want MERGEABLE / CLEAN
gh pr merge <n> --merge
```

Solo dev: once local verify is green and the PR is mergeable, **merge immediately** — do not wait
on GitHub CI (it's informational, never the gate).

When a second session occupies the working tree, do **not** `git checkout <DEFAULT_BRANCH>` there
(you'd carry their uncommitted files). Land from an **isolated worktree** instead:

```bash
git fetch origin
git worktree add -b tmp-land /tmp/land origin/<DEFAULT_BRANCH>
cd /tmp/land
git cherry-pick <yourCommitA> <yourCommitB>   # replay only YOUR commits
# verify, then:
git push origin tmp-land:<DEFAULT_BRANCH>
cd - && git worktree remove /tmp/land && git branch -D tmp-land
```

## Merged ≠ deployed

Code on `<DEFAULT_BRANCH>` is not on `<PROD_URL>`. Deploy is manual and **gated**:

```bash
cd <APP_DIR> && rm -rf <CLEAN_BUILD_DIRS> && <DEPLOY_CMD>
curl -s -o /dev/null -w "%{http_code}" <PROD_URL>   # MUST be 200
```

`rm -rf <CLEAN_BUILD_DIRS>` first or you risk a no-op deploy (stale code ships, smoke still passes).

## Deploy cadence — one push at a time (GitHub Pages concurrency trap)

**Bit us 2026-06-30.** GitHub Pages deploys via a `github-pages` environment with **cancel-in-progress** concurrency: every push (or manual `POST /pages/builds`, or `gh run rerun`) creates a new deployment that **cancels the one still publishing**. Stacking ~5 pushes/triggers in a few minutes (source commit → deploy commit → docs commit → force-rebuild → empty re-trigger) made the *build* succeed every time but the *deploy* step fail with **"Deployment cancelled"** — looked like a hard breakage, was just self-inflicted thrash. After enough rapid failures, new pushes may **stop triggering builds at all** (Pages back-pressure). The site kept serving the prior-good bundle the whole time (200), so users saw nothing.

Rules:
- **Batch first, push once.** Land source + `docs/` + any doc updates in as few pushes as possible, then **let that one deploy settle** before the next push. `deploy.sh --commit … --push` already bundles build+docs into one commit — don't chase it with more pushes.
- **Don't hammer to "fix" a failing deploy.** More triggers prolong the thrash. Wait for the in-flight run to finish.
- **Diagnose before re-triggering:** the *build* vs *deploy* job tells you which half failed —
  ```bash
  gh api repos/<OWNER>/<REPO>/actions/runs --jq '.workflow_runs[0:5][]|{head:.head_sha[0:7],status,conclusion}'
  gh api repos/<OWNER>/<REPO>/pages/builds/latest --jq '{status,commit:.commit[0:7],error:.error.message}'
  ```
  Build-OK + deploy-"cancelled" = concurrency, not content. Confirm it's not a real outage: GitHub Pages component on githubstatus.com.
- **Verdict on liveness = the served bundle, not the API "errored" flag.** A superseded attempt shows `errored`/`cancelled` even though an earlier attempt published. Trust `curl <PROD_URL>/index.html | grep -o 'index-[A-Za-z0-9]*\.js'` matching the freshly-built hash.

## Quick checklist

- [ ] `<VERIFY_CMD>` green
- [ ] Concurrent session? → explicit staging + worktree if needed
- [ ] Staged only intended paths; `git diff --cached --name-only` reviewed
- [ ] No generated artifacts / `.env*` / foreign files staged
- [ ] `git commit -F -` with attribution trailer
- [ ] Land via PR (diverged) or fast-forward (clean)
- [ ] Deploying? → **one push, then let it settle** — don't stack pushes/reruns (Pages cancel-in-progress thrash)
- [ ] If "live" is the goal → deploy is a separate, gated step
