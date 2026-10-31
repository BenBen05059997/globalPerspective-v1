# Start here

Code and live AWS are the truth; docs hold intent and decisions (decisions/0021, 0026). Old docs are deleted, git history keeps them.

## 1. Map
Read order: `CLAUDE.md` -> this file -> [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) -> the architecture doc for your area -> [decisions/README.md](decisions/README.md).
- Areas: [the record](architecture/ARCHITECTURE_TIMELINE.md) (facts, readings, views; stage list in [pipeline.json](architecture/pipeline.json)) · [forecast loop](architecture/ARCHITECTURE_FORECAST_LOOP.md) · [weekly review and analyst weekly](architecture/ARCHITECTURE_WEEKLY_REVIEW.md) · [board](architecture/ARCHITECTURE_BOARD.md) · [ingest proposal](architecture/ARCHITECTURE_INGEST_DESIGN.md) · [storage rules](architecture/DATA_STRATEGY.md) · [world model](architecture/WORLD_MODEL.md).
- Next to code: `backend/<group>/README.md`, `backend/<group>/<name>/README.md`, `global-perspectives-starter/frontend/src/features/<name>/README.md` (checked by `quality/check_docs.mjs`).
- Code lives in: Lambdas `backend/<group>/<name>/src/` (shared helpers `backend/shared/src/`, deployed name to dir in `scripts/functions.json`); frontend `global-perspectives-starter/frontend/src/` (`app/` -> `features/` -> `shared/`); edge `cloudflare/front-worker/`; checks `quality/`; forecast harnesses `predictions/`; severity rubric `quality/SEVERITY_CODEBOOK.md`.
- Deploy: frontend through `./deploy.sh` and `.claude/skills/deploy-frontend/` (targets need a fresh yes); Lambdas through `scripts/lambda.sh <name> diff|package|deploy|rollback` (diff first; the deployed zip can differ from the repo).
- Facts come from code and live AWS: `aws lambda list-functions`, `aws events list-rules`, `aws scheduler list-schedules`, `App.jsx`, the served bundle hash. Never trust a doc for state.

## 2. Where we left off (2026-10-31)
Working model: one coordinator session reviews, merges and deploys; lanes (git worktrees) or Sonnet agents build. Lane briefs go in `.board/` (ignored via `.git/info/exclude`); the old `~/Downloads/gp-mailbox` was lost 2026-10-25 (gap-benchmark answer key, judge bench, board review notes, foundation review are gone). Dev machine moved to an Apple-silicon Mac 2026-10-30 (frontend `node_modules` reinstalled for arm64, git hooks re-pointed with `scripts/install_hooks.sh`); Lambdas stay x86_64 and `scripts/lambda.sh` cross-installs linux/x64 deps.

Foundation (goal: facts are the system of record, decision 0035): steps 0-2c done; **step 3 (weekly review) live since 2026-10-31**; steps 4 (retire duplicates and parsers) and 5 (remove world DynamoDB rows, rebuild test) not started.

Done 2026-10-30/31:
- DeepSeek was topped up 2026-10-25 (last 402 at 04:18 UTC); selection, daily notes, the resolver and the old weekly all run again.
- Weekly review: prompt review-4 (no branch status from the model, chapter dates from cited facts, 6000-token cap, low-confidence links and operator-held aliases rejected; 0039 amendment 2026-10-31) passed the golden-week gates; live canary on 5 W43 stories; `TriggerRecordReview` ENABLED, `REVIEW_CONCURRENCY` 12. Story views and the board no longer carry `branchStatus` (status = verdict, else due date).
- Legacy void job run live 2026-10-30: 2,451 void verdicts (`issued_before_method`) over 220 stories.
- `TriggerFreshnessMonitor` re-enabled with its dedupe marker (env `FRESHNESS_STATE_BUCKET`, inline policy `freshnessStateMarker` on one key).
- Alarms: DeepSeek 402 (13 callers), `newsStoryRecord` errors and not-run (25 h), review errors; all to `GlobalPerspectiveAlerts`.
- Rebuild test (views only): `backend/record/newsStoryRecord/scripts/rebuild-test.js` rebuilt 1,252 of 1,252 live views from facts; it found 7 stale links files of merged stories, fixed (every story now gets a links view).
- Step 4 map: only the board reads the record. Thread pages (entries, forks, links) can switch to views as is; home and weekly lists need entry summaries; track record needs a derived view; story analysis, drift, countries and briefs need new readings first; map and economy need a decision.

