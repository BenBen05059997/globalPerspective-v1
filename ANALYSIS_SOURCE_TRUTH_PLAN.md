# Analysis — Source-Truth Layer (the missing check)

**Status:** PLANNED 2026-06-13, from external reviewer feedback. This is the gap the
reviewer called "the thing worth fixing first, above all." It's also the **original ask**
at the start of this whole arc: *"a review agent to review if it is true or not."*

## The gap (stated precisely)

Both checks we built verify **faithfulness to the source** (validator: no phantom cites /
invented figures / dates; auditor: does any claim contradict the provided material). **Neither
checks whether the source itself is TRUE or correctly characterized.** Consequences the reviewer
demonstrated:
- A thin/rumor/satirical source → the engine produces sophisticated, well-cited,
  fabrication-free reasoning **on a rotten premise**, and our quality layer rates it highly.
- The SpaceX example reasoned about a "mission-driven space company" — but by 2026 SpaceX had
  absorbed xAI/X (a ~$6.4bn AI operating loss, ~94x-revenue pricing). The engine built a clean
  thesis on an **incomplete characterization** because the summary was thin. Faithful, but wrong.
- The engine also injects **external world-facts** ("China ~80% of tungsten processing",
  "~20% of oil through Hormuz") it cannot verify — true-ish here, but unverified by us.

Faithfulness ≠ truth. Right now we have **zero coverage** on truth.

## Layers (cheapest/highest-leverage first)

**L1 — Source robustness (buildable now; data already exists).**
Every topic carries `sources[]` with `{tier: primary|secondary, outletType, source, url}`. Compute
a robustness signal per selected story: # sources, # distinct outlets, # primary-tier, single-source?
recency. Surface it in the Studio banner and gate confidence: a **single low-tier source = "unverified
— treat as unconfirmed"**; multi-outlet primary = "well-sourced". This directly addresses thin/rumor
premises without any new model call. (Mirrors the breaking-alerts significance/novelty scorer.)

**L2 — Surface the auditor faithfulness flag in the LIVE Studio.**
The cross-model auditor already catches invented/external claims (gold-mining, Starlink-chokepoint,
tungsten %) that the deterministic validator can't. Today it runs only in `check.mjs`/benchmark, not
in the live BYOK Studio. Add an optional second pass in the Studio (one extra call on the user's key)
that renders a "Claims to verify" list under the analysis. Honest, and it's the layer catching the
real fabrications.

**L3 — Claim-truth verification (deep).**
For load-bearing external facts and the source premise itself, cross-check against **multiple
independent** retrieved sources (this is exactly what Deep-research mode already does — extend it to
emit a "verified against N independent outlets / unconfirmed" tag per key claim), or against an
**operator-verified fact layer** for load-bearing facts ([[feedback-editorial-fact-layer]] — we
already maintain operator JSON for leaders/conflict dates; extend the pattern). Rumor/satire
detection: flag stories whose only sourcing is social/opinion/low-tier.

**L4 — Characterization completeness (hardest).**
The SpaceX/xAI case: the summary was *incomplete*, not false. Mitigations: richer multi-source
ingestion at pipeline time; a "this analysis is only as complete as the summary it was given"
disclosure; and a deep-mode pass that asks "what material context about this entity is missing?"

## Sequencing & decision

1. **L1 source-robustness** — build now (data exists, no model cost). Highest leverage per effort.
2. **L2 surface the auditor flag** in the live Studio (small; one extra BYOK call, opt-in).
3. **L3** via Deep-research mode (we have the retrieval path) + extend the operator fact layer.
4. **L4** longer-term, pipeline-side.

**Hard principle ([[feedback-no-misinformation-fallback]]):** on an intelligence product, confident
analysis on an unverified premise is the most damaging failure. Source-truth is a *precondition*
for trusting the analysis, not a nice-to-have — the banner should lead with source robustness, and a
single-source/rumor story should visibly downgrade the whole analysis's confidence.

## Not changing
The deterministic validator and the faithfulness auditor stay — they cover a different (real) failure
mode (fabrication/laundering). Source-truth is **added alongside**, not instead.
