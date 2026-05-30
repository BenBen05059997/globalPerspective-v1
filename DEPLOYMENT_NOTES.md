# Frontend Deployment Checklist

**Production URL:** https://globalperspective.net (custom domain via GitHub Pages)
**GitHub Pages URL:** https://benben05059997.github.io/globalPerspective-v1/
**Served from:** `docs/` directory on the `main` branch

Use these steps every time frontend source files are changed.

---

## Steps

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
- Preview mode (`?preview=1`) bypasses the "Under Construction" gate for gated routes, persisted in sessionStorage.
