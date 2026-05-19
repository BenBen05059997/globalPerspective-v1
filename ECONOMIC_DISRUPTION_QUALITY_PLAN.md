# Economic Disruption — Output Quality Evaluation Plan

**Status:** plan, not yet implemented. Sibling to [`ECONOMIC_DISRUPTION.md`](ECONOMIC_DISRUPTION.md) (the concept doc) and [`ECONOMIC_DISRUPTION_PLAN.md`](ECONOMIC_DISRUPTION_PLAN.md) (the implementation plan).

## Why this needs a plan

The 31 validator tests prove our **structural** guards work — no hallucinated tickers, no uncited claims, no out-of-allowlist instruments. They don't prove the output is **right**:

- A record can pass all validators and still call BRENT↑ when it actually fell that week.
- A record can cite real topicIds and still describe a mechanism that doesn't match what the articles said.
- A record can pick the "2019 Abqaiq" analog and have nothing structurally in common with what's happening today.
- Severity 85 today and severity 85 next month aren't necessarily commensurate — calibration drifts silently.

"Looks plausible" is the failure mode that kills credibility for analyst tools. We need a way to catch it.

## How serious firms do this (verified)

### Academic — Caldara & Iacoviello (2022) GPR Index
Statistical validation: regress GPR shocks against industrial production, equity returns, EM capital flows, oil prices. Show that GPR rises predict real economic outcomes. Published in *AER*. The whole index is **reproducible from public data** — that's the gold standard.

