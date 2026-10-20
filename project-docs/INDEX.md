# project-docs — index of living docs

Code and live AWS are the truth; docs hold intent, decisions and how-to (decisions/0021).
Layout and lifecycle: decisions/0025 and 0026. Finished plans, reports and legacy docs are deleted;
git history keeps them. `quality/check_docs.mjs` keeps this file ≤60 lines with working links.

## Start here
- [ARCHITECTURE.md](architecture/ARCHITECTURE.md) — system overview.
- [Decision records](decisions/README.md) — 32 decisions, newest last.
- [STATUS.md](STATUS.md) — in progress, parked, open decisions.
- [reference/](reference/lambdas.md) — generated from code and live AWS by `scripts/gen-reference.mjs`
  (Lambdas, schedules, env key names, routes, features, S3 prefixes); never hand-edited.
- [data-links.md](reference/data-links.md) — every store: writers, readers, read actions, pages (heuristic table + flow diagram);
  `quality/check_aws_inventory.mjs` fails when functions.json drifts from live AWS.
- Start a feature check at its `global-perspectives-starter/frontend/src/features/<name>/README.md`
  (status, routes, frontend, backend, data, docs, how to check it; checked by `quality/check_docs.mjs`).

## Rules (how things must be done)
- [DATA_STRATEGY.md](rules/DATA_STRATEGY.md) — S3 for the world, DynamoDB for the user.
- [SEVERITY_CODEBOOK.md](rules/SEVERITY_CODEBOOK.md) — severity rubric behind the risk tier.
- [WORLD_MODEL.md](rules/WORLD_MODEL.md) — events vs developments, one importance scale.
- [TASK_WORKFLOW.md](rules/TASK_WORKFLOW.md) — plan → build → docs lifecycle.

## Plans (live, at most 10)
- [Consistency and modernisation](plans/PLAN_2026-10-19_consistency_and_modernisation.md) — waves 1–3, backlog.
- [Colour consistency](plans/PLAN_2026-10-19_colour_consistency.md) — map colours, radar C6.
- [Grounded forecasts + cost](plans/TASK_2026-10-17_grounded_forecast_and_cost.md) — layered selector P7, shadow week.
- [Cloudflare migration](plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md) — local build done; candidate and cutover gated.
- [One link system + leaner pages](plans/PLAN_2026-10-19_linking_and_pages.md) — global links, Briefings merge, Studio out of nav; checklist.
- [Studio redesign](plans/PLAN_2026-10-19_studio_redesign.md) — bring-your-own-hypothesis tool; return-to-menu criteria (proposed).

## Runbooks
- [Runbook index](runbooks/README.md) — one per scheduled job and alert, plus parked jobs;
  [drift email](runbooks/drift-email.md) — how to turn it on at the first follower.
- [DEPLOYMENT_NOTES.md](runbooks/DEPLOYMENT_NOTES.md) — frontend release (targets need a fresh yes).
- [DOMAIN_SETUP.md](runbooks/DOMAIN_SETUP.md) · [BUG_PLAYBOOK.md](runbooks/BUG_PLAYBOOK.md) ·
  [AGENT_REVIEW_METHOD.md](runbooks/AGENT_REVIEW_METHOD.md) · [ANALYTICS_GUIDE.md](runbooks/ANALYTICS_GUIDE.md) ·
  [DEEPSEEK_COST_ESTIMATE.md](runbooks/DEEPSEEK_COST_ESTIMATE.md)

## Elsewhere
- `CLAUDE.md` — agent rules and authorization.
- `backend/<group>/<name>/README.md`, `src/features/<name>/README.md` — next to the code.
- `quality/`, `predictions/` — eval harnesses and their dated reports.
- `internal-docs/` — legal and marketing notes; `agent-kit/` — portable agent playbooks.
