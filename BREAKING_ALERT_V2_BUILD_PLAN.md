# Breaking-Alert v2 — Build Plan

The execution plan for the re-scored, standards-grounded breaking-alert system. Derived from
`SCORING_RUBRIC.md` §7 (panel-revised plan) + §9 (professional frameworks) and the
`BREAKING_ALERT_DEBATE_2026-06-24.md` findings.

**Three governing principles (from the panel + research):**
1. **Ship the safe deterministic cure now; gate all weight-tuning on a labeled gold set.** The
   7-story result is anecdote, not evaluation — never tune constants blind.
2. **Copy battle-tested frameworks, don't invent.** Each scoring axis maps to a standard
   (Goldstein, ICRG, news values, Admiralty, CAP, ICD-203).
3. **Recall (deterministic) → Precision (LLM verify-agent, shadow-first).** Never hard-suppress
   in the recall layer; corroboration/immediacy/event-state are soft inputs to the judge. Keep a
   deterministic high-confidence bypass so a dead/quota-exhausted judge can't mute a real alert.

---

## Stage 1 — Deterministic scorer fix (NOW · safe · no eval needed)

The one change everyone endorsed shipping immediately — it cures the country-risk-dominance bug
(`SCORING_RUBRIC.md` §2a) without touching anything that needs a labeled set.

**Changes (`newsBreakingAlert/src/significance.js` + `index.js`):**
- **Cap standing country-risk at 50** before normalization, so geography alone can't clear the
  bar. Concretely in `significance.js`: `risk(rs) = clamp01(min(rs, 50) / 100)` (max 0.5).
- **Demote the risk weight 2.0 → 1.0.** Combined effect: country-risk contributes **≤0.5 = 25%**
  of the 2.0 threshold (was 62–88%).
- Leave popularity/breadth/economic/velocity weights + the threshold **unchanged** (no blind
  recalibration). Add a `RISK_CAP = 50` named constant + comment citing this doc.
- Multi-country note: capping makes the `maxRegionRisk` "scariest country wins" contamination
  far less harmful (max possible from any country = 0.5); the proper relationship fix lands in
  Stage 4.

**Verification:** extend `test-significance.mjs` — assert a high-risk-country routine story
(e.g. riskScore 88, 2 sources, 1 topic, no econ) **no longer clears** the threshold; assert a
genuine multi-signal story still does. Run `node test-significance.mjs`.

**Deploy:** user-gated. `update-function-code` on `newsBreakingAlert` (auto-send is live to the
operator only, so blast radius = one inbox). NOT auto-deployed by the build workflow.

---

## Stage 2 — Labeled gold set (the gate for ALL tuning)

50–100 historical stories hand-labeled `alert` / `suppress`. Pull past `proposed` rows +
`today-archive` threads; operator (or an LLM-assisted first pass + human confirm) labels.
Measure **v1 baseline precision/recall** and, later, the verify-agent's false-suppress rate.
Until this exists, weights stay frozen. (Mirrors the prediction-calibration human-confirm pattern.)

---

## Stage 3 — Verify-agent (analytic tradecraft) · SHADOW mode

Wire `verifyStory()` → real **Gemini** call (cross-family vs the DeepSeek producer, like
`newsEconomicQuality`). A thin wrapper that makes the LLM apply established standards:
- **Significance** → Harcup & O'Neill (2017) **news values** checklist (magnitude, conflict,
  surprise, relevance, power-elite, …) — score = hitting several, none dominant.
- **Credibility** → **Admiralty/NATO code** (source reliability A–F × info credibility 1–6).
  Scoop-safe: a single trustworthy source = `A2/B2`, still high. Replaces the rejected ≥2-source
  hard gate.
- **Urgency/severity/certainty** → **CAP** separate axes.
- **Event-state** → REALIZED / WARNING / INTENT / FILING / RESOLVED, but scored as urgency ×
  event-type (an imminent WARNING or load-bearing FILING can be top-urgency — §6 fix).
- **Forecast language** → **ICD-203 / Words of Estimative Probability** bands.
- **Bias** → weigh alternative explanations (Structured Analytic Techniques / ACH).

Output: structured verdict logged **beside every detection, NO veto**. Add a **deterministic
high-confidence bypass** (REALIZED + multi-source + large-econ) that fires even if the judge is
down. Measure false-suppress rate vs the gold set before granting veto.

---

## Stage 4 — GDELT enrichment + ICRG-style country decomposition

- **GDELT ingest** (new Lambda, free 15-min feed): match our editorial threads → GDELT events by
  actors+time+keywords; pull **Goldstein** (event-type magnitude), **actor→actor tone**
  (relationship: cooperation vs conflict — replaces max-country-risk), and **global mention
  velocity** (independent corroboration that boosts rather than gates). Enrichment signal layered
  on threads, not a replacement.
- **ICRG-style decomposition** of `COUNTRY_INTELLIGENCE.riskScore` into sub-components
  (government-stability / internal-conflict / external-conflict / …) so an event maps to the
  **relevant** sub-risk instead of inheriting the whole-country blob.

---

## Stage 5 — Post-gold-set tuning + product

Only after Stage 2 data exists: re-tune weights/threshold from the gold set; switch to
event-level thread-risk (once backfilled); **grant the verify-agent veto**; adopt the **CAP
3-axis schema** for the Signal-API / alert **output** (interoperable with Google Public Alerts).

---

## Dependency order
`Stage 1 (now)` → `Stage 2 (gold set)` gates → `Stage 3 (verify shadow)` + `Stage 4 (GDELT/ICRG)`
in parallel → `Stage 5 (tune + veto + CAP output)`.

Dedupe (1/run, 5-day) + continuation (×1.8) stay **deterministic**, upstream of the judge,
throughout.
