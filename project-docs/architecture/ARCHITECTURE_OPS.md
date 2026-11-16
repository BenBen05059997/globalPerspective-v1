# Ops: the health view and the operator page

Design of `newsHealth` (`backend/monitoring/newsHealth/`) and the `/ops` page (`global-perspectives-starter/frontend/src/features/ops/`). Code and live AWS stay the truth; the Lambda's own facts are in its [README](../../backend/monitoring/newsHealth/README.md), the page's in the [ops feature README](../../global-perspectives-starter/frontend/src/features/ops/README.md). Facts marked "read 2026-11-17" were read from the code and live AWS that day. What the site costs, with the checking recipe: [COSTS.md](COSTS.md).

## Why
Every older watcher looked at one stage from outside (the freshness monitor probes the topics file; the resolver logs one line a night; the record run writes a status file nobody read). The two failures of October passed all of them: the agent wrote nothing for four nights (21 to 24 Oct) while ingest ran, and the resolver settled nothing for five weeks while running every night. Both were failures of volume, not of liveness. And nothing showed what the machine costs, who reads what, or whether the output is any good.

Operator decisions (2026-11-04): money and pipeline first, readers second; keep Google Analytics and Cloudflare Web Analytics; add Google Search Console; PostHog later, for member events only; no alarms (the operator removed them 2026-11-02). This page is where the operator looks, and what a coordinating session reads when asked "how is it now". It adds no alarms and sends no email.

## Shape
Two files, one Lambda, one page.

| Piece | What | Who reads it |
|---|---|---|
| `record/views/health.json` | Public. The pipeline panel only: one row per stage, last 14 UTC days, no money, no reader data. Served by the front Worker like every view. Schema `backend/record/schema/health.schema.json`. | The `/ops` page |
| `monitoring/ops.json` | Private (not under `record/views/`, so the Worker never serves it). Money, readers, quality. Keeps 62 days of money so month to date survives the 14-day query. | `newsReadApi` action `ops`, only for the uids in `OPS_OPERATOR_UIDS` (others get 403 and no S3 read) |
| `newsHealth` | Hourly (rule `TriggerHealth`, `rate(1 hour)`, ENABLED), group `monitoring`, `nodejs24.x`, 120 s, 256 MB, no model. Writes both files. | |
| `/ops` | `features/ops`, route constant `OPS_ROUTE` (not in `shared/lib/links.js`, whose core is mirrored into Lambdas). Four panels (Money, Pipeline, Readers, Quality), a 14-day strip per pipeline row. Signed out or guest: one sign-in line. The header "Ops" link (`app/layout/Layout.jsx`) shows only after `ops` answered 200 once this session (`useOpsAccess`). A row with no data says "no run", never a placeholder. | The operator |

State, read 2026-11-17: `newsHealth` last modified 2026-11-16T16:50:48Z; `HEAL=dry`; `OPS_OPERATOR_UIDS` is set on `newsReadApi`; `monitoring/ops.json` was written on 2026-11-17.

