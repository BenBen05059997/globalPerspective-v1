# Summary / Analysis Verification — Discussion & Plan

**Status:** PLAN DRAFTED — awaiting review/approval, nothing built. Started 2026-06-10.
Recommended phased plan is in §7; the discussion/options that led to it are §1–6.

The question that started this: **how do we know the AI summaries are true?** The
per-topic Summarize / Predict / Trace-Cause content is LLM-generated and currently
has no truth/quality layer. This doc captures the options and the open decisions.

---

## 1. The actual gap

The site already verifies a lot (see §3), but the **per-topic summaries** are the
one un-covered surface:

- `buildSummaryPrompt()` in `NewsProjectInvokeAgentLambda` only passes the topic
  **title + description — it never gives the model the article snippets.** So the
  summary is written *blind to the actual reporting*. (Trace-cause and prediction
  prompts DO get the snippets.)
- Nothing downstream judges the summary's faithfulness.

**Step zero is grounding** — you cannot meaningfully verify a summary that was
never shown its sources.

---

## 2. How the field does this (industry patterns)

1. **Grounded generation + citation/attribution** — give the model the sources,
   force it to cite, validate the citations. Perplexity / Bing-Copilot / all serious
   RAG. The formal metric is **faithfulness** (decompose answer into claims, check
   each is supported by the cited passage) — RAGAS calls it exactly that.
2. **LLM-as-judge** — a *separate* model grades groundedness. RAGAS / DeepEval /
   TruLens / Phoenix. Rule of thumb (and our own `newsEconomicQuality` comment):
   **use a different model than the producer** so errors aren't correlated.
3. **Entailment / NLI detectors** — purpose-built small models ("does source entail
   claim"): Vectara HHEM, Google TrueTeacher. Cheaper than a full judge, at scale.
4. **Self-consistency sampling (SelfCheckGPT)** — generate N times, check whether the
   model contradicts *itself*. Hallucinations are unstable; facts are stable. This is
   a legit *same-model* technique — it works by stability-checking, NOT by asking the
   model "is this true?". Naive self-grading is the only part that's theater.

**What production teams actually do:** tier by stakes. Ground + cite + deterministic
guardrails at write time (cheap, catches most); run a judge **offline on a sample**
to track a score over time (not to gate every item); human review only high-stakes /
flagged. Almost nobody real-time-judges every generation.

---

## 3. What this codebase already has (it's ahead of typical)

- **cite-or-drop grounding** — `newsEconomicImpact` (every claim cites real topicIds; uncited dropped)
- **URL-hallucination filter** — `newsInvokeGemini` (LLM URLs validated against fetched articles)
- **cross-model LLM-as-judge** — `newsEconomicQuality` (Gemini judges DeepSeek, 5 axes, `is_low_quality`)
- **outcome-based verification** — prediction Brier / `/track-record` (did the forecast come true)
- **deterministic briefings + honesty tests** — `composeEconomyBriefing`, `composeTopicsLede` + `quality/briefing/*`

The only thing missing is the per-topic **summary** quality layer.

---

## 4. Design options for THIS site (solo dev, no paid tools, low traffic)

### Option A — Ground + cite + deterministic validation (write-time, ~free)
Inline in the existing 4h pass:
- feed `buildSummaryPrompt` the source snippets,
- ask for a citation (source index) per bullet,
- a **code** check (no LLM) drops/flags any bullet that cites nothing real.
Fixes the root cause. No new model, no quota concern. This is the 80/20.

### Option B — Scheduled "analysis" LLM judge (every 6–12h) ← user's instinct
A standalone Lambda that reads recent summaries and produces a faithfulness/quality
verdict, mirroring `newsEconomicQuality`.

**The constraint to decide:** who judges?
- **Gemini (independent, free tier):** ~20 req/day cap. Once-daily over ~13 topics ≈ 13 calls → fits.
  **6h (4×/day) or 12h (2×/day) × 13 topics = 52 or 26 calls/day → over the free quota.**
  → independent judging realistically caps at ~once daily on the free tier.
- **DeepSeek (cheap, paid):** can run every 6–12h fine, BUT it's the *same model family*
  that wrote the summary → correlated errors → weak at catching its own hallucinations.
- **DeepSeek self-consistency (SelfCheckGPT-style):** same model, but stability-based —
  legit. Costs N× generations though.

### Option C — Both (A inline + B daily), like the economic layer already works.

---

## 5. Do we need a new DB?

**Short answer: a new Lambda — yes; a new table — probably not.**

- The judge precedent (`newsEconomicQuality`) writes its scores **back onto the
  existing record** — it adds `qualityScores` / `is_low_quality` / `quality_judged_at`
  to the same `ECON#THREAD#` item. No new table.
- The summary judge can do the same: scan recent `TOPIC#{id}` / `SUMMARY` items in
  `SUMMARIZE_PREDICT_TABLE`, annotate each in place. The `summary` proxy action then
  returns the flag; the UI labels/hides low-quality ones.
- A **new table is only worth it** if we want a *judgment audit trail / time-series*
  (track the faithfulness score trend across runs, keep history of every verdict).
  For a simple "flag + label/hide", annotate-in-place is enough.
- Note the repo's clean-architecture lean (dedicated Lambdas > overloading existing
  ones): a dedicated **`newsSummaryQuality` Lambda** fits that; a dedicated table is
  the optional part.

