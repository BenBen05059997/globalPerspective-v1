# Enterprise Analyst Tool — Execution Plan

**Date:** 2026-06-26
**Direction doc:** `ANALYST_TOOL_DIRECTION.md` (the *why*). This is the *what + in what order*.
**Product in one line:** an enterprise sense-making tool over a **causal event-web** — it shows an analyst how a story formed, what it's triggering, and what would falsify their thesis, all auditable to source.
**Buyer:** enterprise thesis-*producers* — **consultancies + macro funds first**, gov deferred to phase 2.
**Reality:** solo dev. The plan is **design-partner-led and narrow-then-deep**, not build-everything-then-sell.

---

## Guiding rules (so scope doesn't blow up)

1. **Coverage is the day-one make-or-break.** A demo dies the moment an evaluator types their region and gets junk. Coverage before polish.
2. **Build the shared core first** (causal web + provenance + watchlist + export) — common to all three segments.
3. **Calibration is background instrumentation, not a gate.** Keep logging predictions (already built); publish the Brier asset *later*, for funds.
4. **Don't pre-build compliance** (SSO/SOC 2). Let the first design partner name the hard gates.
5. **Don't lead with doc-drop** — it's commoditized. It's an *entry point into* the web, not the headline.
6. **GTM runs in parallel from day 0**, not after the product is "done."

---

## Reasoning architecture (cross-cutting — decided 2026-06-27)

**Principle: structure the skeleton, free-form the flesh. Constrain on *honesty*, not on the *source* of reasoning.**

- **The skeleton — the causal graph** (nodes/edges/lag/confidence/citations between *our covered events*): **structured, grounded-to-corpus, validated.** A fabricated causal link between two of our own stories is indefensible, and this is the object you actually *draw* and click. Non-negotiable.
- **The flesh — interpretation** (historical analogs, structural drivers, counter-events, the BYO-hypothesis Q&A): **free-form, and ALLOWED to use outside knowledge.** Over-grounding here (forbidding outside knowledge) lobotomizes the exact thing that makes analysis valuable. Don't do it.

**Why not pure free-form for the skeleton:** it can't be drawn as a web, can't be audited, hallucinates, and destroys the provenance/defensibility that is the entire differentiator. Fluent ≠ trustworthy — a free-form demo wows, then the second meeting dies when an analyst checks one claim and can't source it.

**Three provenance states, shown on every claim** (the resolution to "grounding vs. outside reasoning"):
- ✅ **Sourced** — traceable to our archive → cite the entry.
- 🌐 **Externally sourced** — model fetched it via **web search** → cite the URL. (Reuse the Analysis Studio deep-research web path — Perplexity/Anthropic — so "fetch from outside" produces *grounded* external claims, not frozen-memory guesses.)
- 💭 **Analyst judgment / model inference** — labeled as interpretation, uncited.

**Rationale:** the enterprise analyst distrusts judgment *disguised as fact*, not judgment itself. A tool that says "here's what's sourced, here's what's external, here's where I'm reasoning beyond the evidence" is *more* credible than one that fakes citations or refuses to reason. This is the "keep fact separate from judgment" principle (already in the weekly-brief design; how the Economist/ISW work).

> Steel-man noted: "use a stronger frontier model" ≠ "let it run free-form." Use the better model — but still force the structured schema + citation enforcement on the skeleton.

---

## Spider prototype — BUILD NOW (the discovery prop, throwaway)

