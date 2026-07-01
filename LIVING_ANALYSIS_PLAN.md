# Living, Accountable Analysis — Build Plan (v2: corrector → drift-note → analyzer)

**Date:** 2026-07-01 (rewritten around the corrector→note→analyzer loop)
**Status:** Plan. The differentiator wedge from `PITCH.md` gap #1.
**Grounded in:** the 2026-06-30 living/accountability audit + a 2026-07-01 code check of the producers.

---

## The idea

Analysis that **self-corrects as the newest news arrives** — built as an agent loop, not a versioned-diff engine:

```
new news ─► CORRECTOR agent ─► DRIFT NOTE ─► ANALYZER agent ─► updated read
            (did the read drift?   ("we said A; event Z    (consumes the note        (+ the note is
             gated + grounded)      happened; revised B")    as context)               shown to the user)
```

- The **corrector** watches a prior read against fresh events and asks: *did the conclusion materially drift?* If yes, it writes a **drift note** — grounded, cited, labeled — instead of silently rewriting.
- The **analyzer** (the existing thread/country/systems producer) **consumes recent drift notes** when it regenerates, so the correction feeds *forward*.
- The **drift note is the visible "what changed"** — the accountable diff, as a record, not a silent overwrite.

Why this over a version-store diff engine: it **reuses the agent pattern you already run** (a grounded checker + a producer) instead of inventing storage/versioning machinery.

---

## Prior art — how others do this (and what it changes for us)

Researched 2026-07-01. The corrector→note→analyzer loop is well-trodden across four fields; the literature **validates our shape and hardens two non-negotiables**:

