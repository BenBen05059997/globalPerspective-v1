# Event Dossier — the AI-legible export contract

**Date:** 2026-07-01
**Purpose:** Define the object we hand an AI when it analyzes an event in our causal web — so the AI *understands* what we have (structure + semantics + provenance) and reasons over the *right slice* (not the whole graph). One contract, consumed by both our own Analysis Studio and a customer's bring-your-own model / the signal API.
**Companion to:** `SPIDER_BUILD_SPEC.md` (the graph data contract), `SPIDER_WEB_MODEL_PLAN.md` (backbone-vs-overlay model), `project_analyst_tool_direction` (reasoning architecture).

---

## Part 1 — The profile: how to do it

### 1.1 What makes a dataset "understandable" to an AI
Three things, in order. Miss any one and the model half-guesses:
1. **Explicit structure** — a typed schema the model is *told* about (nodes, edges, fields), not raw records shaped for a UI.
2. **Explicit semantics + provenance** — what each field *means*, and for every claim, *where it came from*: ✅ sourced / 🌐 externally-sourced / 💭 model judgment. This is the one thing that lets an AI keep **fact separate from inference** — our whole differentiator. If provenance is only a colored dot in the UI, the AI can't use it.
3. **Grounding rules** — an instruction contract: "reason over this subgraph, cite our entries, label anything beyond them as 💭 judgment." (Our "structure the skeleton, free-form the flesh" decision, enforced.)

### 1.2 The assembly pipeline (retrieval, not dump)
An event dossier is **built per focal event on request**, not stored. Pipeline:
```
focal event  →  expand k hops on the graph  →  attach genesis + source snippets  →  tag provenance  →  serialize
  (1 node)       (backbone + causal edges)      (per node: timeline + cited text)     (per claim)       (JSON)
```
- **k = 1–2 hops.** 1 hop for a tight read, 2 for context. Never the whole graph — irrelevant *and* blows the context budget.
- Attach, per node in the subgraph: its **genesis timeline** (`narrative_thread`) and the **source-entry text** the edges cite (so the model can quote/ground, not hallucinate).
- Tag provenance at the claim level (see 1.4).

### 1.3 Range / scope policy (grounded in current config)
What we build today in `newsSystemsAnalysis`: **rolling 30-day window** (`ARCHIVE_DAYS=30`), **per country**, ≤15 threads/country, ≤3 edges/node, graph kept 14 days (TTL), **1 live country (Iran)**.
So the dossier's analysis range is bounded by three levers — state them *in the dossier* so the AI knows its own limits:
| Lever | Today | Widens with |
|---|---|---|
| **Time window** | rolling 30 days | longer archive retention (multi-month arcs) |
| **Breadth** | 1 country (Iran) | more countries + the world/situation tier |
| **Subgraph size** | focal + 1–2 hop (~5–20 nodes) | the model's context budget (why we retrieve, not dump) |

### 1.4 Provenance & confidence model (the honest core)
- **Node facts** (headline, actors, category, time span) = ✅ **sourced** (from archive entries).
- **Node summary** = 🌐/✅ **grounded synthesis** of the cited entries (LLM-written but traceable).
- **Backbone edge** (shared_actor / temporal_sequence / narrative_continuation) = ✅ **sourced** — mechanical, auditable. *(Not generated yet — see `SPIDER_BUILD_SPEC.md`.)*
- **Causal edge** (direction + lag + mechanism) = 💭 **model judgment**, *backed by* ✅ cited co-occurring entries. A judgment *about* sourced facts — never dressed as fact.
- **Confidence = ordinal** (weak / medium / strong) + evidence count. **Never a fabricated %.**
- **Defects are surfaced, not hidden.** A negative-lag edge (effect peaked before cause) is flagged `temporal_anomaly: true` and downgraded from "caused" to "co-movement / possibly related." A tautological edge (same event across two near-dup nodes) is flagged. The AI must be *told* about these so it doesn't launder a data artifact into a confident claim.

### 1.5 What NOT to do (failure modes)
- ❌ Dump the whole graph → irrelevant + over-budget. Retrieve the focal neighborhood.
- ❌ Strip provenance → the AI can't separate fact from inference; our edge over ChatGPT evaporates.
- ❌ Present a negative-lag/tautological edge as clean causation → misinformation ([[feedback_no_misinformation_fallback]]).
- ❌ Let the model invent nodes/edges/citations → schema + grounding contract forbids it.
- ❌ Hide coverage limits → the AI (and the analyst) must know it's 1 country / 30 days / Western-RSS corpus.

