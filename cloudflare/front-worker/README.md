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
- `/rss` proxies the RSS action of the read API.
- Real 301s (query string kept) for retired addresses: `/daily`, `/daily/:date`, `/weekly-brief` (to `/briefings?mode=read|weekly`),
  `/spider-demo` (to `/weekly?view=web`), `/map` (to `/`),
  `/weekly?section=countries` (to `/weekly/countries`) and `/analyze` (to the first `?stories=` thread's story page, else
  `/weekly/countries`). The client redirects in `src/app/LegacyRedirects.jsx` and `MapRedirect.jsx` are the fallback.
- Bot pre-render: story and country pages, every `/briefings` mode (canonical = the edition served) and `/today`. Shared runs
  (`/analyze/s/*`) are never pre-rendered. The root page lists the briefings modes.
- GET/HEAD `/blog` and `/blog/*` skip the SPA-shell fallback and go to the origin (static pages in `docs/blog/`).
- Everything else falls back to the SPA shell.

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
