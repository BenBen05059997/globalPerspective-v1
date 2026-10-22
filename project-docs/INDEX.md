# project-docs — index of living docs

Code and live AWS are the truth; docs hold intent, decisions and how-to (decisions/0021).
Layout and lifecycle: decisions/0025 and 0026. Finished plans, reports and legacy docs are deleted;
git history keeps them. `quality/check_docs.mjs` keeps this file ≤60 lines with working links.

## Start here
- [ARCHITECTURE.md](architecture/ARCHITECTURE.md) — system overview.
- [The record](architecture/ARCHITECTURE_TIMELINE.md) — **the one record design doc**: two clocks, ten stages, facts, views, writers, open items; stage list as data in [pipeline.json](architecture/pipeline.json).
- [Foundation stocktake (dated)](architecture/FOUNDATION.md) — every store, writer, reader, ID and duplicate (2026-10-21); live state is in the plan.
- [Forecast loop](architecture/ARCHITECTURE_FORECAST_LOOP.md) — draw, watch, gather, judge, record, review; verification (decision 0038).
- [Ingest design](architecture/ARCHITECTURE_INGEST_DESIGN.md) — proposed: one ingest vs two (lane D) · [Weekly review](architecture/ARCHITECTURE_WEEKLY_REVIEW.md) — weekly readings, golden week (0039).
- [Decision records](decisions/README.md) — 40 decisions, newest last.
- [STATUS.md](STATUS.md) — in progress, parked, open decisions.
- Reference, generated from code and live AWS by `scripts/gen-reference.mjs`; never hand-edited:
  [lambdas](reference/lambdas.md) · [env-keys](reference/env-keys.md) names only · [features](reference/features.md) ·
  [routes](reference/routes.md) · [s3-prefixes](reference/s3-prefixes.md) · [schedules](reference/schedules.md).
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
- [Forecast loop](plans/PLAN_2026-10-22_forecast_loop.md) — proposed: draw/watch/judge/record checklist; carries selector P7 and cost rows.
- [Cloudflare migration](plans/CLOUDFLARE_FRONTEND_MIGRATION_PLAN.md) — local build done; candidate and cutover gated.
- [One link system + leaner pages](plans/PLAN_2026-10-19_linking_and_pages.md) — global links, Briefings merge, Studio out of nav; checklist.
- [Studio redesign](plans/PLAN_2026-10-19_studio_redesign.md) — bring-your-own-hypothesis tool; return-to-menu criteria (proposed).
- [Decisions 2026-10-20 + cleanup run](plans/PLAN_2026-10-20_decisions_and_cleanup.md) — operator's four answers, the one-by-one checklist and log.
- [The analyst's weekly](plans/PLAN_2026-10-20_analyst_weekly.md) — the weekly brief rebuilt as an agent-written, operator-confirmed JSON: content spec, pipeline, steps.
- [The board](plans/PLAN_2026-10-20_board.md) — brainstorm record, not decided: personal connection board (pins, strings, branches, tree, arrivals, monthly, folding rules), with the design canvas link.
- [Foundation](plans/PLAN_2026-10-21_foundation.md) — facts are the system of record (decision 0035): steps 0-5 checklist, retire list, open questions, log.

## Runbooks
[Index](runbooks/README.md) (one per scheduled job and alert) · [parked jobs](runbooks/parked-jobs.md) · [alarms](runbooks/alarms.md). Jobs:
[topic selection](runbooks/topic-selection.md) · [news agent](runbooks/news-agent.md) · [thread analysis](runbooks/thread-analysis.md) ·
[systems analysis](runbooks/systems-analysis.md) · [country briefings](runbooks/country-intelligence.md) · [country facts](runbooks/country-facts.md) ·
[drift notes](runbooks/drift-corrector.md) · [drift email](runbooks/drift-email.md) · [situation ingest](runbooks/situation-ingest.md) ·
[situation tracker](runbooks/situation-tracker.md) · [GDACS](runbooks/gdacs-ingest.md) · [GDELT](runbooks/gdelt-conflict.md) ·
[prediction resolver](runbooks/prediction-resolver.md) · [track record](runbooks/predictions-snapshot.md) · [selection shadow](runbooks/selection-shadow.md) ·
[signals](runbooks/signals-build.md) · [markets](runbooks/markets-data.md) · [breaking alert](runbooks/breaking-alert.md) ·
[daily brief](runbooks/daily-brief.md) · [weekly brief](runbooks/weekly-brief.md) · [weekly email](runbooks/weekly-email.md) ·
[social posts](runbooks/social-posts.md) · [source audit](runbooks/source-audit.md) · [freshness](runbooks/freshness-monitor.md) ·
[model guard](runbooks/model-guard.md) · [error digest](runbooks/error-digest.md). Procedures:
[DEPLOYMENT_NOTES](runbooks/DEPLOYMENT_NOTES.md) (frontend release; targets need a fresh yes) · [DOMAIN_SETUP](runbooks/DOMAIN_SETUP.md) ·
[BUG_PLAYBOOK](runbooks/BUG_PLAYBOOK.md) · [AGENT_REVIEW_METHOD](runbooks/AGENT_REVIEW_METHOD.md) · [ANALYTICS_GUIDE](runbooks/ANALYTICS_GUIDE.md) ·
[DEEPSEEK_COST_ESTIMATE](runbooks/DEEPSEEK_COST_ESTIMATE.md)

## Elsewhere
- `CLAUDE.md` — agent rules and authorization.
- `backend/<group>/<name>/README.md`, `src/features/<name>/README.md` — next to the code.
- `quality/`, `predictions/` — eval harnesses and their dated reports.
- `internal-docs/` — legal and marketing notes; `agent-kit/` — portable agent playbooks.
