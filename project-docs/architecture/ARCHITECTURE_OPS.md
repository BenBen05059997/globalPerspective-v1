# Ops: the health view and the operator page (plan, 2026-11-04)

Status: phase 1 (money + pipeline) built 2026-11-04, not deployed; phases 2 to 4 not started. Operator decisions 2026-11-04: build money + pipeline first, readers second; keep
Google Analytics and Cloudflare Web Analytics; add Google Search Console; PostHog later, for member events only; no alarms
(the operator removed them 2026-11-02 and does not want them back). This page is where the operator looks, and what the
coordinating session reads when asked "how is it now".

## Phase 1 as built (changes from the plan)
- `newsHealth` code, `src/prices.json` (in `src/` so the zip carries it; real list rates read 2026-11-04: Flash $0.15/$0.60, Pro $0.66/$1.98 per million, cache hit $0.003/$0.022, peak hours double), role policy `backend/monitoring/newsHealth/iam/`, deploy commands in its README. Peak (01-04, 06-10 UTC Mon-Fri) is priced hourly, so the usage query bins by hour.
- `health.json`: `days[].rows[]` with `status` ok/thin/missing/failed/nodata, each row with facts, source, time. A day is judged only after the next day's 01:00 UTC. Resolver and situations are snapshots: a closed day keeps the row the previous file held, so they start empty after deploy. Errors thin from 1, failed from 5 a day; a compare DIFFER is thin.
- `ops.json` keeps 62 days so month to date survives the 14-day query; AWS cost is pulled on the first run of each UTC day (not exactly 00:15). Weekly review spend is per ISO week.
- The role also needs `s3:GetObject` on `monitoring/ops.json` and `s3:ListBucket`; `newsReadApi`'s shared role needs `GetObject` on `monitoring/ops.json` (`iam/read-api-ops-read.json`).
- The DeepSeek balance endpoint is not read (needs a secret copy; `newsModelGuard` already reads it).
- Route constant `OPS_ROUTE` lives in `features/ops`, not `shared/lib/links.js` (that core is mirrored into the Lambdas).

## Why
Every watcher we have looks at one stage from the outside (the freshness monitor probes the topics file; the resolver logs one
line a night; the record run writes a status file nobody reads). The two failures of October passed every one of them: the
agent wrote nothing for four nights (21–24 Oct) while ingest ran, and the resolver settled nothing for five weeks while running
every night. Both were failures of volume, not of liveness. And nothing shows what the machine costs, who reads what, or
whether the output is any good.

## Shape
Two files, one Lambda, one page.

| Piece | What | Who reads it |
|---|---|---|
| `record/views/health.json` | Public. The pipeline panel only: one row per stage, last 14 days, no money, no reader data. Served by the front Worker like every view. | The `/ops` page, the map's status line later, the coordinator |
| `monitoring/ops.json` | Private (not under `record/views/`, not served by the Worker). Money, readers, quality. | `newsReadApi` action `ops`, operator uid only |
| `newsHealth` Lambda | Hourly (`TriggerHealth`, `rate(1 hour)`), group `monitoring`, Node 24, no model. Writes both files. Daily pulls (cost APIs) run on the 00:15 UTC tick only. | |
| `/ops` route, `features/ops` | One screen, four panels, a 14-day strip per row; a row with no data says "no run", never a placeholder. Visible only when signed in as the operator; the link sits in the account area like the board link. | The operator |

## Panels and their sources (facts only; every number names its source and time)

