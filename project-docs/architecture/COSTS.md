# Costs: what the site spends, why, and how to check (2026-11-04)

Read this first, then check the code. Numbers are from Cost Explorer and our own `[usage]` logs on the dates given;
they go stale, so re-run the recipe in section 6 before quoting them.

## 1. What it costs

AWS, Cost Explorer `UnblendedCost`, run 2026-11-04 (ap-northeast-1 account):

| Service | Sep 2026 | Oct 2026 | Nov 1-3 |
|---|---|---|---|
| **Total (with tax)** | **$16.11** | **$25.63** | **$1.45** |
| DynamoDB | 9.06 | 9.91 | 0.24 |
| S3 | 0.55 | 7.02 | 1.07 |
| CloudWatch | 4.72 | 5.90 | ~0 |
| Tax | 1.46 | 2.33 | 0.13 |
| SQS | 0.15 | 0.17 | ~0 |
| API Gateway | 0.13 | 0.16 | 0.01 |
| Cost Explorer | 0.05 | 0.13 | ~0 |
| Lambda | 0.00 | ~0 | 0.00 |

Nov daily by usage type (the S3 line is `APN1-Requests-Tier1`, PUT/COPY/POST/LIST): Nov 1 $0.45, Nov 2 $0.28, Nov 3 $0.24.
Next biggest: DynamoDB `APN1-ReadRequestUnits` $0.07 / $0.06 / $0.08. S3 was about 74% of the Nov 1-3 total ($1.07 of $1.45).
The 2026-11-04 digests fix is not in these days yet.

DeepSeek (the model provider) is not on the AWS bill. It is estimated from our own usage logs: about $0.10-0.40 on a normal
day, about $2.40 on the Monday weekly-review day, about $6-10 a month. List prices, per million tokens
(`backend/monitoring/newsHealth/src/prices.json`, operator-owned, fetched 2026-11-04): Flash $0.15 in / $0.60 out / $0.003
cache hit; Pro $0.66 / $1.98 / $0.022; both double at peak (01-04 and 06-10 UTC, Mon-Fri; holidays not modelled, so the
estimate is an upper bound).

## 2. Where each dollar comes from, and why

| Cost | Mechanism | File / decision |
|---|---|---|
| S3 write requests (about 70% of AWS in early Nov; about 100,000 PUTs a day) | `newsStoryRecord` rewrote about 9,000 view files per run, 6 runs a day. Fixed 2026-11-04: a view is written only when its md5 changed. | `backend/record/newsStoryRecord/src/digests.js`; decision 0037, "Amended 2026-11-04" |
| Other S3 requests (about 40-85k a day, **not yet attributed**) | Suspects: `newsSituationTracker` (every 30 min) writing every situation file each run; the `record/shadow/` prefixes. | to find (section 5) |
| DynamoDB (about $9-10 a month in Sep-Oct; $0.24 in 3 days of Nov) | The old world tables, read and written until decision 0035 step 5 retires them. Table TTL is disabled, so rows only grow. | decision 0035; `STEP5_AUDIT.md` |
| CloudWatch ($5-6 a month in Sep-Oct) | Alarms and custom metrics. The alarms were removed 2026-11-02 (operator decision). Nov shows about $0. | section 4 |
| DeepSeek | The weekly review `newsRecordReview` (Pro, about 670 calls a week) is about half of model spend. The rest is `newsAgent` (Flash for summaries, Pro for forecasts) and the analysis Lambdas. | `ARCHITECTURE_WEEKLY_REVIEW.md` |
| Lambda, API Gateway, SQS | Cents. | |

## 3. Where to look

- **Ops money panel**: `/ops` (operator only). Data is `monitoring/ops.json` in the world bucket, written hourly by
  `newsHealth` and served only to the operator by `newsReadApi` action `ops`. Design: `ARCHITECTURE_OPS.md`, panel 1.
- **Public pipeline panel**: `record/views/health.json` (no money in it).
- **Cost Explorer**: console, or the CLI recipe in section 6.
- **`[usage]` log lines**: every model call writes `[usage] {fn, step, model, ...tokens}` (`backend/shared/src/llm.js`),
  with prompt, completion and cache-hit tokens. Sum them with one Logs Insights query over the `/aws/lambda/news*` groups.
