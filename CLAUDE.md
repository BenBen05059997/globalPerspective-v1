# Global Perspectives — working notes for Claude

AI global-news intelligence site (globalperspective.net). Production frontend: GitHub Pages `docs/`
behind the Cloudflare `globalperspective-rss` Worker (a Workers Static Assets migration is prepared,
not cut over). Backend: AWS ap-northeast-1 Lambdas + S3 world store + DynamoDB + Firebase Auth.
Solo developer; no CI by design.

## Facts come from code and live AWS, never from docs
Docs go stale; check the source of truth yourself before acting or reporting:
- Lambdas, env, runtimes: `aws lambda list-functions` / `get-function-configuration` (provider and
  model = live env, not variable names: `GROK_*`/`XAI_*` hold DeepSeek).
- Schedules: `aws events list-rules` + `aws scheduler list-schedules`.
- Routes: `src/app/App.jsx`. Features: `ls src/features`. Deployed frontend: the served bundle hash.
- Deployed Lambda zips can differ from the repo (`newsAnalyze` especially: the repo carries parked
  credits code). Diff deployed vs repo before deploying any Lambda.
Docs are for design intent and navigation: `project-docs/INDEX.md` (map), `ARCHITECTURE.md`
(system overview), `rules/DATA_STRATEGY.md` (storage rules), `decisions/`, plans in `plans/`.

## Layout
- Frontend `global-perspectives-starter/frontend/src/`: `app/` → `features/<name>/` → `shared/`
  (direction enforced by eslint). Imports use the `@/` alias. Shared tokens in
  `shared/styles/tokens.css`, shared blocks in `shared/ui/` — reuse them, never re-style locally.
- `docs/` is build output — don't hand-edit; `docs/config.js` is operator-owned.
- Lambdas: `backend/<group>/<name>/src/`, shared helpers in `backend/shared/src/`; `scripts/functions.json`
  `dir` is the path (newsAnalyze, newsPolarBilling, NewsProjectInvokeAgentLambda still in
  `amplify/backend/function/`). Deploy with `scripts/lambda.sh`.
- Scripts/checks: `scripts/`, `quality/`, `predictions/`.

## Verify
- `cd global-perspectives-starter/frontend && npm run verify` (pre-push runs it when frontend changed;
  pre-commit runs the `quality/check_*.mjs` style ratchets).
- UI changes: click every touched control in a browser before calling it done; if you can't, say so.

## Docs
Update `ARCHITECTURE.md` (and `INDEX.md` for a new doc) only when the architecture changes: a Lambda,
store/S3 prefix, schedule, route, feature or data flow is added or removed. Record design decisions
in the relevant plan. Routine code changes need no doc edit; git log is the change log
(old docs and CHANGES.md were deleted 2026-10-19; git history keeps them).

## Working style
- Reversible work: keep going; report what changed and why. Diagnose-first requests: report, then wait.
- A design discussion is not a build go-ahead; don't drop existing features without asking.
- Stop and ask on: a verify failure you can't fix, ambiguity with irreversible outcomes, business
  decisions (pricing, positioning, legal copy), or anything in Authorization below.
- Simplest code, no duplicated logic; delete replaced paths.
- Commits: plain descriptive summaries, explicit paths, one coherent change per commit.

## Authorization
Standing (operator, 2026-07-01): Lambda code and configuration updates for work the operator asked
for — `aws lambda update-function-code/-configuration/-url-config`, `aws events`, `aws scheduler`,
non-destructive `aws dynamodb` reads/writes. Run each as a single bare command. Env changes: fetch →
merge → write the full map; pass secrets via a temp file. Verify after.
`git push` is allowed once checks pass. The remote belongs to BenBen05059997; on a 403 run
`gh auth switch --user BenBen05059997`, push, switch back.

Needs a fresh "yes" in the current message every time:
- Frontend releases: `./deploy.sh --target candidate|production|legacy-pages` (plain `./deploy.sh`
  only builds locally). See `.claude/skills/deploy-frontend/` and `project-docs/runbooks/DEPLOYMENT_NOTES.md`.
- secret values, IAM changes, Firebase auth config, `.env*`, `docs/config.js`
- Polar / billing code or config (credits are parked)
- enabling user-facing sends (email crons), destructive data ops (delete tables/items/S3 prefixes)
- new paid APIs or dependencies

## Product rules
- Never invent facts (prices, dates, URLs, handles) — find them in the repo or ask.
- No placeholder or "something went wrong" UI: fail empty/honest and report to the error sink.
- Public data hooks never gate on sign-in; membership limits are server-side.
- Lambda Function-URL CORS: if the function's code emits `Access-Control-Allow-Origin`, its
  Function-URL CORS config must be empty; otherwise it must be populated. Grep before touching either.
