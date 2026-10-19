# Cloudflare frontend hosting migration — review draft

**Status:** IMPLEMENTING LOCALLY — baseline captured and code/tests prepared; no candidate upload or live changes. Progress: [active task](TASK_2026-10-05_cloudflare_frontend_migration.md).
**Date:** 2026-10-05
**Prepared by:** Codex with a Luna investigation and draft, incorporating the operator's external-agent review.
**Purpose:** A self-contained migration plan and review reference for the implementation now underway. This document does not authorize deployment, DNS changes, secret provisioning, or Firebase changes.
**Revision 2026-10-05 (Claude review, operator yes):** the existing `globalperspective-rss` Worker stays on its route **in front of** the new site Worker, which only serves files. This removes the Worker rewrite, the S3 secret provisioning and the Worker-first routing work from this migration (merging the two Workers is an optional later Phase E). Also added: a test subdomain for the chained setup, dual publishing during the fallback window, `noindex` as a response header, the Cloudflare access gap, and per-action approvals in §8.
**Revision 2026-10-05 (Luna fixes, Codex review):** supersedes the unconditional “unchanged Worker” assumption above. The front Worker may intercept extensionless `/blog/*` URLs with its SPA shell, and its shell response replaces upstream headers. Phase A must confirm this against deployed code. If confirmed, a narrowly scoped front-Worker change or a proven routing exception is required for blog passthrough and candidate `noindex`; the test hostname alone does not isolate the shared Worker code. Also added an explicit `/index.html` redirect/loop gate. This revision changes the plan only.

## 1. Decision and scope

Move frontend hosting from GitHub Pages to **Cloudflare Workers Static Assets**, using a new Worker provisionally named `globalperspective-site` that **only serves the site files**. Release manually through an updated `deploy.sh` and a pinned Wrangler dependency. The existing `globalperspective-rss` Worker keeps its route on the domain. Its code remains unchanged only if the captured live version passes the blog and response-header checks; otherwise this plan permits the narrow, reviewed compatibility changes described below. The Pages deployment stays available through validation and cutover.

GitHub remains the source repository. AWS Lambda/API Gateway/S3/DynamoDB, Firebase Auth, and billing behavior remain outside this hosting migration. Workers Builds and automatic deployment are deferred to a separate decision after manual releases are reliable. No release branch or GitHub integration is required for this first phase.

Target request path: `globalperspective.net → globalperspective-rss (retained route) → globalperspective-site (Custom Domain = origin) → uploaded frontend assets`.

Why this shape: Cloudflare treats a Worker on a Custom Domain as the origin, and a Worker on a route in front of it reaches it with `fetch(request)` ([Custom Domains and interaction with routes](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)). The checked-in Worker snapshot ends with `return fetch(request)` and fetches the SPA shell with `new URL('/index.html', url.origin)` (`WORKER_FULL_CODE.md:496,513`). Today that origin is GitHub Pages; after cutover it should be the new Worker. However, the snapshot's extensionless SPA fallback can intercept `/blog/` and `/blog/pair-intelligence/` first and return the app shell; the local chain reproduction returned `APP_SHELL`. Do not claim the front Worker can remain byte-for-byte unchanged until Phase A captures live source and Phase C proves all eight blog paths through the actual chain. If the deployed source has this behavior, either add a narrow `/blog` passthrough before its SPA fallback or demonstrate and test a routing exception that sends those paths to the new origin. Any front-Worker code change must preserve the RSS, bot-rendering, `/data/*`, S3-secret, and member-restriction branches, and receive its own deployment approval. Existing AWS API and Firebase calls continue through their current interfaces.

Out of scope for this migration (optional **Phase E**, a separate decision after a stable observation window): merging the two Workers into one, which would need the Worker rewrite onto the `ASSETS` binding, securely provisioning the destination Worker's S3 secrets, and Worker-first routing for dynamic/bot handling. Existing secret values cannot be read back from Cloudflare; securely available existing credentials may be reused if approved. New IAM keys are not automatically required and would need operator approval.

## 2. Evidence and known migration traps