Watch next:
- `newsStoryRecord` nightly 23:45 UTC (first run on the new view code; the 5 canary stories should show a line and chapters).
- First full review Monday 2026-11-02 01:00 UTC for 2026-W44 (about 520 stories): Run `record/runs/review-2026-W44.json` should be `ok` with `notReached` 0.

Still running on the old path: `TriggerWeeklyBrief` and `TriggerWeeklyEmailSend` ENABLED (old Sunday digest, 2 recipients); W1-W3 of the analyst weekly are on unmerged `lane/weekly` (12 commits) and `lane/routine` (9; its routine-definition commit is unique); both merge cleanly except `backend/weekly/README.md` and a deleted plan file. `TriggerSelectionShadow` still ENABLED past its end (blind review: Combined 11, ours 7, 2 split; P7d is an operator decision). `newsInvokeGemini-dev` is behind the repo (RSS parser refactor, same behaviour).

Waiting on the operator:
1. Analyst weekly: build it on the readings (now that they exist), rewrite, or drop (ARCHITECTURE_WEEKLY_REVIEW.md section 9); then retire `newsWeeklyBrief`.
2. Board design-check answers (117 items, https://claude.ai/artifact/NNBZv4WWDoHFuRGwVXCNGE, answers in its `decisions` collection) and a signed-in look at B0 (released 4d31cd28). Design canvas: https://claude.ai/artifact/6TnZPszLnubW6VBTzoN6qo.
3. Frontend release (yes): carries the board `branchStatus` removal and should fix `/textures/earth-night.jpg`, which returns 404 in production (the file is in `public/textures/` but not in `docs/`).
4. Selection go (P7d); gap benchmark rebuild or drop; Cloudflare cutover steps (every step needs a yes); delete the untracked leftover `amplify/` at the repo root (yes; about 56 of its files were never in git).
5. AWS: the CLI is signed in as the account root user; an IAM Identity Center or admin-user login is safer (IAM change, operator).

Next builds: the board artboards in order (graph, tree, zoom ladder, verdict, weekly, arrivals, summary + monthly, presets, divergence, folding, alerts UI only, map), checklist in ARCHITECTURE_BOARD.md.

Open smaller items:
- Cloudflare: capture DNS/TLS/ruleset state, candidate upload, test host `next.globalperspective.net`, front-Worker `/blog` passthrough, observation window, add `BOARD_ENDPOINT` to `REQUIRED_CONFIG_FIELDS`.
- Foundation leftovers (ARCHITECTURE_TIMELINE.md section 7): Run and 402 alarms, the rebuild test, parser moves to `world/`, the retire list, LatAm and SEA feeds, 2 of 83 `NewsProjectInvokeAgentLambda` tests failing on main.
- Colour bugs still unverified: map labels clip at the right edge and Europe labels overlap; Alerts list and Intel feed show the same stories on home; the country list "Highest Risk" rail should sort by score (`features/countries/CountryListPage.jsx`; the default sort is by risk, the filtered case is unchecked).
- Record data: over-joined threads (us-court ae75a8 holds about 20 unrelated entries) and duplicate stories the review cannot merge without neighbours (Amazon 35a31e/c5bce9/da86ee, Canadian base fire 6822c0/bf3dd0); the review flags off-story entries as assignment proposals in the readings for the operator to apply.
- Backend hygiene: `newsAnalyze` and `newsPolarBilling` (each with sandbox) stay on `nodejs20.x`; `deepseek-v4-flash` default string in `newsPostDevTo`; deployed `newsAnalyze` differs from the repo by about 126 lines (parked credits code): leave it or remove the Lambda (billing code: needs yes).

Parked (each has a decision record): analysis credits (0002); economy, jobs DISABLED and surfaces hidden, `newsMarketsData` still runs (0009, 0031); impact audit (0015); Signals API (0032); breaking and drift email rules DISABLED until the first follower; the hidden economy tab on story pages is undecided.

Open decisions: the hosting cutover (confirmed, steps pending); newsAnalyze versus repo; selection go; whether to merge the unmerged weekly branches; the five test users.