---

## Part 2 — The contract (schema)

```jsonc
{
  "dossier_version": "1",
  "focal_event": "<threadId>",
  "scope": {
    "country": "Iran",
    "window_days": 30,
    "as_of": "2026-06-30",
    "hop_depth": 1,
    "coverage_caveat": "single country; rolling 30 days; Western-RSS-weighted corpus"
  },
  "nodes": [
    {
      "id": "<threadId>",
      "headline": "<string>",              // ✅ sourced
      "summary": "<string>",               // 🌐 grounded synthesis
      "category": "conflict|energy|econ|diplo|politics|other",
      "actors": ["United States","Iran","Strait of Hormuz"],  // BUILD (SPIDER_BUILD_SPEC)
      "location": "<string|null>",
      "time": { "start": "YYYY-MM-DD", "peak": "YYYY-MM-DD", "latest": "YYYY-MM-DD" },
      "importance": 1,                     // 1..5 (derive: edge degree until real metric)
      "source_robustness": "<string|null>",
      "genesis": [                          // ✅ sourced — from narrative_thread
        { "date": "YYYY-MM-DD", "event": "<string>", "sources": 10 }
      ],
      "provenance": "sourced"
    }
  ],
  "edges": [
    {
      "from": "<threadId>", "to": "<threadId>",
      "class": "backbone|causal",
      "relation": "shared_actor|temporal_sequence|narrative_continuation|inferred_influence",
      "mechanism": "<string>",             // 💭 judgment (causal) — the transmission channel
      "lag_days": 3,
      "confidence": "weak|medium|strong",
      "provenance": "judgment",            // causal=judgment, backbone=sourced
      "citations": [                        // the ✅ sourced entries this rests on
        { "title": "<headline>", "date": "YYYY-MM-DD", "entry_id": "<...>" }
      ],
      "flags": { "temporal_anomaly": false, "tautology": false }
    }
  ],
  "reasoning_contract": {
    "instructions": "Reason ONLY over this subgraph + cited sources. Cite entry titles for any factual claim. Label anything beyond the sources as '💭 judgment'. Treat confidence as ordinal, never invent a %. Edges flagged temporal_anomaly are co-movement, NOT proven causation — do not assert direction.",
    "provenance_legend": { "sourced": "from our archive", "external": "model web-fetch, cite URL", "judgment": "labeled interpretation, uncited" }
  }
}
```

---

## Part 3 — Worked example (REAL live data, Iran, generated 2026-06-30)

Focal event = the most-connected node: **"Iran closes Strait of Hormuz after Israeli strikes on Lebanon."** Its real 1-hop neighborhood — note **two edges are negative-lag** (the "effect" peaked *before* this node), which the dossier must surface honestly.