- Live checks on 2026-10-05: GitHub Pages API reported `status=built`, `source=main:/docs`, and `cname=globalperspective.net`. The live homepage returned Cloudflare and GitHub origin headers. Cloudflare source/settings/routes were subsequently captured in `cloudflare/front-worker/baseline/`: live version `91ba1e98-0959-4387-84f3-10a0d5790ad8`, deployed October 1, exactly matches the documented source. Live `/blog/` returns the app shell. DNS, SSL settings, rulesets and page-rule reads remain unauthorized; these still block an exact cutover/reversal procedure.
- The original Pages script is preserved as `scripts/deploy-pages-legacy.sh`. The revised [deploy.sh](../../deploy.sh) defaults to local verification/build/packaging; explicit candidate, production and legacy Pages targets handle releases. A pinned Wrangler project is now checked in. Git pushes still publish tracked `docs/` while Pages remains enabled.
- WORKER_FULL_CODE.md (`git show 120de90:project-docs/archive/distribution/WORKER_FULL_CODE.md` (deleted 2026-10-19)) contains a Worker snapshot that uses network `fetch(request)` and `/index.html` fetches against the origin. Those origin fetches are required for the two-Worker chain, so they are not replaced with Static Assets reads in this migration. The snapshot's SPA branch can intercept extensionless `/blog/*` requests before the new site Worker; the local reproduction returned `APP_SHELL`. Capture deployed code and verify this finding in Phase A, then patch the path or prove a routing exception before relying on the chain. Its comments and deployment notes contain differing status claims; download the deployed code before choosing the baseline.
- **Eight tracked blog pages exist.** The earlier investigation's claim that the checkout contained no blog files was incorrect. Preserve the index and all seven articles; inventory them with `git ls-files docs/blog`.
- Production `docs/config.js` defines nine browser runtime fields. The ignored local `frontend/public/config.js` contains only `SENSITIVE_PROXY_ENDPOINT`. Uploading an ordinary local build would publish incomplete configuration.
- Bot rendering and dynamic routes stay in `globalperspective-rss`, which runs first on its route. The new Worker does not need their routing logic. If its own script adds headers or rewrites `/index.html` or blog paths, configure those requests to reach that script before asset handling; asset-first defaults would otherwise bypass it. The existing front Worker can intercept static blog routes, so blog delivery must be resolved before its SPA shell fallback, not only before the new Worker's fallback.
- The new site's candidate `X-Robots-Tag: noindex` can be lost when the front Worker constructs its own SPA response; bot HTML is also generated and returned directly by the front Worker. Candidate noindex must be enforced on the final response at the covering layer and verified for both human and bot responses. A host-scoped front-Worker response wrapper is the proposed solution; any alternative must first prove that it covers Worker-generated responses in this account.
- Cloudflare Static Assets' default HTML handling can canonicalize `/index.html` to `/`. Since the front Worker fetches `/index.html` as its shell, choose and verify an HTML-handling/rewrite strategy that returns the shell bytes with a direct 200 through the chain and cannot redirect back into a loop. Do not choose `html_handling: "none"` without separately preserving directory-index blog URLs.
- `.githooks/pre-push` conditionally runs an economic-layer verifier. It is not a general frontend release gate. The release script must explicitly run the required verification.

Production runtime fields to preserve, without publishing their values in this plan:

`SENSITIVE_PROXY_ENDPOINT`, `FIREBASE_CONFIG`, `GOOGLE_MAPS_API_KEY`, `CLIENT_ERRORS_ENDPOINT`, `NEWS_ANALYZE_ENDPOINT`, `NEWS_SHARE_ENDPOINT`, `POLAR_BILLING_ENDPOINT`, `SAVED_ITEMS_ENDPOINT`, `USER_PREFS_ENDPOINT`.

These are browser-visible configuration. S3 credentials and other server credentials must stay in Worker secrets and never enter the uploaded site files.

## 3. Proposed files and release interface

`frontend/` below means `global-perspectives-starter/frontend/`. Paths are proposed and may be adjusted during implementation review.

