# Frontend Deployment Checklist

Last verified: 2026-10-19 (scripts read from the repo; the curl checks below run against production; the Worker version is as captured 2026-10-05, not re-read).

**Production URL:** https://globalperspective.net (currently GitHub Pages behind Cloudflare)
**GitHub Pages URL:** https://benben05059997.github.io/globalPerspective-v1/
**Served from:** `docs/` directory on the `main` branch

**Migration status (2026-10-05):** production still uses GitHub Pages plus the existing
`globalperspective-rss` Worker. A new static-site Worker and a candidate front-Worker wrapper are
prepared locally, but neither has been uploaded; DNS/domain cutover has not occurred. The captured
front-Worker source matches deployed version `91ba1e98-0959-4387-84f3-10a0d5790ad8` (deployed
2026-10-01). See the [migration plan](../plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md) (§11 holds
the former task tracker).

Use these steps every time frontend source files are changed.

---

## Build locally or release to an explicit target

The repo-root **`./deploy.sh` defaults to local verification, build, and packaging only**. It does
not upload or publish. Candidate and production Cloudflare uploads, and the legacy Pages release,
require explicit current-message authorization.

```bash
./deploy.sh                                  # verify + build + package locally; no upload
./deploy.sh --target candidate              # upload to globalperspective-site-candidate
./deploy.sh --target production             # upload to globalperspective-site
./deploy.sh --target legacy-pages           # invoke preserved Pages release flow
./deploy.sh --target stage-pages --artifact HASH  # stage exact archived package into docs/ only
./deploy.sh --target mark-verified --artifact HASH --version-id UUID  # record after production smoke checks
./deploy.sh --target legacy-pages --commit "msg" --push
```

Workers Builds and automatic deployments are deferred. Once `globalperspective-site` owns the
production domain, future uploads to it are production releases. A `workers.dev` hostname does not
isolate Worker code or configured backend integrations. See the migration plan for release and
cutover gates.

Each local package is archived under `.site-releases/` with its manifest and artifact hash. Upload
records include the Cloudflare version ID. After a production upload passes its smoke checks,
`mark-verified` records the last-known-good artifact/version in `.site-releases/last-verified.json`.
`stage-pages` copies an exact archived package into `docs/` to support dual-publishing or restore a
known artifact for Pages; it preserves `config.js`, `CNAME`, and `.nojekyll`, creates no commit, and
does not publish until the staged `docs/` changes are reviewed, committed, and pushed under explicit Pages-release authorization. Do not run `--target legacy-pages` after staging an archived artifact: it rebuilds/copies the current Vite output and would replace the selected archive.

Recovery has two layers: roll back the Worker version to restore the previous Cloudflare script,
then use the recorded artifact hash with `stage-pages` and an authorized Pages release if the old
static origin also needs restoration. Keep the last-known-good artifact separate from the Pages
fallback artifact; changing hosting infrastructure and reverting an application release are
different recovery actions.

## Legacy GitHub Pages release reference

The manual steps below describe only the preserved `--target legacy-pages` path. They are not the
default frontend deployment workflow. Use them only for an explicitly authorized Pages release.

---

## Steps

1. **Publish through the legacy Pages target** (fresh authorization: this publishes production)
   ```bash
   ./deploy.sh --target legacy-pages --commit "Descriptive message" --push
   ```
   `scripts/deploy-pages-legacy.sh` builds, copies `dist/` into `docs/`, strips `docs/assets/*.map`
   (source maps are private), resyncs `docs/404.html` byte-for-byte with `docs/index.html` (the SPA
   fallback for deep-link refreshes; a stale one renders blank pages), and refuses to finish if
   `docs/config.js` changed (operator-owned runtime config: proxy endpoint, Firebase config, Maps
   key). Omit `--push` to commit locally for review; `--skip-build` reuses the current `dist/`.

2. **Verify**
   After GitHub Pages redeploys (usually < 2 minutes), open the production URL in an incognito
   window, and run the curl regression checks below.

---

## Notes

