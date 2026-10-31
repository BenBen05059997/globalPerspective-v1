# Global Perspectives: Architecture

This is the map, not the inventory. Lambdas, schedules, env keys, routes, feature folders and S3 prefixes are read from the source of truth: `scripts/functions.json`, `aws lambda list-functions`, `aws events list-rules`, `aws scheduler list-schedules`, `src/app/App.jsx`, `ls src/features`, `aws s3 ls`. When this file and those disagree, they win. Area designs: [the record](ARCHITECTURE_TIMELINE.md), [forecast loop](ARCHITECTURE_FORECAST_LOOP.md), [weekly review and analyst weekly](ARCHITECTURE_WEEKLY_REVIEW.md), [board](ARCHITECTURE_BOARD.md), [ingest proposal](ARCHITECTURE_INGEST_DESIGN.md), [storage rules](DATA_STRATEGY.md), [world model](WORLD_MODEL.md). What is stopped or waiting right now: `project-docs/START_HERE.md`.

Where the repo and the live site differ, this file says "after the next release". The live frontend is the build before decisions 0048 to 0050 (briefs page on the record, economy removed, views-freshness rule).

## Purpose
Global Perspectives (globalperspective.net) is an AI global-news intelligence site. Scheduled Lambdas pull news (RSS) and hazard feeds (GDACS, GDELT), use an LLM to select and explain the stories that matter, track situations on a world map, score country risk, make forecasts that are settled later in public, and send a weekly brief. Reading is free and needs no account. A paid membership (Polar) buys following countries and deeper history, not access to content.

The site's memory is the record: an append-only set of facts, readings and notes in S3 (decision 0035). Pages read static views built from it. The older DynamoDB world tables are still live and still read for what no view holds yet; step 5 retires them.

## Bird's-eye view
### Context
```mermaid
flowchart LR
  reader([Readers and members])
  operator([Operator])
  subgraph gp[Global Perspectives]
    site[Site: React SPA]
    back[AWS backend: Lambdas, DynamoDB, S3]
  end
  cf[Cloudflare Worker globalperspective-rss]
  pages[GitHub Pages docs/]
  fb[Firebase Auth]
  polar[Polar billing]
  news[News RSS sources]
  haz[GDACS and GDELT]
  wd[Wikidata and ACLED]
  llm[DeepSeek LLM API]
  jev[Jev scorer, shadow only]
  mail[Resend email]
  soc[LinkedIn and dev.to]
  reader --> cf
  cf -->|SPA files| pages
  cf -->|world and record JSON| back
  reader --> site
  site <-->|read API, member calls| back
  site -->|sign in| fb
  site -->|checkout| polar
  polar -->|webhook| back
  news --> back
  haz --> back
  wd --> back
  back -->|prompts| llm
  back -->|shadow scoring| jev
  back -->|weekly brief, operator alerts| mail
  back -->|daily posts| soc
  operator -->|deploys, corrections| back
```
Every Lambda that calls an LLM uses `api.deepseek.com` through the live env value (`GROK_MODEL`, `PREDICTION_MODEL`, `REVIEW_MODEL`); the exception is `newsSelectionShadow`, which calls the external Jev scorer. The weekly email rule (`TriggerWeeklyEmailSend`) is ENABLED with `EMAIL_SEND_DRY_RUN=false`; the breaking and drift email rules are DISABLED; `newsPostLinkedin` (every 3 hours, JST) and `newsPostDevTo` (daily 23:00 JST) are ENABLED.

### Containers
```mermaid
flowchart LR
  spa[React SPA]
  worker[Worker globalperspective-rss]
  subgraph read[read-api]
    proxy[newsSensitiveData via API Gateway /proxy]
    fn[Function URLs: newsSavedItems, newsRecommend, newsSharedAnalysis, newsClientErrors]
  end
  board[board: newsBoard]
  subgraph member[membership-studio]
    ana[newsAnalyze]
    bill[newsPolarBilling]
  end
  pipe[pipeline: selection, agent, analyses, countries]
  sit[situations: ingest, tracker, GDACS, GDELT]
  pred[predictions: resolver, snapshot]
  rec[record: newsStoryRecord, newsRecordReview]
  dist[distribution: weekly brief, email, posters, breaking alert]
  mon[monitoring: monitors and audits]
  ddb[(DynamoDB tables)]
  s3[(S3 world bucket)]
  ext[RSS, GDACS, GDELT, Wikidata, DeepSeek]
  spa -->|SPA shell, /data/*| worker
  worker -->|signed GETs| s3
  spa -->|actions| proxy
  spa -->|user records, shares, errors| fn
  spa -->|board actions| board
  spa -->|checkout| member
  proxy -->|topics, analyses, tier| ddb
  proxy -->|track record JSON| s3
  fn --> ddb
  board --> ddb
  board -->|views| s3
  bill -->|tier| ddb
  ext --> pipe
  ext --> sit
  pipe --> ddb
  pipe -->|story-map, audit, article inbox, notes| s3
  sit --> s3
  pred --> ddb
  pred -->|track_record.json, verdict and draw inbox| s3
  rec -->|facts, readings, views| s3
  dist -->|reads briefs and prefs| ddb
  mon -->|alerts| sns[SNS]
```
Two stores, split by kind of data ([DATA_STRATEGY.md](DATA_STRATEGY.md) holds the rules). DynamoDB holds per-user mutable records, a few operational tables, and the older world tables (`NewsCache`, `SummarizeAndPredict`, the `PRED#` rows of `GlobalPerspectivePredictionLog`) that step 5 retires (decision 0035; scope and order in [STEP5_AUDIT.md](STEP5_AUDIT.md)). The private S3 "world" bucket holds everything computed about the world, the record included. Pages read the record's views first, through the Worker, and fall back to the read proxy's actions for what a view does not hold yet. The browser never talks to S3 directly, only through the Worker's `/data/*` route.

