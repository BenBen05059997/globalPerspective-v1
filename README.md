# Global Perspectives

AI-powered global-news intelligence platform — [globalperspective.net](https://globalperspective.net). The production frontend is currently GitHub Pages (`docs/`) behind Cloudflare's `globalperspective-rss` Worker; a Workers Static Assets migration is in progress but has not been deployed. Backend: AWS Lambdas (list: `project-docs/reference/lambdas.md`) + S3 + DynamoDB + Firebase Auth. Content is public; Polar membership buys analysis compute + depth.

## Architecture

One record, two clocks. Facts (what happened) are appended daily with no model; readings (what it meant) are written
weekly with hindsight, cite the facts, and supersede earlier readings instead of editing them. Pages, the board and the
weekly report are views of that record. The ten-stage pipeline and the object model are in
`project-docs/architecture/ARCHITECTURE_TIMELINE.md`; the stage list as data is `project-docs/architecture/pipeline.json`.

## Where to look (start here)

| You want… | Read |
|---|---|
| Agent operating rules + deploy workflow | **`CLAUDE.md`** (repo root) |
| A map of all documentation | **`project-docs/INDEX.md`** |
| System overview (Lambdas, stores, routes) | `project-docs/architecture/ARCHITECTURE.md`; generated facts in `project-docs/reference/`. Code and deployed AWS beat any doc. |
| Rules and conventions | `project-docs/rules/` (e.g. `TASK_WORKFLOW.md`, `DATA_STRATEGY.md`) |
| How to run / check a job | `project-docs/runbooks/` |
| Frontend source | `global-perspectives-starter/frontend/src/` — `app/` (chrome/routing) + `shared/` (cross-feature) + `features/<name>/`; see ARCHITECTURE.md's Frontend Path map |
| Lambda source | `backend/<group>/<name>/src/` (path per Lambda: `scripts/functions.json` `dir`) |

## Traps — do NOT assume

- **`docs/` is the legacy GitHub Pages build OUTPUT** (served HTML + operator-owned `config.js`), not source. `./deploy.sh` with no target only verifies, builds and packages locally; only `./deploy.sh --target …` publishes, and every target needs explicit operator authorization. See `project-docs/runbooks/DEPLOYMENT_NOTES.md`.
- **Lambda env vars named `XAI_API_KEY` / `GROK_*` are legacy** — they hold DeepSeek/Gemini values. Confirm the provider with `aws lambda get-function-configuration`, never from the name.
- **Deployed Lambda bytes can drift from `main`** — diff before changing (`scripts/lambda.sh <name> diff`).
- Load-bearing root files: `CLAUDE.md`, `deploy.sh`, `.env.example`.

## No CI by design

This repo is intentionally CI-free. Doc↔code drift is caught by an on-demand multi-agent review (`project-docs/runbooks/AGENT_REVIEW_METHOD.md`), the docs-as-code convention (`project-docs/rules/TASK_WORKFLOW.md`) and local pre-commit checks (`quality/check_*.mjs`), not GitHub Actions.
