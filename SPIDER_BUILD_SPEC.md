# Spider Build Spec — data contract for the two-tier Causal Web

**Date:** 2026-06-30
**Purpose:** Define exactly what data each view needs, and for every field mark its source:
**HAVE** (emitted today) · **DERIVE** (cheap, deterministic, no LLM) · **BUILD** (new backend/LLM work).
Companion to `SPIDER_WEB_MODEL_PLAN.md` (the *why*) and the two design mockups (the *look*).

Ground truth, verified 2026-06-30 against `newsSystemsAnalysis/src/index.js`:
- **Archive entries carry:** `topicId, threadId, title, date, regions[] (country names), category`. **No actors/entities.**
- **Thread nodes built:** `threadId, category, peakDate, entryCount, title, topicIds[]`.
- **Edges emitted:** `from, to, lagDays, mechanism, confidence(weak|med|strong), citedEntries[]` — **causal only.**
- **Scope:** grouped by `entry.regions` (country); gated to `SYSTEMS_TEST_COUNTRIES` (Argentina, Iran); only **Iran** has live data.

---

## TIER 2 — Country "Causal Web" (build this first)

### Node = story thread
| Field | Source | Notes |
|---|---|---|
| `id` (threadId) | **HAVE** | |
| `headline` | **HAVE** | `title` / thread analysis title |
| `category` → lane + color | **HAVE** | map to app `CATEGORY_DOT` palette |
| `peakDate` → x position | **HAVE** | |
| `importance` 1–5 → radius | **DERIVE** | bucket `entryCount` (+ source count if available) into 1–5 |
| `summary` (panel) | **HAVE** | |
| genesis timeline (panel) | **HAVE** | `narrative_thread` → CompactTimeline |
| scenario (panel) | **HAVE** | `PREDICTION` via repTopicId (topicId-derivation fix already done) |
| `actors[]` | **BUILD** | needed for backbone; see below |
| isolated-ring flag | **DERIVE** | node with 0 edges |

### Backbone edges (solid, always-on, factual) — **the main gap**
| Edge type | Source | Notes |
|---|---|---|
| `narrative_continuation` | **HAVE** | `continues_topic` / shared `threadId` lineage — ship this first; it alone gives a real skeleton |
| `shared_actor` / `shared_entity` | **BUILD** | requires per-thread actor extraction (below); weight = # shared |
| `temporal_sequence` | **DERIVE** (after actors) | B follows A within shared-actor space, ordered by `peakDate` |
| `co_location` | **DERIVE** | weak inside a single country (all share the region) — skip at country tier, useful at world tier |

### Causal overlay edges (dashed, toggle-OFF, model judgment)
| Field | Source |
|---|---|
| `from, to` (direction) | **HAVE** |
| `lagDays` | **HAVE** |
| `mechanism` (panel) | **HAVE** |
| `confidence` weak/med/strong → line weight | **HAVE** |
| `citedEntries[]` → citations (panel) | **HAVE** (needs title-match, already handled by parseCitation) |
| temporal-anomaly flag (lagDays<0) | **DERIVE** (already done in prototype) |

### Chrome
| Element | Source |
|---|---|
| coverage-volume ribbon | **DERIVE** — count entries per day across the window |
| time axis + "as of" marker | **DERIVE** — from entry date range |
| lane legend / category filter | **HAVE** |
| honesty footer | static |

**→ Country tier is buildable now at ~70%:** everything except `shared_actor` backbone. Ship with
`narrative_continuation` backbone + causal overlay; show the actor-backbone toggle as "not yet generated" until actor extraction lands.

---

## TIER 1 — "World Causal Overview" (mostly BUILD)

### Node = situation (cluster of threads in a place)
| Field | Source | Notes |
|---|---|---|
| situation cluster | **BUILD** | group threads → situations (by region + dominant actor/topic, or LLM cluster). No situation concept exists today. |
| `region` lane (ME/EU/AS/AM/AF/GL) | **DERIVE** | country→region lookup table over `entry.regions` |
| `threadCount` → size + number inside | **DERIVE** (once clusters exist) | |
| `trend` ▲ escalating / ▼ easing / ■ steady | **DERIVE** | coverage volume recent window vs prior |
| `affects[regions]` → halo + badge | **DERIVE** | thread/situation whose `entry.regions[]` spans multiple regions — multi-region is already in the data |
| top threads / scenario (panel) | **HAVE** (per thread) | aggregate to situation |
| drill → country web | wire navigation | |