**1. Money**
- DeepSeek, estimated: the `[usage]` log lines every model call writes (`fn`, `model`, prompt/completion/cache-hit tokens),
  summed per day per Lambda per model by one CloudWatch Logs Insights query over the `/aws/lambda/news*` groups, priced with
  `backend/monitoring/newsHealth/prices.json` (operator-owned: model, price per million in/out/cache-hit, valid-from date;
  today's list rates Flash $0.14/$0.28, Pro $1.74/$3.48, to be checked against api-docs.deepseek.com before the first build).
  Shown: yesterday, month to date, by Lambda, trend.
- DeepSeek, actual: the account balance endpoint, if it exists for our key (to verify; needs the key in the new Lambda's env, a
  secret copy, operator yes). Shown next to the estimate so the two can be compared.
- AWS: Cost Explorer `GetCostAndUsage`, daily by service, pulled once a day ($0.01 a call). Needs `ce:GetCostAndUsage` on the
  role (IAM, operator yes).
- Unit costs: model spend per story entry, per forecast question, per country briefing, per weekly review, per daily brief,
  from the same usage lines divided by the day's fact counts (`record/runs/DAY.json`).

**2. Pipeline** (one row each; normal ranges measured from `record/runs/` and the inbox files, not guessed)
- ingest ran: raw day present (run file `inputs.rawDay`)
- agent wrote the archive: entries in `record/inbox/entries/DAY.jsonl`; normal 25–47 a day; under 20 thin; 0 missing
- record run: `record/runs/DAY.json` status ok, facts counts; failures listed
- views refreshed: `record/views/manifest.json` builtAt
- resolver: the `status` action (read-only invoke): sampled due / checked / settled / void by reason / backlog, and the night's
  `watch` numbers
- situations: `world/latest.json` age, `stale`, `newsDegraded`, `gdacsDegraded`, open count, merges today
- briefs: daily brief note for the day; weekly brief on Sunday
- Lambda errors: CloudWatch `Errors` per `news*` function, 14 days (`GetMetricData`)
- compare switches: every `[*-compare]` DIFFER count per Lambda (while step 5 runs)

**3. Readers** (phase 2)
- Cloudflare Web Analytics (already on the site): page views and visitors per path, countries, referrers, 14 days, through the
  GraphQL analytics API; needs an API token with Analytics:Read (operator creates it; secret, yes).
- Google Analytics 4: keep; check first in the GA console that data arrives at all (a Chrome check on 2026-11-04 saw the
  collect hits answered 503). Pulling it into the page is optional and later (service account).
- Google Search Console: operator verifies the domain (DNS TXT in Cloudflare); queries and pages Google sends people to. Linked
  from the page; pulled in only if the operator opens it daily.
- Our own tables, no new events: sign-ins (users table), boards and pins (board rows), saved items, shares (`newsSharedAnalysis`),
  weekly email sent/opened (the sender's log rows), social posts (`NewsProject-linkedin-posts`).
- Attention vs effort: model spend per page family (map, stories, countries, briefs, track record, board) next to reads per family.
- PostHog (later, member events only: board actions, forks, saves, sign-in funnel; free tier).

**4. Quality** (phase 3)
- duplicate open situations (same title, same countries), situations merged today
- summaries that describe their sources (one regex over the day's entries, the stories session's finding)
- pins outside their country (count from the situation ingest log)
- forecast voids by reason (record gap first), coverage gaps per day
- source audit result (`newsSourceAudit`, Mon/Wed/Fri): dead outlets
- client errors by page from the error sink table, today vs the 14-day median

## Phases
1. **Money + pipeline.** `newsHealth`, both files, prices.json, the `ops` read action, the `/ops` page with panels 1–2.
   Done when: the page shows yesterday's DeepSeek estimate per Lambda and the AWS daily cost, and the 14-day pipeline strip
   shows the October gaps as holes when run against the history.
2. **Readers.** Cloudflare analytics pull, own-table counts, attention-vs-effort. Done when: top-10 pages and the per-family
   reads/spend table are on the page.
3. **Quality.** The six checks above. Done when: each check names its source and the day.
4. **Self-healing.** If the archive is missing by 06:00 JST, re-run the agent once; if the day is still missing, run the
   recovery from public records (decision 0040) and mark the day "recovered". Done when: a forced-missing day heals without a hand.
Later: PostHog; AI-search citation tracking; a public status line on the map from `health.json`.

## Needs the operator (fresh yes each)
IAM on the `newsHealth` role (`ce:GetCostAndUsage`, `logs:StartQuery/GetQueryResults`, `cloudwatch:GetMetricData`, `lambda:InvokeFunction`
on the resolver, S3 read on `record/` and write on the two files); the DeepSeek key and the Cloudflare analytics token in its env;
the operator uid for the `ops` action; Search Console verification; the `/ops` route in a frontend release.

## Cost of the monitor itself
About 720 invocations a month, Logs Insights over a few MB a day (cents), Cost Explorer $0.30 a month. Well under $1.
