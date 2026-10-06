# Global Perspectives — working notes for Claude

AI global-news intelligence site (globalperspective.net). Production frontend is currently served
from GitHub Pages `docs/` behind the Cloudflare `globalperspective-rss` Worker. A Workers Static
Assets migration is in progress but has not been deployed. Backend: ~33 AWS Lambdas
(ap-northeast-1) + S3 world store + DynamoDB + Firebase Auth. Solo developer; no CI by design.

## Where truth lives
- Doc map: `project-docs/INDEX.md`. System reference: `project-docs/architecture/ARCHITECTURE.md`
  (trust it over other docs; deployed AWS state beats both — check with the AWS CLI).
- Active work: the `_active/` plans listed in INDEX. Read the relevant one before proposing next steps.
- Change log: `CHANGES.md`. Storage rules: `project-docs/architecture/DATA_STRATEGY.md`.

## Layout
- Frontend source: `global-perspectives-starter/frontend/src/`. `docs/` is build output — don't
  hand-edit it; `docs/config.js` is operator-owned runtime config.
- Frontend is feature-folder organized (restructured 2026-09-24): `src/app/` (routing/layout/chrome),
  `src/shared/` (cross-feature api/contexts/data/hooks/lib/styles/ui), `src/features/<name>/`
  (13 features — home, map, threads, countries, economy, analysis-studio, breaking, account,
  daily, weekly-brief, track-record, static, spider-demo). Dependency direction is enforced by
  eslint (`no-restricted-imports`): `app → features → shared`, `shared` never imports
  `features`/`app`; feature→feature imports are allowed (see ARCHITECTURE.md's Frontend Path map).
- Frontend imports use the `@/` alias (→ `src/`, `vite.config.js`), not relative paths — see
  ARCHITECTURE.md "Frontend imports" for the Node-tooling exceptions.
- Lambdas: `amplify/backend/function/<name>/src/` (deployed manually with the AWS CLI; the name
  "amplify" is historical). Several deployed zips differ from the repo — diff before editing.
  `newsAnalyze` specifically is a prompt-patched deployed zip; the repo file carries parked
  credits code, so don't deploy the repo file over it without a fresh go-live decision.
- Scripts/checks: `scripts/`, `quality/`, `predictions/`.

## Verify
- Pre-commit gate: `cd global-perspectives-starter/frontend && npm run verify`.
- UI changes: exercise every touched control in a browser before calling it done; if you can't
  run a browser, say so.
- Hooks already enforce: a CHANGES.md entry on code commits (pre-commit), page guards (pre-push),
  a docs reminder (Stop hook). You don't need to re-check what they check.

## Working style
- On reversible work, keep going without asking; report what changed and why as you go.
- Stop and ask on: a verify failure you can't fix, genuine ambiguity with irreversible outcomes,
  a business decision (pricing, positioning, legal copy), or anything on the list below.
- Diagnose-first requests ("why is X…", "check this"): report findings, then wait.
- Commits: plain descriptive summaries matching `git log`; stage explicit paths; one coherent
  change per commit. Update the docs a change makes stale in the same commit.

## Authorization
Standing (operator, recorded 2026-07-01): Lambda code and configuration updates for work the
operator asked for — `aws lambda update-function-code/-configuration/-url-config`, `aws events`,
`aws scheduler`, non-destructive `aws dynamodb` reads/writes. Run each as a single bare command
(not in a loop). When changing env: fetch → merge → write the full map; pass secrets via a temp
file. Verify after.

`git push` is allowed once verify/hooks pass — no need to ask each time. The GitHub remote
belongs to account BenBen05059997; if a push 403s as another account, run
`gh auth switch --user BenBen05059997`, push, then switch back.

Needs a fresh "yes" in the current message every time:
- Cloudflare candidate/production uploads and GitHub Pages legacy releases (`./deploy.sh --target candidate`, `--target production`, or `--target legacy-pages`, including a legacy push). The default `./deploy.sh` local verify/build/package operation does not deploy and does not need a fresh yes.
- secret values (API keys/tokens), IAM changes, Firebase auth config, `.env*`, `docs/config.js`
- Polar / billing code or config (credits are parked — not an active task)
- enabling user-facing sends (email crons), destructive data ops (delete tables/items/S3 prefixes)
- new paid APIs or dependencies

## Deploying the frontend
`./deploy.sh` with no target runs frontend verification, builds Vite, and packages deterministic
site assets locally; it does not upload or publish. For the candidate Worker use
`./deploy.sh --target candidate`; for a production Worker release use
`./deploy.sh --target production`. Both require explicit current-message authorization. The
preserved GitHub Pages flow is `./deploy.sh --target legacy-pages` (old `--commit`, `--push`, and
`--skip-build` flags are forwarded to it); it also requires explicit current-message
authorization because pushing `docs/` publishes production. Production currently remains Pages
behind `globalperspective-rss`; no Cloudflare site upload or domain cutover has occurred. Details:
`project-docs/ops/DEPLOYMENT_NOTES.md` and
`project-docs/ops/_active/TASK_2026-10-05_cloudflare_frontend_migration.md`.

`./deploy.sh --target stage-pages --artifact HASH` only stages an exact archived artifact into
`docs/`; it does not commit or publish. After a production upload passes smoke checks,
`./deploy.sh --target mark-verified --artifact HASH --version-id UUID` records the verified
Worker version and artifact locally. Do not use either as a substitute for release authorization.

## Product rules that affect code
- Never invent facts (prices, dates, URLs, handles) — find them in the repo or ask.
- No placeholder or "something went wrong" UI: fail empty/honest and report to the error sink.
- Public data hooks never gate on sign-in; membership limits are server-side.
- Lambda Function-URL CORS: only `newsPolarBilling` and `newsAnalyze` emit CORS in code, so their
  Function-URL CORS config must stay empty; `newsSavedItems` and `newsRecommend` are the opposite
  and rely on a populated Function-URL CORS config. Grep the function's source for
  `Access-Control-Allow-Origin` before touching either side.
