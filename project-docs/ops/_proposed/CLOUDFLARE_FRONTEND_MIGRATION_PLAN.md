# Cloudflare frontend hosting migration — review draft

**Status:** PROPOSED — planning complete; implementation and deployment have not started.
**Date:** 2026-10-05
**Prepared by:** Codex with a Luna investigation and draft, incorporating the operator's external-agent review.
**Purpose:** A self-contained plan for another agent to review before implementation. This document does not authorize deployment, DNS changes, secret provisioning, or Firebase changes.
**Revision 2026-10-05 (Claude review, operator yes):** the existing `globalperspective-rss` Worker stays on its route **in front of** the new site Worker, which only serves files. This removes the Worker rewrite, the S3 secret provisioning and the Worker-first routing work from this migration (merging the two Workers is an optional later Phase E). Also added: a test subdomain for the chained setup, dual publishing during the fallback window, `noindex` as a response header, the Cloudflare access gap, and per-action approvals in §8.

## 1. Decision and scope

Move frontend hosting from GitHub Pages to **Cloudflare Workers Static Assets**, using a new Worker provisionally named `globalperspective-site` that **only serves the site files**. Release manually through an updated `deploy.sh` and a pinned Wrangler dependency. The existing `globalperspective-rss` Worker keeps its route on the domain and its code unchanged; the Pages deployment stays available through validation and cutover.

GitHub remains the source repository. AWS Lambda/API Gateway/S3/DynamoDB, Firebase Auth, and billing behavior remain outside this hosting migration. Workers Builds and automatic deployment are deferred to a separate decision after manual releases are reliable. No release branch or GitHub integration is required for this first phase.

Target request path: `globalperspective.net → globalperspective-rss (route, unchanged) → globalperspective-site (Custom Domain = origin) → uploaded frontend assets`.

Why this shape: Cloudflare treats a Worker on a Custom Domain as the origin, and a Worker on a route in front of it reaches it with `fetch(request)` ([Custom Domains and interaction with routes](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)). The live Worker already ends with `return fetch(request)` and fetches the SPA shell with `new URL('/index.html', url.origin)` (`WORKER_FULL_CODE.md:496,513`). Today that origin is GitHub Pages; after cutover it is the new Worker. RSS, bot rendering, the `/data/*` S3 proxy, its secrets and the member restrictions keep running in the existing Worker, untouched. Existing AWS API and Firebase calls continue through their current interfaces.

Out of scope for this migration (optional **Phase E**, a separate decision after a stable observation window): merging the two Workers into one, which would need the Worker rewrite onto the `ASSETS` binding, new S3 secrets (values cannot be read back from the live Worker; new IAM keys need operator approval) and Worker-first routing.

## 2. Evidence and known migration traps

- Live checks on 2026-10-05: GitHub Pages API reported `status=built`, `source=main:/docs`, and `cname=globalperspective.net`. The live homepage returned Cloudflare and GitHub origin headers. Cloudflare account routes, DNS records, and deployed Worker source have **not** yet been captured in this investigation.
- [deploy.sh](../../../deploy.sh) builds Vite, copies selected output into `docs/`, strips source maps, mirrors `404.html`, and preserves `docs/config.js`. A Git push publishes the Pages output. No checked-in Wrangler project exists.
- [WORKER_FULL_CODE.md](../../distribution/WORKER_FULL_CODE.md) contains a Worker snapshot that uses network `fetch(request)` and `/index.html` fetches against the origin. Both require replacement with Static Assets reads. Its comments and deployment notes contain differing status claims; download the deployed code before choosing the migration baseline.
- **Eight tracked blog pages exist.** The earlier investigation's claim that the checkout contained no blog files was incorrect. Preserve the index and all seven articles; inventory them with `git ls-files docs/blog`.
- Production `docs/config.js` defines nine browser runtime fields. The ignored local `frontend/public/config.js` contains only `SENSITIVE_PROXY_ENDPOINT`. Uploading an ordinary local build would publish incomplete configuration.
- Bot rendering and dynamic routes stay correct because `globalperspective-rss` keeps running first on its route; Worker-first routing inside the new Worker is only needed if the Workers are merged (Phase E). Static blog HTML must be resolved before the SPA shell fallback.
- `.githooks/pre-push` conditionally runs an economic-layer verifier. It is not a general frontend release gate. The release script must explicitly run the required verification.

Production runtime fields to preserve, without publishing their values in this plan:

`SENSITIVE_PROXY_ENDPOINT`, `FIREBASE_CONFIG`, `GOOGLE_MAPS_API_KEY`, `CLIENT_ERRORS_ENDPOINT`, `NEWS_ANALYZE_ENDPOINT`, `NEWS_SHARE_ENDPOINT`, `POLAR_BILLING_ENDPOINT`, `SAVED_ITEMS_ENDPOINT`, `USER_PREFS_ENDPOINT`.