| File / area | Intended change |
|---|---|
| `frontend/worker/index.js` | Minimal site Worker: serve `env.ASSETS`, set cache and candidate `X-Robots-Tag` headers, real 404 for missing files. No RSS/bot/data logic (that stays in `globalperspective-rss`). Select HTML handling so the front Worker's `/index.html` subrequest returns direct 200 bytes while `/blog/` and article directory URLs still resolve. Optional: assets-only Worker with no script if headers can be set by `_headers` alone and candidate behavior is proven. |
| `frontend/wrangler.jsonc` | Explicit new Worker identity, entrypoint, compatibility date, asset binding/directory, `not_found_handling: "none"`, `html_handling: "none"`, observability, and `run_worker_first: true` with navigation-only SPA fallback in the script for the site's response/rewrite script. Initially no production domain or route. |
| `globalperspective-rss` source | Capture the deployed code into the repo in Phase A as the baseline. Keep RSS, bot, `/data/*`, and member logic unchanged. If deployed code reproduces the blog shell interception or header loss, add a narrow `/blog` passthrough and candidate-host final-response `noindex` handling (or prove an equivalent routing/header-rule exception). This is a scoped front-Worker version change and has a separate approval gate; it is not implied by adding the test route. |
| `frontend/package.json`, lockfile | Pin Wrangler and add reproducible verification, packaging, and Worker validation commands. Keep the existing React/Vite architecture. |
| `scripts/prepare-site-assets.mjs` | Produce a clean upload directory, stage complete runtime config and required public content, exclude source maps, and validate the asset manifest. |
| `frontend/site-dist/` | Proposed gitignored upload artifact, separate from Vite `dist/` so local source maps can remain available for debugging. |
| `deploy.sh` | Explicit build-only, candidate deployment, and production deployment modes. Run verification before upload; record commit, artifact hash, Worker name, and deployment version. Keep any existing front-Worker patch deployment as a separate, explicit target from site-Worker upload. |
| Worker routing tests / release smoke checks | Exercise the actual Worker and packaged files, especially blog/SPA precedence, bot responses, data restrictions, and caching. |
| Deployment and architecture documentation | Update the files listed in section 9 when the corresponding behavior changes. |

The script's default is **build-only**. Uploads require an explicit target. The candidate target always uses a separate `globalperspective-site-candidate` Worker; production always uses `globalperspective-site`. These names are never promoted or reused across targets. The first candidate uses `workers.dev`; an authorized chained test may later attach `next.globalperspective.net` to the candidate. The initial release guard refuses candidate uploads with any attached domain/zone route; before repeat uploads on a retained chained hostname, review a narrowly scoped next-host exception. It must continue rejecting production-domain attachments.

Retain a clearly named legacy Pages build path during the rollback window. Do not combine uploading to Cloudflare, publishing Pages, and changing DNS in one command. Git commit/push is not a Cloudflare release trigger in this phase.

## 4. Phase A — capture the baseline

Read and record the current account/zone, **deployed** Worker source/version (including the exact SPA fallback and all response-header construction), routes and Custom Domains, secret names/presence, bindings, compatibility settings, DNS record IDs/types/targets/proxy state/TTL, redirects, TLS settings, and relevant caching configuration. Record apex and `www` behavior separately. Reproduce `GET /blog/` and `GET /blog/pair-intelligence/` through the front Worker and note status, final URL, response-body identity (app shell versus article), and headers for human and bot user agents. Also exercise its `/index.html` shell fetch behavior on a candidate origin if available.

Save the Pages commit/artifact and confirm its fallback availability. Record representative human/bot responses, RSS/data behavior, runtime-config hash, and all eight blog URLs. Do not store credentials in the review document or Git.

**Exit condition:** a reconciled Worker baseline; a documented result on whether the deployed front Worker intercepts `/blog/*` or replaces candidate response headers; a public-file manifest; and a recorded current configuration sufficient to write an exact reversal procedure. If account permissions cannot read DNS or routes, report that specific gap and obtain the needed access or operator-provided export before cutover planning.

## 5. Phase B — implement and package locally

### Routing

