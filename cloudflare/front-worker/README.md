# Front Worker sources (`globalperspective-rss`)

The sources of the Cloudflare Worker in front of globalperspective.net. No script in this repo uploads any of them: an
upload is a production change and needs the operator's explicit yes. Which version is live is a Cloudflare fact (dashboard
or `wrangler versions list`); it is not recorded here.

| Path | What it is |
|---|---|
| `baseline/worker2.mjs` (+ sanitized `capture.json`) | Captured source of the production Worker before 2026-10-20. The rollback target; the candidate wraps it. |
| `production/worker.mjs` | The Worker to deploy: baseline plus the changes below. |
| `candidate.mjs` | Wrapper around the baseline for `next.globalperspective.net` only: GET/HEAD `/blog` and `/blog/*` go straight to the origin, and every response gets `X-Robots-Tag: noindex`. Other hosts get baseline behaviour. A two-module upload (it imports `baseline/worker2.mjs`). |

## What `production/worker.mjs` does

- `/data/<key>` reads the private world bucket with SigV4. Only keys matching `DATA_ALLOWED` are served: `world/*.json`,
  `situations/state/*.json`, `stories/state/*.json` and `record/views/*.json`. Facts, runs, inboxes and readings are not
  in the allowlist.
- `POST /api/errors` is the client-error sink's same-origin endpoint: a request whose `request.cf.asn` is in `DATA_CENTRE_ASNS` (8075, Microsoft) gets 204 and
  nothing is sent on; any other is forwarded (body, content-type, user-agent) to the newsClientErrors Function URL (`CLIENT_ERRORS_URL`) and its
  status and body come back. Other methods get 405. Never cached.
- `/rss` proxies the RSS action of the read API (which builds the feed from the record's today view when its `RECORD_READS` says so, decision 0054).
- Real 301s (query string kept) for retired addresses: `/daily`, `/daily/:date`, `/weekly-brief` (to `/briefings?mode=read|weekly`),
  `/spider-demo` (to `/weekly?view=web`), `/map` (to `/`),
  `/weekly?section=countries` (to `/weekly/countries`) and `/analyze` (to the first `?stories=` thread's story page, else
  `/weekly/countries`). The client redirects in `src/app/LegacyRedirects.jsx` and `MapRedirect.jsx` are the fallback.
- Bot pre-render: story and country pages, every `/briefings` mode (canonical = the edition served) and `/today`. Shared runs
  (`/analyze/s/*`) are never pre-rendered. The root page lists the briefings modes.
- Where the pre-render reads (decision 0054): the record's public view files first, through the Worker's own SigV4 path (the objects `/data/record/views/*`
  serves), and the read API action only when no view answers. `/today` reads `index/today.json` (the latest run's topics); a daily brief
  `briefs/daily/<date>.json` (the newest through `index/briefs.json`); a weekly brief `briefs/weekly/<weekOf>.json` (published weeks only); a story
  `stories/<id>.json` (its `analysis`); a country `index/countries.json` (name to ISO3) and `countries/<ISO3>.json`. "The newest", the today view, the story
  and the country read only while `manifest.builtAt` is under 9 hours old. A missing, unreadable or stale view is not an error: the action (`topics`,
  `daily_brief`, `latest_daily_brief`, `weekly_brief`, `thread_preview`, `country_preview`) answers as before. The Worker reads no DynamoDB.
- GET/HEAD `/blog` and `/blog/*` skip the SPA-shell fallback and go to the origin (static pages in `docs/blog/`).
- `HEAD` answers exactly as `GET` does (status and headers), without the body, for every path.
- Content-hashed build files (`/assets/<name>-<hash>.<ext>`) are served `Cache-Control: public, max-age=31536000, immutable`; every other
  response keeps the origin's headers (HTML, `config.js`, `/data` are unchanged).
- Everything else falls back to the SPA shell: status 200 for a client route, status 404 for any other path (no route, redirect, file or blog page).
  The route list is `APP_ROUTES` in `worker.mjs`; `worker.test.mjs` fails when it differs from the `<Route path>` values in `src/app/App.jsx`,
  so adding or removing a route there means editing that list in the same commit.

## Tests

Offline; each compares against the baseline.

```sh
node --test cloudflare/front-worker/production/worker.test.mjs
node --test cloudflare/front-worker/candidate.test.mjs
```

## Uploading

Any upload must be code-only and keep the existing Worker name, routes, bindings, secrets, compatibility settings and other
live settings; never a bare `wrangler deploy`. Before upload, record the current deployed version and settings. Recovery is
a version rollback to the recorded version, or a controlled upload of the captured baseline source if it is unavailable.
Process: `.claude/skills/deploy-frontend/DEPLOYMENT_NOTES.md`.
