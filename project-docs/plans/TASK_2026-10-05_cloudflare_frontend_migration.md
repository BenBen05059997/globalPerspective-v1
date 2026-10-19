## Cloudflare frontend migration — 2026-10-05 — active

Status: active.

**Goal:** Implement the reviewed two-Worker hosting migration, beginning with a verified local package and captured production baseline. Site hosting moves to a new static-assets Worker while the existing route Worker retains RSS, bot rendering, and data access.

**Authorization:** User requested starting migration with Luna implementation and root review. Local implementation, testing, and read-only baseline capture are in scope. Candidate upload, changes to the production-shared Worker, DNS/domain cutover, Firebase changes, and fallback retirement follow the concrete release gates in the plan; none has been executed.

**Reads / references:**
- `project-docs/plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md`
- `CLAUDE.md`, `deploy.sh`, `.githooks/*`, frontend build/config/public content, `docs/` assets.
- `project-docs/archive/distribution/WORKER_FULL_CODE.md`, Cloudflare current docs and captured live source/settings.

**Changes (code):**
- `global-perspectives-starter/frontend/worker/*`, `wrangler.jsonc`, package/lockfile, lint configuration as needed.
- `scripts/prepare-site-assets.mjs`, focused packaging/release tests, `deploy.sh`, preserved legacy Pages script, `.gitignore`.
- Captured front-Worker baseline and a separate candidate compatibility patch if live evidence requires it.

**Docs to update on completion:**
- This ledger; migration plan status; `project-docs/INDEX.md`; `CHANGES.md`.
- `README.md`, `CLAUDE.md`, `project-docs/runbooks/DEPLOYMENT_NOTES.md`, `DOMAIN_SETUP.md`, `project-docs/architecture/ARCHITECTURE.md`, `project-docs/archive/distribution/WORKER_FULL_CODE.md`, `.claude/skills/deploy-frontend/SKILL.md` as implementation makes changes relevant. Keep current live-hosting facts accurate until cutover.

**Completion checklist:**
- [x] Live baseline captured; unresolved account access identified.
- [x] Static Worker/config implemented and routing tests pass.
- [x] Complete deterministic upload package, runtime config, blog content, sourcemap exclusion.
- [x] Explicit release targets and artifact records implemented/tested.
- [x] Frontend verify/build and local Worker smoke checks pass.
- [x] Docs and CHANGES updated.
- [ ] Candidate release reviewed and authorized; then validated.
- [ ] Chained hostname and production cutover gates completed separately.

**Progress:**
- Started from commit `347e16d`; retained uncommitted reviewed plan corrections.
- Production remains GitHub Pages behind the existing Cloudflare route Worker. No deployment performed by this task.

## Captured production baseline

- Worker `globalperspective-rss`: version `91ba1e98-0959-4387-84f3-10a0d5790ad8`, deployed 2026-10-01; compatibility date 2026-04-01. Source captured as `cloudflare/front-worker/baseline/worker2.mjs` with sanitized metadata in `capture.json`; source matches `WORKER_FULL_CODE.md` exactly. SHA-256 `48f1b03ebfab8382652ef94cbc6e3d480182d7f61203dfd0a5048f0981812989`.
- Existing apex routes `globalperspective.net/*` and `globalperspective.net/rss*` both target this Worker. No www route was returned. Existing S3 secret binding names were captured; values were not retrieved or copied.
- GitHub Pages reports built, main:/docs, custom domain globalperspective.net. Local tracked Pages output preserved in ignored `.site-releases/baseline-pages/` (121 files plus manifest); this is the checkout baseline, not a claim that every byte was downloaded from production.
- Live homepage and `/blog/` return 200 SPA shell (`x-rendered-by: cf-worker-spa-fallback`). The blog interception therefore exists in production. Candidate wrapper fixes only `next.globalperspective.net`; production blog correction remains a distinct cutover change.
- Refreshed existing OAuth access reads account/zone, Worker source/settings/versions, Custom Domains and routes. DNS and rulesets return authentication errors; SSL and page rules return unauthorized errors. Exact DNS/TLS/redirect reversal and www behavior still need capture before cutover.