The new Worker is a plain file server with script-first handling for consistent cache/noindex headers and explicit blog directory rewrites, followed by navigation-only SPA fallback. Ensure any path needing its header/rewrite script reaches that script rather than being served first by assets. `/data/*`, `/rss`, bot rendering and the `/analyze/s/*` bot exclusion stay in `globalperspective-rss`, which runs first on its route; nothing in the new Worker reimplements them. The deployed front Worker may return its SPA shell for extensionless `/blog/*` before reaching the new Worker. If Phase A confirms that behavior, add a narrow `/blog` and `/blog/*` passthrough ahead of the old generic shell fallback, or prove a route exception that bypasses that fallback and reaches the Custom Domain origin. Scope the candidate change to the test hostname, then explicitly extend blog handling to approved production hostnames at cutover. Verify the chosen behavior on all eight pages. Keep the old routes/branches in place and verify `/rss`, bot-rendered pages, `/data/*`, and `/analyze/s/*` retain their responses. Preserve existing canonical/trailing-slash behavior or document each intended change. A missing JS/CSS/image must return an actual 404 (SPA fallback only for navigation requests).

Check the chain interaction points. First, the old Worker's shell fetch (`/index.html` on `url.origin`) must receive the shell bytes with a direct 200, not rely on a canonical redirect from `/index.html` to `/`, and must not recurse or loop. Static Assets defaults to `html_handling: "auto-trailing-slash"`, which redirects `index.html` URLs to their canonical directory URL; select the setting or an explicit Worker rewrite after testing. If selecting `html_handling: "none"`, explicitly map `/blog/` and `/blog/<article>/` to their `index.html` files and test canonical redirects because the built-in directory-index behavior changes. Second, the front Worker's normal pass-through must reach the new Worker and return the requested file. The data allow-list, member restrictions and S3 access remain served by the front Worker and must be regression-checked, even though their implementation is unchanged.

For candidate `noindex`, adding a header only in the site Worker is insufficient: the front Worker's shell branch constructs a new response and can discard upstream headers, while bot HTML is generated wholly in the front Worker. Enforce `X-Robots-Tag: noindex` on the final candidate-host response at the outermost covering layer, using a host-scoped front-Worker response wrapper that covers every application-controlled return path. An alternative response-header rule is acceptable only after its applicability to Worker-generated responses is verified in current documentation and on the actual chain. Verify this for human shell, each bot-rendered path, pass-through static/blog assets, errors, and redirects. Verify the production host has no `noindex` header. Direct `workers.dev` requests bypass the front Worker and therefore also need noindex at the site layer; test both entry points separately. Do not claim control over platform-generated failures that bypass both scripts.

### Assets and configuration

Build a fresh artifact from Vite output plus an explicit manifest covering all eight blog pages, sitemap, whitepaper, robots, logos, textures, and other confirmed public content. Initially copy docs-only content from its current authoritative paths; identify its permanent source location before deleting any Pages output. Exclude `.map`, `CNAME`, and `.nojekyll` from the Cloudflare upload.

Use an explicit approved runtime-config input. For the production package, `docs/config.js` remains authoritative during migration: stage it without modifying it and verify equality/hash. Do not use the incomplete ignored local file. Validate all expected fields while allowing intentionally unset/parked endpoint values; require the values actually needed for core functionality. Fail before upload on absent or wrong-target configuration.

No secrets are needed for the new Worker: it serves public files only. S3 credentials stay in `globalperspective-rss`.

### Cache policy

Use long browser caching with `immutable` only for content-hashed assets. HTML and `/config.js` must revalidate. Preserve reviewed RSS, bot HTML, and public-data cache lifetimes; private responses remain non-public. Headers for Worker-generated responses must be set in code. Confirm bot HTML cannot be served to human visitors through a shared cache entry. Apply candidate `X-Robots-Tag: noindex` at the final-response layer described above (never baked into HTML), and verify it reaches all candidate human/bot/static/error responses and is absent on the production host.

**Exit condition:** frontend verification and focused Worker tests pass; the packaged asset manifest is complete; no source maps/server secrets are in the upload; the site candidate configuration targets only the new Worker. Any proposed front-Worker patch has a separate reviewed diff, explicit deployment target, and captured version/configuration for rollback.

## 6. Phase C — candidate deployment and review

Deploy the new Worker to its own `workers.dev` address after the candidate deployment is authorized. `workers.dev` checks the site files alone (blog, config, caching, 404s, `/index.html`, SPA fallback); it does not test the front Worker chain.