### World-tier edges
| Edge type | Source |
|---|---|
| cross-situation backbone (shared actor across regions) | **BUILD** — depends on actor extraction |
| cross-situation causal | **BUILD** — analysis is per-country today; no cross-region causal pass |

**→ World tier is NOT feedable yet:** needs the situation layer + actor extraction + cross-region pass + coverage beyond 1 country. Gated by the analyst-discovery conversations per the plan; do **not** fake it with placeholder data.

> ✅ **SUPERSEDED — World tier SHIPPED 2026-07-01, enhanced 2026-07-05.** The blockers above were all resolved: `actors[]` + `class` landed in `newsSystemsAnalysis` (2026-07-01), coverage widened to **12 countries**, and the "situation layer" was satisfied *deterministically* — the `world_overview` proxy action derives one situation per country from its SYSTEMS# graph (threadCount, earliest/peak/latest from node peakDates, topCategory) + cross-country `links` from shared node actors (ambient-actor exclusion, df < 40% of countries), no LLM clustering needed. **Enriched 2026-07-05:** each situation also carries `riskLevel`/`riskScore` (from `COUNTRY_INTELLIGENCE`) + `latestDrift` (newest `DRIFT#` note) — additive/best-effort — feeding risk-tier bubble fill + "read changed this week" badges. Rendered by `SpiderWorld.jsx` (region lanes fit-to-height, month fit-to-width, clickable shared-actor links, `?view=`/`?country=` URL state). The `trend ▲/▼/■` and `affects[]` halo fields spec'd above were NOT built (cut as non-essential). Cross-situation *causal* edges remain unbuilt — world links are backbone-class (shared-actor) only.

---

## The new backend pieces (in dependency order)

1. **Per-thread actor/entity extraction** (the CAMEO "who"). Cheapest path: add `actors[]` (canonical entities — countries, leaders, orgs, chokepoints) to each node in the existing `newsSystemsAnalysis` LLM call — same invocation, one extra output field. Unlocks `shared_actor` backbone + `temporal_sequence` + cross-region links. **This is the highest-leverage single addition.**
2. **Backbone-edge computation** — deterministic post-process: emit `shared_actor` (weight=#shared), `narrative_continuation` (have), `temporal_sequence`. No LLM. Add `edges[].class: 'backbone'|'causal'` to the output schema so the frontend can split layers.
3. **Coverage widening** — raise `SYSTEMS_TEST_COUNTRIES` beyond Argentina/Iran once the model is trusted (cost/quality check first).
4. **Situation clustering** (world tier only) — new aggregation; defer until country tier is validated.
5. **Derived signals** — importance bucket, daily coverage counts, trend, region map, affects[] — all cheap, deterministic, no schema change to the LLM.

### Output schema change (minimal)
Add to `newsSystemsAnalysis` node: `"actors": ["United States","Israel","Strait of Hormuz", ...]`.
Add to edges: `"class": "backbone" | "causal"` (causal = existing inferred edges; backbone = new deterministic ones).
Everything else the frontend needs is derivable client-side from data we already serve.

---

## Minimum to ship the country view this week
- Frontend: port the `Causal Web.html` layout into `SpiderDemo.jsx` (timeline + lanes), map `--bg*`→`--paper*`, use `CATEGORY_DOT`, drop duplicate font import.
- Backbone layer: `narrative_continuation` only (HAVE) — honest, real skeleton.
- Overlay: existing causal edges (HAVE).
- Derived chrome: ribbon, axis, importance, isolated rings (DERIVE).
- Backend ask deferred to a follow-up: add `actors[]` + `class` to `newsSystemsAnalysis` to light up the `shared_actor` backbone and unblock the world tier.
  > ✅ **DONE 2026-07-01** — `actors[]` + backbone post-process shipped in `newsSystemsAnalysis`; world tier live (see the SUPERSEDED note in Tier 1 above). Of the numbered backend pieces: #1 ✅, #2 ✅, #3 ✅ (12 countries), #4 ✅ (deterministic per-country situations, not LLM clusters), #5 partially (importance/region ✅; trend/affects[] cut).
