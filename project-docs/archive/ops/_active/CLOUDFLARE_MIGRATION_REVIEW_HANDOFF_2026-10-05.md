# Cloudflare frontend migration — implementation review handoff

**Date:** 2026-10-05  
**Prepared for:** another agent to review before any upload or live migration  
**Working-tree base:** `347e16d89b518116e04a058133ac1a3d4035226a`  
**Status:** local implementation prepared and tested; no candidate deployment, production deployment, or domain cutover has occurred. Changes are uncommitted.

This document consolidates what was done, the changed-file inventory, test evidence, current plan stage, and remaining work. It is a review handoff, not deployment authorization. File paths below are relative to the repository root.

## 1. Summary of work completed

Luna implemented the static-site Worker, candidate front-Worker wrapper, packaging/release scripts, tests, and deployment documentation. The primary agent captured the live baseline, reviewed the changes, corrected integration issues, ran frontend and local-runtime checks, and updated the plan and task ledger.

Prepared architecture:

```text
Current production:
globalperspective.net → globalperspective-rss route Worker → GitHub Pages docs/

Planned production after approved cutover:
globalperspective.net → globalperspective-rss route Worker → globalperspective-site → static assets

Initial candidate:
workers.dev → globalperspective-site-candidate → static assets

Later approved chained candidate:
next.globalperspective.net → globalperspective-rss → globalperspective-site-candidate → static assets
```

The static origin and the existing dynamic front Worker remain separate. AWS APIs, S3, Firebase, membership, and billing behavior remain outside the hosting migration. GitHub remains the source repository. Automatic deployments/Workers Builds are deferred.

### Live baseline captured

- Downloaded actual `globalperspective-rss` source and read its settings, deployment version, route configuration, account Custom Domains, and secret binding names. Secret values were not retrieved or placed in the repository.
- Current captured version: `91ba1e98-0959-4387-84f3-10a0d5790ad8`, deployed October 1, 2026. Compatibility date: `2026-04-01`.
- Captured source matches the JavaScript snapshot in `WORKER_FULL_CODE.md` exactly. SHA-256: `48f1b03ebfab8382652ef94cbc6e3d480182d7f61203dfd0a5048f0981812989`.
- Existing routes `globalperspective.net/*` and `globalperspective.net/rss*` target the front Worker. No `www` route was returned; this does not establish the complete `www` DNS/redirect behavior.
- GitHub Pages reports built, source `main:/docs`, custom domain `globalperspective.net`.
- Live `/blog/` returns the app shell, confirming the old front Worker's extensionless SPA fallback intercepts blog pages. This is an existing production issue, not a regression introduced by the new local files.
- Existing OAuth access can read zone/Worker/routes. DNS records and rulesets still return authentication errors; SSL settings and page rules return unauthorized errors. Phase A is therefore incomplete for exact cutover and rollback planning.

### Static-site Worker

- New production identity: `globalperspective-site`; separate candidate identity: `globalperspective-site-candidate`. Candidate uploads do not reuse the eventual production Worker.
- Uses Workers Static Assets through `ASSETS`, with `run_worker_first: true`, `html_handling: "none"`, and `not_found_handling: "none"`.
- Implements explicit directory-index handling for all blog pages and navigation-only SPA fallback. Missing JavaScript, CSS, images, and blog pages return real 404 responses.
- `/index.html` returns shell bytes directly with 200, avoiding a redirect loop with the existing front Worker's internal shell request.
- Sets candidate `X-Robots-Tag: noindex`, revalidation for HTML/config, and long immutable caching for successful hashed assets. Errors are not cached immutably.
- Raw static origin does not implement `/rss` or `/data/*`; those remain in the front Worker.
- Pinned Wrangler `4.147.0`; new site compatibility date `2026-10-01` matches the installed local runtime.

### Candidate front-Worker compatibility wrapper