These are browser-visible configuration. S3 credentials and other server credentials must stay in Worker secrets and never enter the uploaded site files.

## 3. Proposed files and release interface

`frontend/` below means `global-perspectives-starter/frontend/`. Paths are proposed and may be adjusted during implementation review.

| File / area | Intended change |
|---|---|
| `frontend/worker/index.js` | Minimal site Worker: serve `env.ASSETS`, set cache and `X-Robots-Tag` headers, real 404 for missing files. No RSS/bot/data logic (that stays in `globalperspective-rss`). Optional: assets-only Worker with no script if headers can be set by `_headers` alone. |
| `frontend/wrangler.jsonc` | Explicit new Worker identity, entrypoint, compatibility date, asset binding/directory, `not_found_handling: "single-page-application"`, observability. Initially no production domain or route. |
| `globalperspective-rss` source | **Unchanged.** Capture the deployed code into the repo in Phase A as the baseline (read-only), but do not redeploy it in this migration. |
| `frontend/package.json`, lockfile | Pin Wrangler and add reproducible verification, packaging, and Worker validation commands. Keep the existing React/Vite architecture. |
| `scripts/prepare-site-assets.mjs` | Produce a clean upload directory, stage complete runtime config and required public content, exclude source maps, and validate the asset manifest. |
| `frontend/site-dist/` | Proposed gitignored upload artifact, separate from Vite `dist/` so local source maps can remain available for debugging. |
| `deploy.sh` | Explicit build-only, candidate deployment, and production deployment modes. Run verification before upload; record commit, artifact hash, Worker name, and deployment version. |
| Worker routing tests / release smoke checks | Exercise the actual Worker and packaged files, especially blog/SPA precedence, bot responses, data restrictions, and caching. |
| Deployment and architecture documentation | Update the files listed in section 9 when the corresponding behavior changes. |

The script's proposed default is **build-only**. Uploads require an explicit target. Before cutover, an explicit candidate target deploys to the new Worker's `workers.dev` address. Once that Worker owns the production domain, deploying to the same Worker is a production release; the script must not continue calling it a harmless preview. Later previews need a separate Worker or a separately configured Worker Preview.

Retain a clearly named legacy Pages build path during the rollback window. Do not combine uploading to Cloudflare, publishing Pages, and changing DNS in one command. Git commit/push is not a Cloudflare release trigger in this phase.

## 4. Phase A — capture the baseline

Read and record the current account/zone, Worker source/version, routes and Custom Domains, secret names/presence, bindings, compatibility settings, DNS record IDs/types/targets/proxy state/TTL, redirects, TLS settings, and relevant caching configuration. Record apex and `www` behavior separately.

Save the Pages commit/artifact and confirm its fallback availability. Record representative human/bot responses, RSS/data behavior, runtime-config hash, and all eight blog URLs. Do not store credentials in the review document or Git.

**Exit condition:** a reconciled Worker baseline, a public-file manifest, and a recorded current configuration sufficient to write an exact reversal procedure. If account permissions cannot read DNS or routes, report that specific gap and obtain the needed access or operator-provided export before cutover planning.

## 5. Phase B — implement and package locally

### Routing

The new Worker is a plain file server: asset-first, with SPA fallback for navigation requests. `/data/*`, `/rss`, bot rendering and the `/analyze/s/*` bot exclusion stay in `globalperspective-rss`, which runs first on its route; nothing in the new Worker reimplements them. Resolve real static pages, including `/blog/` and article directories, before falling back to the SPA shell. Preserve existing canonical/trailing-slash behavior or document each intended change. A missing JS/CSS/image must return an actual 404 (SPA fallback only for navigation requests).

Check the one interaction point: the old Worker's shell fetch (`/index.html` on `url.origin`) and pass-through `fetch(request)` must reach the new Worker and get the right file, status and headers. The data allow-list, member restrictions and S3 access are unchanged because that code is not touched.

### Assets and configuration

Build a fresh artifact from Vite output plus an explicit manifest covering all eight blog pages, sitemap, whitepaper, robots, logos, textures, and other confirmed public content. Initially copy docs-only content from its current authoritative paths; identify its permanent source location before deleting any Pages output. Exclude `.map`, `CNAME`, and `.nojekyll` from the Cloudflare upload.

Use an explicit approved runtime-config input. For the production package, `docs/config.js` remains authoritative during migration: stage it without modifying it and verify equality/hash. Do not use the incomplete ignored local file. Validate all expected fields while allowing intentionally unset/parked endpoint values; require the values actually needed for core functionality. Fail before upload on absent or wrong-target configuration.

