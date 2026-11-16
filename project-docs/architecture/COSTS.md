# Costs: what the site spends, why, and how to check (2026-11-16)

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

The table above is the 2026-11-04 pull. Cost Explorer settles late: Nov 3 read $0.24 then and $0.29 on 2026-11-05.
Next biggest in Nov: DynamoDB `APN1-ReadRequestUnits` $0.06-0.08 a day. S3 was about 74% of the Nov 1-3 total ($1.07 of $1.45).

### S3 by usage type, per UTC day (Cost Explorer, 2026-11-05)

The S3 cost is `APN1-Requests-Tier1` (PUT/COPY/POST/LIST, about $0.0047 per 1,000). GET (`Tier2`) is about $0.02-0.03 a day;
storage is under $0.01 a day.

| UTC day | Tier1 requests | Tier1 cost |
|---|---|---|
| Oct 29 | 10,624 | $0.05 |
| Oct 30 | 8,196 | - |
| Oct 31 | 581,939 (plus 4,995,380 GET) | $4.58, one-off |
| Nov 1 | 95,782 | $0.45 |
| Nov 2 | 59,793 | $0.28 |
| Nov 3 | 61,221 | $0.29 |
| Nov 4 | 46,491 | $0.22 |

Oct 31 is the record-migration day: 27 `newsStoryRecord` invocations (about 20 manual) plus the local backfill and replay CLIs.
That is inferred from git and invocation counts, not measured (there is no CloudTrail data-event log).
Nov 1-4 are mostly `newsStoryRecord` view rewrites; the digests (section 4, rule 1) are what stops them (see below).

The model providers (DeepSeek, Anthropic) are not on the AWS bill. Model spend is estimated from our own usage logs.
- DeepSeek, until it ran out of credit on 2026-11-14: about $0.10-0.40 on a normal day, about $2.40 on the Monday
  weekly-review day (review on Pro), about $6-10 a month before the 2026-11-04 switch to Flash (decision
  [0056](../decisions/0056-models-by-measured-quality.md)); about $2-3 expected after it. List prices per million tokens
  (`backend/monitoring/newsHealth/src/prices.json`, operator-owned, fetched 2026-11-04): Flash $0.15 in / $0.60 out / $0.003
  cache hit; Pro $0.66 / $1.98 / $0.022; both double at peak (01-04 and 06-10 UTC, Mon-Fri; holidays not modelled, so the
  estimate is an upper bound).