**Chained test (needed before cutover):** the route-in-front behavior cannot be exercised on `workers.dev`. With operator approval, add a test hostname on the zone (proposed `next.globalperspective.net`): attach it as a Custom Domain of the new Worker, and add a route for that hostname to `globalperspective-rss`. A new route alone does not isolate code: routes to the same Worker run the same deployed version. If Phase A confirms the current `/blog/*` fallback/header behavior, validate the narrow patch locally first, then deploy it under authorization that covers changing the production-shared Worker. Both the blog passthrough and final-response noindex changes must initially be gated to the test hostname; production-host behavior and RSS/bot/data branches must remain unchanged. Apply the reviewed code update without resetting existing settings, bindings, or secrets; do not run an incompletely configured bare Wrangler deployment against the live Worker. Capture and smoke-check the old and new versions. If a proven routing/header exception avoids the patch, document it and test it equivalently. Do not treat test-route approval alone as approval to change the shared Worker. Then run the chain acceptance matrix on the test hostname, including RSS, bot HTML, all eight blog URLs, noindex coverage and `/data/*`. Keep or remove the test hostname after review; if kept, protect it and its production-backend access under the policy below. The candidate Worker remains separate from the production site Worker after cutover; publish the same verified artifact to production explicitly.

This address is a separate frontend, **not an isolated backend**. Select and document one test policy before interactive testing:

- Prefer sandbox APIs/auth/billing for flows that write or incur cost, if suitable environments already exist.
- Otherwise use production public reads for parity checks and prevent automated/browser test interactions with saves, forms, analyses, checkout, and sends. An agent test policy alone does not stop other visitors; protect the candidate or disable such capabilities if it is shared beyond controlled review.
- Review incidental writes such as analytics and client-error reporting. Do not claim a session is read-only merely because the tester did not click a submit button.

Validate sign-in before cutover where possible using an approved stable test hostname. Check Firebase authorized domains, redirect behavior, API CORS, and Maps referrer restrictions. Any required Firebase configuration change needs the operator's approval under `CLAUDE.md`. If auth cannot be tested, record it as an unresolved release gate or obtain an explicit waiver with an immediate production check and rollback condition.

| Acceptance check | Expected evidence |
|---|---|
| Home, representative client routes, nested refreshes | Correct shell, working assets, no browser routing errors. |
| Blog index plus seven articles | Through the chained hostname, each existing URL returns the real article HTML/content with success status, not `APP_SHELL`; verify human and bot user agents and both slash forms where currently supported. |
| Front Worker shell-origin fetch | A request for `/index.html` through the chained hostname returns direct 200 shell bytes with no redirect to `/` and no loop/recursive Worker invocation; record the selected HTML-handling or rewrite strategy. |
| Unknown client route / missing file | Current client not-found behavior retained; missing JS/CSS/image returns 404. |
| Human and crawler requests | Expected shell versus bot HTML, including query variants and shared-analysis exclusions. |
| RSS and data proxy | Correct types/statuses; valid public data; disallowed/missing/member cases preserve restrictions. |
| Runtime configuration and API reads | Correct target, complete fields, successful real browser reads. |
| Auth and write-capable flows | Results from the approved test environment/policy; no unapproved live transactions. |
| Static/SEO content | Sitemap, robots, whitepaper, logos, textures, and canonical URLs resolve as intended. |
| Caching and packaging | Correct headers; no public source maps; `X-Robots-Tag: noindex` survives at the final chained response for human and bot HTML, static/blog assets, errors and redirects on the candidate hostname; absent on production; bot/human cache separation. |
| Front-Worker patch, if required | Patch is gated by exact path/hostname; source diff and deployed version recorded; `/rss`, bot routes, `/data/*`, member-deny behavior and production hostname regressions pass before and after. |
| Release behavior | Failed verification prevents upload; commit/artifact/version recorded; an open browser survives or clearly recovers from an asset-changing release. |

**First review milestone:** a working candidate URL, evidence against this matrix, and an explicit list of remaining gates. Local preparation alone is not completion of this milestone.

## 7. Phase D — production cutover and rollback

