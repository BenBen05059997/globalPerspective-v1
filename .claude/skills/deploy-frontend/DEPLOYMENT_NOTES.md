# Frontend Deployment Checklist

**Production URL:** https://globalperspective.net, served from the `docs/` directory of `main` on GitHub Pages, behind the
Cloudflare `globalperspective-rss` Worker (sources in `cloudflare/front-worker/`). A second Worker (`globalperspective-site`,
Workers Static Assets) is prepared but not cut over; the hosting plan, fallbacks and gates are in
`project-docs/architecture/ARCHITECTURE.md` (Hosting and the Cloudflare cutover). Which Worker version is live is a
Cloudflare fact: read it from Cloudflare, not from this file.

Use these steps every time frontend source files are changed.

## Build locally or release to an explicit target

The repo-root `./deploy.sh` defaults to local verification, build and packaging. It does not upload or publish. Candidate and
production Cloudflare uploads and the legacy Pages release each need explicit current-message authorization.

```bash
./deploy.sh                                  # verify + build + package locally; no upload
./deploy.sh --target candidate              # upload to globalperspective-site-candidate
./deploy.sh --target production             # upload to globalperspective-site
./deploy.sh --target legacy-pages           # preserved GitHub Pages release flow
./deploy.sh --target stage-pages --artifact HASH  # stage an archived package into docs/ only
./deploy.sh --target mark-verified --artifact HASH --version-id UUID  # record after production smoke checks
./deploy.sh --target legacy-pages --commit "msg" --push
```

- Each local package is archived under `.site-releases/` with its manifest and artifact hash. Upload records include the
  Cloudflare version ID. `mark-verified` records the last-known-good artifact and version in `.site-releases/last-verified.json`.
- `stage-pages` copies an exact archived package into `docs/` (keeps `config.js`, `CNAME`, `.nojekyll`; makes no commit and
  publishes nothing). Publishing the staged output is a Pages release and needs authorization. Do not run `legacy-pages`
  after staging: it rebuilds and would replace the selected archive.
- A `workers.dev` hostname does not isolate Worker code or configured backend integrations.
- Recovery has two layers: roll back the Worker version, then use the recorded artifact hash with `stage-pages` and an
  authorized Pages release if the static origin also needs restoring.

## Legacy GitHub Pages release

`./deploy.sh --target legacy-pages --commit "Descriptive message" --push` runs `scripts/deploy-pages-legacy.sh`: it builds,
copies `dist/` into `docs/`, strips `docs/assets/*.map` (source maps are private), resyncs `docs/404.html` byte-for-byte with
`docs/index.html` (the SPA fallback for deep-link refreshes; a stale one renders blank pages), and refuses to finish if
`docs/config.js` changed. Omit `--push` to commit locally for review; `--skip-build` reuses the current `dist/`.
After GitHub Pages redeploys (usually under 2 minutes), open the production URL in an incognito window and run the curl
checks below.

## Notes

- If the app's base path changes, update `resolveBasename()` in `src/app/App.jsx` and rebuild.
- `docs/config.js` is operator-owned runtime config (endpoints, Firebase config, Maps key). The build never writes it.
- Lambdas deploy separately: `bash scripts/lambda.sh <name> diff|package|deploy` (deploy needs the CLAUDE.md authorization).
- A route can ship without being linked from nav. There is no preview gate in the app; do not rely on one.
- Any upload of the shared front Worker needs separate explicit authorization and must preserve its routes, bindings,
  secrets and compatibility settings (see `cloudflare/front-worker/README.md`).

## Curl regression checks (front Worker)

As written they target production; for an authorized candidate-host test, substitute `https://next.globalperspective.net` and
also check the `X-Robots-Tag: noindex` header. Read headers with `curl -s -D - -o /dev/null <url>` (a GET), not `curl -sI`: a
HEAD request to an SPA route returns `404` without the fallback header. The `x-rendered-by` values come from
`cloudflare/front-worker/production/worker.mjs`.
1. `/` returns `200`; with `-A "Googlebot/2.1"` the header is `cf-worker-bot` and the body contains `AI news intelligence that shows its work`.
2. `/map` returns `301` to `/` (`x-rendered-by: cf-worker-redirect`) once the production Worker file is the uploaded one.
3. `curl -s -A "Googlebot/2.1" /briefings` returns `200`, `cf-worker-bot`, a `— Daily Briefing` title and a `Top Stories` list; without the bot UA the same URL returns the shell (`cf-worker-spa-fallback`).
4. `/weekly/thread/<a real threadId from /briefings links>` returns `200`; with the bot UA the body contains the story title (no preview data: the bot gets the shell, still `200`).
5. `/sitemap.xml` returns `200` with an XML content type and `<loc>https://globalperspective.net/...` entries (served by GitHub Pages from `docs/sitemap.xml`).

Also: `/data/world/latest.json` returns `200` with `cf-worker-data`; `/rss` has content type `application/rss+xml`;
`/analyze/s/abc` with the bot UA returns `200` with `cf-worker-spa-fallback`, never `cf-worker-bot`; `/analyze` returns `301`
once the `/analyze` redirect has been uploaded (it is in the repo file; whether it is live is a Cloudflare fact).
