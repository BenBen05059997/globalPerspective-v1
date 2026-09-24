# agent-kit — Global Perspectives project bindings

> Filled placeholder values for this repo. The generic kit (`CLAUDE.template.md` + `playbooks/`)
> is project-agnostic; this file is the one place where its `<PLACEHOLDERS>` are bound to
> Global Perspectives. When a playbook says `<VERIFY_CMD>`, read it as the value below.

## Project facts

| Key | Value |
|---|---|
| App directory (`<APP_DIR>`) | `global-perspectives-starter/frontend` |
| Verify — pre-commit gate (`<VERIFY_CMD>`) | `npm run verify` (= `eslint . && vitest run`) — run from `<APP_DIR>` |
| Verify-full — pre-deploy gate (`<VERIFY_FULL_CMD>`) | `npm run verify` then `npm run build` (build runs the `prebuild` eslint gate) |
| Smoke — post-deploy (`<SMOKE_CMD>`) | `node scripts/smoke-test.mjs` (from repo root) — a manual, on-demand playbook, not CI |
| Deploy command (`<DEPLOY_CMD>`) | `./deploy.sh` (repo root) — build → copy `dist/` to `docs/` → strip `docs/assets/*.map` → resync `docs/404.html` byte-identical → guard `docs/config.js` |
| Production URL (`<PROD_URL>`) | `https://globalperspective.net` |
| Default branch (`<DEFAULT_BRANCH>`) | `main` |
| Build dirs to clear before deploy (`<CLEAN_BUILD_DIRS>`) | `global-perspectives-starter/frontend/dist` |

## `<NEVER_TOUCH>` — needs an explicit, fresh "yes" in the current message

This mirrors the Authorization section in repo `CLAUDE.md`; that file is the single wording —
update both together if either changes. Lambda code/config updates the operator asked for
(`update-function-code`/`-configuration`/`-url-config`, `aws events`, `aws scheduler`,
non-destructive `aws dynamodb`) are standing-authorized, as is `git push` once verify/hooks pass.
Still needs a fresh "yes" every time:

- `./deploy.sh` (frontend prod deploy).
- `docs/config.js` — runtime config (`FIREBASE_CONFIG`, `SENSITIVE_PROXY_ENDPOINT`, Google Maps key). `deploy.sh` hash-guards it; never overwrite it.
- `.env*` files anywhere, secret values, IAM changes, Firebase auth config.
- Polar / billing / subscription code or config (`newsPolarBilling`; credits are parked, not an active task — see `feedback_billing_polar` memory).
- Enabling user-facing sends (email crons), destructive DynamoDB/S3 ops, new paid-API/dependency integrations.
- Plaintext Lambda env is the chosen secret store (see `feedback_no_secrets_manager` memory); never infer the AI provider from the legacy `XAI_*`/`GROK_*` names (see `feedback_misleading_grok_naming` memory) — verify with `aws lambda get-function-configuration`.

## Project-specific deviations from the generic kit

- **Deploy is GitHub Pages, not a host CLI.** "Deploy" = `./deploy.sh` writing to `docs/`; there is no `npm run deploy`. After deploy, `curl -s -o /dev/null -w "%{http_code}" https://globalperspective.net` must be `200`, AND `diff docs/index.html docs/404.html` must be empty (the SPA-fallback gotcha that bit twice).
- **No CI gate, ever.** Solo-dev repo; the gate is local `npm run verify`. Do not add or wait on GitHub Actions. Dependabot is fine.
- **Smoke/observability are roll-your-own.** `scripts/{smoke-test,link-crawl,auth-guard-check,contract-check}.mjs` are manual checks (the 8 bug classes in `project-docs/playbooks/BUG_PLAYBOOK.md`); passive 24/7 monitors are Lambdas → SNS `GlobalPerspectiveAlerts`. Don't propose paid Sentry.
- **No fallback/placeholder data.** This is an intelligence site — a fake-looking fallback is misinformation. Fail empty + report.
- **Memory system already exists.** The harness provides the file-based memory in `MEMORY_SYSTEM.md`; use it, don't recreate it.

## Worktrees on this repo

Each new worktree needs deps: clone them with APFS copy-on-write from the main checkout
(near-instant, real dir not a symlink), then verify:

```bash
git worktree add ../gp-<line> -b <type>/<line> main
cp -Rc global-perspectives-starter/frontend/node_modules \
       ../gp-<line>/global-perspectives-starter/frontend/node_modules
cd ../gp-<line>/global-perspectives-starter/frontend && npm run verify
```
