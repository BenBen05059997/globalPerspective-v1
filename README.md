# Global Perspectives

AI-powered global-news intelligence platform — [globalperspective.net](https://globalperspective.net). React frontend on GitHub Pages + ~33 AWS Lambdas + DynamoDB + Firebase Auth. Content is public; Polar membership buys analysis compute + depth.

## Where to look (start here)

| You want… | Read |
|---|---|
| Agent operating rules + deploy workflow | **`CLAUDE.md`** (repo root) |
| A map of all documentation | **`project-docs/INDEX.md`** |
| Authoritative system overview (Lambdas, DDB, routes) | **`project-docs/architecture/ARCHITECTURE.md`** — trust this over any other doc on drift |
| Code-grounded wiring | `project-docs/architecture/SYSTEM_WIRING.md` |
| Autonomy / verify / deploy playbooks | `agent-kit/` (bindings in `agent-kit/PROJECT.md`) |
| Task/docs-freshness convention | `project-docs/playbooks/TASK_WORKFLOW.md` |
| Frontend source | `global-perspectives-starter/frontend/src/` |
| Lambda source | `amplify/backend/function/<name>/src/` |

## Traps — do NOT assume

- **`docs/` is the GitHub Pages build OUTPUT** (served HTML + `config.js`), not source. Never hand-edit it except `config.js`; `deploy.sh` regenerates it.
- **Root `src/` is a legacy Amplify scaffold, NOT the frontend.** The real frontend is `global-perspectives-starter/frontend/src/`.
- **Lambda env vars named `XAI_API_KEY` / `GROK_*` are legacy** — they hold DeepSeek/Gemini values. Confirm the provider with `aws lambda get-function-configuration`, never from the name.
- **Deployed Lambda bytes can drift from `main`** (especially the signal-api-derived ones) — diff before changing.
- Root scratch files (`simple-prompt.js`, `test-gemini.js`, `*.xlsx`, root `index.html`) are one-offs, not load-bearing. Load-bearing root files: `CLAUDE.md`, `deploy.sh`, `package-lock.json`, `.env.example`.

## No CI by design

This repo is intentionally CI-free. Doc↔code drift is caught by an on-demand multi-agent review (`project-docs/playbooks/AGENT_REVIEW_METHOD.md`) + the docs-as-code convention (`project-docs/playbooks/TASK_WORKFLOW.md`), not GitHub Actions.
