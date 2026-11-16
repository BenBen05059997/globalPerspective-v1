# 60. Each job runs on Claude Haiku 5.5 or Sonnet 5.5, chosen by a recorded test; seven jobs are chosen but not yet live

Status: accepted (operator decision 2026-11-16); follows 0056 (method) and 0059 (provider). Round one is live; round two (seven jobs) waits for the operator's yes.
Date: 2026-11-16

## Context
- DeepSeek ran out of credit on 2026-11-14 and no news was stored from about 17:50 UTC that day until 2026-11-16 (0059). 0059 added Anthropic as a provider but left the model per job open and said the 0056 tests had not been run for Claude.
- On 2026-11-16 the operator asked for that test. Three local reports (`.board/reviews/`, not in git) hold the evidence and every number below:
  - `model-quality-claude-intake-2026-11-16.md`: `newsIngest` topic selection, `newsAgent` (summary, trace_cause, forecast), `newsSituationIngest` classify.
  - `model-quality-claude-briefs-2026-11-16.md`: `newsDailyBrief`, `newsWeeklyBrief`, `newsCountryIntelligence`, `newsThreadAnalysis`, `newsSystemsAnalysis`.
  - `model-quality-claude-record-2026-11-16.md`: `newsRecordReview`, `newsPredictionResolver`, `newsDriftCorrector`, `newsSourceAudit`.
- Prices are in `backend/monitoring/newsHealth/src/prices.json` (entries `claude-haiku-5-5` and `claude-sonnet-5-5`, valid from 2026-11-15): Haiku $0.10 in / $0.50 out, Sonnet $2 in / $10 out per million tokens. That file says its source is the claude-api skill's price table cached 2026-10-06 and asks for a check against Anthropic's pricing page; that check has not been done. The reports priced their calls from the `usage` numbers at these rates.

## Decision
1. **The method is 0056's, with Haiku against Sonnet.** Same inputs for both models through the shared `chat()` with each Lambda's own prompt code and options, a blind judge in both orders, a hand check against the inputs, and the Lambda's own gates where they exist. Total spend of the three runs: $3.22 + $3.06 + about $1.27 of a $6 cap each.
2. **The model per job.** "Live" is the env value read on 2026-11-16; "chosen" is the model this record picks.

| Job | Env value | Chosen | Live now | Why |
|---|---|---|---|---|
| `newsIngest` topic selection | `GROK_MODEL` | Sonnet | Sonnet | Judge: Sonnet won 8 of 8. Haiku had an invented title element and a garbled title in the 2 runs read by hand and 2 source URLs not in the pool. Sonnet over-merges and returns one topic too many, which `capTopics` cuts. |
| `newsAgent` summary, trace_cause | `GROK_MODEL` | Sonnet | Sonnet | Summary: Haiku lost to the stored DeepSeek summaries 5 to 11 and broke prompt rule 5 in 4 of 8 stories (Sonnet 2 of 8). Trace_cause on Haiku would do, but both steps read the one `GROK_MODEL`, so they run together on Sonnet. |
| `newsAgent` forecast | `PREDICTION_MODEL` | Sonnet | Sonnet | Judge: Sonnet 15 of 16. Haiku wrote stances the input does not support. Forecasts feed the public track record. |
| `newsSituationIngest` classify | `GROK_MODEL` | Haiku | Haiku | 105 of 105 rows parsed and valid on both models; judge 4 to 2 for Sonnet (noisy); Sonnet costs 20 times more per call. |
| `newsDailyBrief` | `GROK_MODEL` | Haiku | Haiku | Same content quality as live; no invented fact in either model. Neither model keeps the "exactly 4 bold phrases" rule (Haiku writes none). |
| `newsWeeklyBrief` | `GROK_MODEL` | Haiku | Haiku | 0 cut-offs, 0 invented facts by hand, 0 rule breaks. Only 2 weeks tested. |
| `newsThreadAnalysis` | `GROK_MODEL` | Haiku | `deepseek-flash` | Judge could not separate the models. 1 bad JSON in 20 for each model. |
| `newsSystemsAnalysis` | `GROK_MODEL` | Haiku | `deepseek-flash` | Quality equal. Needs `MAX_TOKENS` 6000 (the live env already has it). |
| `newsCountryIntelligence` | `GROK_MODEL` | Haiku | `deepseek-v4-pro` | Fewer invented facts than Sonnet and far fewer than the stored DeepSeek output (about 20 invented dated expectations, the 2026-11-04 failure). Sonnet padded thin countries with invented dates. |
| `newsDriftCorrector` | `GROK_MODEL` | Haiku | `deepseek-flash` | Both models pick events from the list; Sonnet slightly more disciplined. Low confidence. |
| `newsSourceAudit` | `AUDIT_MODEL` | Haiku | `deepseek-flash` | Sonnet over-flagged 1 of 5 summaries as drift (a false drift) and writes more commentary. |
| `newsPredictionResolver` settle-draft | `DRAFT_MODEL` | Sonnet | unset, code default `deepseek-v4-pro` | Haiku wrote `yes` where its own reason says the criterion is not shown (2 of 3 yes cases). A wrong `yes` goes into the public record. Five cases only. |
| `newsRecordReview` | `REVIEW_MODEL` | Sonnet | `deepseek-flash` | Haiku wrote "pending / not yet recorded" clauses in 7 of 25 lines against the review's rule and copied 2 details from forecast text; Sonnet 2 of 25 and no invented fact. |