- **Unit costs** (defined in `backend/monitoring/newsHealth/src/config.js` `units`; the model spend of the matching steps
  divided by that day's fact counts), 3 Nov values:

| Unit | Spend per |
|---|---|
| story entry (`newsAgent` summary + trace_cause) | $0.00037 |
| forecast question (`newsAgent` forecast) | $0.0018 |
| country briefing (`newsCountryIntelligence`) | $0.0060 |
| daily brief | $0.0040 |

## 4. The rules that keep it low

1. **Write a derived file only when its content changed.** `digests.js` keeps `record/views/digests.json` (path -> md5);
   `manifest.json` is still written every run and carries freshness.
2. **No model call on reuse.** `newsAgent` calls the model for a forecast only when `decideReuse` says generate (no stored
   forecast, or the article set changed) and the thread has no fork in the last 7 days
   (`backend/pipeline/NewsProjectInvokeAgentLambda/README.md`). `newsThreadAnalysis` re-analyses only threads with a new event
   (`src/threadPolicy.js`, at most `MAX_THREADS`). `newsCountryIntelligence` re-briefs by `src/refreshPolicy.js` (new, weekly
   baseline 156 h, open alert, coverage jump; never twice a UTC day; top `COUNTRY_TOP_N`).
3. **Prompt caching.** Providers bill cache-hit tokens at about 1/50 of input; the `[usage]` cache-hit count shows how well
   prompts are laid out (stable prefix first).
4. **Flash for bulk, Pro where it matters.** Live model env, 2026-11-04 (values are model names):

| Lambda | Model |
|---|---|
| `newsAgent` | `GROK_MODEL=deepseek-flash` (summaries); `PREDICTION_MODEL=deepseek-v4-pro` (forecasts) |
| `newsThreadAnalysis`, `newsDriftCorrector`, `newsPredictionResolver` | Flash |
| `newsRecordReview` | `REVIEW_MODEL=deepseek-v4-pro` |
| `newsDailyBrief`, `newsWeeklyBrief`, `newsCountryIntelligence`, `newsSystemsAnalysis`, `newsAnalyze` | `GROK_MODEL=deepseek-v4-pro` |

   The provider and model are the live env, not the variable name (`GROK_*`/`XAI_*` hold DeepSeek). `newsDailyBrief` also has
   an `AI_MODEL` set to a `:free` model name; check the code for which one it uses.
5. **The Cost Explorer pull is $0.01 a call**, so `newsHealth` pulls once per UTC day (`awsPullDue` in
   `backend/monitoring/newsHealth/src/ops.js`); the monitor itself costs under $1 a month.
6. **No alarms** (operator decision 2026-11-02): do not add CloudWatch alarms or custom metrics; health is read from the
   panels above.
7. **The front Worker caches `/data/*`**: public bundles are `max-age=60, s-maxage=300, stale-while-revalidate=600`
   (`cloudflare/front-worker/production/worker.mjs`), so readers do not hit S3 each time.

## 5. Planned reductions (plan, not built)

| Step | Expected effect |
|---|---|
| Find the remaining S3 writers; make the situations tracker rewrite only when content changed (same digest idea) | Most of the S3 line that remains after the 11-04 fix |
| Retire the DynamoDB world tables (decision 0035 step 5) | About -$2.50 a month by the coordinator's estimate (Nov 1-3 run-rate: $0.24 in 3 days) |
| Items vs stories: a one-entry item gets no forecasts, links or analysis | An estimated third to half off model spend |
| Incremental refresh; freeze cold stories | Headroom rather than money |

Expected end state: AWS about $2-3 a month, DeepSeek about $4-6 a month.

## 6. How to check a cost claim

1. A day by usage type: `aws ce get-cost-and-usage --time-period Start=2026-11-03,End=2026-11-04 --granularity DAILY --metrics UnblendedCost --group-by Type=DIMENSION,Key=USAGE_TYPE` (swap the key for `SERVICE` for a service view; each call is $0.01).
2. Model spend: Logs Insights over `/aws/lambda/news*`, `filter @message like /\[usage\]/ | parse @message '[usage] *' as j | stats count(*) by bin(1d)`, then sum the tokens per `fn` and `model` from `j` (fields `fn`, `step`, `model`, token counts) and price them with `prices.json`.
3. Or read `monitoring/ops.json`: `aws.days`, `aws.monthToDate`, `deepseek.days`, `deepseek.yesterday`, `deepseek.monthToDate`, `unitCosts.days`, `unitCosts.weeklyReview`, and `errors`/`error` fields for a source that failed.
4. S3 request counts by prefix are not available from Cost Explorer; use S3 server access logs or CloudTrail data events on a short window (both cost money; operator yes).
