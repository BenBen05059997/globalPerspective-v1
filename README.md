# Global Perspectives

AI-powered global-news intelligence platform — [globalperspective.net](https://globalperspective.net). The production frontend is currently GitHub Pages (`docs/`) behind Cloudflare's `globalperspective-rss` Worker; a Workers Static Assets migration is in progress but has not been deployed. Backend: ~33 AWS Lambdas + DynamoDB + Firebase Auth. Content is public; Polar membership buys analysis compute + depth.

## Where to look (start here)

| You want… | Read |
|---|---|
| Agent operating rules + deploy workflow | **`CLAUDE.md`** (repo root) |
| A map of all documentation | **`project-docs/INDEX.md`** |
| Authoritative system overview (Lambdas, DDB, routes) | **`project-docs/architecture/ARCHITECTURE.md`** — trust this over any other doc on drift |
| Code-grounded wiring | `project-docs/architecture/SYSTEM_WIRING.md` |
| Autonomy / verify / deploy playbooks | `agent-kit/` (bindings in `agent-kit/PROJECT.md`) |
| Task/docs-freshness convention | `project-docs/playbooks/TASK_WORKFLOW.md` |
| Frontend source | `global-perspectives-starter/frontend/src/` — `app/` (chrome/routing) + `shared/` (cross-feature) + `features/<name>/` (13 features); see ARCHITECTURE.md's Frontend Path map |
| Lambda source | `backend/<group>/<name>/src/` (path per Lambda: `scripts/functions.json` `dir`; three still in `amplify/backend/function/`) |

## Traps — do NOT assume

- **`docs/` is the legacy GitHub Pages build OUTPUT** (served HTML + operator-owned `config.js`), not source. The new `./deploy.sh` defaults to local verify/build/package only. Use `--target legacy-pages` to run the preserved Pages release flow; candidate and production Cloudflare uploads are explicit targets and require current authorization. See `project-docs/ops/DEPLOYMENT_NOTES.md`.
- **Lambda env vars named `XAI_API_KEY` / `GROK_*` are legacy** — they hold DeepSeek/Gemini values. Confirm the provider with `aws lambda get-function-configuration`, never from the name.
- **Deployed Lambda bytes can drift from `main`** (especially the signal-api-derived ones) — diff before changing.
- Root scratch files (`simple-prompt.js`, `test-gemini.js`, root `index.html`, and the 101-byte empty-stub root `package-lock.json`) were removed 2026-09-24 as dead weight (see `project-docs/architecture/CLEANUP_AUDIT_2026-09-24.md`). Load-bearing root files: `CLAUDE.md`, `deploy.sh`, `.env.example`.

## No CI by design

This repo is intentionally CI-free. Doc↔code drift is caught by an on-demand multi-agent review (`project-docs/playbooks/AGENT_REVIEW_METHOD.md`) + the docs-as-code convention (`project-docs/playbooks/TASK_WORKFLOW.md`), not GitHub Actions.