- Imports the captured live baseline rather than rewriting its RSS, bot, data, or membership branches.
- On exactly `next.globalperspective.net`, sends `/blog` and `/blog/*` GET/HEAD requests to the origin before the baseline SPA fallback.
- Adds noindex to final candidate responses, including directly generated bot HTML, shell responses, and errors. Candidate exceptions return a controlled 502.
- All other hostnames delegate to the baseline unchanged. The production blog exception is deliberately not enabled yet and remains required before production cutover.
- This is a two-module source package. Uploading it later requires a reviewed code-only update preserving the live Worker's settings/bindings/secrets; a bare incomplete Wrangler deployment is not appropriate. No uploader for that live patch has been executed.

### Packaging and release workflow

- `./deploy.sh` now defaults to local frontend verification, hosting tests, build, and packaging. It performs no upload in default mode.
- Explicit targets: `candidate`, `production`, `legacy-pages`, `stage-pages`, and `mark-verified`.
- Preserved the previous Pages script separately, including its existing optional commit/push flags.
- Stages Vite output plus authoritative `docs/config.js`, eight blog pages, sitemap, and whitepaper. Vite public files supply the remaining public assets. Excludes source maps, `CNAME`, and `.nojekyll` from Cloudflare assets.
- Validates the nine expected browser-config fields and required core values; ignores the incomplete local Vite public config as the production input. Operator-owned `docs/config.js` is not modified.
- Keeps manifests and archived upload packages in ignored `.site-releases/`. Release identity covers asset bytes, Worker source hash, and Wrangler config hash. Records source commit and dirty state.
- Candidate upload checks account Custom Domains and the configured production zone's routes, refuses unreadable/attached candidate state, pins the account, and records Wrangler's exact `Current Version ID`.
- Uploads read the validated archive; current Worker/config must match the selected manifest. Upload success alone does not mark a release verified.
- `stage-pages` restores the selected archive into local `docs/`, preserving config and Pages markers. It does not commit/push. After staging an archive, publish the reviewed docs changes directly under release authorization; do not run the legacy rebuild afterward, as that would replace the selected artifact.
- `mark-verified` records a production artifact/version only when a matching upload record exists. The operator must first complete post-deploy smoke checks.

### Issues corrected during primary-agent review

- Prevented the output-path guard from rejecting its own intended `site-dist` directory; restricted output/source overlap and symlink handling, including refusal of the whole temporary directory as output.
- Validated executable runtime config instead of accepting field names in comments/text.
- Included Worker/config hashes in release identity and guarded uploads against changed source or archive bytes.
- Extracted the version from the actual upload result rather than assuming the account's latest version was this upload.
- Added exact-artifact Pages staging to avoid rebuilding a different fallback artifact.
- Allowed old archived assets to be staged for Pages rollback without requiring current Worker source to equal the old version.
- Added hosting tests to the default release gate; excluded generated assets and Node Worker tests from inappropriate frontend lint/Vitest traversal.
- Corrected a test's working-directory assumption and restored `deploy.sh` executable permission.
- Corrected stale documentation claiming the front Worker's SPA fallback was not deployed.

## 2. Current stage against the migration plan

Plan: `project-docs/plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md`.

| Plan phase | Actual state | Remaining work |
|---|---|---|
| A — capture baseline | **Partially complete.** Live Worker source/version/settings/routes and Pages state captured; blog interception confirmed; local Pages artifact preserved. | Capture exact DNS records, TLS/redirect/cache rules and apex/www behavior; finish representative live response coverage and exact reversal procedure. |
| B — implement/package locally | **Implemented and locally verified, awaiting independent review.** Static Worker, candidate wrapper, packaging/release scripts, tests and docs prepared. | Address review findings; validate any implementation assumptions exposed by remote candidate/chained testing. |
| C — candidate deployment/review | **Not started remotely.** Candidate files and artifact ready; no online candidate URL exists from this task. | Authorize/upload candidate; define controlled preview policy; validate workers.dev, then separately approve test hostname/routes/shared front-Worker patch and test the real chain. |
| D — production cutover/rollback | **Not started.** Existing production remains Pages. | Complete exact transition/reversal, auth/browser gates, production blog patch, approvals, dual publishing, observation and rollback checks. |
| E — merge Workers | **Deferred/out of scope.** | Separate future decision; not needed for this two-Worker migration. |