```jsonc
{
  "dossier_version": "1",
  "focal_event": "thread-us-and-iran-exchange-strikes-i-19ebab",
  "scope": { "country": "Iran", "window_days": 30, "as_of": "2026-06-30", "hop_depth": 1,
             "coverage_caveat": "single country; rolling 30 days; Western-RSS-weighted corpus" },
  "nodes": [
    { "id": "thread-us-and-iran-exchange-strikes-i-19ebab", "category": "conflict",
      "headline": "Iran closes Strait of Hormuz after Israeli strikes on Lebanon",
      "summary": "Iran closes the Strait of Hormuz after Israeli strikes on Lebanon, conditioning reopening on a Lebanon ceasefire and oil waivers.",
      "time": { "peak": "2026-06-21" }, "importance": 4,
      "actors": ["Iran","Israel","United States","Strait of Hormuz","Lebanon"],   // ← BUILD (not in data yet)
      "genesis": "«attach from narrative_thread»", "provenance": "sourced" },
    { "id": "thread-iran-launches-missiles-at-isra-d0e797", "category": "conflict",
      "headline": "Iran launches missiles at Israel in first direct attack since April ceasefire",
      "time": { "peak": "2026-06-08" }, "provenance": "sourced" },
    { "id": "thread-oil-prices-fall-to-three-month-15c0bd", "category": "energy",
      "headline": "Oil prices fall to three-month low as Strait of Hormuz traffic resumes",
      "time": { "peak": "2026-06-17" }, "provenance": "sourced" },
    { "id": "thread-iran-war-jeopardizes-global-fo-9db897", "category": "econ",
      "headline": "Iran war jeopardizes global food security as Hormuz blockade disrupts grain",
      "time": { "peak": "2026-06-06" }, "provenance": "sourced" },
    { "id": "thread-trump-says-iran-shot-down-us-a-7ed4a3", "category": "diplo",
      "headline": "US and Iran agree to stand down and hold technical talks in Qatar",
      "time": { "peak": "2026-06-26" }, "provenance": "sourced" }
  ],
  "edges": [
    { "from": "thread-iran-launches-missiles-at-isra-d0e797", "to": "thread-us-and-iran-exchange-strikes-i-19ebab",
      "class": "causal", "relation": "inferred_influence", "lag_days": 13, "confidence": "medium", "provenance": "judgment",
      "mechanism": "Iran's direct missile attack on Israel escalates the conflict, leading to Israeli strikes on Lebanon and the subsequent Hormuz closure.",
      "flags": { "temporal_anomaly": false } },
    { "from": "thread-us-and-iran-exchange-strikes-i-19ebab", "to": "thread-oil-prices-fall-to-three-month-15c0bd",
      "class": "causal", "relation": "inferred_influence", "lag_days": -4, "confidence": "strong", "provenance": "judgment",
      "mechanism": "Hormuz closure drove oil up; the agreement to resume traffic then drove prices down.",
      "flags": { "temporal_anomaly": true },
      "_note": "lag −4 → effect peaked BEFORE cause. Present as co-movement, NOT proven direction." },
    { "from": "thread-us-and-iran-exchange-strikes-i-19ebab", "to": "thread-iran-war-jeopardizes-global-fo-9db897",
      "class": "causal", "relation": "inferred_influence", "lag_days": -15, "confidence": "medium", "provenance": "judgment",
      "mechanism": "Hormuz blockade disrupts grain shipments, threatening global food security.",
      "flags": { "temporal_anomaly": true } },
    { "from": "thread-us-and-iran-exchange-strikes-i-19ebab", "to": "thread-trump-says-iran-shot-down-us-a-7ed4a3",
      "class": "causal", "relation": "inferred_influence", "lag_days": 5, "confidence": "medium", "provenance": "judgment",
      "mechanism": "The exchange of strikes and Hormuz closure lead US and Iran to stand down and hold talks in Qatar.",
      "flags": { "temporal_anomaly": false } }
  ],
  "backbone": [],   // ← EMPTY today: no shared-actor/co-occurrence edges generated yet
  "reasoning_contract": { "instructions": "…as in Part 2…" }
}
```

**What this example teaches:**
- The dossier is *real and useful* — an AI can see the Hormuz event sits between a missile-escalation cause and oil/food/diplomacy effects, with the transmission mechanism spelled out and each edge cited.
- It is *honest* — 2 of 4 edges are temporal anomalies; the dossier flags them so the AI reports "co-movement" not "X caused Y." Without this, an AI would confidently launder a data artifact.
- The **gaps are visible**: `actors[]` and the whole `backbone` array are empty until the `newsSystemsAnalysis` unlock. Right now an AI would reason over the *causal overlay only* — exactly the least-reliable layer — which is why the backbone build matters most.

---

## Part 4 — Build state & sequencing
| Piece | State |
|---|---|
| Nodes (id, headline, summary, category, peak) | ✅ HAVE |
| Causal edges (mechanism, lag, confidence, citations) | ✅ HAVE |
| Genesis attach (`narrative_thread`) | ✅ HAVE |
| Provenance tags + anomaly/tautology flags | 🟡 DERIVE (compute at assembly; anomaly = lag<0 already known) |
| k-hop retrieval + serialization (the dossier builder) | 🔴 BUILD (small, deterministic; no LLM) |
| `actors[]` + `class` + backbone edges | 🔴 BUILD — the gating unlock (`SPIDER_BUILD_SPEC.md`) |
| Source-snippet attach for citations | 🟡 DERIVE (citedEntries are `headline-N` → fuzzy title-match to archive text) |

**Recommended order:** (1) build the deterministic dossier builder over *today's* data (nodes + causal edges + genesis + provenance/anomaly flags) — this is shippable now and makes the graph AI-consumable immediately, honestly labeled with an empty backbone; (2) then the `actors[] + class` backbone unlock, which upgrades the dossier from "causal-overlay-only" to a full reliable-backbone-plus-overlay object and unblocks cross-event/world-tier reasoning.

## Open questions
- Serving path: a new `event_dossier` proxy action vs. folding into the signal API export? (Lean: one `event_dossier` action, reused by both.)
- Hop depth default (1 vs 2) and node cap for context budget.
- Do we attach full source text or a snippet + link? (Budget vs. groundability.)