**Source:** [matteoiacoviello.com/gpr_files/GPR_PAPER.pdf](https://www.matteoiacoviello.com/gpr_files/GPR_PAPER.pdf)

### Quant — GeoQuant (Fitch Solutions)
31 indicators audited by political scientists. They publish a backtested correlation of their Sovereign Risk score vs 10Y sovereign spreads: **0.73**. The methodology is published, individual indicator weights are proprietary.

**Source:** [GeoQuant FAQ](https://assets.ctfassets.net/nvl7oyu82ssb/5xX5bUq1dlf3Y6jXCkq3zN/dbac23d9c0461098b7a6972dd623b625/GeoQuant-FAQ.pdf)

### Discretionary — Eurasia Group "Top Risks"
Regional specialists draft → senior partner review → integrated with quant tools. Annual report. **They get held accountable in reality** — every Jan they review the previous year's calls publicly. No automated eval; the calibration is reputational.

### Asset manager — BlackRock GRI / MDS
Market-Driven Scenarios (MDS) defines asset-level payoffs for each named risk. The mapping table is proprietary. They run **historical backtests** — when a risk has materialized in the past, did the MDS asset payoffs roughly match? Methodology published in [Making of a Market-Driven Scenario](https://www.blackrock.com/aladdin/products/aladdin-wealth/insights/making-of-a-market-driven-scenario).

### LLM evaluation broadly — Anthropic / OpenAI / academic
The standard stack in 2024-2026:

1. **Schema validation** — already done in our system
2. **LLM-as-judge** — a second model scores outputs on a rubric. Used by everyone. Source: [Zheng et al. 2023, *Judging LLM-as-a-Judge with MT-Bench*](https://arxiv.org/abs/2306.05685). Cheap, scalable, biased toward the judge model's preferences.
3. **Golden eval sets** — curated input/output pairs. Trade off: small N, expensive to maintain.
4. **Adversarial probing** — inputs designed to trip the system (e.g., feed a basketball game thread, verify tombstone).
5. **Human spot-check rubrics** — slow, but the ground truth for tuning the LLM-as-judge.
6. **Production telemetry** — clicks, dwell time, "this is wrong" feedback button. Indirect but real.

### Finance-LLM evaluation specifically
- **FAITH** (2025) — hallucination benchmark for financial LLMs. 10-20% error on multi-step numerical reasoning even on frontier models. [arXiv:2508.05201](https://arxiv.org/abs/2508.05201).
- **PIXIU / FinGPT benchmarks** — finance-domain LLM eval suites.
- **FINOS AI Governance Framework** — risk register including hallucination, prompt injection, drift. [air-governance-framework.finos.org](https://air-governance-framework.finos.org/risks/ri-4_hallucination-and-inaccurate-outputs.html).

## The 5-layer evaluation stack we'll build

Borrowed from the LLM-eval consensus + adapted for our specific output shape (instruments + direction + severity + mechanism + analog).

### Layer 1 — Always-on internal consistency checks (free, daily)

Cheap rules that run on every record after the LLM produces it. Stricter than the existing validator. Live alongside the Lambda, not after.

| Check | Why |
|---|---|
| `severityScore` consistent with `severity` enum | severe→70-100, moderate→40-69, minor→0-39 |
| `confidence` not "high" when `instruments.length === 1` AND `citedTopicIds.length < 2` | Suspicious confidence |
| `magnitude: "large"` requires `confidence: "medium"` or `"high"` | Don't let LLM hedge a big call |
| For each instrument, the thread category should be in the instrument's relevant set (e.g., BRENT relevant to {conflict, energy, sanctions}) | Crude relevance filter — defense against instruments hallucinated into the wrong story |
| Mechanism contains at least one `[topic-xxx]` inline citation | Already in validator but worth reinforcing |
| Historical analog year is in the past, plausible (1990-current) | Hallucination guard |
| Winners + losers each have ≥2 entries when severity ∈ {moderate, severe} | Real disruptions have real losers |
| `marketContext` snapshot is fresh (`asOf` within 4 hours) | Stale prices are misleading |

**Owner:** the existing Lambda. **Effort:** ~80 lines added to `validateImpact()`. **Failure mode:** record is downgraded (drop to lower severity / lower confidence) rather than tombstoned — better to publish a conservative version than nothing.

### Layer 2 — Daily LLM-as-judge scoring (cheap, daily)

After each daily run, a second LLM call per record. Use **a different model family** (Gemini 2.5 Flash if Lambda is using DeepSeek, since they likely have less-correlated errors than two DeepSeek calls). Same prompt structure for every record:

```
Given a news thread (title + 3-5 article snippets) and the economic disruption record we generated for it, score the output on 5 axes. Each axis: 1-5. Score honestly. Be willing to mark our output as 1-2 when warranted.

INPUT THREAD:
{title, articles}

OUR OUTPUT:
{the full economic_impact record}

SCORE:
1. coherence (1-5): does the mechanism logically follow from the articles?
2. citation_fidelity (1-5): do the cited topicIds actually support the specific claims they're attached to?
3. analog_match (1-5): is the historical analog actually structurally similar to this story, or just superficially?
4. severity_calibration (1-5): would a reasonable analyst assign this severity, or is it too aggressive / too cautious?
5. no_bs (1-5): does any part of this output read as confident bullshit rather than honest analysis?

For each axis ≤3, give a one-sentence reason. Return JSON only.
```

**What we do with the scores:**
- Records with any axis ≤2 get an `is_low_quality: true` flag in DDB
- Frontend optionally hides low-quality records (or shows them with a warning badge)
- Weekly aggregate published as "this week's quality rating" on `/economy` footer
- Persistent records of which records the judge flagged go to a `QUALITY#` PK family for trend analysis

**Cost:** ~15 records/day × 1500 tokens × Gemini free tier = $0 (within free tier rate limits). DeepSeek alternative: ~$0.005/day.

**Owner:** new Lambda `newsEconomicQuality` or extend `newsEconomicImpact` with a second pass. The former is cleaner per `feedback_clean_architecture.md`.

**Risk:** judge model has correlated biases. Mitigations:
- Use a different model family than the producer (DeepSeek produces; Gemini judges)
- Periodically calibrate the judge against human spot checks (Layer 4)
- Track judge agreement with human review — when they diverge, the judge prompt needs tuning

### Layer 3 — Direction-call backtest (slow, monthly)

The strongest credibility moat. Slow because we need 30+ days of records before this becomes meaningful.

**For every instrument call made at time T:**
1. Read the actual price at T from `marketContext.{ticker}.value`
2. Read the actual price at T+7d / T+30d from `MARKETS_DDB_TABLE` HISTORY
3. Compute realized direction (up/down/flat) using a threshold (e.g., ±0.5% = flat, else up/down)
4. Compare to the LLM's `direction` call

**Metrics computed monthly:**
- **Hit rate by instrument** — % of calls where realized direction matched. Published per instrument.
- **Hit rate by horizon** — does "immediate" outperform "days" / "weeks" / "months"?
- **Hit rate by confidence** — if the LLM says "high confidence," does it actually hit more often than "low"?
- **Calibration plot** — predicted-confidence vs actual-accuracy, by decile. Reliability diagram standard from forecasting literature.
- **Brier score** — `mean((predicted_prob - actual_outcome)²)`. Lower is better. Standard for probabilistic forecasts.

**Published as a "trust badge" on the `/economy` page footer:**

> Direction calls — 30-day hit rate: 64% (n=120 calls). Last updated 2026-06-15.
> [See full backtest →](/economy/backtest)

**Owner:** new Lambda `newsEconomicBacktest` triggered weekly via EventBridge. Writes to `BACKTEST#YYYY-MM-DD` records in `SummarizeAndPredict`.

**Why this matters:** Caldara-Iacoviello, GeoQuant, and BlackRock all publish backtest numbers. Almost no LLM-driven product does. Doing it would be a real differentiation.

**Caveat:** spurious attribution. Most market moves aren't driven by the geopolitical headline. We should expect hit rates in the 55-65% range, not 80%+. Anything above 60% on direction calls is genuinely useful; anything below 50% means we're noise.

### Layer 4 — Human spot-check rubric (slow, weekly)

The ground truth that everything else calibrates against. Without this, the LLM-as-judge can drift toward its own biases.

**Process:**
- 5 random records per week, selected stratified by severity (1-2 severe, 2-3 moderate, 1 minor)
- Reviewer (you or anyone with the right context) fills a rubric:

```
Record: ECON#THREAD#thread-xxx
Date reviewed: YYYY-MM-DD

1. Headline accurate? [Y / N / partial]
   - If N or partial, what's wrong:

2. Direction calls correct (subjective — does direction make sense)? [all correct / some wrong / all wrong]

3. Mechanism makes sense given the news? [yes / mostly / partly / no]

4. Historical analog appropriate? [good fit / weak / wrong / not in catalog and shouldn't be cited]

5. Severity calibrated? [right / too high / too low]

6. Any hallucinations or BS? [none / minor / moderate / severe]

7. Would you publish this on a paid newsletter? [yes / yes-with-edits / no]

Overall grade: A / B / C / D / F
```

- Results logged to a Google Sheet or markdown file in `quality/reviews/YYYY-WW.md`
- Aggregated quarterly into a "human review" trend line, compared against Layer 2 (LLM-as-judge) and Layer 3 (backtest)

**This is the bridge** between automated metrics and reality. When Layer 2 says "all green" but Layer 4 says "I wouldn't publish 3 of these 5," the LLM-as-judge prompt needs tuning.

### Layer 5 — Adversarial / golden eval suite (one-time + quarterly)

A curated set of inputs with known expected outputs. Like an integration test, but for output quality.

**Categories:**

| Should produce tombstone | Should produce SEVERE | Should pick a specific analog |
|---|---|---|
| Sports thread | Russia 2022 invasion day 1 | Suez Canal blockage 2021 → `houthi-red-sea-2024` |
| Celebrity feud | COVID March 2020 | TSMC export ban → `trump-tariffs-2018` |
| Local election | Lehman 2008 collapse | UK fiscal crisis → `uk-mini-budget-2022` |
| Sports betting story | Iran nuclear deal collapse | Argentina default → `argentina-imf-crisis-2018` |

**Process:**
- Build 30 frozen "golden" inputs (thread title + thread analysis + a few topic snippets) with expected hasImpact/severity/analog
- Quarterly: run all 30 through the Lambda, check if outputs match expected. If not, why?
- Tracks regression: did a prompt change break a previously-handled edge case?

**Owner:** `quality/golden_evals.json` + a Node script to run them. Manual maintenance.

## Phased rollout

Order matters. Layer 1 + 5 first (cheap + reveal structural gaps). Then Layer 2 (automated scoring kicks in). Then Layer 3 once we have 30+ days. Layer 4 is always-on but light.

| Phase | Adds | Effort | Why this phase |
|---|---|---|---|
| **A** — Layer 1 + Layer 5 | Internal consistency checks + golden eval suite (~30 frozen inputs) | 1 day | Catches the easy stuff. Reveals structural failures fast. |
| **B** — Layer 2 | LLM-as-judge daily run + DDB writes + frontend low-quality badge | 1 day | The biggest signal:noise improvement for ongoing operations. |
| **C** — Layer 4 baseline | First 4 weeks of human spot checks logged in `quality/reviews/` | (passive — just review 5/week) | Establishes ground truth before backtest math becomes meaningful. |
| **D** — Layer 3 | Direction-call backtest Lambda + `/economy/backtest` page | 1.5 days, **after** ~30 days of records exist | The credibility moat. Worthless without enough data. |
| **E** — Calibrate judge against human | Compare Layer 2 ratings vs Layer 4 grades; tune Layer 2 prompt | Ongoing | Closes the loop. Without this, the judge slowly drifts. |

## What ships in v1 (Phases A + B — 2 days)

**Backend changes:**
- Extend `validateImpact()` in `newsEconomicImpact/src/index.js` with the 8 internal consistency checks from Layer 1. Failures cause downgrades, not tombstones.
- New file `quality/golden_evals.json` at repo root with 30 frozen inputs + expected outputs.
- New script `quality/run_golden_evals.js` to run them on demand.
- New Lambda `newsEconomicQuality` (or extension of existing) — daily LLM-as-judge pass over the day's records. Writes `is_low_quality` + per-axis scores back to each ECON# record.

**Frontend changes:**
- Optional "Lower-quality output" badge on disruption cards where `is_low_quality: true`
- Footer line on `/economy`: "Quality monitoring active — see [methodology](/disclosures#quality)"

**DDB schema additions:**
- `qualityScores: { coherence, citation_fidelity, analog_match, severity_calibration, no_bs }` on each ECON# record
- `is_low_quality: boolean` flag
- `quality_judged_at: ISO timestamp`

## What v2 + v3 add (deferred)

- Layer 3: backtest Lambda + page. Needs 30+ days of data.
- Layer 4: structured weekly review template + Sheet/MD log.
- Layer 5: quarterly run automation.
- Public-facing "trust badge" with hit rate on `/economy`.
- A `quality/dashboard.md` (or page) summarizing recent metrics.

## Specific thresholds for "good enough"

Cribbed from BlackRock's published methodology + the academic literature.

| Metric | Acceptable | Concerning | Target after 6mo |
|---|---|---|---|
| Hit rate on direction calls (7d horizon, BRENT) | ≥55% | <50% (random) | ≥60% |
| Hit rate on direction calls (any instrument, 30d) | ≥52% | <48% | ≥58% |
| LLM-judge "no BS" score (mean) | ≥4.0 / 5 | <3.5 | ≥4.5 |
| LLM-judge "coherence" (mean) | ≥4.0 / 5 | <3.5 | ≥4.5 |
| Human spot-check "would you publish" | ≥80% yes-with-edits or better | <60% | ≥90% |
| Golden eval pass rate | ≥27/30 (90%) | <24/30 (80%) | 30/30 |
| Brier score (probabilistic forecasts) | ≤0.20 | ≥0.25 | ≤0.15 |

These are realistic, not aspirational. Discretionary firms (Eurasia, Stratfor) themselves don't beat 60-65% on direction calls over long horizons. We should be honest about that.

## Things we deliberately won't measure

- **"Did the market react to OUR ANALYSIS?"** — we have no causal claim that anyone reads us and trades on it. Not measurable, not relevant.
- **Token-level perplexity / BLEU / ROUGE** — wrong tool for free-form analyst output.
- **Reader satisfaction surveys** — too noisy at small N, and reader preference can diverge from accuracy.

## Risks of NOT having this

- **Silent drift**: model upgrades change behavior subtly, no one notices, quality degrades over months.
- **Confirmation bias from looking**: we'll naturally remember the 3 records we liked and forget the 12 mediocre ones. Without systematic measurement, no one knows the actual hit rate.
- **No defense against critique**: if an analyst writes "your Hormuz prediction was wrong by X," we have no data to respond with. With a published hit rate, we have: "Yes, that specific call was wrong. Across 120 BRENT calls in the last 90 days, our hit rate was 64%."
- **Can't tune the system**: without metrics, prompt changes are guesses.

## Open questions

1. **Should the public hit rate show by instrument, or aggregated?** Aggregating hides genuinely-strong instruments behind weaker ones. Splitting risks looking bad on edge cases where N is small.
2. **What's the right judge model?** Gemini 2.5 Flash is free. Claude Sonnet would likely give better judgment but costs more. Worth A/B-testing once we have 4 weeks of records.
3. **Human spot-check ownership** — is this just you, or do we eventually find a contractor / community analyst? At what scale does it become unsustainable?
4. **What do we DO with low-quality records?** Hide them? Mark them? Re-run with higher confidence threshold? Open question.

## Sources

- [Zheng et al. 2023 — "Judging LLM-as-a-Judge"](https://arxiv.org/abs/2306.05685) — foundational LLM-judge paper
- [Caldara & Iacoviello 2022 GPR Index paper](https://www.matteoiacoviello.com/gpr_files/GPR_PAPER.pdf) — academic geopolitical risk validation
- [GeoQuant FAQ](https://assets.ctfassets.net/nvl7oyu82ssb/5xX5bUq1dlf3Y6jXCkq3zN/dbac23d9c0461098b7a6972dd623b625/GeoQuant-FAQ.pdf) — quant political risk methodology
- [BlackRock — Making of a Market-Driven Scenario](https://www.blackrock.com/aladdin/products/aladdin-wealth/insights/making-of-a-market-driven-scenario)
- [FAITH 2025 — Financial LLM hallucination benchmark](https://arxiv.org/abs/2508.05201)
- [FINOS AI Governance Framework — hallucination risk](https://air-governance-framework.finos.org/risks/ri-4_hallucination-and-inaccurate-outputs.html)
- [Brier score (forecasting standard)](https://en.wikipedia.org/wiki/Brier_score)
- [Reliability diagram methodology](https://en.wikipedia.org/wiki/Calibration_(statistics))

## Decision needed before starting

Three open questions before Phase A starts:

1. **Judge model**: Gemini 2.5 Flash (free, lower quality) or Claude Sonnet ($0.50/1M tokens, higher quality)? Recommend Gemini Flash for v1 — switch later if calibration is poor.
2. **Where do golden evals live?** `quality/golden_evals.json` at repo root, or `amplify/backend/function/newsEconomicQuality/`? Recommend repo root — they're cross-cutting reference data, not Lambda-internal.
3. **Public hit rate**: show on `/economy` immediately when computed, or hold internal until we have a 6-month track record? Recommend public from day 1 with clear caveats about N — credibility comes from showing the work.
