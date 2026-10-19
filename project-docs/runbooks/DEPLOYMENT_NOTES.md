# Frontend Deployment Checklist

**Production URL:** https://globalperspective.net (currently GitHub Pages behind Cloudflare)
**GitHub Pages URL:** https://benben05059997.github.io/globalPerspective-v1/
**Served from:** `docs/` directory on the `main` branch

**Migration status (2026-10-05):** production still uses GitHub Pages plus the existing
`globalperspective-rss` Worker. A new static-site Worker and a candidate front-Worker wrapper are
prepared locally, but neither has been uploaded; DNS/domain cutover has not occurred. The captured
front-Worker source matches deployed version `91ba1e98-0959-4387-84f3-10a0d5790ad8` (deployed
2026-10-01). See the [active task](../plans/TASK_2026-10-05_cloudflare_frontend_migration.md)
and [migration plan](../plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md).

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

## Steps (manual reference)

1. **Install dependencies (first time only)**
   ```bash
   cd global-perspectives-starter/frontend
   npm install
   ```

2. **Build the Vite app**
   ```bash
   cd global-perspectives-starter/frontend
   npm run build
   ```
   This outputs static assets to `global-perspectives-starter/frontend/dist/`.

3. **Copy build output to `docs/`**
   ```bash
   rm -rf ../../docs/assets
   cp -r dist/assets ../../docs/assets
   cp dist/index.html ../../docs/index.html
   # Source maps are PRIVATE (build.sourcemap:'hidden') — never serve them publicly.
   rm -f ../../docs/assets/*.map
   # SPA fallback for deep-link refreshes — MUST mirror index.html (see note below)
   cp ../../docs/index.html ../../docs/404.html
   ```

   **NEVER overwrite `docs/config.js`** — it contains runtime configuration:
   - `window.SENSITIVE_PROXY_ENDPOINT` — API Gateway endpoint
   - `window.FIREBASE_CONFIG` — Firebase project config
   - `window.GOOGLE_MAPS_API_KEY` — Google Maps key

   **`docs/404.html` MUST stay byte-for-byte identical to `docs/index.html`.** It
   is the GitHub Pages SPA fallback served on every deep-link refresh (e.g.
   refreshing `/economy`); if it points at an old/deleted bundle hash, every
   deep-link refresh renders a blank page. `npm run build` auto-emits a matching
   `dist/404.html` (postbuild script), but resync it here too. Verify:
   `diff ../../docs/index.html ../../docs/404.html` must be empty.

4. **Update CHANGES.md** with a dated entry describing what changed.

5. **Publish through the legacy Pages target**
   ```bash
   cd ../..
   ./deploy.sh --target legacy-pages --commit "Descriptive message" --push
   ```
   A fresh authorization is required because this publishes production. Omit `--push` to commit
   locally for later review; use the preserved script's `--skip-build` only when appropriate.

6. **Verify**
   After GitHub Pages redeploys (usually < 2 minutes), open the production URL in an incognito window to confirm routing and assets work correctly.

---

## Notes

- The root `index.html` at the repository level redirects visitors to `/globalPerspective-v1/`. The custom domain removes this redirect.
- If the app's base path changes, update the `resolveBasename()` function in `App.jsx` and rebuild.
- The `docs/config.js` file is never overwritten by the build process and must be updated manually when endpoints or Firebase config changes.
- Backend (Lambda) changes are deployed separately via the AWS Console or `amplify push` — no frontend build required.
- **Unlisted routes (no gate):** a route can ship to prod without being surfaced in nav/home — it simply isn't linked. As of 2026-09-09 the 2.5D situation map was live at `/map` this way (nothing linked to it yet), with `/map-legacy` keeping the old `WorldMapV2`. **Update 2026-09-24:** `/map` is now `Layout.jsx`-linked (top nav "Map") and is the primary map; `/map-legacy` and `WorldMapV2.jsx` were removed (`CLEANUP_AUDIT_2026-09-24.md` §4 D3) — do not reintroduce that route. There is **no** `?preview=1` / "Under Construction" gate in the current app (an earlier such gate was removed); do not rely on one.

---

## Existing front Worker (`globalperspective-rss`): live baseline and regression checks

The Worker fronts all traffic and currently remains in production. Its captured live source is
`cloudflare/front-worker/baseline/worker2.mjs`; it matches the code block in
`project-docs/archive/distribution/WORKER_FULL_CODE.md`. Captured version:
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

**5 curl regression checks** (all against production as written; expected results):
1. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/` -> `200`; `curl -sI -A "Googlebot/2.1" https://globalperspective.net/ | grep -i x-rendered-by` -> `cf-worker-bot`; the body (`curl -s -A "Googlebot/2.1" https://globalperspective.net/`) contains `AI news intelligence that shows its work`.
2. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/map` -> `200` (was `404` before the Worker fallback); `curl -sI https://globalperspective.net/map | grep -i x-rendered-by` -> `cf-worker-spa-fallback`; body contains `<div id="root">` (the SPA shell).
3. `curl -s -A "Googlebot/2.1" https://globalperspective.net/briefings` -> `200`, header `x-rendered-by: cf-worker-bot`, body contains `— Daily Briefing` in `<title>` and a `Top Stories` list (links `/weekly/thread/thread-…` where the brief has ids); without the bot UA the same URL returns the shell (`cf-worker-spa-fallback`).
4. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/weekly/thread/<a real threadId from today's /briefings links>` -> `200`; with `-A "Googlebot/2.1"` the header is `cf-worker-bot` and the body contains the story title (if the thread has no preview data the bot gets the shell, still `200`).
5. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/sitemap.xml` -> `200`, `curl -sI ... | grep -i content-type` -> `application/xml` (or `text/xml`), body starts with `<?xml` and lists `<loc>https://globalperspective.net/…` URLs (currently served by GitHub Pages from `docs/sitemap.xml`).

Also confirm nothing regressed: `curl -sI https://globalperspective.net/data/world/latest.json | grep -i x-rendered-by` -> `cf-worker-data` (200); `curl -sI https://globalperspective.net/rss | grep -i content-type` -> `application/rss+xml`; `curl -s -o /dev/null -w "%{http_code}" -A "Googlebot/2.1" https://globalperspective.net/analyze/s/abc` -> `200` with `x-rendered-by: cf-worker-spa-fallback` (never `cf-worker-bot`). The fuller matrix is in `WORKER_FULL_CODE.md` ("Test plan for the SPA fallback").