The plan status now says **IMPLEMENTING LOCALLY**, records the updated access gap, uses separate candidate/production identities, and reflects explicit Worker-first/manual fallback settings. The plan stays at its existing `_proposed/` path for continuity; its status text and active task ledger describe the actual progress.

**The first milestone of a working online candidate has not been reached.** The checked local completion boxes in the task ledger do not mean all of Phase A or the migration itself is complete.

## 3. Complete changed-file inventory

Inventory checked against the working tree when writing this handoff: 16 modified tracked files, 15 previously untracked implementation files, plus this new handoff document. The migration plan already had uncommitted review corrections when implementation began; those were preserved and further updated. No files were committed or pushed by this work.

### Modified tracked files

| File | Change |
|---|---|
| `.claude/skills/deploy-frontend/SKILL.md` | Explicit release targets, local build default, archive staging, verification and rollback guidance. |
| `.gitignore` | Ignores site-dist, local Wrangler state, and release archives/records. |
| `CHANGES.md` | Dated local migration entry; explicitly not deployed. |
| `CLAUDE.md` | Current hosting, revised commands and authorization boundaries. |
| `README.md` | Current hosting and build/release entrypoint guidance. |
| `deploy.sh` | Replaced implicit Pages release default with local build/package and explicit targets; frontend and hosting gates. |
| `global-perspectives-starter/frontend/eslint.config.js` | Excludes site-dist and .wrangler generated output. |
| `global-perspectives-starter/frontend/package-lock.json` | Wrangler dependency tree and resolved dependency updates; large diff warrants dependency review. |
| `global-perspectives-starter/frontend/package.json` | Exact Wrangler dependency and `test:hosting` command. |
| `global-perspectives-starter/frontend/vite.config.js` | Excludes Worker Node tests and site-dist from Vitest discovery. |
| `project-docs/INDEX.md` | Links current plan/task status and removes duplicate migration entry. |
| `project-docs/architecture/ARCHITECTURE.md` | Captured live facts, current/planned hosting, Worker paths and release workflow. |
| `project-docs/archive/distribution/WORKER_FULL_CODE.md` | Marks source snapshot/history and updates deployment guidance; baseline code preserved. |
| `project-docs/runbooks/DEPLOYMENT_NOTES.md` | Local build versus explicit release, artifacts, exact Pages staging and rollback. |
| `project-docs/runbooks/DOMAIN_SETUP.md` | Current hosting/status, access gaps and gated migration guidance. |
| `project-docs/plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md` | Preserved prior review fixes; updated local progress, captured evidence, Worker identities and routing choices. |

### Added implementation and review files

| File | Purpose |
|---|---|
| `cloudflare/front-worker/README.md` | Candidate wrapper behavior and future two-module code-only upload/recovery requirements. |
| `cloudflare/front-worker/baseline/capture.json` | Sanitized live version/source hash, routes, binding names and access gaps. |
| `cloudflare/front-worker/baseline/worker2.mjs` | Exact captured live Worker source, renamed to .mjs for module imports/tests. |
| `cloudflare/front-worker/candidate.mjs` | Next-host-only blog passthrough and final-response noindex wrapper. |
| `cloudflare/front-worker/candidate.test.mjs` | Seven offline compatibility/regression tests. |
| `global-perspectives-starter/frontend/worker/index.js` | Static-site Worker implementation. |
| `global-perspectives-starter/frontend/worker/site-worker.test.mjs` | Eleven site routing/header/cache tests. |
| `global-perspectives-starter/frontend/wrangler.jsonc` | Separate production/candidate configuration and asset binding. |
| `scripts/deploy-pages-legacy.sh` | Preserved old Pages workflow, adjusted for its new script location. |
| `scripts/deploy-site.test.mjs` | Version extraction, candidate remote guard and archive-to-Pages staging tests. |
| `scripts/prepare-site-assets.mjs` | Config/content validation, staging, manifests and archive creation. |
| `scripts/prepare-site-assets.test.mjs` | Packaging completeness, stable identity, invalid config/symlink/path tests. |
| `scripts/release-site.mjs` | Archive validation, explicit uploads, version records, Pages staging and verification marker. |
| `scripts/site-release.config.json` | Nonsecret expected account/zone IDs and route-check zone. |
| `project-docs/plans/TASK_2026-10-05_cloudflare_frontend_migration.md` | Task ledger, baseline findings, checks and outstanding release gates. |
| `project-docs/archive/ops/_active/CLOUDFLARE_MIGRATION_REVIEW_HANDOFF_2026-10-05.md` | This consolidated review handoff. |