---

## 6. Open decisions (for discussion)

1. **Cadence vs. independence:** once-daily independent Gemini judge, or more-frequent
   DeepSeek (weaker) / self-consistency? (Gemini free quota forces ~daily.)
2. **Ground first?** Do Option A regardless — a judge on an ungrounded summary is
   judging blind too. Agree it's step zero?
3. **New table or annotate-in-place?** Audit-trail value vs. simplicity.
4. **What does the user see?** Hide low-quality summaries, or show a visible quality
   signal (badge/score) — transparency vs. cleanliness.
5. **Scope:** summaries only, or also predictions / trace-cause?

---

## 7. Recommended phased plan (for review)

A proposed path with the §6 decisions resolved to a recommendation. **Resolved:**
ground first; independent (Gemini) judge over frequency; annotate-in-place (no new
table); visible quality badge (label, don't silently hide). Phases ship
independently and each is reversible.

### Phase 0 — Ground the summary (write-time, in the existing 4h pass) ← do first
The cheapest, highest-value step; a judge on an ungrounded summary is also judging
blind.

- **`NewsProjectInvokeAgentLambda` › `buildSummaryPrompt(topic, generatedDate)`**:
  pass the article snippets (same `topic.sources.map(...snippet...)` block the
  trace-cause / prediction prompts already build), and instruct: *"State only what
  the sources support. Cite the source number inline as [1], [2] after each bullet."*
- **Deterministic post-check (no LLM)** in `generateAndStore` after the summary
  returns: extract `[n]` tokens, verify each `n` ≤ number of sources; compute
  `citedBullets` / `totalBullets` / `uncitedBullets`. Store alongside the summary
  record: `grounded: <bool>`, `citationCoverage: <0–1>`. Do **not** delete bullets
  (markdown is rendered as-is) — flag, don't mutate.
- **Cost:** a few hundred extra prompt tokens × 13 topics × ~6 runs/day on DeepSeek
  ≈ cents/month. No quota concern.
- **Test:** `quality/` node script asserting the citation extractor + coverage math
  (mirrors `scripts/test-disruption-gate.mjs`).

### Phase 1 — Daily independent judge (`newsSummaryQuality` Lambda)
Mirrors `newsEconomicQuality` exactly (the proven pattern).

- **New Lambda** `newsSummaryQuality` — Gemini 2.5 Flash judges DeepSeek's summaries
  (different model family = uncorrelated errors). Scans recent `TOPIC#{id}` / `SUMMARY`
  rows not judged in the last N days.
- **Quota fix — BATCH.** Gemini free tier is rate/quota-limited and is already used
  daily by `newsThreadAnalysis` + `newsEconomicQuality`. So judge **many summaries per
  call**: one prompt with ~8–10 summaries → JSON array of verdicts. ~13 topics ⇒ ~2
  Gemini calls/day, not 13. (One-record-per-call like the economic judge would blow
  the quota.)
- **Axes** (1–5, flag `is_low_quality` if any ≤ 2): `faithfulness` (does each bullet
  follow from the cited source), `citation_fidelity` (do the [n] map to real sources),
  `coherence`, `no_bs`.
- **Annotate-in-place:** write `qualityScores` + `is_low_quality` + `quality_judged_at`
  back onto the same `SUMMARY` record. **No new table.**
- **Schedule:** EventBridge daily, offset from the other Gemini jobs (e.g. `cron(45 8
  * * ? *)`, after `newsEconomicQuality` at 08:00).
- **Env vars** (copy economic-quality): `XAI_API_KEY`(=Gemini), `GROK_MODEL`
  (=`gemini-2.5-flash`), `GROK_API_URL`(=Gemini OpenAI-compat), `INTER_CALL_DELAY_MS`
  (=13000), `MAX_TOKENS`, `SUMMARIZE_PREDICT_TABLE`, `QUALITY_MAX_RECORDS`,
  `QUALITY_RECENT_DAYS`.

### Phase 2 — Surface it (frontend)
- **`newsSensitiveData` `summary` action**: include `grounded` / `citationCoverage` /
  `qualityScores` / `is_low_quality` in the response (read straight off the record).
- **`SummaryDisplay.jsx`**: a small quality chip — e.g. "✓ sources cited" when
  grounded, "⚠ unreviewed" until a verdict exists (honest empty state — never a fake
  score), and a muted "⚠ low-confidence" when `is_low_quality`. **Label, don't hide**
  (hiding loses information; a visible signal is the honest move).

### What we are NOT doing (and why)
- **No DeepSeek-judges-DeepSeek** — correlated errors; the judge would bless the
  writer's own hallucinations.
- **No new DynamoDB table** — annotate the existing `SUMMARY` record (economic-judge
  precedent). Revisit only if we later want a faithfulness-score *time series*.
- **No 6h/12h judge** — summaries barely change between the 4h regenerations;
  independence (daily Gemini) beats a faster but self-correlated check.

### Rollout order & checkpoints
1. Phase 0 (grounding + citations) → deploy `NewsProjectInvokeAgentLambda` → verify a
   live run: summaries cite `[n]`, `grounded`/`citationCoverage` stored.
2. Phase 1 (`newsSummaryQuality`) → deploy + one manual invoke → verify `qualityScores`
   written, batched into ≤ ~2 Gemini calls.
3. Phase 2 (UI badge) → build → `docs/` deploy.

### Rough cost
Phase 0 ≈ cents/mo (DeepSeek). Phase 1 ≈ free (batched, within Gemini free tier).
Phase 2 = $0.

### Still needs your call before building
- **Scope:** summaries only (this plan), or extend the same judge to predictions /
  trace-cause later?
- **UI:** badge wording + whether `is_low_quality` should *hide* or just *mark*
  (recommendation: mark).

---

## 8. Experiment: snippet-grounded vs "free-style" (search-backed) judge

Idea raised in discussion: instead of only checking the summary against the snippets
we pre-fed, let the judge **use its own search tool to find evidence freely**. Reframe:
this is NOT the opposite of grounding — it's grounding against **self-retrieved**
evidence instead of pre-fetched snippets. **Precedent already in the repo:**
`newsPredictionResolver` grounds verdicts against Brave Search + returns verdict +
citation. So Arm B is a proven pattern here, not new territory.

### The two arms
- **Arm A — snippet-grounded:** judge sees the topic's already-fetched sources, scores
  faithfulness against them. 1 LLM call, fast, reproducible. Blind spot: whatever the
  snippets omit.
- **Arm B — search-backed / "free style":** judge gets fresh Brave results for the
  topic (or, fuller, calls search itself) and checks against those. Broader evidence;
  but slower, non-reproducible, and **can be misled by / hallucinate from bad search
  results** — search-augmented ≠ truthful.

Two flavors of Arm B (pick the simpler first):
- **B1 retrieval-augmented (recommended):** we run one Brave query, feed results, judge
  scores. Simple, deterministic-ish, exactly the `newsPredictionResolver` shape.
- **B2 true tool-use agent loop:** model decides what to search across turns. Needs
  function-calling, costs more calls, harder to test. Defer unless B1 underperforms.

### The catch: "better" must be MEASURED, not assumed
Running two arms only means something if we can score which was right. **Experiment
design (one-off, no production infra):**
1. Pick a small sample (~8 topics from a recent run).
2. A one-off script runs Arm A and Arm B on each → two verdicts/topic.
3. **Human spot-check (you):** for each, was the verdict correct? did either invent a
   claim or cite junk? (reuses the economic / prediction human-review muscle.)
4. Tally: which arm caught real errors, which hallucinated, cost/latency each.
5. Winner becomes the Phase-1 production judge; loser is dropped.

### Tradeoffs to weigh in the result
cost (Brave + more tokens) · latency · reproducibility · evidence breadth · the new
failure mode (trusting a bad search hit). For a solo / no-paid-tools / low-traffic
site, Arm B on *every* summary *every* cycle is heavy — even if it wins, it may only
be worth running on the day's top-N significant summaries, not all 13.

### Open questions for this experiment
- Arm B flavor: **B1 (pre-fetched Brave, simpler)** or B2 (full tool-use agent)?
- Judge model: Gemini (independent) for both arms, or compare models too? (keep it one
  variable — recommend same model both arms, vary only the evidence source).
- How do we score "better" — your human spot-check on the sample, agreed?