- Anthropic, since 2026-11-16 (decision [0060](../decisions/0060-claude-models-by-job-measured.md)): Haiku 5.5 $0.10 in /
  $0.50 out, Sonnet 5.5 $2 / $10, cache read 0.1 times input, no peak pricing (same file, valid from 2026-11-15; the
  source is the claude-api skill's price table cached 2026-10-06, not yet checked against Anthropic's pricing page).
  The first live intake run cost about $0.60 (topic selection 47,421 tokens in / 10,829 out; the story agent about $0.39).
  Three runs a day is about $1.80 a day for intake if every run is that size, a projection from one run. With the weekly
  review on Sonnet, decision 0060 adds up to roughly $65 to $115 a month for all model calls (an estimate from the test
  reports' per-call figures and call counts, not read from CloudWatch). No full day on Claude has been read from the
  `[usage]` logs yet; replace these figures with that reading when there is one.

## 2. Where each dollar comes from, and why

| Cost | Mechanism | File / decision |
|---|---|---|
| S3 write requests (about 70% of AWS in early Nov; 46,491 Tier1 on Nov 4) | `newsStoryRecord` rewrote about 9,000 view files per run, 6 runs a day. Fixed in two steps, see "S3 writers on 2026-11-04" below. | `backend/record/newsStoryRecord/src/digests.js`; decision 0037, "Amended 2026-11-04" |
| DynamoDB (about $9-10 a month in Sep-Oct; $0.24 in 3 days of Nov) | The old world tables, read and written until decision 0035 step 5 retires them. Table TTL is disabled, so rows only grow. | decision 0035; `STEP5_AUDIT.md` |
| CloudWatch ($5-6 a month in Sep-Oct) | Alarms and custom metrics. The alarms were removed 2026-11-02 (operator decision). Nov shows about $0. | section 4 |
| Model providers | On DeepSeek the weekly review `newsRecordReview` (about 670 calls a week; Pro until 2026-11-04, then Flash, about 4 times cheaper per call) was about half of model spend; the rest was `newsAgent` and the analysis Lambdas. On Claude the intake chain (`newsIngest`, `newsAgent` on Sonnet) and the weekly review (Sonnet, about $5.6 to $13.1 a Monday, estimated; none has run on Sonnet yet) are the two largest lines. | decision 0060; `ARCHITECTURE_WEEKLY_REVIEW.md` |
| Lambda, API Gateway, SQS | Cents. | |

### S3 writers on 2026-11-04 (46,491 Tier1 requests)

| Writer | Requests | How known |
|---|---|---|
| `newsStoryRecord` views | about 41,500 | 23,012 logged by `[views] wrote N of M` across 6 runs, plus about 18,500 from the 04:35 and 05:20 UTC runs, which ran the old code (every view written, no count logged): an estimate from run duration |
| `newsSituationTracker` | about 2,050 | 48 runs x about 43 puts; it rewrites every state file each run |
| `newsSituationIngest` | 1,992 | 24 runs x 83, measured |
| `newsGdacsIngest` | 144 | |
| everything else | about 250 | |
| unattributed | about 600 (1.3%) | |

The earlier "40-85k requests a day not attributed, suspect the situations tracker" was wrong: it was the record's own view
writes. The tracker is about 4% of the day.

Fixes in place: (1) digests, so a view is written only when changed (deployed 2026-11-04 20:53 JST); (2) from 2026-11-05
about 09:00 JST the digest leaves out the daily `builtFrom` stamp (commit 8cd2267d), because the nightly run on 11-04 23:46 UTC
still wrote 9,293 of 9,293. Expected after both: `newsStoryRecord` a few hundred writes a day instead of about 40-55k, saving
about $6 a month. **Not yet measured:** the first clean day to confirm it is 2026-11-06 (UTC).

## 3. Where to look

- **Ops money panel**: `/ops` (operator only). Data is `monitoring/ops.json` in the world bucket, written hourly by
  `newsHealth` and served only to the operator by `newsReadApi` action `ops`. Design: `ARCHITECTURE_OPS.md`, panel 1.
- **Public pipeline panel**: `record/views/health.json` (no money in it).
- **Cost Explorer**: console, or the CLI recipe in section 6.
- **`[usage]` log lines**: every model call writes `[usage] {fn, step, model, ...tokens}` (`backend/shared/src/llm.js`),
  with prompt, completion and cache-hit tokens. Sum them with one Logs Insights query over the `/aws/lambda/news*` groups.
- **Unit costs** (defined in `backend/monitoring/newsHealth/src/config.js` `units`; the model spend of the matching steps
  divided by that day's fact counts), 3 Nov values, DeepSeek prices (not recomputed on Claude):

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
4. **Each job's model is chosen by a recorded test** (decision [0056](../decisions/0056-models-by-measured-quality.md) for the method; the 29 Sep choice of Pro for the "high-leverage" calls was a judgement; decision [0060](../decisions/0060-claude-models-by-job-measured.md) for Claude). Model env as read on 2026-11-16 (values are model names; why each model: 0060):

| Lambda | Env value | Live 2026-11-16 (read after 15:18 UTC) |
|---|---|---|
| `newsIngest` | `GROK_MODEL` | `anthropic:claude-sonnet-5-5` |
| `newsAgent` | `GROK_MODEL` (summary, trace_cause); `PREDICTION_MODEL` (forecast) | both Sonnet, `MAX_TOKENS` 1500 |
| `newsRecordReview` | `REVIEW_MODEL` | Sonnet |
| `newsPredictionResolver` | `DRAFT_MODEL` | Sonnet (the `GROK_MODEL` there, `deepseek-flash`, is read by no code) |
| `newsSituationIngest`, `newsDailyBrief`, `newsWeeklyBrief` | `GROK_MODEL` | `anthropic:claude-haiku-5-5` |
| `newsThreadAnalysis`, `newsSystemsAnalysis` (`MAX_TOKENS` 6000 on both), `newsCountryIntelligence`, `newsDriftCorrector` | `GROK_MODEL` | Haiku |
| `newsSourceAudit` | `AUDIT_MODEL` | Haiku |
| `newsAnalyze` | | parked, `deepseek-v4-pro` |

   The provider and model are the live env, not the variable name (`GROK_*`/`XAI_*` names are DeepSeek-era; the value decides
   the provider). Every scheduled job is on Claude; the seven switched at about 15:17 UTC on 2026-11-16 (thread, systems, country, drift, audit, resolver and review) have not yet run on it, so their cost is the test's estimate. Claude counts about 1.5
   times more input tokens than DeepSeek for the same text and writes longer answers, so output caps were raised
   (decision 0060 lists them). `newsDailyBrief` also carries an `AI_MODEL` env value that no code reads (checked 2026-11-16 in
   `backend/distribution/newsPostDevTo/src`); it has no effect.
5. **The Cost Explorer pull is $0.01 a call**, so `newsHealth` pulls once per UTC day (`awsPullDue` in
   `backend/monitoring/newsHealth/src/ops.js`); the monitor itself costs under $1 a month.
6. **No alarms** (operator decision 2026-11-02): do not add CloudWatch alarms or custom metrics; health is read from the
   panels above.
7. **The front Worker caches `/data/*`**: public bundles are `max-age=60, s-maxage=300, stale-while-revalidate=600`
   (`cloudflare/front-worker/production/worker.mjs`), so readers do not hit S3 each time.

## 5. Planned reductions (plan, not built)

| Step | Expected effect |
|---|---|
| Confirm 2026-11-06 shows `newsStoryRecord` at a few hundred writes (section 6, recipe 4) | About -$6 a month, from the digest fixes already deployed |
| Retire the DynamoDB world tables (decision 0035 step 5) | About -$2.50 a month by the coordinator's estimate (Nov 1-3 run-rate: $0.24 in 3 days) |
| Move the four jobs from Pro to Flash after tests (0056): review, systems, daily brief and `newsIngest` done 2026-11-04 | About -$4 to 7 a month of model spend on DeepSeek (estimate from the test reports, not measured live); overtaken by the move to Claude on 2026-11-16 |
| Items vs stories: a one-entry item gets no forecasts, links or analysis | An estimated third to half off model spend |
| Incremental refresh; freeze cold stories | Headroom rather than money |

Expected end state: AWS about $2-3 a month. Model spend was expected at about $2-3 a month on DeepSeek Flash; on Claude it is about $65 to $115 a month by decision 0060's estimate, and less if items vs stories lands. Cheaper choices that lost the quality test, or need a code split, are listed in 0060.

After that about 4,400 Tier1 a day is left from the non-record writers, about $0.66 a month. Not worth building now:
tracker skip-unchanged (about 1,200 a day, about $0.18 a month; first check whether anything reads `last_checked_at` in
`situations/state/*.json`), ingest skip-unchanged (guess $0.08-0.15 a month), GDACS (about $0.02 a month).

## 6. How to check a cost claim

1. A day by usage type: `aws ce get-cost-and-usage --time-period Start=2026-11-03,End=2026-11-04 --granularity DAILY --metrics UnblendedCost --group-by Type=DIMENSION,Key=USAGE_TYPE` (swap the key for `SERVICE` for a service view; each call is $0.01).
2. Model spend: Logs Insights over `/aws/lambda/news*`, `filter @message like /\[usage\]/ | parse @message '[usage] *' as j | stats count(*) by bin(1d)`, then sum the tokens per `fn` and `model` from `j` (fields `fn`, `step`, `model`, token counts) and price them with `prices.json`.
3. Or read `monitoring/ops.json`: `aws.days`, `aws.monthToDate`, `deepseek.days`, `deepseek.yesterday`, `deepseek.monthToDate` (the key `deepseek` holds the estimate for every provider, decision 0059), `unitCosts.days`, `unitCosts.weeklyReview`, and `errors`/`error` fields for a source that failed.
4. S3 requests per day: `aws ce get-cost-and-usage --time-period Start=2026-11-05,End=2026-11-06 --granularity DAILY --metrics UsageQuantity UnblendedCost --group-by Type=DIMENSION,Key=USAGE_TYPE --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Simple Storage Service"]}}'` (read `APN1-Requests-Tier1`), then the `newsStoryRecord` `[views] wrote N of M` log lines summed per UTC day (Logs Insights over `/aws/lambda/newsStoryRecord`). Other writers are the run count times the puts per run read from the code.
5. S3 requests by prefix are not in Cost Explorer; that needs S3 server access logs or CloudTrail data events on a short window (both cost money; operator yes).