### Generated local artifacts, not tracked source changes

- `global-perspectives-starter/frontend/dist/`: Vite build, including local debugging maps.
- `global-perspectives-starter/frontend/site-dist/`: 120-file upload package, without source maps.
- `global-perspectives-starter/frontend/.wrangler/`: local runtime state.
- `.site-releases/manifests/` and `.site-releases/packages/`: package manifests and archived site assets.
- `.site-releases/baseline-pages/`: 121-file copy of the checkout's Pages output plus capture metadata. This is a local checkout baseline, not a complete download of every production byte.
- Local `node_modules/`: installed pinned Wrangler/runtime dependencies.
- `/tmp/gp-migration-final-build.log`, `/tmp/gp-migration-dryrun.log`, `/tmp/gp-site-local-smoke.json`: local evidence from the previous implementation turn; temporary paths are not durable repository evidence.
- Raw Cloudflare read responses were kept in private temporary storage; only the sanitized baseline was added to the repository. Do not publish raw account responses or credentials.

No tracked `docs/` files changed. No application feature-source files changed. No live Worker, DNS, Firebase, AWS, or Pages publication was changed.

## 4. Verification evidence and limits

These results were obtained during implementation, before this documentation-only handoff. The handoff itself does not claim a fresh rerun of the full suite.

| Check | Result |
|---|---|
| Full default `./deploy.sh` | Passed frontend verification, hosting tests, build and packaging; ended with “Build-only complete. No upload performed.” |
| Frontend `npm run verify` | 144 test files, 1,096 tests passed; no lint errors. |
| `npm run test:hosting` | 27 tests passed: 11 site Worker, 7 front wrapper, 9 packaging/release checks. |
| `npm run build` | Passed. |
| Candidate Wrangler `deploy --dry-run` | Passed; did not upload. |
| Actual Wrangler local runtime HTTP checks | 24 passed: direct index, navigation, all 8 blogs compared to file bytes, config equality, public files, missing assets/reserved paths, cache headers, query-preserving redirect, host noindex distinction and HEAD. |
| Shell/Node syntax and `git diff --check` | Passed. |
| Baseline/config integrity | Captured source and operator-owned browser config hashes unchanged; tracked docs/ output unchanged. |

Existing warnings remain: three React hook dependency warnings; test-environment canvas-not-implemented messages; a CSS comment syntax warning and bundle-size warnings during build.

Local HTTP checks did not execute the browser application or exercise sign-in, live API CORS, Maps referrer restrictions, payments, saved data, or analyses. No actual two-Worker Cloudflare chain has been tested remotely. Mocked front-Worker tests preserve selected behavior; they are not exhaustive proof of every live RSS/bot/data/cache path.

## 5. Exact prepared artifact

```text
Artifact: ac53cf1038d9ef13cc65425bf66479cc73a5e8b6431d4c982bae47924619384c
Files: 120
Runtime config SHA-256:
84ce4470ad3b7de2b0cdf31053c92e7eeb1a80181597b609d9f193c218253c2a
Manifest:
.site-releases/manifests/ac53cf1038d9ef13cc65425bf66479cc73a5e8b6431d4c982bae47924619384c.json
Archive:
.site-releases/packages/ac53cf1038d9ef13cc65425bf66479cc73a5e8b6431d4c982bae47924619384c/
```