3. **Caps changed for Claude.** Claude writes longer than DeepSeek and cut-off JSON does not parse, so these were raised:
   - `newsAgent` env `MAX_TOKENS` 600 to 1500 (summary and trace_cause share it; trace_cause was cut off in 16 of 16 test calls at 600). Live.
   - `newsDailyBrief` `maxTokens` 2000 to 4000 (8 of 8 cut off at 2000; complete answers 2,014 to 2,432 tokens). Code, commit `eb00ff02`.
   - `newsDriftCorrector` `maxTokens` 500 to 1000, and the note is read through `jsonText` (Claude writes prose before the JSON). Code, `eb00ff02`.
   - `newsSourceAudit` `maxTokens` 400 to 800. Code, `eb00ff02`.
   - `newsSystemsAnalysis` env `MAX_TOKENS` 6000 (Iran with 15 threads needed 4,298 tokens on Haiku and was cut off at 3000). The live env already holds 6000.
   - Kept: `newsIngest` 12000 (Sonnet used at most 9,281 at `TOPICS_LIMIT` 13; raise it before raising the limit), `PREDICTION_MAX_TOKENS` 2500, `newsSituationIngest` 8192, `newsThreadAnalysis` (live 6000), `newsWeeklyBrief` 3500, `newsCountryIntelligence` 5000 (6500 if Sonnet is ever chosen), `newsPredictionResolver` 500, `newsRecordReview` 6000.
4. **One retry on unparseable JSON** (commit `aad79a5c`, `backend/shared/src/llm.js`). For an Anthropic call with `json: true`, an answer that is complete (not cut off) but does not parse gets one more identical request; the second answer is returned whatever it is. A cut-off answer is not retried; DeepSeek is unchanged. The daily brief, country briefing and drift note ask for JSON in the prompt only (no `json: true`), so they do not get this retry. The test saw 1 bad JSON in 20 thread analyses per model.
5. **What is live and what is not (2026-11-16).**
   - Live since about 14:20 UTC: `newsIngest`, `newsAgent` (`GROK_MODEL`, `PREDICTION_MODEL`, `MAX_TOKENS` 1500), `newsSituationIngest`, `newsDailyBrief`, `newsWeeklyBrief`. All five hold `ANTHROPIC_API_KEY`. A manual intake run at 14:23 to 14:35 UTC produced 13 stories on Sonnet.
   - Chosen, not live (round two): `newsThreadAnalysis`, `newsSystemsAnalysis`, `newsCountryIntelligence`, `newsDriftCorrector`, `newsSourceAudit` on Haiku; `newsPredictionResolver` and `newsRecordReview` on Sonnet. They have no `ANTHROPIC_API_KEY`, and their env values still name DeepSeek (the resolver has none and uses its code default). Going live for each is its env value plus the key plus a deploy of the current code (the drift and audit caps and the JSON retry are in the code, not in the deployed zips). It waits for the operator's yes.