Use the Phase A live configuration to write an executable change list with exact old/new record and route values. Target a Worker Custom Domain for the final origin. Check existing CNAME conflicts and apex/`www` redirects before selecting the sequence.

The old route stays in front: `globalperspective-rss` keeps running. If the confirmed `/blog/*` fix was candidate-host-only, extend its narrow allowlist to include the production hostname as a distinct reviewed change before or as part of cutover; otherwise the front Worker will continue returning the SPA shell for production blog URLs. Cutover = attach `globalperspective.net` (and `www` per Phase A findings) as a Custom Domain of `globalperspective-site`, which replaces the DNS records that point at GitHub Pages. Check the existing records/CNAME conflicts first and document the interruption risk at that step. Do not claim an atomic or zero-downtime switch without verification.

Before requesting cutover approval, provide the verified artifact/version, test results, unresolved items, exact transition steps, and exact rollback steps. Prepare the production form of the candidate with noindex/test restrictions removed as appropriate, and verify it before binding the domain. Keep Pages and the old Worker available.

After the approved switch, check TLS, canonical redirects, page reloads, all blog URLs, RSS/data, bot responses, Firebase/API behavior, and Worker errors. Confirm by configuration inspection that GitHub is no longer the origin; response headers are corroborating evidence, not the only proof.

Rollback triggers include failed sign-in/core data access, missing public content, broken RSS/data restrictions, or sustained new server errors. The initial hosting rollback removes the Custom Domain from the new Worker and restores the captured GitHub Pages DNS records. The primary front-Worker route remains in place; separately restore any changed route exceptions/header rules and, if the compatibility patch is implicated, the captured front-Worker version/configuration. Record which compatible front version accompanies each verified site release; do not assume site-version rollback also rolls back the front Worker. A restored pre-patch front version may restore pre-existing blog behavior, so distinguish recovery of the original baseline from meeting the new blog acceptance gate. Repeat the same smoke checks afterward.

**Two separate fallbacks during the observation window:**
- *Hosting fallback (Pages):* until Pages is retired, every production release goes to both the new Worker and Pages (`docs/`), so switching the domain back never serves an older build than Cloudflare had. This only covers a hosting failure; it does nothing for a broken app, because both hosts get the same release.
- *Release fallback (last verified artifact):* every production release records its commit, artifact hash and Worker version, and keeps the packaged upload directory of the **last release that passed the post-deploy checks** (e.g. `releases/<date>-<commit>/`, gitignored, plus its manifest). An application regression is rolled back by restoring that artifact: the previous Worker version on Cloudflare (`wrangler rollback` or the dashboard) and, while Pages is still a fallback, re-publishing the same artifact to `docs/`. `deploy.sh` states which targets it updated and which artifact is the current "last verified"; a release only becomes "last verified" after its smoke checks pass.

Later Cloudflare release rollbacks may restore a previous Worker version and its associated assets. They do not restore DNS, deleted secrets, changed bindings, or external data. Record those separately. Agree the observation window before cutover; suggested default is 48 hours plus one successfully verified subsequent release before retiring Pages. Do not remove fallback resources automatically when that time elapses.

## 8. Decisions and approvals still needed

**Access gap updated 2026-10-05:** refreshed existing Wrangler OAuth access can read the zone, deployed Worker source/settings/version, account Custom Domains, and zone Worker routes. DNS records and rulesets return authentication errors; SSL settings and page rules return unauthorized errors. Obtain those specific read permissions or an operator export before writing an exact cutover and rollback. Existing route/source capture is checked in without secret values.

The implementation must record authorization covering the actions below; the current local implementation authorization covers none of the deployment or account changes. Related actions may be approved together when their scope is explicit. Do not re-request approval already provided in the active session. Existing authorized read-only access needs no extra approval; obtaining a new credential or account grant is different. Apply the repo's production-release and Firebase rules to the relevant actions.