1. **LLM self-correction is unreliable *without external feedback*** — DeepMind, *"LLMs Cannot Self-Correct Reasoning Yet"* ([arXiv 2310.01798](https://arxiv.org/abs/2310.01798)): unguided self-correction often *degrades* output; the bottleneck is **error *detection*, not correction**. → **THE make-or-break constraint:** the corrector must detect drift from **new, cited external events — never from re-reading its own analysis.** A "reflection agent" that just re-reads the prior read will fail. Grounding isn't a nice-to-have; it's the whole thing.
2. **LLM-as-judge has self-preference + *family* bias** ([arXiv 2410.21819](https://arxiv.org/abs/2410.21819); [Adaline](https://www.adaline.ai/blog/llm-as-a-judge-reliability-bias)): models over-rate their own / same-provider outputs; no judge is uniformly reliable (>50% error on hard cases). → Confirms the **different-model-family corrector** (our Gemini-judges-DeepSeek pattern) and the **human checkpoint on conclusion-flips**.
3. **"Living systematic reviews" (evidence-synthesis)** — the closest formal analog. They use **"signal detection for updating"**: a surveillance step decides *when a conclusion is out of date* (validated at 83–99% concordance — [AHRQ/RAND](https://www.rand.org/pubs/external_publications/EP50475.html), [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7542271/)). And crucially: **"not all reviews merit living status, nor indefinitely"** — you update only when new evidence would *change the finding*, and only for high-importance, fast-moving questions. → Our **gate is a named, validated concept** (port it, don't invent), and we should make only **high-importance/fast-moving** countries "living," not everything (cost + noise control).
4. **Superforecasters = Bayesian updating + keep score** (Tetlock/Good Judgment Project — [AI Impacts](https://aiimpacts.org/evidence-on-good-forecasting-practices-from-the-good-judgment-project/)): **many small updates, occasional big ones**, and track accuracy to stay honest. → Our **drift note is a recorded Bayesian update**; small (score nudge) vs big (level flip) maps onto the backtest (18% big / 37% cosmetic). Keeping the score (even if deferred) is what makes forecasters good.

**Net change to the plan:** (a) the corrector is a **grounded event-detector**, not a self-reflection loop (elevated from non-negotiable #3 to *the* design; the research is emphatic); (b) adopt living-review **"signal detection"** framing for the gate; (c) make **only high-value items "living"** — a discipline, not a default.

## What we have right now (code-checked 2026-07-01)

| Building block | Have today | Gap for this loop |
|---|---|---|
| **Corrector primitive** (grounded drift detection) | ✅ `newsPredictionResolver` — Brave-grounded, emits a `proposal {verdict, confidence, citation, reasoning}` for a prediction. ✅ `newsEconomicQuality` — a **different-model-family** reviewer (Gemini judges DeepSeek). | Neither generalizes to *narrative* reads, and neither **feeds forward** into analysis. |
| **Something to compare against** (point-in-time) | ✅ `GlobalPerspectivePredictionLog` (immutable). 🟡 `newsCountryIntelligence` writes a daily `HISTORY#<date>` row — but **scalars only** (riskLevel/score/trajectory/headline), not the narrative body. | Thread + systems **overwrite in place** — no prior read to diff. Country `HISTORY#` lacks the narrative text. |
| **Analyzer consumes prior/notes** | 🟡 `newsCountryIntelligence.loadThreadAnalyses()` already pulls *other* analyses into its context (the plug-in seam). | **No producer reads its own prior read or a drift note into the prompt.** `newsThreadAnalysis` reads its prior only to check `entryCount` for the skip, then regenerates **blind**. |
| **Change gate** (signal vs noise) | 🟡 Count-based skip only: thread `entryCount`, country `totalArticles`. | **Not conclusion-based** — regenerates on *count* change, which the backtest showed is 37% cosmetic rewording. No material-change judge. `newsSystemsAnalysis` has no gate at all (re-spends every run). |
| **Drift-note store** | ❌ none | Net-new record type (fits the existing `SUMMARIZE_PREDICT_TABLE` PK/SK pattern). |

**Backtest signal (2026-06-30, real `HISTORY#` data, 405 country day-pairs):** ~**18–25% of daily updates move the conclusion** (risk-level flip or big score move — real, ~every 4–6 days); **37% are cosmetic rewording** (the noise the gate must kill); 4% flat. → The loop has signal, *and* the gate is mandatory, *and* it must key on the **conclusion (risk/trajectory), not the headline.**

---

## The drift-note record (the accountable diff, as data)

Fits `SUMMARIZE_PREDICT_TABLE` as e.g. `COUNTRY#{name}` / `DRIFT#{date}` (bounded TTL):
```jsonc
{
  "priorRead":   "<what we said, + as-of date>",        // ✅ sourced from the prior snapshot
  "triggerEvent":{ "headline":"...", "date":"...",       // ✅ the real event that caused the drift
                   "topicId":"...", "sources":[...] },
  "revisedRead": "<what we now say>",                     // 🌐 grounded synthesis
  "change":      { "dimension":"risk|trajectory|direction",
                   "from":"elevated/65", "to":"high/85" },// deterministic where possible
  "confidenceDelta": "60%→40%",                           // ordinal, never fabricated
  "provenance":  "note = judgment about sourced facts",
  "asOf":"<date>"
}
```
The UI renders it as **"What changed since <date> — because <event>"**; the analyzer reads recent notes as prompt context.

---

## Non-negotiables (the difference between trustworthy and slippery)
1. **Note, never silent overwrite.** The correction is *recorded and shown* ("we said A; Z happened; revised B"). Silently editing the read = hindsight editing = the trust-killer.
2. **Gate on the conclusion.** Fire only when risk/trajectory/direction materially moved — not on headline rewording (37% noise) or raw count change. Deterministic pre-filter → small LLM judge.
3. **Ground or it's fabrication.** The corrector must cite the **real dated event** that caused the drift; label its own inference 💭. No ungrounded "corrections."
4. **Model choice, scoped by task.** The family-bias rule (a model over-rates its own/same-provider output — [arXiv 2410.21819]) applies to a model **judging another's output quality**. The drift-corrector does NOT rate the analyzer's prose — it **grounds a causal explanation in a real dated event** (generation, not judging). So **same-family is fine here → corrector = DeepSeek** (decided 2026-07-01, cheaper/consistent). The different-family rule stays **reserved for a future quality-JUDGE step** (like `newsEconomicQuality`).
5. **Human checkpoint only on conclusion-flips** — not every note; just the load-bearing ones (keeps it honest without a review bottleneck).

---

## Phased build (smallest real loop first)

> **STATUS 2026-07-01:**
> - **Phase 1a — ✅ SHIPPED + DEPLOYED** (`3c6766b`). `utils/countryDrift.js` (deterministic conclusion-gate, 6 tests) + `atoms/CountryWhatChanged.jsx` "What changed" band on `CountryPage` (revives `RiskDeltaPill`). Verified live: Ukraine (elevated→high fresh), Iran (high→elevated 19d ago), China (honest-empty). No LLM; honest-empty when stable.
> - **Phase 1b — ✅ SHIPPED + DEPLOYED** (`1f86e46`). `newsDriftCorrector` Lambda (grounded "↳ Because: <cited event>" notes, daily `TriggerDriftCorrector` cron; DeepSeek; gate→ground→note, never overwrites) + `country_history` serves `driftNotes[]` + `CountryWhatChanged` renders them. First prod run: grounded notes for Ukraine/US/Russia/Japan/France; honest no-note for Iran/China.
> - **Phase 1b.5 (feed-forward) — ✅ SHIPPED + DEPLOYED.** `newsCountryIntelligence` reads the last 2 `DRIFT#` notes as a low-authority "RECENT CORRECTIONS" block → the next read builds on its own grounded corrections. Safe by construction (try/caught → graceful no-block). Loop closed.
> - Decisions below.
>
> **Decisions 2026-07-01:**
> - Corrector = a **dedicated `newsDriftCorrector` Lambda** (keeps the analyzer clean; matches the new-infra-is-easy preference).
> - **Model = DeepSeek** (same family as the analyzer). Reconciled with the family-bias rule in non-negotiable #4: the corrector grounds a causal explanation in a real event (generation), it does not judge the analyzer's prose (which is where family-bias bites). Different-family stays reserved for a future quality-judge.
> - **Defer the `HISTORY#` narrative-snapshot extension.** The scalar `HISTORY#` (risk/trajectory/headline) + the archive is enough to ground "why did risk move" → **no `newsCountryIntelligence` change** (one fewer prod deploy).
> - **Deploy footprint for 1b:** new `newsDriftCorrector` Lambda (+ IAM role + EventBridge schedule ~07:20 UTC) + `newsSensitiveData` `country_history` serve update + frontend. The corrector→analyzer **feed-forward** (country-intel reads drift notes into its prompt) is a follow-up (1b.5).
> - **Sequencing: build → prove locally against live data (borrow a key, real archive+history via the proxy) → show real grounded notes → deploy only if good.** Prove-before-ship.

**Phase 1a — "What changed" from the history we already log (frontend-only, deterministic, no LLM).**
- We *already* serve `country_history` (dated risk level/score/trajectory/headline). Compute the drift **deterministically** client-side: risk-level flips, |Δscore|≥8, trajectory/headline shifts between the last two materially-different snapshots.
- Render a **"What changed since <date>"** card on `CountryPage`; revive the dead-but-tested `RiskDeltaPill`. Honest-empty when no prior / no material change.
- Zero backend change, zero prod risk, demoable immediately — proves the "living / what-changed" value before we build the corrector.

**Phase 1b — the grounded corrector loop (one surface, end to end).**
- Extend `newsCountryIntelligence` `HISTORY#` to snapshot the **narrative body** (not just scalars) — gives the corrector something to compare against.
- Add a **corrector step** (in-Lambda or a small sibling, different family): compare today's read to the last *materially-different* snapshot; deterministic pre-filter on risk/trajectory; if it moved, write a **`DRIFT#<date>`** note grounded in the triggering event.
- Serve the note (`country_history` already serves `HISTORY#`; add drift notes) → **"What changed since <date>" card on `CountryPage`** (revive the dead-but-tested `RiskDeltaPill` as the first pixel).
- **Feed-forward:** `newsCountryIntelligence` reads recent drift notes into its prompt (plug into the existing `loadThreadAnalyses` seam) so the next read *knows* it corrected itself.
- Ships the full corrector→note→analyzer loop on **one** surface. Small, real, demoable.

**Phase 2 — harden the gate.** Replace the deterministic pre-filter's blunt edges with the small different-family judge ("did the conclusion move?"); retrofit onto `newsSystemsAnalysis` (kills its unconditional re-spend).

**Phase 3 — threads + systems.** Give them the `DRIFT#` note + feed-forward; causal-web shows "these edges/actors are new since <date>."

**Phase 4 — predictions as a drift source.** The resolver's fired/not-fired verdict is a *high-value* drift signal ("a counter-event undercut this thesis"). Wire resolver verdicts into drift notes → closes the loop with the (deferred) track record.

---

## Risks / failure modes
- **Reflection-loop instability** (corrector confidently wrong, or analyzer→corrector→analyzer compounding a bad turn). Anchor: the corrector can't *invent* drift — it must point at a dated, cited event; human checkpoint on conclusion-flips.
- **The gate is the whole game** — too loose = thrash + cost; too tight = misses real change. Tune on real country data (the backtest set), not the demo.
- **Doesn't fix coverage** (`PITCH.md` gap #3) — a differentiator layer on top, not a corpus substitute.
- **Storage:** drift notes + narrative snapshots grow the table; bound with TTL (30–60d); predictions stay immutable/no-TTL.

---

## Phase 1 — concrete task list
1. `newsCountryIntelligence`: add `situationSummary` (+ key developments) to the `HISTORY#<date>` item.
2. Corrector: deterministic pre-filter (riskLevel flip OR |Δscore|≥8 OR trajectory shift) → on hit, a small grounded LLM call → write `COUNTRY#{name}/DRIFT#<date>` (cited triggering event, from→to, confidence delta).
3. `newsCountryIntelligence`: load recent `DRIFT#` notes into the generation prompt (feed-forward via the `loadThreadAnalyses` seam).
4. `newsSensitiveData` `country_history`: return drift notes (payload-cap N days).
5. Frontend: `useCountryDrift(country)` + **"What changed since <date>"** card on `CountryPage`; mount `RiskDeltaPill`.
6. Honesty: honest-empty when no prior/no material change; label the revised read 💭; every note cites its triggering event.