6. **Reversal is one env value per job**: set `GROK_MODEL` (or `PREDICTION_MODEL`, `AUDIT_MODEL`, `DRAFT_MODEL`, `REVIEW_MODEL`) back to a bare DeepSeek name such as `deepseek-flash`; no code change. DeepSeek needs credit first. For code, `scripts/lambda.sh <name> rollback`. `newsAgent` `MAX_TOKENS` 1500 can stay on DeepSeek.

## Cost
- At the test's per-call figures and the call counts the reports estimate (from the 2026-11-15 call-site map, not read from CloudWatch): intake on Sonnet about $1.16 a day (ingest 3 runs $0.43, summary $0.11, trace_cause $0.29, forecast $0.32); classify on Haiku about $0.09 a day (40 calls; hard cap 288 calls would be $0.63); the five analysis jobs on Haiku about $1.1 a month together; drift and audit on Haiku about $0.03 a month together; the resolver on Sonnet under $0.07 a day; the weekly review on Sonnet about $5.6 to $13.1 per Monday, about $24 to $56 a month (its live bundles are smaller than the fixture, so the range is the honest answer; Haiku would be $1.2 to $2.8).
- One measured fact from the first live intake run: topic selection 47,421 tokens in and 10,829 out (about $0.20 at the rates above, against $0.14 in the test), the story agent run about $0.39, about $0.60 for the whole run. At 3 runs a day (schedules `InvokeGoogleGemini` and `InvokeNewsAgent`, `cron(.. 4/8 ..)`) that is about $1.80 a day if every run is that size; that is a projection from one run, not a measurement.
- Together, with the review on Sonnet, these figures add up to roughly $65 to $115 a month for model calls (the sum is this record's arithmetic over the lines above). 0056 expected $2 to 3 a month on DeepSeek. The two largest lines are intake and the weekly review. The trace_cause step on Haiku (about $0.01 a day against $0.29) and the review on Haiku are the two switches that would save the most, and both lost on quality in the test or need a code split.

## Consequences
- 0056 rule 1 now covers Claude: a job's model is chosen by a recorded test. The next model change follows the same method.
- **Limits of the test.**
  - The judge is Sonnet, the same family as one contestant. In Sonnet-versus-Haiku pairs the answer shown second won 28 of 36 verdicts, so only a model that wins in both orders is read as a signal; a split is a tie. Judge answers moved between two runs of the same pair once.
  - Samples are small (4, 2, 5, 5 and 3 for the brief jobs; 5 for the resolver; 8 stories for the agent; one run per model for the review). One generation per input; run-to-run variation is not measured.
  - The AWS session was expired during the test. Inputs came from the public record views and from the day's live feeds, not from what the Lambdas saw, so each input is an approximation (the reports list the gaps per job: no FACTS block for forecasts, snippets in place of model summaries, no drift notes or Wikidata facts for countries). Baselines are the stored DeepSeek outputs from those views.
  - Calls per day come from the 2026-11-15 map, not from CloudWatch. Latency was measured from a laptop, not from Lambda.
  - Rate limits at real volume are untested: the review makes about 670 calls on a Monday and the test ran it at concurrency 2.
  - Not tested: thinking above the default, prompt caching, the real handler flow of most jobs, a country with 40 arcs, threads with more than 8 entries, a third review run (the review's README asks for three).
  - `newsPredictionResolver` has no `GROK_MODEL` step; only `DRAFT_MODEL` is used.
- Prompt problems seen on Claude and not fixed here (they are in the reports): the daily brief's "exactly 4 bold" rule is not followed; the country prompt's "10 to 15 events" cannot be met honestly for quiet countries; `validateGraph` does not check cause before effect; `normalizeClassified` does not check `category`; the audit counts any non-"OK" answer as drift.
- `newsModelGuard` still reads only `deepseek-` model ids and DeepSeek's balance (0059); nothing here changes it. There is no alarm on the Anthropic account balance (the no-alarms rule stands).
- Where it shows: [COSTS.md](../architecture/COSTS.md) section 4, `ARCHITECTURE.md` "LLM providers".

Source: the three reports above (local, `.board/reviews/`; raw data in `.board/reviews/model-quality-claude-2026-11-16/`); commits `aad79a5c`, `eb00ff02`, `251d377a`; live env read 2026-11-16 with `aws lambda get-function-configuration` (model values, `MAX_TOKENS`, key present or not).
