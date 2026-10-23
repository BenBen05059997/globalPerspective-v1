# Front Worker sources (`globalperspective-rss`)

Three versions of the live front Worker live here. None of them is uploaded by any script in this repo.

| Path | What it is | Uploaded? |
|---|---|---|
| `baseline/worker2.mjs` (+ sanitized `capture.json`) | Captured source of the production Worker before 2026-10-20 (version `91ba1e98…`, deployed 2026-10-01). | Rollback target. |
| `production/worker.mjs` | Baseline plus: GET/HEAD `/blog` and `/blog/*` skip the SPA-shell fallback and go to the origin (static blog pages in `docs/blog/`); real 301s (query kept) for `/daily`, `/daily/:date`, `/weekly-brief` (→ `/briefings?mode=read\|weekly`), `/weekly-markets`, `/spider-demo`, `/map`, `/weekly?section=countries`, `/analyze` (→ the first requested thread story, else `/weekly/countries`; `/analyze/s/*` shared runs stay the SPA, never bot-rendered); bot pre-render for every `/briefings` mode (canonical = the edition served) and `/today`; the root page directory lists the briefings modes. | **Live 2026-10-22** as version `1e17cf9a…` = the 2026-10-20 code (`cc57a42f…`) plus the `record/views/` allowlist line. The `/analyze` redirect in this file is **not uploaded** yet. |
| `candidate.mjs` | Wrapper around the baseline for `next.globalperspective.net` only: sends GET/HEAD `/blog` and `/blog/*` straight to the origin and adds `X-Robots-Tag: noindex` to every response. Other hosts keep baseline behaviour. | **No**. |

The live Worker serves `record/views/` JSON only (checked 2026-10-23: `/data/record/views/manifest.json` 200, `/data/record/facts/manifest.json` 404); facts, runs, inboxes and readings are not in its allowlist.

Offline tests (each compares against the baseline):

```sh
node --test cloudflare/front-worker/production/worker.test.mjs
node --test cloudflare/front-worker/candidate.test.mjs
```

Uploading either file is a production change and needs the operator's explicit yes. `candidate.mjs`
is a two-module upload (it imports `baseline/worker2.mjs`). Any upload must be code-only and keep the
existing Worker name, routes, bindings, secrets, compatibility settings and other live settings —
never a bare `wrangler deploy`. Before upload, record the current deployed version and settings.
Recovery is a version rollback to the recorded baseline, or a controlled upload of the captured
baseline source if that version is unavailable. Process: `project-docs/runbooks/DEPLOYMENT_NOTES.md`.
