---
name: deploy-frontend
description: Verify/build/package frontend changes locally or release them to the explicit Cloudflare or legacy GitHub Pages target. Use when the user asks to build, deploy, publish, update the live site, or release frontend changes.
allowed-tools: Bash, Read, Grep, Glob
---

# Deploy Frontend to Production

The default build-only command is local and needs no deploy authorization. Any Cloudflare upload
or GitHub Pages legacy release needs explicit current-message authorization, per repo `CLAUDE.md`.

## Steps

1. Run `./deploy.sh` (repo root) for verify/build/package only. It does not upload or publish.
   - Candidate Worker: after explicit authorization for candidate upload, run
     `./deploy.sh --target candidate` (Worker `globalperspective-site-candidate`).
   - Production Worker: after explicit authorization for production upload, run
     `./deploy.sh --target production` (Worker `globalperspective-site`).
   - Legacy Pages: after explicit authorization for the Pages release, run
     `./deploy.sh --target legacy-pages`; this invokes the preserved script with its existing
     `--commit`, `--push`, and `--skip-build` options.
   - Exact Pages staging for dual-publish or rollback: run
     `./deploy.sh --target stage-pages --artifact HASH`. This copies the archived package into
     `docs/` without commit/push. Publishing that staged output still needs explicit legacy-release
     authorization.
   - If verification/build/package fails, stop before any upload or publish.
2. Update `CHANGES.md` with a dated entry (what changed, why, files touched).
3. Follow `project-docs/runbooks/DEPLOYMENT_NOTES.md` for target-specific smoke checks and release
   records. Do not infer candidate isolation from a `workers.dev` hostname: it shares the Worker
   code and configured backend integrations for that Worker.
4. After a production upload passes its smoke checks, record it with
   `./deploy.sh --target mark-verified --artifact HASH --version-id UUID` using the matching
   production upload record.

## Rollback

For Pages rollback, stage the prior artifact with `stage-pages`, then review, commit and push
the staged `docs/` under Pages-release authorization. Do not run `legacy-pages` afterward: it
would replace the selected archive with current build output. For Cloudflare, roll back the recorded Worker version and artifact as described in the
migration plan. A new code push alone is not a rollback.

## Notes

- Backend Lambdas are not touched by this skill — they deploy separately via the AWS CLI.
- Never overwrite `docs/config.js` — it's operator-owned runtime config. Cloudflare packaging
  validates the approved production runtime config separately; the ignored local
  `frontend/public/config.js` is incomplete.