Alert email was cut back by the operator on 2026-11-06 because this page shows the same facts. Read 2026-11-17: `TriggerErrorDigest` DISABLED (the Quality panel's client-errors check replaces it); `TriggerFreshnessMonitor` still ENABLED and `newsFreshnessMonitor` still has `SNS_TOPIC_ARN`; `newsSourceAudit` has no `SNS_TOPIC_ARN` (it still logs the `[audit]` lines the Quality panel reads); `newsModelGuard` (DeepSeek balance) is the email kept.

## Phase 1 as built (money and pipeline)
**Money.** Model spend is an estimate: the `[usage]` log lines every model call writes (`fn`, `step`, `model`, token counts) summed per hour, function, step and model by one Logs Insights query over `/aws/lambda/news*`, priced hour by hour with `src/prices.json` (operator-owned: model, per-million rates, valid-from date; DeepSeek peak hours are priced hourly). A model with no price is listed `unpriced` and adds nothing. The `ops.json` section is still named `deepseek` in the code. AWS: Cost Explorer `GetCostAndUsage`, daily by service, once per UTC day ($0.01 a call). Unit costs: a day's spend for the matching functions and steps over that day's count (`CONFIG.units` in `src/config.js`); the weekly review's spend per ISO week. No provider balance is read here (`newsModelGuard` reads DeepSeek's; nothing reads Anthropic's).

**Pipeline** (`health.json`; `days[].rows[]`, status `ok`, `thin`, `missing`, `failed`, `nodata`, plus `recovered` and `late` on the agent row; each row carries its facts, source and the source's time). Stages, from `STAGES` in `src/config.js`: ingest ran (`record/runs/DAY.json` `inputs.rawDay`), agent wrote the archive (lines of `record/inbox/entries/DAY.jsonl`; 25 to 47 a day is normal, under 20 is `thin`, 0 `missing`; thresholds measured 2026-11-04), record run, views refreshed (manifest `builtAt`, stale after 9 h), resolver (heartbeat plus a read-only `status` invoke), situations (`world/latest.json` age and flags), briefs, Lambda errors (CloudWatch `Errors` per `news*`; 1 or more is `thin`, 5 or more `failed`), compare switches (`DIFFER` lines per Lambda in `compareFunctions`; one is `thin`). A day is judged only after the next day's 01:00 UTC. Resolver and situations are snapshots: a closed day keeps the row the previous file held.

`late` (decision 0061): the agent row is `late`, never `ok`, when the day's entries hold stories with a valid `writtenLate` marker (`facts.lateEntries` counts them); the page draws it as `◷` ("written late", `features/ops/lib/pipeline.js`).

IAM: the role policy is `iam/policy.json` (all phases in one file). The shared role of `newsReadApi` reads `monitoring/ops.json` through `iam/read-api-ops-read.json`.

## Phase 2 as built (readers)
`ops.json` has a `readers` section, built on the first run of each UTC day (and hourly again while Cloudflare is not `ok`; no token costs no call). Cloudflare Web Analytics through the GraphQL API (`rumPageloadEventsAdaptiveGroups`), 14 days, filtered by `requestHost` `globalperspective.net`, by date and path, referrer host and country. Token `CF_ANALYTICS_TOKEN` (secret, Account Analytics read, set on the Lambda by the operator). No token reads `not_connected`; an API failure reads `error` with its text. No number is invented. Page families come from one table, `src/pageFamilies.json` (map, stories, countries, briefings, track record, board; `ops` shown apart and left out of totals). Own data, counts only, projected scans: accounts by `createdAt` (`GlobalPerspectiveUserTable`), boards and saved items by `savedKey` prefix (`GlobalPerspectiveSavedItems`), shares (`GlobalPerspectiveShares`). Attention versus effort: views per family next to the model spend of the Lambdas whose `scripts/functions.json` features include the family's features (`lambdaFeatures` in `src/config.js` is a copy; a test fails when they differ). The counts include our own testing; nothing in our data measures that honestly and the panel says so.

Not built: Google Analytics pull, Search Console pull (nothing pulls it), PostHog, email opens, social posts.

## Phase 3 as built (quality)
`ops.json` has a `quality` section for the last closed UTC day, built on the first run of each UTC day; a check that could not read its source is read again hourly, alone. Each check names its `source` and `day`; a missing source is `{status:'not_available', why}`; a failed read is `{status:'error', error}`. Nothing is estimated. Code `src/quality.js`, settings `QUALITY` in `src/config.js`.
- Duplicates and merges: open situations in `world/latest.json` with the same normalised title and country set; merge files `situations/merges/YYYY/MM/DD/HH/HHMM.json` for the day.
- Summaries that describe their sources: one regex (`QUALITY.selfReference`) over `ai.summary` of the day's entries; count, phrases, up to 5 examples.
- Pins outside their country: `not_available`. `newsSituationIngest` moves such centroids silently and logs no count. Missing: one counter in its result line.
- Forecast voids by reason (record gap first) from `record/inbox/verdicts/DAY.jsonl`; coverage gaps over 14 closed days from `record/runs/DAY.json` (`thin:N`, a missing run, and a Run with `inputs.lateWritten` are gaps).
- Source audit: the last `newsSourceAudit` run's `[audit]` lines from its log group (Logs Insights, 7 days; the run is Mon, Wed, Fri): checked, drifted, errors, single-source. `deadOutlets` is `not_available`: the audit records no unreachable outlet.
- Client errors: `GlobalPerspectiveClientErrors`, projected scan (`day`, `count`, `sampleUrl`), per page family, the day against the median of the 14 days before. A row's page is the first hit's URL, so the page split is approximate and the panel says so.

## Phase 4 as built (self-healing)
Why inside `newsHealth`: it already holds the day's facts, ticks hourly, has no model and no user-facing send. The part that does not fit its 120 s read-mostly role is a separate Lambda, `newsRecover` (group `record`, `nodejs22.x`, 900 s, 3008 MB, no schedule; read 2026-11-17). Code `src/heal.js`, settings `HEAL` in `src/config.js`.
- Archive missing means `record/inbox/entries/D.jsonl` has no line for UTC day D, for today or the two days before. A `thin` day is not healed. An unreadable file is skipped, never taken for missing.
- Step 1, agent re-run, once per day, only in 21:00 to 23:00 UTC of day D: if staging (`NewsCache` item `staging`, read only) is fresh, invoke `newsAgent {}`; if not, invoke `newsIngest {}` first and the agent on the next tick. No `force`.
- Step 2, recovery, from D+1 00:30 UTC and within 48 h, only if D is still empty: `newsRecover {day}` (GDELT GKG raw files plus Wayback snapshots of our feeds, no model; up to 3 invokes; result in `monitoring/heal/recover/D.json`); with at least 300 articles (`minArticles`), `newsStoryRecord {recovery:true, date:D}` (up to 2 invokes). A recovered day has articles and a Run with `notes:"recovery"`, no entries, no forecasts, unscored (decision 0040).
- Never inside a scheduled run: nothing starts from :10 to :55 of 04, 12 and 20 UTC or 23:40 to 00:10.
- Ledger `monitoring/heal/D.json`, written before each invoke (a failed write means no invoke; a refused invoke still counts). A day with an `outcome` (`healed`, `recovered`, `unhealed`) is never touched again.
- Shown: agent row `recovered` (`↺`) with `facts.heal`; `health.json now.heal` lists what the tick did.
- Switch: env `HEAL` `on` acts, `dry` reports only (`now.heal.actions` with `dry:true`), anything else is off. A test event can only lower the mode.
- Does not heal: a thin day, downstream stages of a missing day (daily brief, country notes), a GDELT outage over 3 hourly attempts (`backend/record/cli/recover-day.mjs` stays the manual path).
- IAM: `newsHealth` role adds `lambda:InvokeFunction` on `newsAgent`, `newsIngest`, `newsStoryRecord`, `newsRecover`, `dynamodb:GetItem` on `NewsCache` with leading key `staging`, Get and Put on `monitoring/heal/*`. `newsRecover` has its own role (`backend/record/newsRecover/iam/`).
- Offline tests with injected ports: `newsHealth/test/heal.test.js`, `newsRecover/test/recover.test.js`.

## Open
- `HEAL` is `dry` (read 2026-11-17). The dry tick in `health.json` (asOf 2026-11-16T16:34:34Z) lists one action, recovery attempt 1 of 3 for 2026-11-15, whose agent row is `missing`. Setting `HEAL=on` is the operator's call after reading a dry tick (fetch the env, merge, write the full map; steps in the `newsHealth` README).
- Planned with `HEAL=on` (operator, 2026-11-06): disable the rule `TriggerFreshnessMonitor`. Not done.
- Pins outside their country and dead outlets need a counter or a per-outlet fetch result in `newsSituationIngest` and `newsSourceAudit`.
- Later: PostHog, AI-search citation tracking, a public status line on the map from `health.json`, pulling Search Console into the Readers panel.

Cost of the monitor itself: about 720 invocations a month, Logs Insights over a few MB a day, Cost Explorer $0.01 a day. Well under $1 a month (estimate from those counts).
