# Spider Web — Data Model Redesign Plan

**Date:** 2026-06-29
**Status:** BUILD-READY (gated by discovery). Model flip + defensible-edge rules evidence-grounded; overlay formalism + visualization decided from established practice (verification harness rate-limited on those two angles — see caveat at end).
**Why this exists:** the live `/spider-demo` prototype came out sparse, with disconnected dots, temporal-anomaly edges, and an unreadable layout. A research pass into how serious event systems actually model "connected information" showed our *backbone* is built on the least-reliable primitive. This plan flips the model. Supersedes the "causal-first spider" framing in `ANALYST_TOOL_DIRECTION.md` / `ENTERPRISE_ANALYST_TOOL_PLAN.md`.

---

## The finding that forced this (verified, 2026-06-29)

The major event-data systems deliberately **do NOT machine-assert event-to-event causality:**
- **GDELT's Global Knowledge Graph is a *co-occurrence* network** — links entities/events that appear together in news; its own docs say co-mentions "are not necessarily causal" and it records only positional proximity, "not allowing for deeper semantic association."
- **The atomic unit (GDELT + ICEWS) is the CAMEO actor-action-actor triple** — *who did what to whom* + time/location/severity/tone/importance. Causal linkage is left out of the core schema **on purpose.**
- **News-derived event data is noisy** — false positives + duplicates ("largely impossible to identify true vs noise"), gross mis-coding (weather warning → aerial attack; Iran "war of words" → 25 nuclear-level conflicts in DC), and order-of-magnitude disagreement on what even counts as an event (ACLED 6,739 vs UCDP 28 Mexican civilian deaths, 2021).

**Implication:** our spider made *automated causation* its backbone — exactly the part the field treats as too unreliable to automate. That is why it's sparse (causal links are genuinely rare + a coding choice), wrong (causal/temporal extraction is brittle), and unreadable.

---

## The decision: FLIP the model

**Backbone = the reliable thing. Causation = a sparse, hedged overlay.**

| Layer | Edges = | Density | Confidence | Provenance state |
|---|---|---|---|---|
| **Backbone (new)** | shared actors · shared entities · location · **temporal sequence / same-narrative continuation** | dense — a real web | high, mechanical, auditable | ✅ sourced |
| **Overlay (current backbone, demoted)** | "A may have *triggered* B" + mechanism + lag | sparse | low, model-inferred | 💭 judgment, human-reviewable |

This single flip fixes all four prototype problems at once:
- **Dense + reads as a web** — Iran threads share actors (US, Israel, Trump, Hormuz) constantly; co-occurrence is genuinely connected.
- **No more "temporal anomalies"** — a co-occurrence/temporal backbone is not a DAG, so feedback loops & co-movement are *expected*, not violations.
- **Defensible** — "connected via shared actor X / same story" is true and auditable; causation stays clearly-marked judgment (the fact-vs-judgment separation we already committed to).
- **Matches analyst trust** — the field abandoned auto-causation for good reason; analysts distrust a tool that confidently draws "A caused B" everywhere.

---

## Node / edge schema (DECIDED in shape; field names TBD)

**Node = a story thread**, carrying (adopt the CAMEO-style structure):
- actors/entities involved, primary location, time span (start → peak → latest), category, importance/severity, source robustness.

**Backbone edges (reliable, dense):**
- `shared_actor` / `shared_entity` (weight = # shared), `co_location`, `temporal_sequence` (B follows A in the same actor/topic space), `narrative_continuation` (existing `threadId`/`continues_topic` linkage).

**Overlay edges (sparse, hedged):**
- `inferred_influence` — direction + lag + mechanism + confidence + citations + 💭 judgment label. NOT shown by default; a toggle/lens.

> What we already have: threads, regions, `continues_topic`, `threadId`, sources. **Likely gap:** per-thread actor/entity extraction (the CAMEO "who") — needs checking against the ingest pipeline.

---

## Accuracy ceiling + defensible-edge rules (VERIFIED 2026-06-29, run `wbu7puef2`)

Automated causal extraction from news is genuinely unreliable — this is the evidence behind demoting it to an overlay:
- Causal extraction **F1 ≈ 0.14–0.32** on news; MAVEN-ERE supervised causal F1 **31.6** vs temporal **55.8**; GPT-3.5 **5.3 causal F1**. No reliable off-the-shelf extractor.
- **Causal is ~2× harder than temporal** — even humans agree less (causal 0.64 vs temporal 0.74–0.77).
- **Detecting *that* causality exists (F1 86%) ≫ *what causes what* (F1 54%).**
- LLMs show **causal hallucination, post-hoc fallacy (temporal precedence ≠ causation), order-of-mention bias.**
- Explicit causal links are **rare in news** (117 explicit vs 2,265 looser "explanatory" in EventStoryLine) → a sparse causal overlay is *honest*, not a failure.

**DEFENSIBLE-EDGE RULE-SET (encode this):** an overlay causal edge is promoted from "possible" → "defensible" only with **temporal precedence + an explicit textual causal signal + external corroboration (≥1 independent source) + human sign-off.** Anything short of that renders as "possibly related," never "caused." Reference benchmark for any extraction component = **MAVEN-ERE**.

## Overlay formalism (DECIDED from established practice; research throttled but textbook)

- **NOT a Pearl DAG.** Use a **directed, signed, weighted graph that ALLOWS cycles** — a Causal-Loop-Diagram-style "influence" layer (edges marked amplifies/dampens, feedback loops permitted). We don't need do-calculus (no intervention inference) or FCM simulation (no dynamics).
- **Allowing cycles eliminates the "temporal anomaly" problem by definition** — feedback is expected.
- **Confidence = ordinal (weak/medium/strong) backed by an evidence count**, NOT a fabricated probability (matches [[feedback_no_misinformation_fallback]]; the one numeric recipe the field proposed did not hold up).

## Visualization (DECIDED from established HCI practice; research throttled)

**The single highest-leverage change: stop rendering the whole graph as a force-directed hairball.** Established practice (and how Palantir Gotham / IBM i2 actually work) = analyst-driven **focus+context**:
- Default to an **ego-network around one focal thread** and/or a **timeline-anchored layout** (left→right = time — suits our reliable temporal signal and shows genesis).
- **Causal overlay OFF by default**; expand-on-demand; filter/lens by actor / time / severity / layer.
- This one change fixes the "scattered dots" feel more than anything else.

> Research caveat: the formalism + visualization conclusions are reasoned from established/textbook practice — the verification harness rate-limited on both angles across two passes, so they are NOT independently verified here. The accuracy/defensible-edge section IS verified (peer-reviewed/arXiv).

---

## Sequencing (where this sits in the bigger plan)

- This is a refinement of the **causal-web core** (Phase 2 of `ENTERPRISE_ANALYST_TOOL_PLAN.md`) + the prototype.
- **Still gated by discovery** — don't rebuild before the analyst conversations confirm the wedge. The flip makes the *eventual* build right; it does not change the rule that validation comes first.
- Cheap interim: the prototype's "labels = category" and foregrounded-anomaly issues can be fixed independently to make `/spider-demo` demo-safe (see prior review).

---

## The one-line takeaway

We were building the hardest, least-reliable web (automated causation). Flip it: build the *reliable* web (who/where/when/same-story) as the backbone, and offer causation as a clearly-labeled, sparse, human-checkable overlay. That is both more honest and what makes it actually look and feel like a web.
