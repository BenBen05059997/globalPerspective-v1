# Global Perspectives — working notes for Claude

AI global-news intelligence site (globalperspective.net). React frontend served from `docs/` by
GitHub Pages; ~33 AWS Lambdas (ap-northeast-1) + S3 world store + a few DynamoDB tables + Firebase
Auth; Cloudflare Worker in front. Solo developer; no CI by design.

## Where truth lives
- Doc map: `project-docs/INDEX.md`. System reference: `project-docs/architecture/ARCHITECTURE.md`
  (trust it over other docs; deployed AWS state beats both — check with the AWS CLI).
- Active work: the `_active/` plans listed in INDEX. Read the relevant one before proposing next steps.
- Change log: `CHANGES.md`. Storage rules: `project-docs/architecture/DATA_STRATEGY.md`.

## Layout
- Frontend source: `global-perspectives-starter/frontend/src/`. `docs/` is build output — don't
  hand-edit it; `docs/config.js` is operator-owned runtime config.
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
- `./deploy.sh` (frontend prod deploy)
- secret values (API keys/tokens), IAM changes, Firebase auth config, `.env*`, `docs/config.js`
- Polar / billing code or config (credits are parked — not an active task)
- enabling user-facing sends (email crons), destructive data ops (delete tables/items/S3 prefixes)
- new paid APIs or dependencies

## Deploying the frontend
Run `./deploy.sh` (add `--commit "msg"` freely; add `--push` only with a fresh deploy "yes" —
`--push` rides along with the deploy gate, not the standing push allowance above). It builds,
copies to `docs/`, strips source maps, keeps `docs/404.html` identical to `index.html`, and
guards `docs/config.js`. Afterwards: `curl -s -o /dev/null -w "%{http_code}" https://globalperspective.net`
→ 200, then push once and let Pages settle. Details: `project-docs/ops/DEPLOYMENT_NOTES.md`.

## Product rules that affect code
- Never invent facts (prices, dates, URLs, handles) — find them in the repo or ask.
- No placeholder or "something went wrong" UI: fail empty/honest and report to the error sink.
- Public data hooks never gate on sign-in; membership limits are server-side.
- Lambda Function-URL CORS: only `newsPolarBilling` and `newsAnalyze` emit CORS in code, so their
  Function-URL CORS config must stay empty; `newsSavedItems` and `newsRecommend` are the opposite
  and rely on a populated Function-URL CORS config. Grep the function's source for
  `Access-Control-Allow-Origin` before touching either side.
