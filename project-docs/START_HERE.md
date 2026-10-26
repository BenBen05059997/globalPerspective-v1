# Start here

Code and live AWS are the truth; docs hold intent and decisions (decisions/0021, 0026). Old docs are deleted, git history keeps them.

## 1. Map
Read order: `CLAUDE.md` -> this file -> [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) -> the architecture doc for your area -> [decisions/README.md](decisions/README.md).
- Areas: [the record](architecture/ARCHITECTURE_TIMELINE.md) (facts, readings, views; stage list in [pipeline.json](architecture/pipeline.json)) · [forecast loop](architecture/ARCHITECTURE_FORECAST_LOOP.md) · [weekly review and analyst weekly](architecture/ARCHITECTURE_WEEKLY_REVIEW.md) · [board](architecture/ARCHITECTURE_BOARD.md) · [ingest proposal](architecture/ARCHITECTURE_INGEST_DESIGN.md) · [storage rules](architecture/DATA_STRATEGY.md) · [world model](architecture/WORLD_MODEL.md).
- Next to code: `backend/<group>/README.md`, `backend/<group>/<name>/README.md`, `global-perspectives-starter/frontend/src/features/<name>/README.md` (checked by `quality/check_docs.mjs`).
- Code lives in: Lambdas `backend/<group>/<name>/src/` (shared helpers `backend/shared/src/`, deployed name to dir in `scripts/functions.json`); frontend `global-perspectives-starter/frontend/src/` (`app/` -> `features/` -> `shared/`); edge `cloudflare/front-worker/`; checks `quality/`; forecast harnesses `predictions/`; severity rubric `quality/SEVERITY_CODEBOOK.md`.
- Deploy: frontend through `./deploy.sh` and `.claude/skills/deploy-frontend/` (targets need a fresh yes); Lambdas through `scripts/lambda.sh <name> diff|package|deploy|rollback` (diff first; the deployed zip can differ from the repo).
- Facts come from code and live AWS: `aws lambda list-functions`, `aws events list-rules`, `aws scheduler list-schedules`, `App.jsx`, the served bundle hash. Never trust a doc for state.

## 2. Where we left off (2026-10-26)
Working model: one coordinator session reviews, merges and deploys; lanes (git worktrees) or Sonnet agents build. Lane briefs go in an ignored folder inside the repo; the old `~/Downloads/gp-mailbox` was lost 2026-10-25, so anything that cited it (the gap-benchmark answer key, the judge bench, board review notes, foundation review) is gone.

Stopped or waiting, from the live pipeline:
- Ingest model: DeepSeek out of credit (HTTP 402 since 2026-10-20). Raw capture still runs; selection, daily notes and model drafts are stopped. Review (`newsRecordReview`) is deployed with `TriggerRecordReview` DISABLED and no readings written. `TriggerFreshnessMonitor` is DISABLED (it re-sent "stale" every 2 hours during the outage). No Run alarm, no `LLM 402` alarm, two alert topics.
- Weekly report is not on the new path: `TriggerWeeklyBrief` and `TriggerWeeklyEmailSend` are still ENABLED, so the old digest still sends on Sundays. W1-W3 are on unmerged branches `lane/weekly` and `lane/routine`.
- Delivery: the board is released but not yet looked at signed in by the operator. `newsInvokeGemini-dev` is deployed behind the repo (shared RSS parser refactor, same behaviour); redeploy to match.
- `TriggerSelectionShadow` is still ENABLED past its end (about 2026-10-25). Blind review: Combined 11, ours 7, 2 split. P7d (switch to the layered selector) is an operator decision.

Waiting on the operator:
1. DeepSeek top-up. After it, in order: watch the first selection and verdicts; run the review canary on 2-3 stories (`threadIds`) after a golden-week score; enable `TriggerRecordReview` (yes); run the legacy void job (2,451 branches without a qid; shadow first, live needs yes); rebuild and score the gap benchmark (answer key lost; rebuild or drop); re-enable `TriggerFreshnessMonitor`.
2. Board design-check answers (117 items, https://claude.ai/artifact/NNBZv4WWDoHFuRGwVXCNGE, answers in its `decisions` collection) and a signed-in look at B0 (released 4d31cd28). Design canvas: https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo.
3. Analyst weekly: revive on the readings, rewrite, or drop (design in ARCHITECTURE_WEEKLY_REVIEW.md section 9).
4. Selection go after the shadow week (above); the Cloudflare cutover steps (see ARCHITECTURE.md, Hosting and the Cloudflare cutover; every step needs a yes).

Next builds: the board artboards in order (graph, tree, zoom ladder, verdict, weekly, arrivals, summary + monthly, presets, divergence, folding, alerts UI only, map), checklist in ARCHITECTURE_BOARD.md.

Open smaller items:
- Cloudflare: capture DNS/TLS/ruleset state, candidate upload, test host `next.globalperspective.net`, front-Worker `/blog` passthrough, observation window, add `BOARD_ENDPOINT` to `REQUIRED_CONFIG_FIELDS`.
- Foundation leftovers (ARCHITECTURE_TIMELINE.md section 7): Run and 402 alarms, the rebuild test, parser moves to `world/`, the retire list, LatAm and SEA feeds, 2 of 83 `NewsProjectInvokeAgentLambda` tests failing on main.
- Four unverified colour bugs: map labels clip at the right edge and Europe labels overlap; Alerts list and Intel feed show the same stories on home; `/textures/earth-night.jpg` may 404 in production; the country list "Highest Risk" rail should sort by score (`features/countries/CountryListPage.jsx`).
- Backend hygiene: `newsAnalyze` and `newsPolarBilling` (each with sandbox) stay on `nodejs20.x`; `deepseek-v4-flash` default string in `newsPostDevTo`; deployed `newsAnalyze` differs from the repo by about 126 lines (parked credits code): leave it or remove the Lambda (billing code: needs yes).

Parked (each has a decision record): analysis credits (0002); economy, jobs DISABLED and surfaces hidden, `newsMarketsData` still runs (0009, 0031); impact audit (0015); Signals API (0032); breaking and drift email rules DISABLED until the first follower; the hidden economy tab on story pages is undecided.

Open decisions: the hosting cutover (confirmed, steps pending); newsAnalyze versus repo; selection go; whether to merge the unmerged weekly branches; the five test users.
