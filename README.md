# Global Perspectives

AI-powered global-news intelligence platform — [globalperspective.net](https://globalperspective.net). The production frontend is currently GitHub Pages (`docs/`) behind Cloudflare's `globalperspective-rss` Worker; a Workers Static Assets migration is in progress but has not been deployed. Backend: AWS Lambdas (list: `scripts/functions.json`) + S3 + DynamoDB + Firebase Auth. Content is public; Polar membership buys following countries and deeper history (the Analysis Studio was retired 2026-10-20).

## Architecture

One record, two clocks. Facts (what happened) are appended daily with no model: raw articles are captured before the
model runs, entries are assigned to stories, and verdicts come back through inboxes. Readings (what it meant) are written
weekly with hindsight, cite the facts, and supersede earlier readings instead of editing them. Pages, the board and the
weekly report are views of that record, served as static JSON through the Worker; pages are moving over one at a time and some still read the old DynamoDB world rows (START_HERE says which). The ten-stage pipeline and the object model are in
`project-docs/architecture/ARCHITECTURE_TIMELINE.md`; the stage list as data is `project-docs/architecture/pipeline.json`;
what is stopped or waiting is in `project-docs/START_HERE.md`; what is deployed comes from AWS.

## Where to look (start here)

| You want… | Read |
|---|---|
| Agent operating rules + deploy workflow | **`CLAUDE.md`** (repo root) |
| A map of the docs and where we left off | **`project-docs/START_HERE.md`** |
| System overview (Lambdas, stores, routes) | `project-docs/architecture/ARCHITECTURE.md` and the area designs beside it. Code and deployed AWS beat any doc. |
| Storage rules and decisions | `project-docs/architecture/DATA_STRATEGY.md`, `project-docs/decisions/` |
| How to run / check a job | the README next to the code (`backend/<group>/<name>/README.md`) |
| Frontend source | `global-perspectives-starter/frontend/src/` — `app/` (chrome/routing) + `shared/` (cross-feature) + `features/<name>/`; see ARCHITECTURE.md's Frontend Path map |
| Lambda source | `backend/<group>/<name>/src/` (path per Lambda: `scripts/functions.json` `dir`) |

## Traps — do NOT assume

- **`docs/` is the legacy GitHub Pages build OUTPUT** (served HTML + operator-owned `config.js`), not source. `./deploy.sh` with no target only verifies, builds and packages locally; only `./deploy.sh --target …` publishes, and every target needs explicit operator authorization. See `.claude/skills/deploy-frontend/DEPLOYMENT_NOTES.md`.
- **Lambda env vars named `XAI_API_KEY` / `GROK_*` are legacy** — they hold DeepSeek/Gemini values. Confirm the provider with `aws lambda get-function-configuration`, never from the name.
- **Deployed Lambda bytes can drift from `main`** — diff before changing (`scripts/lambda.sh <name> diff`).
- Load-bearing root files: `CLAUDE.md`, `deploy.sh`, `.env.example`.

## No CI by design

This repo is intentionally CI-free. Doc↔code drift is avoided by keeping docs to design intent (code and AWS are the truth) and caught by local pre-commit checks (`quality/check_*.mjs`), not GitHub Actions.
