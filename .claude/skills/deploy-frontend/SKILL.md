---
name: deploy-frontend
description: Build and deploy frontend changes to GitHub Pages production. Use when the user asks to deploy, publish, push to production, update the live site, or release frontend changes. Triggers on phrases like "deploy", "publish frontend", "push to prod", "update production", "go live".
allowed-tools: Bash, Read, Grep, Glob
---

# Deploy Frontend to Production

Only run this after an explicit deploy "yes" in the current message — deploying prod needs a
fresh confirmation every time, per repo `CLAUDE.md`.

## Steps

1. `./deploy.sh` (repo root) — builds, copies `dist/` → `docs/`, strips `docs/assets/*.map`,
   resyncs `docs/404.html` byte-identical to `index.html`, and hash-guards `docs/config.js`
   (aborts if it changed). Add `--commit "msg"` to commit; add `--push` only if the deploy "yes"
   covers pushing too.
   - If the build fails, stop and show the error — don't proceed to copy/commit.
2. Update `CHANGES.md` with a dated entry (what changed, why, files touched) if `./deploy.sh
   --commit` didn't already fold that in.
3. Verify: `diff docs/index.html docs/404.html` is empty; then
   `curl -s -o /dev/null -w "%{http_code}" https://globalperspective.net` → `200`.
4. If not using `--push`, push once (`git push`) and let GitHub Pages settle (1-2 minutes) —
   don't push repeatedly in quick succession.

## Rollback

If deployment breaks production: `git log --oneline -5`, then `git revert <sha>` and push again.

## Notes

- Backend Lambdas are not touched by this skill — they deploy separately via the AWS CLI.
- Never overwrite `docs/config.js` — it's operator-owned runtime config; `deploy.sh`'s hash guard
  will refuse to proceed if it changed unexpectedly.
