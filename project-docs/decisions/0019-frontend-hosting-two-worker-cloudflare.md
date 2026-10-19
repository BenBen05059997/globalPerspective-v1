# 19. Frontend hosting moves to Cloudflare Workers Static Assets behind the existing Worker

Status: accepted (migration prepared locally; not cut over)
Date: 2026-10-05

## Context
Production is GitHub Pages (`docs/` on `main`) behind the `globalperspective-rss` Cloudflare Worker,
which handles RSS, bot pre-rendering, `/data/*` and the SPA fallback. A push to `docs/` publishes
production.

## Decision
We will move site hosting to a new static-assets Worker (provisionally `globalperspective-site`)
that only serves files, with `globalperspective-rss` kept on its route in front of it (revision
2026-10-05, operator yes). Releases are manual through `./deploy.sh` targets with a pinned
Wrangler. Merging the two Workers is a separate, later decision (Phase E).

## Consequences
- Until an authorized cutover, production stays on Pages behind `globalperspective-rss`.
- Candidate, production and legacy-pages releases each need a fresh operator "yes"
  (`CLAUDE.md`, Authorization).

Source: `project-docs/plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md` (§1 and the 2026-10-05
revisions); `project-docs/plans/TASK_2026-10-05_cloudflare_frontend_migration.md`;
`project-docs/runbooks/DEPLOYMENT_NOTES.md`; `CLAUDE.md`