- If the app's base path changes, update `resolveBasename()` in `src/app/App.jsx` and rebuild.
- `docs/config.js` is never written by the build; the operator updates it by hand when endpoints or Firebase config change.
- Backend (Lambda) changes deploy separately with `bash scripts/lambda.sh <name> diff|package|deploy` (deploy needs the CLAUDE.md authorization) — no frontend build required.
- **Unlisted routes (no gate):** a route can ship to prod without being linked from nav/home. There is **no** `?preview=1` / "Under Construction" gate in the app; do not rely on one. `/map-legacy` and `WorldMapV2.jsx` were removed 2026-09-24 — do not reintroduce them.

---

## Existing front Worker (`globalperspective-rss`): live baseline and regression checks

The Worker fronts all traffic and currently remains in production. Its captured live source is
`cloudflare/front-worker/baseline/worker2.mjs`; it matches the code block in
`git show 120de90:project-docs/archive/distribution/WORKER_FULL_CODE.md` (deleted 2026-10-19). Captured version:
`91ba1e98-0959-4387-84f3-10a0d5790ad8`, deployed 2026-10-01. The separately prepared
`cloudflare/front-worker/candidate.mjs` wrapper is **not uploaded**. It adds candidate-host-only
blog passthrough and noindex handling; it is not a production change.

The former 2026-09-30 paste checklist is historical. Do not paste or upload code based on it as
part of a site release. Any future upload of this shared Worker needs separate explicit
authorization and must preserve its current routes, bindings, secrets, and compatibility settings.
See the migration plan for candidate and cutover gates.

The curl checks below remain useful as regression checks. As written, they target production. For
an authorized candidate-host test, substitute `https://next.globalperspective.net` and verify the
candidate-only noindex header as well.

**5 curl regression checks** (all against production as written; expected results). Read headers
with `curl -s -D - -o /dev/null <url>` (a GET), not `curl -sI`: a HEAD request to an SPA route
returns `404` without the fallback header.
1. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/` -> `200`; `curl -sI -A "Googlebot/2.1" https://globalperspective.net/ | grep -i x-rendered-by` -> `cf-worker-bot`; the body (`curl -s -A "Googlebot/2.1" https://globalperspective.net/`) contains `AI news intelligence that shows its work`.
2. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/map` -> `200` (was `404` before the Worker fallback); `curl -s -D - -o /dev/null https://globalperspective.net/map | grep -i x-rendered-by` -> `cf-worker-spa-fallback`; body contains `<div id="root">` (the SPA shell).
3. `curl -s -A "Googlebot/2.1" https://globalperspective.net/briefings` -> `200`, header `x-rendered-by: cf-worker-bot`, body contains `— Daily Briefing` in `<title>` and a `Top Stories` list (links `/weekly/thread/thread-…` where the brief has ids); without the bot UA the same URL returns the shell (`cf-worker-spa-fallback`).
4. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/weekly/thread/<a real threadId from today's /briefings links>` -> `200`; with `-A "Googlebot/2.1"` the header is `cf-worker-bot` and the body contains the story title (if the thread has no preview data the bot gets the shell, still `200`).
5. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/sitemap.xml` -> `200`, `curl -sI ... | grep -i content-type` -> `application/xml` (or `text/xml`), body starts with `<?xml` and lists `<loc>https://globalperspective.net/…` URLs (currently served by GitHub Pages from `docs/sitemap.xml`).

Also confirm nothing regressed: `curl -sI https://globalperspective.net/data/world/latest.json | grep -i x-rendered-by` -> `cf-worker-data` (200); `curl -sI https://globalperspective.net/rss | grep -i content-type` -> `application/rss+xml`; `curl -s -o /dev/null -w "%{http_code}" -A "Googlebot/2.1" https://globalperspective.net/analyze/s/abc` -> `200` with `x-rendered-by: cf-worker-spa-fallback` (never `cf-worker-bot`). The fuller matrix is the "Test plan for the SPA fallback" in `git show 120de90:project-docs/archive/distribution/WORKER_FULL_CODE.md`.