No secrets are needed for the new Worker: it serves public files only. S3 credentials stay in `globalperspective-rss`.

### Cache policy

Use long browser caching with `immutable` only for content-hashed assets. HTML and `/config.js` must revalidate. Preserve reviewed RSS, bot HTML, and public-data cache lifetimes; private responses remain non-public. Headers for Worker-generated responses must be set in code. Confirm bot HTML cannot be served to human visitors through a shared cache entry. Mark candidates `noindex` with an `X-Robots-Tag: noindex` response header added by the Worker when the request host is not the production domain (never baked into the HTML), so a production deploy cannot ship it by accident; verify it is absent on the production domain.

**Exit condition:** frontend verification and focused Worker tests pass; the packaged asset manifest is complete; no source maps/server secrets are in the upload; the candidate configuration targets only the new Worker.

## 6. Phase C — candidate deployment and review

Deploy the new Worker to its own `workers.dev` address after the candidate deployment is authorized. The live Worker's code and production routing remain unchanged at this stage. `workers.dev` checks the files alone (blog, config, caching, 404s, SPA fallback).

**Chained test (needed before cutover):** the route-in-front behavior cannot be exercised on `workers.dev`. With operator approval, add a test hostname on the zone (proposed `next.globalperspective.net`): attach it as a Custom Domain of the new Worker, and add a route for that hostname to `globalperspective-rss` (the same script, a new route; its code unchanged). Run the acceptance matrix there, including RSS, bot HTML and `/data/*`. Remove both afterwards or keep them as the standing preview host. This is a DNS/route change on the zone but does not touch the live hostname.

This address is a separate frontend, **not an isolated backend**. Select and document one test policy before interactive testing:

- Prefer sandbox APIs/auth/billing for flows that write or incur cost, if suitable environments already exist.
- Otherwise use production public reads for parity checks and prevent automated/browser test interactions with saves, forms, analyses, checkout, and sends. An agent test policy alone does not stop other visitors; protect the candidate or disable such capabilities if it is shared beyond controlled review.
- Review incidental writes such as analytics and client-error reporting. Do not claim a session is read-only merely because the tester did not click a submit button.

Validate sign-in before cutover where possible using an approved stable test hostname. Check Firebase authorized domains, redirect behavior, API CORS, and Maps referrer restrictions. Any required Firebase configuration change needs the operator's approval under `CLAUDE.md`. If auth cannot be tested, record it as an unresolved release gate or obtain an explicit waiver with an immediate production check and rollback condition.

| Acceptance check | Expected evidence |
|---|---|
| Home, representative client routes, nested refreshes | Correct shell, working assets, no browser routing errors. |
| Blog index plus seven articles | Real article HTML/content at existing URLs, not the SPA shell. |
| Unknown client route / missing file | Current client not-found behavior retained; missing JS/CSS/image returns 404. |
| Human and crawler requests | Expected shell versus bot HTML, including query variants and shared-analysis exclusions. |
| RSS and data proxy | Correct types/statuses; valid public data; disallowed/missing/member cases preserve restrictions. |
| Runtime configuration and API reads | Correct target, complete fields, successful real browser reads. |
| Auth and write-capable flows | Results from the approved test environment/policy; no unapproved live transactions. |
| Static/SEO content | Sitemap, robots, whitepaper, logos, textures, and canonical URLs resolve as intended. |
| Caching and packaging | Correct headers; no public source maps; candidate noindex; bot/human cache separation. |
| Release behavior | Failed verification prevents upload; commit/artifact/version recorded; an open browser survives or clearly recovers from an asset-changing release. |

**First review milestone:** a working candidate URL, evidence against this matrix, and an explicit list of remaining gates. Local preparation alone is not completion of this milestone.

## 7. Phase D — production cutover and rollback

Use the Phase A live configuration to write an executable change list with exact old/new record and route values. Target a Worker Custom Domain for the final origin. Check existing CNAME conflicts and apex/`www` redirects before selecting the sequence.

The old route stays: `globalperspective-rss` keeps running in front. Cutover = attach `globalperspective.net` (and `www` per Phase A findings) as a Custom Domain of `globalperspective-site`, which replaces the DNS records that point at GitHub Pages. Check the existing records/CNAME conflicts first and document the interruption risk at that step. Do not claim an atomic or zero-downtime switch without verification.

Before requesting cutover approval, provide the verified artifact/version, test results, unresolved items, exact transition steps, and exact rollback steps. Prepare the production form of the candidate with noindex/test restrictions removed as appropriate, and verify it before binding the domain. Keep Pages and the old Worker available.

After the approved switch, check TLS, canonical redirects, page reloads, all blog URLs, RSS/data, bot responses, Firebase/API behavior, and Worker errors. Confirm by configuration inspection that GitHub is no longer the origin; response headers are corroborating evidence, not the only proof.