## Local validation

- Frontend `npm run verify`: 144 files / 1,096 tests passed; three existing hook warnings, no lint errors. Test environment emits existing canvas-not-implemented notices.
- `npm run build`: passed; existing CSS comment syntax and bundle-size warnings remain outside this migration.
- Site Worker routing: 11 tests passed. Front candidate wrapper: 7 tests passed.
- Wrangler 4.147.0 candidate `deploy --dry-run`: passed, no upload. Compatibility date 2026-10-01 matches installed workerd support.
- Wrangler local runtime: 24 HTTP checks passed (direct index, navigation fallback, all eight blog files compared byte-for-byte, config compared to docs/config.js, sitemap/robots/whitepaper, missing assets and reserved paths, immutable cache, redirect query, noindex host distinction, HEAD).
- Local runtime ran with `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false` so unrelated frontend development variables were not loaded as Worker bindings. Server stopped after checks.

## Remaining release gates

1. Approve a concrete candidate artifact for upload to `globalperspective-site-candidate` workers.dev; no upload has occurred. Test only controlled public reads until candidate backend/analytics/error-write policy is approved.
2. Capture missing DNS/TLS/rule settings; review exact next-host Custom Domain/route and the separate production-shared front-Worker patch before deploying either. Initial candidate upload guard deliberately refuses any attached domain/route; a retained next hostname needs an explicit reviewed exception before later candidate uploads.
3. Run actual chained human/bot/RSS/data/blog/header/browser checks. No browser sign-in, API CORS or Maps-referrer validation is claimed by local HTTP tests. Firebase changes need their own authorization if required.
4. Prepare and approve production-host blog patch, exact Custom Domain cutover and reversal, dual-host publication and post-deploy checks. Agree observation window before retiring Pages.

This task has not reached the plan's working online candidate milestone. No live Worker, DNS, Firebase, AWS, docs/config.js, or Pages publication changed.

## Final local package / handoff

- Full default `./deploy.sh` completed successfully: 1,096 frontend tests + 27 hosting/package/release tests, build and packaging. It reported build-only completion and performed no upload. Shell/Node syntax checks and `git diff --check` pass.
- Ready artifact: `ac53cf1038d9ef13cc65425bf66479cc73a5e8b6431d4c982bae47924619384c` (120 files), archived under `.site-releases/packages/` with its manifest. This identity includes site file bytes, site Worker hash and Wrangler configuration hash. Source state is recorded as dirty because this implementation is not committed.
- Config SHA-256 `84ce4470ad3b7de2b0cdf31053c92e7eeb1a80181597b609d9f193c218253c2a`; staged browser config matches operator-owned docs/config.js. No tracked docs/ output changed.
- Reviewed candidate upload command (only after authorization): `node scripts/release-site.mjs candidate ac53cf1038d9ef13cc65425bf66479cc73a5e8b6431d4c982bae47924619384c`. It validates the archive and current Worker/config, checks remote domain/route state, pins the account, then uploads to the separate candidate Worker and records Wrangler's exact Current Version ID.
- Upload guard checks all account Custom Domains and routes on the configured globalperspective.net zone; it does not assert absence of routes on unrelated zones. It refuses unreadable state or any candidate attachment in that scope.
- Restoring an old Pages artifact uses `stage-pages`, followed by an authorized review/commit/push of docs/. Do not run the legacy rebuild afterward, because that replaces the selected archive. Cloudflare application rollback uses its recorded Worker version. Old archive staging does not require current Worker source to match the old version.
- Documentation updated: README, CLAUDE, deployment/domain notes, architecture, Worker snapshot banner, deployment skill, plan, INDEX and CHANGES. No inaccessible persistent memory was claimed updated.
