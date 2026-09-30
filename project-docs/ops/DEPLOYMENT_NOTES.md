# Frontend Deployment Checklist

**Production URL:** https://globalperspective.net (custom domain via GitHub Pages)
**GitHub Pages URL:** https://benben05059997.github.io/globalPerspective-v1/
**Served from:** `docs/` directory on the `main` branch

Use these steps every time frontend source files are changed.

---

## One command: `./deploy.sh`

The canonical deploy is the repo-root **`./deploy.sh`** — it runs the entire checklist below (build → copy to `docs/` → **strip `docs/assets/*.map`** → resync `docs/404.html` byte-identical → hash-guard `docs/config.js`) in one step:

```bash
./deploy.sh                          # build + copy to docs/ (review diff, push yourself)
./deploy.sh --commit "msg"           # ...and commit (no push)
./deploy.sh --commit "msg" --push    # ...and push to origin in one shot
./deploy.sh --skip-build             # copy an already-built dist/ only
```

Prefer the script. The manual steps below document exactly what it does (and are the fallback if you can't run it).

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

5. **Commit and push**
   ```bash
   cd ../..
   git add docs/assets docs/index.html docs/404.html global-perspectives-starter/frontend/src/ CHANGES.md
   git commit -m "Descriptive message"
   git push
   ```

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

## Cloudflare Worker update (`globalperspective-rss`): paste checklist (prepared 2026-09-30, operator runs it)

The Worker is not in a wrangler project; its full source is the ```js block in `project-docs/distribution/WORKER_FULL_CODE.md`. The Worker fronts all traffic, so deploy it only after the frontend is live and keep the previous version for rollback.

**Where to paste:** Cloudflare dashboard -> Workers & Pages -> `globalperspective-rss` -> Edit code. Select everything in the editor, replace it with the ```js block, click **Deploy**. Secrets `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` already exist (Settings -> Variables); do not change them. Rollback: Deployments tab -> pick the previous version -> Rollback (or re-paste the previous file version from git history).

**Before you paste:** in the dashboard note the current version id (Deployments tab). What this update adds: `/briefings` (and `?date=` / `?mode=weekly`) bot pre-render, and no pre-render for `/analyze/s/*`. Everything else is unchanged.

**5 curl checks after the deploy** (all against production; expected results):
1. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/` -> `200`; `curl -sI -A "Googlebot/2.1" https://globalperspective.net/ | grep -i x-rendered-by` -> `cf-worker-bot`; the body (`curl -s -A "Googlebot/2.1" https://globalperspective.net/`) contains `AI news intelligence that shows its work`.
2. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/map` -> `200` (was `404` before the Worker fallback); `curl -sI https://globalperspective.net/map | grep -i x-rendered-by` -> `cf-worker-spa-fallback`; body contains `<div id="root">` (the SPA shell).
3. `curl -s -A "Googlebot/2.1" https://globalperspective.net/briefings` -> `200`, header `x-rendered-by: cf-worker-bot`, body contains `— Daily Briefing` in `<title>` and a `Top Stories` list (links `/weekly/thread/thread-…` where the brief has ids); without the bot UA the same URL returns the shell (`cf-worker-spa-fallback`).
4. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/weekly/thread/<a real threadId from today's /briefings links>` -> `200`; with `-A "Googlebot/2.1"` the header is `cf-worker-bot` and the body contains the story title (if the thread has no preview data the bot gets the shell, still `200`).
5. `curl -s -o /dev/null -w "%{http_code}\n" https://globalperspective.net/sitemap.xml` -> `200`, `curl -sI ... | grep -i content-type` -> `application/xml` (or `text/xml`), body starts with `<?xml` and lists `<loc>https://globalperspective.net/…` URLs (served by GitHub Pages from `docs/sitemap.xml`, untouched by the Worker).

Also confirm nothing regressed: `curl -sI https://globalperspective.net/data/world/latest.json | grep -i x-rendered-by` -> `cf-worker-data` (200); `curl -sI https://globalperspective.net/rss | grep -i content-type` -> `application/rss+xml`; `curl -s -o /dev/null -w "%{http_code}" -A "Googlebot/2.1" https://globalperspective.net/analyze/s/abc` -> `200` with `x-rendered-by: cf-worker-spa-fallback` (never `cf-worker-bot`). The fuller matrix is in `WORKER_FULL_CODE.md` ("Test plan for the SPA fallback").

