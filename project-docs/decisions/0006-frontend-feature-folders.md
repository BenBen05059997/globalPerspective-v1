# 6. Frontend is organised by feature; Lambda paths stay put

Status: accepted; the "no index.js barrels" and "do not group Lambdas by feature" parts are superseded by 0024
Date: 2026-09-24

## Context
The frontend `src/` had grown flat (193 files). Finding what a page uses meant searching
everywhere. Grouping the Lambdas into feature folders was evaluated at the same time.

## Decision
We will organise the frontend as `src/app/` (routing, layout, chrome), `src/shared/`
(cross-feature api, contexts, data, hooks, lib, styles, ui) and `src/features/<name>/`, import
through the `@/` alias, and enforce one dependency direction: `app → features → shared`; `shared`
never imports `features` or `app`; a feature may import another feature's file by direct path.
No `index.js` barrels in this programme. Backend Lambda directories under
`amplify/backend/function/` are not moved; a feature → Lambda index answers "which Lambdas serve
this page".

## Consequences
- eslint `no-restricted-imports` enforces the direction.
- Cross-feature edges are visible as `@/features/<other>/…` import lines.
- Executed 2026-09-24 in phases P0–P12.

Source: `project-docs/archive/architecture/REPO_RESTRUCTURE_DESIGN_2026-09-24.md` (§2.5, §2.6,
recommendation); `project-docs/archive/architecture/_active/TASK_2026-09-24_frontend_feature_folders.md`
