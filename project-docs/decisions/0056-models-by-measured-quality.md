# 0056. Each job's model is chosen by a recorded Flash-versus-Pro test; four jobs move to Flash, the rest stay on Pro

Date: 2026-11-04. Status: accepted (operator decision 2026-11-04, "switch the four"); partly supersedes the "four high-leverage calls on Pro" consequence of 0014 and the "larger model" wording of 0039. Live 2026-11-04 for `newsRecordReview`, `newsSystemsAnalysis` and `newsDailyBrief`; `newsIngest` is planned, after its filter fixes are deployed.

## Context
- On 2026-09-29 (Batch 2, decision 0014) topic selection, the daily brief, the weekly brief and the story forecast went to `deepseek-v4-pro` as "high-leverage calls". That was a judgement; no test compared Pro with Flash. Decision 0039 later put the weekly review on "the larger model" the same way.
- Prices (`backend/monitoring/newsHealth/src/prices.json`, in [COSTS.md](../architecture/COSTS.md)): Flash $0.15 in / $0.60 out per million tokens, Pro $0.66 / $1.98. For the same tokens Pro costs about 4 times as much.
- On 2026-11-04 the operator asked for the test. Three reports (local, `.board/reviews/`) hold the evidence:
  - `model-quality-flash-2026-11-04.md` (the briefs and systems): systems analysis as good on 3 countries (valid graphs, 0 edges dropped by the Lambda's own check; Pro had one effect-before-cause edge). Daily brief equal in content, looser in format (summary over 350 words in 2 of 4, bold phrases wrong in 3 of 4). Weekly brief as good or better (Pro invented two dates, Flash none; one clean sample). Country intelligence clearly worse on Flash (judge 1 / 9, Pro won 4 of 5 countries in both orders; Flash invented a meeting and future dates).
  - `model-quality-review-flash-2026-11-04.md` (golden week, 29 stories): Flash passes every mechanical gate in both runs (27 of 27 stories read, 0 citation rejections, only shape slips, same `over_cap`), about 4.1 times cheaper per call ($0.0010 against $0.0042).
  - `model-quality-ingest-flash-2026-11-04.md` (topic selection, last four runs): Flash matched Pro on what matters (same primary country on 25 of 25 matched topics, all sources valid, blind judge 2 to 2) and followed the rules better (limit 13, repeats, statements). Pro's 3 Nov 20:16 reply was cut off at max_tokens and the salvage kept 30 topics against the limit of 13.

## Decision
1. **A job's model is chosen by a recorded test, not by judgement.** Same inputs rebuilt from the record, Flash only (the Pro side is the stored output), a blind A/B judge run in both orders, plus a hand check of the inputs and outputs. For the weekly review the test is the golden week (`scripts/golden-week.js`). The result goes to a report and, when it changes a model, to a record like this one.
2. **Four jobs move to Flash.** `newsRecordReview` (`REVIEW_MODEL`), `newsSystemsAnalysis` (`GROK_MODEL`) and `newsDailyBrief` (`GROK_MODEL`) are `deepseek-flash` live since 2026-11-04. `newsIngest` (`GROK_MODEL`) moves to `deepseek-flash` once its small filter fixes are deployed (planned, not live).
3. **These stay on Pro, each for its own reason.** `newsCountryIntelligence`: Flash invented facts in the test. `newsAgent` `PREDICTION_MODEL` (forecasts): not testable until verdicts exist to score them against. `newsWeeklyBrief`: equal quality and the saving is about 2 cents a month, so left as it is. `newsAnalyze`: parked.
4. **Reversal is one env value** per Lambda (`REVIEW_MODEL` or `GROK_MODEL` back to `deepseek-v4-pro`); no code changes.

## Consequences
- Estimated model spend falls from about $6 to 10 a month to about $2 to 3 (from the reports above; the review's saving was computed from the fixture's token sizes, so check it against the live `[usage]` logs after Monday's run). Monday's review fits the DeepSeek balance.
- A live canary of the review on 25 W44 stories is running 2026-11-04 (the result is not in this record yet).
- Country briefings stay on Pro. The review's links, merges and alias conflicts were not covered by the fixture for either model, and the operator spot check of a few stories is still open.
- Flash is looser on the daily brief's length and bold markers; accepted.
- The next model change follows the same method (point 1).
- Where it shows: [COSTS.md](../architecture/COSTS.md) section 4, `ARCHITECTURE.md` "LLM providers".