## Codemap
Paths are named, not linked; search for them.

### Backend: `backend/<group>/<dir>/src/`
Lambdas are grouped by feature (decision 0024): `backend/<group>/<dir>/` with `src/`, `test/` and a README. Nothing is deployed with Amplify; each Lambda is deployed by hand (see Deploy). `scripts/functions.json` maps each deployed name to its repo dir, runtime, group and schedules. Names that surprise:
- `newsInvokeGemini` (deployed `newsInvokeGemini-dev`) is topic selection. Despite the name it calls DeepSeek.
- `NewsProjectInvokeAgentLambda-dev` and `newsSensitiveData-dev`: the `-dev` suffix is production.
- `newsPostLinkedIn` deploys as `newsPostLinkedin` (lower-case "in").
- The Scheduler entry for country intelligence is named `countryIntelliegence` (the typo is real).
- `backend/membership-studio/_sandbox/` holds the deploy script for the `-sandbox` twins of `newsAnalyze` and `newsPolarBilling` (no repo src of their own).
- `newsAnalyze/deployed-snapshot/` is what actually runs; `newsAnalyze/src/` is not.

Groups: `pipeline` (selection, story writer, analyses, country risk), `situations` (map pipeline), `predictions` (resolver, snapshot), `record` (`newsStoryRecord`, `newsRecordReview`), `board` (`newsBoard`), `distribution` (email, social, briefs, breaking alerts), `read-api` (proxy and Function-URL endpoints), `membership-studio` (billing, and `newsAnalyze`, which the site no longer calls), `monitoring`. `backend/weekly/` (the analyst's weekly) holds the schema and section model only, no Lambda.

**Invariant:** code shared between Lambdas lives once, in `backend/shared/src/` (see its README). Each consumer reaches it through a committed `src/_shared` symlink; `scripts/lambda.sh` copies the real files into the zip. Never copy these into a Lambda.

Country names are canonical at the writers (United States, DR Congo, UAE; `resolveIso3`), so one country is one record; briefs, forecasts, drift notes and shares carry related ids (`iso3[]`, `threadId`).

### Frontend: `global-perspectives-starter/frontend/`
React + Vite SPA. Build output goes to the repo-root `docs/`.
- `src/app/`: routing (`App.jsx`), redirects for retired URLs, layout and chrome, the error boundary.
- `src/features/<name>/`: 12 feature folders (`account`, `analysis-studio`, `board`, `breaking`, `briefings`, `countries`, `home`, `map`, `static`, `threads`, `track-record`, `weekly`), each owning its pages, components, hooks and lib. `map` owns `/`, `home` owns `/today`, `threads` owns `/weekly` and the story pages, `countries` the country pages, `board` `/board`, `briefings` `/briefings`, `track-record` `/track-record`, `analysis-studio` only the shared-run page `/analyze/s/:id` (`/analyze` is a redirect in `app/`). `weekly` is the planned analyst-weekly page and has no route. `/weekly`'s Countries section is `countries`' `CountryListPage`, handed to `WeeklyPage` by `App.jsx` as a prop so `threads` never imports `countries`. Routes: `App.jsx`.
- `src/features/<name>/index.js`: a feature's public API, only what other features and `app/` import (route pages are not in it; `App.jsx` lazy-loads them by path). `account`, `analysis-studio`, `static` and `weekly` have none.
- `src/shared/`: `api/` (`restProxy.js` the one client for the proxy and the Function-URL endpoints; `recordViews.js` the one reader of `/data/record/views/`; `viewsFresh.js` the 9-hour freshness rule; the per-view readers), `contexts/AuthContext.jsx`, `styles/` tokens, `lib/` pure helpers, `hooks/` shared data hooks, `ui/` shared blocks, `map/` the map drawing kit.
- `worker/` + `wrangler.jsonc`: the Workers Static Assets site (`globalperspective-site`), prepared but not the production path.

**Invariant:** imports flow `app -> features -> shared`. ESLint `no-restricted-imports` fails a `shared/` file that imports `@/features` or `@/app`, and a `features/` file that imports `@/app`. Another feature is imported only through its index (`@/features/<name>`); tests and lazy `import()` are exempt. Feature-to-feature imports must not form a cycle (`quality/check_feature_cycles.mjs`, run by pre-commit with the other `quality/check_*.mjs`).

**Invariant:** imports inside `src/` use the `@/` alias. The exceptions are the few files that Node tooling outside `src/` imports by relative path; they carry a header comment saying so.

### Edge: `cloudflare/front-worker/`
`production/worker.mjs` is the repo copy of the `globalperspective-rss` Worker that fronts production; `baseline/worker2.mjs` is the captured deployed source; `candidate.mjs` wraps it for `next.globalperspective.net`. The Worker SigV4-signs GETs to the private S3 world bucket for `/data/*`, allow-listed (`DATA_ALLOWED`) to `world/*.json`, `situations/state/`, `stories/state/` and `record/views/`, never facts, runs, inboxes, notes or readings. It also proxies `/rss` to the proxy's `rss` action, pre-renders pages for bot user-agents (calling proxy actions), and returns the SPA shell with a 200 for other GET paths.

### Operator tools
- `scripts/`: `lambda.sh` (diff, package, deploy, rollback one Lambda, driven by functions.json), `audit-lambda-drift.sh`, `errors.mjs`, `gen-pipeline-blocks.mjs`, and on-demand checks (`smoke-test.mjs`, `link-crawl.mjs`, `auth-guard-check.mjs`, `contract-check.mjs`, `situations-log.mjs`, `check-shared-sync.mjs`).
- `quality/`: the frontend verify gate (`verify_pages.sh` and ratchets such as `check_color_literals.mjs`, `check_shared_blocks.mjs`, `check_docs.mjs`, `check_links.mjs`), eval harnesses.
- `predictions/`: `settle-correct.js` (list settled and due questions; correct a verdict with a reason), `verify-draw.mjs`.
- `backend/<group>/cli/`: operator CLIs next to their Lambdas: `distribution/cli/`, `pipeline/cli/threads.mjs` (list-joins, merge, split; print-only without `--apply`), `record/cli/` (note backfills, the history copy, day recovery, actor reconciliation, assignment benchmark).
- `deploy.sh` (repo root): frontend verify, build, package and release targets.

## Data flows
Times are UTC unless noted; exact cron expressions and ENABLED/DISABLED state come from `aws events list-rules` and `aws scheduler list-schedules`.

### 1. Topic selection and daily stories (DynamoDB)
```mermaid
flowchart LR
  s1[Scheduler InvokeGoogleGemini 04:15 12:15 20:15] --> a[newsInvokeGemini-dev]
  a -->|staging| nc[(NewsCache)]
  a -->|every article| ib[(S3 record/inbox/articles)]
  s2[Scheduler InvokeNewsAgent 04:25 12:25 20:25] --> b[NewsProjectInvokeAgentLambda-dev]
  nc --> b
  b -->|TOPIC, THREAD pointers| sp[(SummarizeAndPredict)]
  b -->|forecasts| pl[(PredictionLog)]
  b -->|entry notes| nt[(S3 record/notes)]
  s3[rule TriggerDailyAnalysis 04:40, TriggerNewsSystemsAnalysis 05:00] --> c[newsThreadAnalysis, newsSystemsAnalysis]
  sp --> c
  c --> sp
  c -->|story_analysis, link, web notes| nt
  sp -->|topics, today, thread_analysis, systems_analysis| px[newsSensitiveData-dev]
  px --> pg["/today, /weekly, story pages (newest days)"]
```
1. `newsInvokeGemini-dev` (three times a day) reads the RSS feeds, asks the LLM to pick and cluster the day's topics under the done-not-said rule, with code dedupe and a significance floor (decision 0040), and writes them to `NewsCache` item `id='staging'`. Before the model call it writes every fetched article to S3 `record/inbox/articles/` (raw capture, no model), so a model outage cannot lose the news; it also writes `audit/ingest-capture/`. It fails the run on a model error. No web search in ingest.
2. `NewsProjectInvokeAgentLambda-dev` (ten minutes later) reads `staging` and writes a summary, cause trace and forecast per topic to `SummarizeAndPredict` (`TOPIC#…` keys, each carrying `threadId`). It logs each forecast to `GlobalPerspectivePredictionLog` and assigns thread ids, writing `threads/story-map.json` to S3 by matching against `stories/state/`: a topic joins a thread only at composite score at least 0.4 and keyword overlap at least 0.15, each join logged as `[join]` (repair with `backend/pipeline/cli/threads.mjs`). It then swaps `staging` to `latest`, updates the archive (`today-archive`, `archive#<date>`) and writes the thread to topic pointer `THREAD#<threadId>` / `TOPICS`. It reconciles each `PRED#` row to the entry's final `threadId`. Forecasts are drawn at most weekly per story ([forecast loop](ARCHITECTURE_FORECAST_LOOP.md)). After each archive it writes the entry notes (summary, cause and forecast text per entry) to `record/notes/entry/`.
3. `newsThreadAnalysis` (daily) writes per-thread analysis and dated history (`THREAD#…` / `THREAD_ANALYSIS`, `THREAD_HISTORY#<date>`); `newsSystemsAnalysis` (daily) reads those and writes causal webs (`SYSTEMS#…`, `WEB#INDEX`, `THREAD#…/WEB`), plus a daily snapshot to `web/YYYY/MM/DD.json` and `web/latest.json`. Both also write their output as notes into the record (`story_analysis`; `link` and `web`) through shared `notes.js` (decision 0042).
4. `newsSelectionShadow` (rule `TriggerSelectionShadow`, 04:20, 12:20, 20:20, ENABLED) runs a candidate layered selector (corpus plus GDACS, scored by the external model "Jev") against what was published and writes only `audit/selection-shadow/`. Nothing on the site reads it; whether it continues is an operator decision.

The record's views carry the entries, analyses and links these produce. `newsSensitiveData-dev` still answers what the views do not hold: today's topics, the home map's topic card, the board's pin titles, member extras.

### 2. Situations and the map (S3)
```mermaid
flowchart LR
  g[rule TriggerGdacsIngest every 20 min] --> gi[newsGdacsIngest]
  gi -->|inbox, corpus/gdacs| s3[(S3 world bucket)]
  h[rule TriggerSituationIngest hourly] --> si[newsSituationIngest]
  si -->|corpus, stories/state| s3
  t[rule TriggerSituationTracker every 30 min] --> tr[newsSituationTracker]
  s3 --> tr
  tr -->|situations/, world/latest.json| s3
  s3 -->|/data/world, /data/situations| w[Worker]
  w --> m["Map page /"]
```
1. `newsGdacsIngest` (every 20 min, no LLM) overwrites the Orange/Red observations to `situations/inbox/gdacs-latest.json` and the full snapshot to `corpus/gdacs/latest.json`. It is the only inbox opener.
2. `newsGdeltConflict` (every 6 h, no LLM) writes conflict events to `corpus/gdelt/<day>.json`; only the parked impact audit reads them.
3. `newsSituationIngest` (hourly) reads RSS, classifies each headline with the LLM (country, location, axis, severity; cached in `stories/classify-cache.json`), clusters deterministically, and writes `corpus/<date>/<hour>.jsonl`, `stories/state/`, `stories/index.json`.
4. `newsSituationTracker` (every 30 min, no LLM) is the only writer of `situations/` state and `world/`: it folds the inbox, clusters and the thread story-map into `situations/state/`, `situations/index.json` (news situations keyed `news#<ISO3>#<threadId>`), `situations/history/`, closed situations into `situations/archive/`, and assembles `world/latest.json` (plus dated snapshots and `world/latest.member.json`).
5. The map feature fetches `/data/world/latest.json` and `/data/situations/state/<id>.json` (`src/features/map/api/worldData.js`) through the Worker.

**Invariant:** each S3 prefix has one writer (DATA_STRATEGY.md §4). Add a writer only by changing that table first.

**Invariant:** `*.member.json` is never served. The Worker's member check is a stub that always refuses, so any key containing `.member.` returns 401 until a real JWT check exists.

**Invariant:** `signals/` is built by `newsSignals` and served only by its own key-gated Function URL, never added to the Worker's allow-list. The Signals API is parked (decision 0032); `TriggerSignalsBuild` is DISABLED.

### 3. Forecasts and the track record
```mermaid
flowchart LR
  ag[Agent Lambda] -->|each forecast| pl[(PredictionLog)]
  r[rule TriggerPredictionResolver 10:30 daily] --> pr[newsPredictionResolver]
  pl --> pr
  pr -->|verdict rows| pl
  pr -->|verdict lines| ib[(S3 record/inbox/verdicts)]
  q[rule TriggerPredictionsSnapshot every 30 min] --> sn[newsPredictionsSnapshot]
  pl --> sn
  sn -->|predictions/track_record.json| s3[(S3)]
  pr -->|draw lines| dw[(S3 record/inbox/draws)]
  sr[newsStoryRecord] -->|views/track-record.json| rv[(S3 record/views)]
  rv -->|Worker| tp["/track-record"]
  s3 -->|prediction_track_record fallback| px[newsSensitiveData-dev]
  px --> tp
```
The agent Lambda writes forecasts to `GlobalPerspectivePredictionLog`. `newsPredictionResolver` runs the forecast loop (decision 0038): each night it watches open branches on stories that moved or fell due, gathers the story's own entries after the draw from `record/facts` (no web search), judges with a boxed model, and records a verdict put-once in the log and as a line in `record/inbox/verdicts/`, which `newsStoryRecord` turns into a `verdict` fact. It also commits a weekly random seed and draws the pre-registered sample of 22 questions that the public track record scores. Yes, no and void verdicts are final at once (decision 0034); the operator can append a correction with `predictions/settle-correct.js`. `newsPredictionsSnapshot` (every 30 min) scans the log into `predictions/track_record.json`, which the proxy action `prediction_track_record` serves.

The track-record page reads `record/views/track-record.json` first (built by `newsStoryRecord` from the question facts and the frozen pilot-era numbers, decision 0044) and falls back to that action. The weekly draws also go to `record/inbox/draws/`, and a forecast's section on the story page reads the story view (decision 0043). The commitment state (`SEED#`, `SAMPLE#`, `Q#`, `SETTLE#` rows) stays in `GlobalPerspectivePredictionLog`, as does the draw pool that "Verify this draw" reads.

### 4. Country risk and living analysis
```mermaid
flowchart LR
  f[Scheduler Fact, Mondays JST] --> fu[newsCountryFactsUpdater]
  fu -->|FACTS| d[(SummarizeAndPredict)]
  c[Scheduler countryIntelliegence 05:15] --> ci[newsCountryIntelligence]
  d --> ci
  ci -->|COUNTRY, HISTORY| d
  ci -->|country notes| nt[(S3 record/notes)]
  dr[rule TriggerDriftCorrector 05:30] --> dc[newsDriftCorrector]
  d --> dc
  dc -->|DRIFT, DRIFTLOG| d
  dc -->|drift notes| nt
  nt -->|countries views| cv[(S3 record/views)]
  cv --> cp["/weekly/country/:name"]
  d -->|country_history, country_facts| px[newsSensitiveData-dev]
  px --> cp
```
`newsCountryFactsUpdater` (weekly, Mondays 05:00 JST) writes current facts from Wikidata and ACLED to `FACTS#<country>`. `newsCountryIntelligence` (daily) reads thread analyses and facts and writes `COUNTRY#<name>` / `COUNTRY_INTELLIGENCE` plus a dated `HISTORY#<date>` snapshot. `newsDriftCorrector` (daily) compares snapshots; when a risk level, score (change of 8 or more) or trajectory moves, it grounds the move in a real archived event and writes a note (`DRIFT#<date>`, 60-day TTL; permanent `DRIFTLOG#<date>`). The original analysis is never overwritten. Both also write the `country` and `drift` notes. The country page reads the country views and the countries index for the briefing and "what changed"; member drift depth (`country_history`), country facts and the cross-country corrections ledger stay on the proxy actions. No pipeline Lambda runs a web search.

Risk tiers are 0-24 low, 25-49 moderate, 50-74 elevated, 75-100 high: `src/shared/lib/riskTiers.js` on the frontend, `tierFromScore` in `backend/shared/src/riskDimensions.js` on the backend (`world/tier.js` wraps it).

**Invariant:** a risk tier is never a traffic-light colour. Risk shows as a number, a tier word and a ring weight; the `--tier-*` tokens are neutral greys that get brighter with the tier, and `TierChip` has no fill. `quality/verify_pages.sh` fails if a `--tier-*` token gets a hue or `TierChip.css` gets a background.

### 5. Briefs, email and distribution
```mermaid
flowchart LR
  w[rule TriggerWeeklyBrief Sunday 06:00] --> wb[newsWeeklyBrief]
  wb -->|WEEKLY_BRIEF| d[(SummarizeAndPredict)]
  e[rule TriggerWeeklyEmailSend Sunday 14:00] --> es[newsEmailSender]
  d --> es
  u[(UserPrefs)] --> es
  es -->|Resend| sub([Subscribers])
  l[Scheduler InvokeLinkedIn, InvokeDev JST] --> po[newsPostLinkedin, newsPostDevTo]
  d --> po
  po --> soc([LinkedIn, dev.to])
  po -->|DAILY_BRIEF| d
  d -->|actions| px[newsSensitiveData-dev]
  px --> bp["/briefings"]
  rv[(S3 record/views/briefs)] -.->|after the next release| bp
```
- `newsWeeklyBrief` (Sunday 06:00) writes `WEEKLY_BRIEF#<week>` to `SummarizeAndPredict`, published directly. `newsEmailSender` mode `weekly` (Sunday 14:00) sends it with Resend to subscribers in `GlobalPerspectiveUserPrefs` (`digestOptIn`), logging each week (`EMAILLOG#`) so it is never sent twice. Its `breaking` and `drift_alert` rules are DISABLED. This is the old digest; the analyst's weekly (ARCHITECTURE_WEEKLY_REVIEW.md §9) is meant to replace it, and then `newsWeeklyBrief` retires.
- `newsBreakingAlert` (every 8 h, 04:35 12:35 20:35) scores stories deterministically, records proposals in `GlobalPerspectiveBreakingAlerts`, and with live `DRY_RUN=false` emails each detection to one operator address. It does not email subscribers. A breaking alert shows on the site only when the operator has `confirmed` it (`review.js`); the operator email is marked "[Unconfirmed] NOT PUBLIC YET". This is separate from verdicts, which have no human gate.
- `newsPostDevTo` builds the daily brief (`DAILY_BRIEF#<date>`) and publishes it to dev.to; `newsPostLinkedin` posts to LinkedIn. Both log to `NewsProject-linkedin-posts`.
- The record holds both briefs as `daily_brief` and `weekly_brief` notes (decision 0048), backfilled for every existing brief. The two writers call `briefNotes.writeBriefNote`, which writes nothing while `NOTES_PREFIX` is unset; it is unset live, and their roles have no S3 write statement yet, so new briefs reach the record only through the backfill CLI until the operator adds the statements. `newsStoryRecord` builds `record/views/briefs/` and `index/briefs.json` from the notes. After the next release the briefs page reads those views and asks the actions only when the views are not fresh. Until then the page uses the actions. The email sender and the Worker's bot pre-render read the DynamoDB rows either way.
- Subscription preferences and unsubscribe go through `newsRecommend` (Function URL).

**Invariant:** user-facing sends are switched on only by the operator. A disabled email rule stays disabled until an explicit decision.

### 6. Analysis Studio (retired) and the country sheet
The lens Studio is gone from the site (decisions 0030, 0033). `/analyze?stories=<id,...>` redirects to the first id's story page when it is a thread id (`thread-...`), otherwise to the countries list (`app/LegacyRedirects.jsx`; the front Worker sends the same as a real 301 and never bot-renders `/analyze/s/*`). Kept:
- Shared-run pages: `newsSharedAnalysis` still serves shares from `GlobalPerspectiveShares` (read by id is public, `noindex`); the SPA renders them at `/analyze/s/:id` so links already out there work. The site can no longer create a share.
- `newsAnalyze` and the prompt, validator and context libraries in `src/features/analysis-studio/lib/`: no page calls them; the share Lambda copies some (checked by `scripts/check-shared-sync.mjs`) and the offline eval harness in `quality/analysis/` imports them.
- The country page (`/weekly/country/:countryName`) is the "sheet": fact and judgment marks on every section, a computed "What we don't know", Copy as text, Print and a private "Your view". It reads stored data only; no model runs on view.

**Invariant:** the deployed `newsAnalyze` differs from `newsAnalyze/src/` (the repo carries parked credits code). Never deploy the repo file over it without a fresh go-live decision; `lambda.sh` refuses functions marked `deployBlocked` in functions.json.

### 7. Billing (Polar)
`newsPolarBilling` (Function URL) has three paths: the Polar webhook (Standard Webhooks signature), `create_checkout` and `get_membership` (both need a Firebase JWT). The webhook writes `tier`, `subscriptionStatus` and `billingProvider='polar'` onto the user's row in `GlobalPerspectiveUserTable`. `/membership` and `/account` read it back through `get_membership`. Credit packs are parked (decision 0002): the code path exists, but the live function has no `POLAR_CREDIT_PACKS` key.

### 8. The record
The site's memory is one append-only record in the world bucket (`record/`), in three kinds of object plus views built from them.
- **Facts** (what happened) are appended daily with no model by `newsStoryRecord` to `record/facts/YYYY-MM-DD.jsonl` (rule `TriggerStoryRecord`, 23:45 UTC). They run from 2026-03-07: the part before September was copied in from the old archive by a one-off replay through the nightly code (decision 0047), and the forecasts that no story could be found for are kept whole under `record/legacy/predictions/`.
- **Readings** (what it meant) are written weekly, with hindsight, by `newsRecordReview` (`record/readings/YYYY-Www.jsonl`; rule `TriggerRecordReview`, Mondays 01:00 UTC, one model call per active story). Each reading cites facts and can supersede an earlier one.
- **Notes** (what a model wrote about something the record names) go to `record/notes/<subtype>/YYYY-MM-DD.jsonl`, one writer per subtype, all through shared `notes.js` against `backend/record/schema/note.schema.json` (decision 0042): `entry` (the agent), `story_analysis` (`newsThreadAnalysis`), `drift` (`newsDriftCorrector`), `country` (`newsCountryIntelligence`), `link` and `web` (`newsSystemsAnalysis`), and `daily_brief` / `weekly_brief` (`newsPostDevTo`, `newsWeeklyBrief`; decision 0048). A writer writes only where its `NOTES_PREFIX` env points. Live today: `record/` on the agent and the four analysis Lambdas; unset on the two brief writers. The agent and the four analysis Lambdas default to `record/shadow/` when unset; the brief writers write nothing.
- **Views** under `record/views/` (stories, countries, links, briefs, counts, `index/*.json`, `track-record.json`, `manifest.json`) are rebuilt from facts, readings and notes by `newsStoryRecord`, the only builder, and served through the Worker (`/data/record/views/`). They are rebuilt in full after the nightly append and, since decision 0050, after every ingest and brief by a refresh: `{"refresh":true,"shadow":false}` on rules `TriggerStoryRecordRefresh` (04:35, 12:35, 20:35), `-Brief` (14:15), `-Analysis` (05:20) and `-Weekly` (Sunday 06:15). A refresh appends no fact. It adds today's archive entries as provisional entries in the views, because the agent may rewrite a day's entries before the day ends. The nightly run replaces them with real facts. `newsStoryRecord` has reserved concurrency 1, so a refresh and the nightly run never overlap. Nothing is edited in place.

Pages read the views first and keep the old action as a fallback for what a view does not hold: the story page (timeline, analysis, forecast, links), the track record, the list pages, the country pages, and the board. After the next release the pages also answer the newest days from the views while `manifest.json` `builtAt` is under 9 hours old (`shared/api/viewsFresh.js`) and ask the actions otherwise, and the briefs page reads the briefs views. The home map, `/today`, the board's pin titles and member extras still read DynamoDB through the proxy. The remaining readers and what step 5 waits on are in [STEP5_AUDIT.md](STEP5_AUDIT.md) and `project-docs/START_HERE.md`.

Hand-off rule: other writers never write facts. The selector appends raw articles, the resolver verdicts and draws, the review merges, and the operator assignments, splits and the who's who file (`record/operator/aliases.json`) to prefixes `newsStoryRecord` reads; it converts them into facts and views. Stories keep `threadId`; an `assignment` fact moves an entry between stories (latest wins); actors carry canonical `wd:Q…` ids once the who's who file names them, and generic actors never ground a link. The board (`/board`, `newsBoard`) keeps boards in `GlobalPerspectiveSavedItems` as `board#<id>` and follows in `GlobalPerspectiveUserPrefs`, and reads the views.

Decisions: facts are the system of record (0035), facts format (0036), views (0037), forecast loop (0038), weekly review (0039), raw before model (0040), notes in the record (0042), question draws (0043), track-record view (0044), eligibility window (0045), weekly index (0046), history before the record (0047), briefs (0048), fresh views (0050). Design, ten stages, object model and open items: ARCHITECTURE_TIMELINE.md. Rebuild test: `backend/record/newsStoryRecord/scripts/rebuild-test.js`.

## Links, identity and product rules
### One link system
Every reader destination has one canonical address built by one module (`shared/lib/links.js`, backend mirror `backend/shared/src/links.js` for emails, guarded by `scripts/check-shared-sync.mjs` and the `check_links.mjs` ratchet). `<EntityLink kind id>` in `shared/ui` renders the link and hover preview. Pages never build paths by hand.

| Entity | Key | Address |
|---|---|---|
| Story | `threadId` (stable; topic ids change every run) | `/weekly/thread/:threadId` |
| Country | ISO3 | `/weekly/country/:displayName` (the page resolves aliases and codes and redirects to the canonical name) |
| Situation | situation id (country + thread) | `/?focus=<id>`; no thread: link its country |
| Map focus | story / country | `/?story=<threadId>`, `/?country=<ISO3>` |
| Forecast | `qid` | `/track-record?q=<qid>`, inline `#q-<qid>` on the story page |
| Briefing | date / week | `/briefings?date=YYYY-MM-DD`, `/briefings?mode=weekly&week=YYYY-MM-DD`; old `/daily`, `/weekly-brief` get real 301s from the Worker |

Country identity: one source, `backend/shared/src/iso3Names.json` (`{name, aliases[]}`), one resolver `resolveCountry(text) -> {iso3, name} | null`. Display names are short ("UAE", "DR Congo"). Non-countries (Strait of Hormuz, West Bank) are plain text; a place inside one country links to that country.

### Hosting and the Cloudflare cutover
Production is the GitHub Pages `docs/` build behind the Cloudflare `globalperspective-rss` Worker. The decision is to go ahead with Workers Static Assets in a second Worker (decision 0019, operator confirmed 2026-10-20); live DNS steps come to the operator first. The new site Worker is prepared locally and not cut over.
- Candidate checks run on `workers.dev` (site files only) and then on a test hostname (proposed `next.globalperspective.net`) that exercises the front-Worker chain: RSS, bot HTML, `/data/*`, all eight blog URLs, noindex. The front Worker returns the SPA shell for extensionless `/blog/*`; a narrow `/blog` passthrough there is a separate reviewed change that must keep the RSS, bot, `/data/*`, S3-secret and member branches unchanged.
- Two fallbacks during the observation window (default 48 hours plus one verified release before retiring Pages; never retire automatically): the hosting fallback (every release goes to both the new Worker and Pages) and the release fallback (the last artifact that passed its post-deploy checks, with commit, hash and Worker version). A Cloudflare rollback restores a Worker version and its assets, not DNS, deleted secrets, changed bindings or data.
- Cutover steps and their reversal come from the account's captured DNS, TLS and ruleset state, never from guesses. Sign-in, API CORS (read APIs allow only the site origins) and the Maps referrer must be verified on the test hostname or waived explicitly. `docs/config.js` already sets `BOARD_ENDPOINT`; add it to `REQUIRED_CONFIG_FIELDS` in `scripts/prepare-site-assets.mjs` at cutover.
- Each of these needs a fresh operator yes: candidate upload, front-Worker patch, test hostname, Firebase authorized domain, the cutover, every production release, retiring Pages.

## Cross-cutting concerns
### Auth
Firebase Authentication in the browser (`src/shared/contexts/AuthContext.jsx`: email magic link and Google). `App.jsx` wires `getIdToken` into `restProxy.js` (`setAuthProvider`), which sends `Authorization: Bearer <id token>`. Lambdas that need identity verify the token themselves (Google's securetoken certs, RS256, issuer for `FIREBASE_PROJECT_ID`): `newsAnalyze`, `newsPolarBilling`, `newsSavedItems`, `newsRecommend`, `newsSensitiveData`, `newsSharedAnalysis`, `newsBoard`.

**Invariant:** public data never needs sign-in. No proxy action requires auth; `newsSensitiveData` only reads the tier best-effort (falling back to `free`) to shorten two member extras (`country_history` drift notes, `corrections_feed`). Record views carry no member data: the country view holds only the newest drift note. Frontend data hooks must not gate on `user`; membership limits are enforced server-side.

### Runtime config
`docs/config.js` is operator-owned and loaded at runtime; it sets the `window.*` endpoints and keys (proxy, share, billing, saved items, prefs, client errors, board, `FIREBASE_CONFIG`, `GOOGLE_MAPS_API_KEY`). None is bundled into the build. Local dev uses `frontend/public/config.js` (template `public/config.example.js`).

### Endpoints and CORS
`newsSensitiveData-dev` is behind API Gateway (REST API `NewsSensitiveProxyRestAPI`, `GET`/`POST /proxy`) and dispatches on `action`. The other browser-facing Lambdas use Function URLs (list: `scripts/functions.json`).

**Invariant:** a Function URL gets CORS from exactly one place. If the code emits `Access-Control-Allow-Origin` (`newsPolarBilling`, `newsAnalyze`, `newsSharedAnalysis`), the Function-URL CORS config stays empty; if it does not (`newsSavedItems`, `newsRecommend`, `newsClientErrors`, `newsBoard`), the config must be populated. Both at once sends a duplicate header and the browser fails with "Failed to fetch". Grep the source before touching either side.

### LLM providers
Every LLM-calling Lambda calls DeepSeek (`api.deepseek.com`) through shared `llm.js` or its own client; the model is the live env value. `newsSelectionShadow` is the exception (external "Jev" scorer).

**Invariant:** env names lie. `GROK_*` and `XAI_*` keys hold DeepSeek settings; read the live value (`aws lambda get-function-configuration`), never infer the provider from the name.

### Cost and usage logs
There is no central cost store. Callers of `backend/shared/src/llm.js`, `NewsProjectInvokeAgentLambda` and `newsSelectionShadow` `console.log` a `[usage]` JSON line (function, step, model, tokens) into CloudWatch Logs. `newsModelGuard` turns the measured daily burn into a runway alert; `newsAnalyze` logs no usage.

### Monitoring
Passive monitors publish to SNS `GlobalPerspectiveAlerts` (email): `newsFreshnessMonitor` (every 2 hours: proxy reachable, topics fresh; a dedupe marker in S3 `monitoring/freshness/state.json` gives one mail on break and one on recovery), `newsErrorDigest` (every 6 hours: new or spiking browser errors from `GlobalPerspectiveClientErrors`), `newsModelGuard` (daily: a Lambda env pointing at a deprecated model, and balance runway), `newsSourceAudit` (Mon/Wed/Fri: summaries drifting from their sources) and `newsImpactAudit` (rule DISABLED).

CloudWatch alarms (read live with `aws cloudwatch describe-alarms`): two SNS topics with near-identical names. `GlobalPerspectivesAlerts` (an AWS Chatbot subscription and one email) carries the Lambda alarms: the account-wide `Lambda-Errors-Spike`, per-function errors for the agent, `newsInvokeGemini-dev`, `newsThreadAnalysis`, `newsCountryIntelligence`, `newsPostDevTo`, `newsPostLinkedin` and `newsSensitiveData-dev`, proxy throttles and duration, and DynamoDB throttles on `NewsCache` and `SummarizeAndPredict`. `GlobalPerspectiveAlerts` (email only) carries the monitor Lambdas and the situation-tracker alarms (`situation-tracker-errors`, and `situation-tracker-stalled`, which fires when the `ChecksRun` metric stops, meaning `world/latest.json` stopped updating). Billing: `AWS-Bill-Over-5-Dollars` (us-east-1) and budget `Monthly-AWS-Budget` ($20) notify by email. `PPA*`, `ppa-*` and `so-v3-engine` alarms and `ppa-alerts` belong to other projects in the account.

The operator does not want pipeline alarms for the record, the review or LLM 402 / insufficient balance; none exist, so do not propose them. Known behaviour: stages swallow LLM errors, so Lambda `Errors` can stay 0; expected refusals (LinkedIn `429 share limit`, "no new topics") count as errors. Capacity, IAM or code changes are operator-asked work (CLAUDE.md, Authorization).

Active checks (the `scripts/` list above) are run by hand. There is no CI by design (solo developer).

### Deploy
- Frontend: `./deploy.sh` with no target verifies, builds and packages locally, nothing more. `--target candidate|production` uploads to the Cloudflare site Worker; `--target legacy-pages` runs the GitHub Pages release (production today). Each upload target needs explicit operator approval. Details: `.claude/skills/deploy-frontend/DEPLOYMENT_NOTES.md`.
- Lambdas: `scripts/lambda.sh <name> diff|package|deploy|rollback` packages `<dir>/src` from functions.json (no node_modules unless the live zip ships them, no tests), refuses to deploy over deployed files it cannot find in git unless forced, backs up first, and refuses `deployBlocked` functions. `scripts/audit-lambda-drift.sh` is the read-only fleet-wide diff.
- Worker: code-only updates through the Cloudflare API that keep its routes, bindings and secrets (see `cloudflare/front-worker/README.md`); never a bare `wrangler deploy`.

**Invariant:** `docs/` is build output. Never hand-edit it; change `global-perspectives-starter/frontend/src` and rebuild. `docs/config.js` is the one operator-owned file in it.

**Invariant:** the deployed zip may differ from the repo. Diff first before editing or deploying any Lambda.

**Invariant:** environment variables are a second deploy surface. Features turn on and off by env alone (for example `DRY_RUN` on `newsBreakingAlert`, `NOTES_PREFIX` on the note writers, `REVIEW_CONCURRENCY` on the review). When changing env, fetch the full map, merge, and write it back whole.

## Deliberately absent
- No read paywall: content is free; membership buys following countries and deeper history.
- No Amplify, no CI, no secrets manager (Lambda env holds secrets by choice).
- No direct browser access to S3, and no public bucket.
- No economy product (decision 0049, supersedes 0009 and 0031). The five economy Lambdas, their rules, roles and log groups are deleted from AWS. After the next release the repo has no `/economy` route, economy tab, FX box or markets read actions; the live site still has them until then. What remains in AWS is data with no writer: the table `GlobalPerspectiveMarkets` and the `ECON#THREAD#`, `PAIR#` and `WEEKLY_MARKETS#` rows in `SummarizeAndPredict` (backed up under `backup/economy-2026-10-31/` in the world bucket). The read proxy's markets actions and the table go after the release, each on an operator yes.

## Tables and storage
DynamoDB, by what happens to it in step 5 (scope set by the operator 2026-10-31; order and preconditions in [STEP5_AUDIT.md](STEP5_AUDIT.md)):
- Stays: the user tables (`GlobalPerspectiveUserTable`, `GlobalPerspectiveUserPrefs`, `GlobalPerspectiveSavedItems`, `GlobalPerspectiveShares`, `GlobalPerspectiveApiKeys`), `GlobalPerspectiveBreakingAlerts`, `GlobalPerspectiveClientErrors`, `NewsProject-linkedin-posts`, the `EMAILLOG#` rows in `SummarizeAndPredict`, and the commitment state in `GlobalPerspectivePredictionLog`.
- World tables, still live and still read until step 5 runs: `NewsCache`, `SummarizeAndPredict`, and the `PRED#` rows of `GlobalPerspectivePredictionLog`. The record already holds their history from 2026-03-07; what is left to build before they go is in `START_HERE.md`.
- Retired, awaiting deletion: `GlobalPerspectiveMarkets`.

S3 prefixes, writers and IAM: [DATA_STRATEGY.md](DATA_STRATEGY.md). Story-web history is kept daily in S3 (`web/YYYY/MM/DD.json`).