Rollback triggers include failed sign-in/core data access, missing public content, broken RSS/data restrictions, or sustained new server errors. The initial rollback removes the Custom Domain from the new Worker and restores the captured GitHub Pages DNS records; the old Worker route was never changed. Repeat the same smoke checks afterward.

**Dual publishing during the fallback window:** until Pages is retired, every frontend release goes to both the new Worker and Pages (`docs/`), so a rollback never restores an older build. `deploy.sh` keeps the legacy Pages path for this and states which targets it updated.

Later Cloudflare release rollbacks may restore a previous Worker version and its associated assets. They do not restore DNS, deleted secrets, changed bindings, or external data. Record those separately. Agree the observation window before cutover; suggested default is 48 hours plus one successfully verified subsequent release before retiring Pages. Do not remove fallback resources automatically when that time elapses.

## 8. Decisions and approvals still needed

**Access gap found 2026-10-05:** the local `wrangler` OAuth token lists the account's Workers and Pages projects but **cannot read the `globalperspective.net` zone** (zone lookup returned nothing), so DNS records and Worker routes could not be captured. Phase A needs a login/token with zone read access, or the operator exports the DNS records and routes once.

Each of these needs its own explicit operator yes at the time it happens (planning approval is not any of them):

| Action | Why it needs a yes |
|---|---|
| Phase A zone access (token with zone read, or an operator export) | account access |
| First candidate deploy of `globalperspective-site` to `workers.dev` | new production-account Worker |
| Test hostname `next.globalperspective.net` + its route to `globalperspective-rss` | DNS/route change on the live zone |
| Adding a hostname to Firebase authorized domains (only if sign-in is tested before cutover) | Firebase auth config (`CLAUDE.md`) |
| Production cutover (Custom Domain on the live hostname) | live hosting change |
| Each later production release | frontend deploy (`CLAUDE.md`) |
| Retiring Pages / `docs/` after the observation window | removes the fallback |
| Phase E (merge Workers; new S3 keys = IAM change) | separate decision |

Local read-only inspection and reversible local preparation (code, scripts, packaging, tests) need no further approval. Workers Builds/GitHub access grants remain a later optional decision.

## 9. Documentation and implementation handoff

Before implementation, create the task ledger required by [TASK_WORKFLOW.md](../../playbooks/TASK_WORKFLOW.md), with this plan as its reference. Update these documents in the same change as the behavior they describe:

- `README.md` and `CLAUDE.md`: hosting layout, manual release procedure, authorization boundaries.
- `project-docs/ops/DEPLOYMENT_NOTES.md` and `DOMAIN_SETUP.md`: packaging, domain transition, validation, rollback.
- `project-docs/architecture/ARCHITECTURE.md`: actual hosting and Worker source/config locations.
- `project-docs/distribution/WORKER_FULL_CODE.md`: retire dashboard-paste instructions; reference the real source and preserve useful history.
- `.claude/skills/deploy-frontend/SKILL.md`: new explicit targets and release/rollback procedure.
- `project-docs/INDEX.md`, `CHANGES.md`, and the implementation task ledger.
- Any discoverable persistent Worker/deployment memory note: update its owner/location if available; do not claim an inaccessible note was updated.

Do not rewrite current-hosting documentation as though migration has shipped during the planning stage.

## 10. Reviewer checklist

- [ ] Does the plan distinguish observed production state from repo documentation and proposed behavior?
- [ ] Does the implementation start from the captured deployed Worker and preserve its required behavior?
- [ ] Do blog/static resolution and SPA fallback work together without hiding file 404s?
- [ ] Are all eight blog pages and every required runtime field included?
- [ ] Can the artifact be reproduced without accidentally using ignored local config?
- [ ] Are candidate side effects controlled, including incidental analytics/error writes?
- [ ] Does the old Worker's pass-through and `/index.html` fetch reach the new Worker correctly (chained test on the test hostname)?
- [ ] Is auth testing and candidate access feasible?
- [ ] Does every release during the fallback window reach both the new Worker and Pages?
- [ ] Is the production target unambiguous once the candidate Worker owns the live domain?
- [ ] Are DNS/route transition and rollback derived from actual account state, with no premature route deletion?
- [ ] Are the release checks, documentation changes, and fallback-retirement gate sufficient?

## References

Cloudflare documentation consulted on 2026-10-05; recheck relevant commands/configuration against the pinned Wrangler version during implementation:

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Worker-first routing and the asset binding](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Custom Domains and interaction with routes](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Version rollback and its limits](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Worker Previews](https://developers.cloudflare.com/workers/previews/get-started/) — optional later preview mechanism.
- [Workers Builds branch controls](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/) — deferred automation.
