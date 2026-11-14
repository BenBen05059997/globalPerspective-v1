# Frontend Deployment Checklist

**Production URL:** https://globalperspective.net, served since 2026-11-14 by the Cloudflare Worker `globalperspective-site`
(Workers Static Assets) behind the front Worker `globalperspective-rss` (sources in `cloudflare/front-worker/`). GitHub Pages
(`docs/` on `main`) is the fallback during the observation window and is not retired yet. The hosting design, rollback and
gates are in `project-docs/architecture/ARCHITECTURE.md` (Hosting and the Cloudflare cutover) and decision 0019. Which Worker
version is live is a Cloudflare fact: read it from Cloudflare, not from this file.

Use these steps every time frontend source files are changed.

## Build locally or release to an explicit target

The repo-root `./deploy.sh` defaults to local verification, build and packaging. It does not upload or publish. Candidate and
production Cloudflare uploads and every Pages push each need explicit current-message authorization (a fresh yes every time).

```bash
./deploy.sh                                  # verify + build + package locally; no upload
./deploy.sh --target candidate              # upload to globalperspective-site-candidate
./deploy.sh --target production             # the normal release: upload to globalperspective-site
./deploy.sh --target legacy-pages           # fallback only: preserved GitHub Pages release flow
./deploy.sh --target stage-pages --artifact HASH  # stage an archived package into docs/ only
./deploy.sh --target mark-verified --artifact HASH --version-id UUID  # record after production smoke checks
./deploy.sh --target legacy-pages --commit "msg" --push
```

- Each local package is archived under `.site-releases/` with its manifest and artifact hash. Upload records include the
  Cloudflare version ID. `mark-verified` records the last-known-good artifact and version in `.site-releases/last-verified.json`.
- `stage-pages` copies an exact archived package into `docs/` (keeps `config.js`, `CNAME`, `.nojekyll`; makes no commit and
  publishes nothing). Publishing the staged output is a Pages release and needs authorization. Do not run `legacy-pages`
  after staging: it rebuilds and would replace the selected archive.
- Observation window: after each production release and its smoke checks, run `mark-verified`, then stage the same artifact
  with `stage-pages` and (with its own operator yes) commit and push it, so Pages keeps the same build. Retiring Pages needs an
  operator yes; `docs/` still holds files packaging reads (`config.js`, `blog`, `sitemap.xml`, `WHITEPAPER.md`).
- A `workers.dev` hostname does not isolate Worker code or configured backend integrations.
- Recovery has two layers: roll back the Worker version, then use the recorded artifact hash with `stage-pages` and an
  authorized Pages release if the static origin also needs restoring.

## Legacy GitHub Pages release (fallback path, not the normal one)

`./deploy.sh --target legacy-pages --commit "Descriptive message" --push` runs `scripts/deploy-pages-legacy.sh`: it builds,
copies `dist/` into `docs/`, strips `docs/assets/*.map` (source maps are private), resyncs `docs/404.html` byte-for-byte with
`docs/index.html` (the SPA fallback for deep-link refreshes; a stale one renders blank pages), and refuses to finish if
`docs/config.js` changed. Omit `--push` to commit locally for review; `--skip-build` reuses the current `dist/`.
Pages no longer serves the domain, so check the Pages build on `benben05059997.github.io` if needed; for the live site open the
production URL in an incognito window and run the curl checks below after a production upload.

## Notes

- If the app's base path changes, update `resolveBasename()` in `src/app/App.jsx` and rebuild.
- `docs/config.js` is operator-owned runtime config (endpoints, Firebase config, Maps key). The build never writes it.
- Lambdas deploy separately: `bash scripts/lambda.sh <name> diff|package|deploy` (deploy needs the CLAUDE.md authorization).
- A route can ship without being linked from nav. There is no preview gate in the app; do not rely on one.
- Any upload of the shared front Worker needs separate explicit authorization and must preserve its routes, bindings,
  secrets and compatibility settings (see `cloudflare/front-worker/README.md`).

## Curl regression checks (front Worker)

As written they target production. The `next.globalperspective.net` test hostname was waived on 2026-11-14 and does not exist; a candidate runs on `workers.dev` and answers `X-Robots-Tag: noindex`. The real hostname must send no `x-robots-tag`. Read headers with `curl -s -D - -o /dev/null <url>` (a GET), not `curl -sI`: a
HEAD request to an SPA route returns `404` without the fallback header. The `x-rendered-by` values come from
`cloudflare/front-worker/production/worker.mjs`.
1. `/` returns `200`; with `-A "Googlebot/2.1"` the header is `cf-worker-bot` and the body contains `AI news intelligence that shows its work`.
2. `/map` returns `301` to `/` (`x-rendered-by: cf-worker-redirect`) once the production Worker file is the uploaded one.
3. `curl -s -A "Googlebot/2.1" /briefings` returns `200`, `cf-worker-bot`, a `— Daily Briefing` title and a `Top Stories` list; without the bot UA the same URL returns the shell (`cf-worker-spa-fallback`).
4. `/weekly/thread/<a real threadId from /briefings links>` returns `200`; with the bot UA the body contains the story title (no preview data: the bot gets the shell, still `200`).
5. `/sitemap.xml` returns `200` with an XML content type and `<loc>https://globalperspective.net/...` entries (served by the site Worker from the packaged `docs/sitemap.xml`).

Also: `/data/world/latest.json` returns `200` with `cf-worker-data`; `/rss` has content type `application/rss+xml`;
`/analyze/s/abc` with the bot UA returns `200` with `cf-worker-spa-fallback`, never `cf-worker-bot`; `/analyze` returns `301`
once the `/analyze` redirect has been uploaded (it is in the repo file; whether it is live is a Cloudflare fact).