The manifest records dirty source state: this work is uncommitted, so checking out the recorded base commit alone will not reproduce it. Archives contain site assets; Worker/config hashes identify the matching executable source, which must remain available in the working tree or a later commit. Future Cloudflare rollback uses the recorded deployed Worker version; the archived assets support Pages restoration.

There is no candidate deployment version, preview URL, production upload record or verified production marker from this task, because no upload occurred.

## 6. Review priorities and remaining limitations

1. **Review the code and scripts before uploading.** In particular, inspect path/deletion guards, runtime config validation, manifest/archive integrity, account/Worker targeting, and failure behavior. The direct `release-site.mjs` upload command validates an existing artifact but does not itself rerun frontend tests; its use assumes evidence for that exact package. The main deploy entrypoint runs the gates.
2. **Candidate protection/test policy remains unresolved.** The package uses production browser config. Noindex does not restrict access or prevent writes. Do not claim the preview is isolated from production APIs. Define access controls or a controlled testing policy covering analytics/error writes as well as user actions before interactive/shared review.
3. **Candidate trigger guard has an intentional scope/limitation.** It checks account Custom Domains and routes on globalperspective.net, not routes in unrelated zones. It currently rejects every attached candidate domain/route, including the future next hostname. A reviewed narrow exception or other explicit release procedure is needed before repeated uploads after next is attached.
4. **Phase A access is incomplete.** Obtain exact DNS/TLS/redirect/cache state and www behavior before writing final transition/reversal steps. Missing DNS reads do not prevent local implementation or initial workers.dev validation, but block a fully specified production cutover.
5. **Front patch still needs real-chain validation and separate upload approval.** Candidate wrappers run in the production-shared Worker if deployed there. Preserve its current settings/secrets and verify production behavior immediately after any approved code update.
6. **Production blogs still need the approved production-host exception.** The current wrapper only fixes next. Uploading the static Worker alone will not fix production blog interception.
7. **Manual verification remains manual.** `mark-verified` verifies a matching upload record, not the success of external browser smoke checks. No rollback was executed; staging tests ran on fixtures rather than replacing real docs/.
8. **Dependency and CLI documentation review.** The lockfile has a large dependency diff from Wrangler installation. Also, deploy.sh help currently says “Nothing commits, pushes, or changes DNS”; read this as the Cloudflare/default modes only—the delegated legacy Pages target retains explicit `--commit`/`--push` support. That wording should be tightened in a follow-up fix.
9. **Keep docs-only sources and fallback until retirement is approved.** Blog, sitemap, whitepaper and runtime config are still sourced from docs/. Identify permanent source locations before removing Pages output.

## 7. Suggested reviewer workflow

Read this handoff, then inspect the diff and newly added files. `git diff` alone omits untracked additions; include them in review.

Safe local review commands (no upload):

```bash
git status --short
git diff --stat
git diff --check
git ls-files --others --exclude-standard
cd global-perspectives-starter/frontend
npm run test:hosting
npm run verify
```

The build-only `./deploy.sh` may be run from the repository root if a fresh full package is needed. A rebuilt artifact must be identified and reviewed on its own merits.

Return findings with file/line references and distinguish blockers for initial candidate upload from later chained validation/cutover requirements. Stop at review: the user's current request is documentation for another agent, not permission to upload, modify DNS, patch the live Worker or change Firebase.

## 8. Supporting documents

- Plan: `project-docs/plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md`
- Active implementation ledger: `project-docs/plans/TASK_2026-10-05_cloudflare_frontend_migration.md`
- Release procedure: `project-docs/runbooks/DEPLOYMENT_NOTES.md`
- Front wrapper/baseline: `cloudflare/front-worker/README.md` and `cloudflare/front-worker/baseline/capture.json`

All essential implementation status and file inventory are contained above; these references provide the deeper plan and operating details.