The best prop for the discovery conversations (the causal web is visual — you can't validate it by talking). **Goal: provoke a real analyst reaction, not ship a product.** Done = demo-ready. **Time-box to days; deletable in one commit.**

**Scope:** one standalone throwaway route (e.g. `/spider-demo`) that does NOT touch the rest of the app.

**Data (no model re-run — use existing stored data):**
- `systems_analysis` proxy action → `{nodes:{threadId,category,peakDate,summary}, edges:{from,to,lagDays,mechanism,confidence,citedEntries}}`. **Iran is the only live country** (Argentina returns empty) — demo on Iran, or the design partner's domain once gated in.
- `narrative_thread` action → genesis/timeline for a clicked node (already powers `CompactTimeline`).

**Reuse:** `useSystemsAnalysis`, `fetchSystemsAnalysis`, `confColor`, `threadPath`, `CompactTimeline` + `narrative_thread`, StoryEntryCard/MechanismCard.

**Build new (the only real work):**
1. **A real node-link diagram (d3-force).** The current `SystemsGraph.jsx` is a *flat CSS list of edges, not a web* — it won't provoke the "oh!" reaction. Nodes colored by `category`, sized by entry count; directed arrows; styling by `confidence`; lag on the edge.
2. **Click a node → genesis** (how the arc formed across days — reuse `CompactTimeline`) + summary.
3. **Click an edge → mechanism + citations** (the provenance/defensibility moment).
4. **A "what could this trigger next / counter-scenario" affordance** off a node, from `PREDICTION` data — labeled 💭 judgment.

**Hand-cleanup pass (curate the ONE demo domain — it's a prop):**
- Suppress/relabel **negative-lag edges** (effect-before-cause — the code permits these by design).
- Merge **duplicate nodes** (the two near-identical ceasefire threads → the tautological "strong" edge).
- Leave isolated nodes isolated (honest — don't force-connect); show confidence.

**⚠️ The one real plumbing risk:** `citedEntries` in production are **headline+index strings** (e.g. `"Iran launches missiles…-0"`), NOT clean topicIds. The click-to-citations panel must **fuzzy-match those strings back to articles by title**. Budget for this.

**Do NOT build:** auth, multi-tenancy, watchlists, export, coverage expansion, any backend/reasoning changes.

---

## Prerequisites — what we're lacking (close BEFORE Phase 1)

Ranked by how badly they block. The two "blocking" items are cheap and de-risk everything.

### Blocking — close before writing serious code

| # | Gap | Why it blocks | Status |
|---|---|---|---|
| P1 | **Validated demand + a real analyst workflow** | The whole plan is design-partner-led; we have 0 partners and an unvalidated wedge. Every build choice (export format, watchlist unit, what the web emphasizes) is a guess until an analyst confirms the pain + shows their workflow. | **Open.** Need 3–5 discovery conversations. Only the founder can do this. |
| P2 | **Proof the causal web is defensible, not plausible noise** | The entire product premise. | **CHECKED 2026-06-27 (Iran, the only live country — Argentina returns empty). Verdict: premise HOLDS but output is prototype-grade, not analyst-grade.** Works: validation layer (no hallucinated IDs), every edge cited, coherent conflict→oil→funding chain, calibrated confidence. Defects an analyst would catch: (a) a **temporally-impossible edge** (lagDays=−4, effect before cause — validation missed it); (b) the one "strong" edge is a **tautology** (same ceasefire event duplicated across two nodes); (c) **upstream dedup leaks duplicate nodes** into the graph; (d) a speculative reach (hackers→war-funding, marked weak); (e) sparse + N=1 — can't judge quality at scale on one gated country. **Implication: the real work is a QC layer (temporal validation, dedup-before-graph, prune tautological/speculative edges), and it can't be assessed until coverage widens.** |

### Build-time gaps — real work, build into them

- **P3 Coverage** — Western-RSS corpus fails on a buyer's domain; no multilingual/regional/structured sources; no coverage measurement. (= Phase 1; overlaps `project_impact_first_redesign`.)
- **P4 Multi-tenancy (under-weighted hidden build)** — the app is a **single-tenant, public, global-content site**. Per-customer watchlists, accounts/seats, workspaces, data scoping = an architectural shift, not a feature.
- **P5 Causal-web QC layer** (new, from P2) — temporal validation, dedup before graphing, edge pruning. Prerequisite to the web being trustworthy at scale.
- **P6 Export/brief generation + BYO-doc RAG** — don't exist yet (= Phase 3).

### Business / operational — needed before MONEY, not before building

- **P7** Enterprise contracting: MSA/DPA, "no-training-on-your-data" doc, B2B annual invoicing (Polar is built for the $15/mo membership, not enterprise contracts).
- **P8** Basic security posture (data-handling one-pager). SOC 2 later.

### Founder / capacity — the honest constraints

- **P9 Bandwidth** — solo dev doing build + enterprise sales + support against 6–18mo cycles. The binding constraint is *founder time*, not features.
- **P10 Domain credibility / network** — selling to fund & consultancy analysts; need warm intros + trust in that world (advisor Mo Batran → Henri intro still pending).
- **P11 Capital** — widening ingest + systems-graph beyond 2 countries costs real LLM + feed money; we've optimized for *cheap* (DeepSeek, free tiers). Need a budget for inference at coverage.

**Recommendation: do NOT start Phase 1 until P1 (discovery conversations) is underway. P2 is done — premise is viable, with a QC layer (P5) now on the critical path.**

---

## Phase 0 — Foundation (week 0–2, mostly decisions + outreach)

| # | Task | Definition of done |
|---|---|---|
| 0.1 | Lock the lead segment for first outreach: **boutique geopolitical/strategy consultancies** (faster value, lower data bar, reachable). Macro funds = fast-follow. | One written ICP + the wedge use-case ("a consultant building a client assessment on <topic> needs the causal web + provenance + counter-events"). |
| 0.2 | Start **design-partner outreach** (warm intros first — incl. advisor Mo Batran). Target 1–3 partners. | ≥1 partner agreeing to a 60–90 day POC, or a committed pipeline of conversations. |
| 0.3 | Pick the **first watchlist domain** from the design partner's actual exposure (e.g. a region/sector they cover). | A concrete list of ~20–40 entities/countries/sectors to make coverage + the web excellent for. |
| 0.4 | Create a working branch off `main` (reuse `signal-api` infra where it helps). | Branch + this plan committed. |

> Phase 0 gates everything: **the design partner's domain defines what "good coverage" and "good causal web" mean.** Don't build the core in a vacuum.

---

## Phase 1 — Coverage credibility (the #1 gate)

Builds on `project_impact_first_redesign` (impact-driven ingest, capture harness already deployed).

| # | Task | Notes / DoD |
|---|---|---|
| 1.1 | Widen ingest beyond Western RSS for the **chosen watchlist domain** (not the whole world): regional + multilingual outlets, structured feeds (GDELT, ACLED, GDACS, filings). | Evaluator types the partner's region → real, current, multi-source results. |
| 1.2 | Make ingest **impact-typed** (the impact-first redesign) so selection isn't vibe-based. | Stories chosen by domain-typed impact, not LLM vibe. |
| 1.3 | **Coverage self-test:** a script that, for the watchlist, reports source count / regions / freshness per entity. | Honest coverage dashboard; flags thin entities (no fabrication). |

**Exit criteria:** for the design partner's domain, coverage is demonstrably broad, current, and multi-source — defensible in a live demo.

---

## Phase 2 — The shared core reasoning surface

The product's actual value. Reuses `newsSystemsAnalysis`, narrative threading, `trace_cause`, `newsSourceAudit`, `SourceRobustness`.

| # | Task | Notes / DoD |
|---|---|---|
| 2.1 | **Causal web:** widen the systems-graph gate beyond `SYSTEMS_TEST_COUNTRIES=Argentina,Iran` to the watchlist domain. Productize `SystemsGraph.jsx` into the enterprise view (nodes/edges, lag, confidence, citations; each node → its arc). | A real causal web for the partner's watchlist, not a 2-country demo. |
| 2.2 | **Genesis / "how the story formed":** package the threaded archive (`threadId` arcs, `newsThreadAnalysis` storyArc/rootCauseChain) as a birth-to-now timeline view. | For any thread: when it started, first signal, how it evolved. |
| 2.3 | **Provenance everywhere:** every claim auditable to a primary source; surface `SourceRobustness` + `newsSourceAudit` status as a first-class trust layer. | One click from any assertion → its source(s) + robustness. |
| 2.4 | **Counter-events / falsification:** for each scenario, surface the counter-scenario + "what would have to be true for the opposite." Wire to existing `PREDICTION` data. | Each thesis view shows outcomes AND counter-events with confidence. |

**Exit criteria:** an analyst can take a watchlist topic and, in the tool, see the causal web + genesis + provenance + counter-events — and trust it because it's sourced.

---

## Phase 3 — Enterprise workflow layer (what gets it *used*)

Insight without integration loses enterprise deals. Extends Analysis Studio (`/analyze`, `AnalysisStudio.jsx`).

| # | Task | Notes / DoD |
|---|---|---|
| 3.1 | **Watchlist model:** customer defines entities/countries/sectors; the causal web, alerts, and counter-events tune to *their* exposures. | Per-customer watchlist persisted; everything scopes to it. |
| 3.2 | **Branded export:** one-click PDF/brief (their logo) an analyst hands upward/to a client — with provenance footnotes. | Export a defensible, branded assessment from any web/thread view. |
| 3.3 | **Delivery:** scheduled briefs to email/Slack on the watchlist; alerting on significant web changes (reuse breaking-alert significance scorer). | Customer gets pushed updates without logging in. |
| 3.4 | **BYO-hypothesis (entry point, not headline):** extend Analysis Studio to accept a dropped doc → RAG over our corpus → place it in the causal web → assisted (not replaced) thesis. | Drop a report → see the web it sits in + related sourced data. |
| 3.5 | **API / MCP endpoint** (reuse `newsSignals` / signal-API branch): let their stack pull the watchlist's web/signals. | Optional machine access for partners who want it. |

**Exit criteria:** the POC partner uses it in their real workflow (exports a real client deliverable / gets real briefs).

---

## Phase 4 — Enterprise trust & multi-tenant (only as partners require)

Do NOT pre-build. Triggered by procurement.

| # | Task | When |
|---|---|---|
| 4.1 | SSO/SAML + multi-seat + RBAC + workspaces (reuse Firebase Auth). | When a partner needs >1 seat. |
| 4.2 | DPA, "no training on your data" guarantee, data-handling doc, basic uptime SLA. | Before any paid contract. |
| 4.3 | SOC 2 (Type I → II). | Only when a deal above mid-market gates on it. |

---

## Phase 5 — Calibration asset + funds expansion (later)

| # | Task | Notes |
|---|---|---|
| 5.1 | Keep `GlobalPerspectivePredictionLog` logging (already on). | Background — the asset accrues silently. |
| 5.2 | When resolved data exists: per-domain Brier + calibration curve, **exportable** as a sales artifact. | The thing funds gate on. |
| 5.3 | Expand GTM to **macro/event-driven funds** (raw point-in-time data + calibration). | Segment 2. |
| 5.4 | Evaluate **gov/policy/defense** (compliance-heavy). | Segment 3, only with references + compliance budget. |

---

## Workstreams running in parallel (not phases)

- **Background instrumentation:** honesty contract + prediction logging — already on, keep on.
- **GTM:** design-partner conversations → POC → reference logo → land-and-expand. Pricing: annual, seat/platform, ~$1k–50k/yr; start with a time-boxed/free 60–90d POC.

---

## What we are explicitly NOT doing (now)

- Not selling to consumers / prosumers (dead WTP).
- Not building for corporate supply-chain *alert-consumers* (excluded — they're not thesis-producers).
- Not leading with doc-drop, not competing with Tavily on generic AI grounding.
- Not building SSO/SOC 2 speculatively.
- Not gating the build on a published calibration score.
- Not widening coverage to "the whole world" — only the design partner's domain.

---

## Critical path (the short version)

**Design partner (0.2) → their domain (0.3) → coverage for that domain (Phase 1) → causal web + provenance + counter-events for that domain (Phase 2) → watchlist + export + delivery (Phase 3) → POC in their real workflow → reference logo → expand.**

Everything else (compliance, calibration asset, funds, gov) is pulled in by demand, not pushed ahead of it.

---

## Open items for the founder to decide

1. **Consultancy vs. macro fund as the *very first* design partner** — depends on which warm intro lands first.
2. **Which watchlist domain** to make excellent first (comes from the partner).
3. **Hosting/cost ceiling** for widening ingest + systems-graph beyond 2 countries (more LLM + feed cost).
