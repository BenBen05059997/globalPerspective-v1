---
name: deploy-frontend
description: Verify/build/package frontend changes locally or release them to the explicit Cloudflare or legacy GitHub Pages target. Use when the user asks to build, deploy, publish, update the live site, or release frontend changes.
allowed-tools: Bash, Read, Grep, Glob
---

# Deploy Frontend to Production

Production is the Cloudflare Worker `globalperspective-site` (cut over 2026-11-14). GitHub Pages stays as the
fallback until the operator retires it.

The default build-only command is local and needs no deploy authorization. Any Cloudflare upload
or GitHub Pages push needs explicit current-message authorization (a fresh yes every time), per repo `CLAUDE.md`.

## Steps

1. Run `./deploy.sh` (repo root) for verify/build/package only. It does not upload or publish.
   - Candidate Worker: after explicit authorization for candidate upload, run
     `./deploy.sh --target candidate` (Worker `globalperspective-site-candidate`).
   - Production (the normal release, live since 2026-11-14): after explicit authorization for
     production upload, run `./deploy.sh --target production` (Worker `globalperspective-site`). It
     refuses uncommitted packaged source and a HEAD not contained in `origin/main`.
   - No dual publish: releases go only to Cloudflare. Do not stage or push Pages per release
     (operator decision 2026-11-14).
   - Emergency fallback tools (only if Cloudflare hosting itself fails, until Pages is retired):
     `./deploy.sh --target stage-pages --artifact HASH` copies an archived package into `docs/`
     without commit/push. For a Pages release, after explicit authorization, run
     `./deploy.sh --target legacy-pages`; this invokes the preserved script with its
     existing `--commit`, `--push`, and `--skip-build` options.
   - If verification/build/package fails, stop before any upload or publish.
2. Commit the change with a plain descriptive message (git log is the change log).
3. Follow `DEPLOYMENT_NOTES.md` (next to this file) for target-specific smoke checks and release
   records. Do not infer candidate isolation from a `workers.dev` hostname: it shares the Worker
   code and configured backend integrations for that Worker.
4. After a production upload passes its smoke checks, record it with
   `./deploy.sh --target mark-verified --artifact HASH --version-id UUID` using the matching
   production upload record.

## Rollback

For a Cloudflare production release, restore the previous Worker version (a new code push alone is not a rollback).
Pages is only an emergency fallback if Cloudflare hosting itself fails (it holds an older build). Then
stage an artifact with `stage-pages`, review, commit and push the staged `docs/` under Pages-release authorization. Do not run `legacy-pages` afterward: it
would replace the selected archive with current build output. The cutover itself is rolled back as described in
`project-docs/decisions/0019-frontend-hosting-two-worker-cloudflare.md` and
`project-docs/architecture/ARCHITECTURE.md` (Hosting and the Cloudflare cutover).

## Notes

- Backend Lambdas are not touched by this skill — they deploy separately via the AWS CLI.
- Never overwrite `docs/config.js` — it's operator-owned runtime config. Cloudflare packaging
  validates the approved production runtime config separately; the ignored local
  `frontend/public/config.js` is incomplete.
