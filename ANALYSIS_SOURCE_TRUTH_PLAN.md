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

## How other developers do it (researched 2026-06-13)

The field has a precise name for our gap. **Groundedness vs factuality** ([Azure AI Content
Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/concepts/groundedness)):
*"a response may be grounded but incorrect if the source itself is wrong or misinterpreted."* Our
two checks measure **groundedness**; the missing layer is **factuality**. The standard ways
products close it:

1. **Source-credibility scoring.** Rate the *outlet*, not just count it.
   [NewsGuard](https://www.newsguardtech.com/solutions/news-reliability-ratings/) scores domains on
   9 journalistic criteria → 0–100, **≥60 = trustworthy ("green"), <60 = "proceed with caution"
   ("red")**; [Media Bias/Fact Check](https://mediabiasfactcheck.com/newsguard/) is the open
   analogue. → our **L1**.
2. **Cross-source corroboration.** Treat a claim carried by **multiple independent** outlets as
   stronger than a single-source claim; single-source / social-only ⇒ low confidence. Standard
   misinformation signal. → our **L1 / L3**.
3. **Automated claim-verification pipeline** ([survey](https://www.arxiv.org/pdf/2601.02574),
   [ClaimCheck](https://arxiv.org/abs/2510.01226)): **claim extraction → evidence retrieval →
   verdict (supported / refuted / unverifiable) → explanation**; ClaimCheck = query-plan → retrieve
   → synthesize → re-retrieve → verdict. → our **L3** (we already have the retrieval path in
   Deep-research mode).
4. **Reflection / verify-before-answer** (Self-RAG reflection markers; Azure *groundedness
   detection* as a shipped API): the model/critic flags claims needing verification. → our **L2**
   (surface the auditor in the live Studio). The literature's line: *users of knowledge apps care
   more about **verifiability** than raw correctness — ground before production.*

Takeaway: our layered plan matches the field. L1 = source-credibility + corroboration; L2 =
groundedness/reflection surfacing; L3 = the claim-verification pipeline; L4 = characterization.
We don't need to invent anything — just implement the known patterns at our scale.

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