| Action | Why it needs a yes |
|---|---|
| New zone-access grant/token or an operator export, if current access is insufficient | account-access setup; ordinary reads with existing access are already part of inspection |
| First candidate deploy of `globalperspective-site-candidate` to `workers.dev` | new production-account Worker |
| Narrow patch deployment to `globalperspective-rss` for candidate blog passthrough and final-response `noindex` (if required by Phase A) | changes the deployed version of the Worker on the live route; test-host noindex must be hostname-scoped and production branch behavior regression-checked |
| Test hostname `next.globalperspective.net` + its Custom Domain and route to `globalperspective-rss` | DNS/route change on the live zone; adding a route alone does not isolate the shared Worker code |
| Adding a hostname to Firebase authorized domains (only if sign-in is tested before cutover) | Firebase auth config (`CLAUDE.md`) |
| Production cutover (Custom Domain on the live hostname) | live hosting change |
| Extend a hostname-scoped blog passthrough patch to `globalperspective.net`/`www` at cutover, if the candidate patch does not already cover production | changes existing Worker behavior for production blog URLs |
| Each later production release | frontend deploy (`CLAUDE.md`) |
| Retiring Pages / `docs/` after the observation window | removes the fallback |
| Phase E (merge Workers; any new S3 keys would be an IAM change) | separate decision; existing credentials may be usable through an approved secure source |

Local read-only inspection and reversible local preparation (code, scripts, packaging, tests) need no further approval. Workers Builds/GitHub access grants remain a later optional decision.

## 9. Documentation and implementation handoff

Before implementation, create the task ledger required by [TASK_WORKFLOW.md](../rules/TASK_WORKFLOW.md), with this plan as its reference. Update these documents in the same change as the behavior they describe:

- `README.md` and `CLAUDE.md`: hosting layout, manual release procedure, authorization boundaries.
- `project-docs/runbooks/DEPLOYMENT_NOTES.md` and `DOMAIN_SETUP.md`: packaging, domain transition, validation, rollback.
- `project-docs/architecture/ARCHITECTURE.md`: actual hosting and Worker source/config locations.
- `git show 120de90:project-docs/archive/distribution/WORKER_FULL_CODE.md` (deleted 2026-10-19): retire dashboard-paste instructions; reference the real source and preserve useful history.
- `.claude/skills/deploy-frontend/SKILL.md`: new explicit targets and release/rollback procedure.
- `project-docs/INDEX.md`, `CHANGES.md`, and the implementation task ledger.
- Any discoverable persistent Worker/deployment memory note: update its owner/location if available; do not claim an inaccessible note was updated.

Do not rewrite current-hosting documentation as though migration has shipped during the planning stage.

## 10. Reviewer checklist

- [ ] Does the plan distinguish observed production state from repo documentation and proposed behavior?
- [ ] Does the implementation start from the captured deployed Worker and preserve its required behavior?
- [ ] Do all eight blog routes pass through the captured front Worker to the site assets, rather than receiving its SPA shell?
- [ ] Does the front Worker's `/index.html` origin fetch return direct 200 bytes under the selected HTML-handling strategy, without a canonical redirect loop or broken blog directory indexes?
- [ ] Does candidate noindex survive the outer front Worker for human and bot responses, and is it absent on production?
- [ ] Are all eight blog pages and every required runtime field included?
- [ ] Can the artifact be reproduced without accidentally using ignored local config?
- [ ] Are candidate side effects controlled, including incidental analytics/error writes?
- [ ] Does the old Worker's pass-through and `/index.html` fetch reach the new Worker correctly (chained test on the test hostname)?
- [ ] Is auth testing and candidate access feasible?
- [ ] Does every release during the fallback window reach both the new Worker and Pages?
- [ ] Is the production target unambiguous with separate candidate and production Worker identities?
- [ ] Are DNS/route transition and rollback derived from actual account state, with no premature route deletion?
- [ ] Are the release checks, documentation changes, and fallback-retirement gate sufficient?

## References

Cloudflare documentation consulted on 2026-10-05; recheck relevant commands/configuration against the pinned Wrangler version during implementation:

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Worker-first routing and the asset binding](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [HTML handling and canonical redirects](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)
- [Custom Domains and interaction with routes](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Version rollback and its limits](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Worker Previews](https://developers.cloudflare.com/workers/previews/get-started/) — optional later preview mechanism.
- [Workers Builds branch controls](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/) — deferred automation.
