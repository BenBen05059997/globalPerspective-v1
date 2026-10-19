# Global Perspectives — Pitch

**Updated:** 2026-07-01, rewritten against a **code-grounded audit** of the live system (3 parallel subsystem audits), not the spec docs. **Supersedes `GAMMA_PITCH_WITH_CITATIONS.md`** (its "xAI real-time + cheaper-than-GPT-4" moat is dead: off xAI, and "cheaper real-time LLM" was never defensible). Direction: `ANALYST_TOOL_DIRECTION.md`; data contracts: `SPIDER_BUILD_SPEC.md`, `EVENT_DOSSIER_SPEC.md`.

---

## One line

> **We turn the news into a causal web you can reason over — a factual backbone of who-and-what connects events, with model inference clearly marked as inference, packaged as an AI-legible dossier per event, and a public track record of whether our forecasts were right.**

## The problem

Analysts who must **construct and defend a thesis** — at funds, consultancies, policy shops — get events in a *line* (timeline, sentiment score, alert) or a *finished answer* (an LLM summary that's confidently wrong, forgets what it said, and can't tell you what's fact vs. its own guess). Neither helps you reason about *what an event triggers*, *how a narrative formed*, or *whether your read is holding up* — and none of them let you tell fact from inference, which is the whole job when you have to defend a call.

## What it is — four pillars (with honest build-state)

1. **The causal web, backbone-first.** A two-tier graph — World (region-laned situations + cross-country shared-actor links) drilling into Country (events on a timeline, by category). The **default layer is a deterministic, factual shared-actor backbone** (who/what connects these events — mechanical, auditable). The **model's causal arrows are an opt-in overlay, default OFF, explicitly labeled as judgment**. *Fact-separate-from-inference is the default state of the product, not a disclaimer.* **BUILT** (12 live countries; World tier connected by cross-country shared-actor links, ambient names excluded).

2. **The event dossier — AI-legible, provenance-tagged.** For any event we assemble (on request) a 1–2-hop subgraph with per-claim **provenance** (`sourced` fact vs `judgment`), citations, temporal-anomaly flags, the event's **genesis timeline**, and an embedded **reasoning contract** ("reason only over this slice, cite entries, label interpretation as judgment"). This is the object we (or a customer's own model) reason over — so an AI understands *what we have* and can't launder a data artifact into a confident claim. **BUILT** (a frontier model off a raw feed structurally can't do this).

3. **Genesis / provenance.** How a narrative formed from its first weak signal to today — the birth-to-now arc per node, from narrative threading. **BUILT.**

4. **Accountability — a real, scored forecast record.** Every prediction is logged **immutably at the moment it's made** (point-in-time, no expiry); as deadlines pass, each trigger is scored fired/not-fired (evidence-grounded, human-confirmed), and the running **Brier score + calibration** is public at `/track-record`. **BUILT and end-to-end** — for discrete forecasts.

## What's live TODAY (verified in code)

| Capability | Status | Evidence |
|---|---|---|
| Continuous ingest + topic clustering (every 4h) | ✅ live | `newsInvokeGemini` |
| Summary / prediction / root-cause per story | ✅ live | `NewsProjectInvokeAgentLambda` |
| Causal web — **deterministic shared-actor backbone (default) + LLM causal overlay (opt-in, marked judgment)** | ✅ live | `newsSystemsAnalysis` (`actors[]`, `buildBackboneEdges`, `edge.class`), `SpiderDemo.jsx` (`causalOn` default OFF) |
| Two-tier World → Country causal view | ✅ live | `world_overview` action + `SpiderWorld.jsx` / `SpiderDemo.jsx` (`/spider-demo`) |
| **Event dossier** — k-hop retrieval, per-claim provenance, anomaly flags, citations, reasoning contract | ✅ live | `buildEventDossier` / `assembleDossier` (`dossier.js`) |
| **"Analyze this event with AI"** over the dossier | ✅ live | `dossier_analysis` action → DeepSeek under honesty prompt; `SpiderDemo` panel |
| Genesis timeline per event | ✅ live | narrative threading → `CompactTimeline` |
| **Immutable point-in-time forecast log** | ✅ live | `GlobalPerspectivePredictionLog` (no TTL) |
| **Scored track record** (Brier + calibration, human-confirmed) | ✅ live | `newsPredictionResolver` + `predictions/review.js` → `/track-record` |
| Country daily risk trail (sparkline) | ✅ live | `HISTORY#<date>` scalar rows → `RiskSparkline` |
| Analysis regenerates as new articles arrive | ✅ live (but overwrites — see below) | `newsThreadAnalysis` (entryCount), `newsCountryIntelligence` (totalArticles) |
| Economic-impact + independent-family quality judge | ✅ live | `newsEconomicImpact` (DeepSeek) judged by `newsEconomicQuality` (Gemini) |
| Source-drift dead-man's-switch + source-robustness | ✅ live | `newsSourceAudit`, `SourceRobustness` |
| Self-serve cited analysis over our data | ✅ live | Analysis Studio `/analyze` |

## The honest gaps — what's NOT built (this is the roadmap, and the wedge)

1. **The visible "living" diff.** Analyses *do* regenerate as news arrives, but they **overwrite in place** — no stored prior version, and **no user-facing "what changed / self-correction" view anywhere** (the one delta affordance, `RiskDeltaPill`, is dead code). The self-correction is real but *invisible*. The high-value build: preserve versions and show "changed because event Z — prior read A → revised read B, confidence 60%→40%," with a **conclusion-change gate** (regenerate only on material change, not every cron tick — `newsSystemsAnalysis` currently re-spends LLM budget unconditionally). Groundwork exists (country `HISTORY#`, the prediction log); the narrative-diff UX does not.
2. **Surface the provenance to the user.** The dossier's provenance tags + anomaly flags are sent to the model but **not shown in the UI** — the reader sees only prose. Displaying "✅ fact / 💭 judgment / ⚠ co-movement-not-cause" *is* the trust moat; it's a display gap, not a data gap.
3. **Coverage.** 12 live country graphs (all resolve; 56 eligible in the pipeline), but Western-RSS corpus and cross-country is only shared-actor links — **no cross-country causal reasoning**, no sub-country situation clustering. Still narrow vs. the world. **This is the #1 deal-killer** (an evaluator types in *their* region/language and finds the gap) — fix via impact-driven, multilingual, structured ingest for the vertical's world.
4. **Backbone depth + honesty polish.** Only `shared_actor` backbone (no `temporal_sequence`/`narrative_continuation` yet); temporal-anomaly edges are currently **hidden** rather than *labeled* as co-movement; no `tautology` flag; citations reference titles without the source text.

## Why it's defensible

- **Frontier LLMs** (ChatGPT/Claude) do one-shot analysis but don't persist point-in-time state, maintain a scored track record, keep fact structurally separate from inference, or reason over a retrieved causal subgraph with a provenance contract — and won't *want* a public diff/track record, because it exposes them to being wrong.
- **Feeds/APIs** (Dataminr, Tavily, NewsCatcher) give events in a line/score; we give the **graph + provenance + accountability**.
- **Not Bloomberg.** Every funded comparable (Signal AI, AlphaSense ~$2.5B, RANE, Recorded Future) sells to **human desks** — the validated buyer.
- The dossier is the reusable core: same object feeds our Analysis Studio, a customer's bring-your-own model, and a future signal API.

## Who it's for (ICP)

**Thesis-*producers*** — people paid to construct and defend a judgment: **boutique consultancies + macro/discretionary funds first** (reachable by a solo founder), **gov phase 2** (procurement/compliance too slow to start). Not corporate supply-chain (thesis-*consumers* who want operational alerts). Pricing: annual, seat/platform, ~$1k–50k/yr, land-and-expand off a time-boxed POC + reference logo.

## The honest risks (saying them out loud is the brand)

- **Coverage credibility is the make-or-break** — the causal web is only as good as the corpus, which is largely Western RSS and ~12 countries deep today.
- **Causal edges are model judgment.** The trustworthy default is the deterministic backbone; the causal overlay is opt-in and only as good as the model. Keep it labeled, keep it off-by-default.
- **Calibration is unproven at scale** — a Brier record can't be retrofitted, which is exactly why the immutable log runs from day one; the *published* score matters mainly to funds and accrues over time.
- **Doc-drop is a feature, not a headline** — leading with "upload a doc, get analysis" competes with free frontier models. It's an entry point *into* the web.

## The bet

Static analysis is commoditized; frontier models give it away. The durable, hard-to-copy product is a **causal web with a factual backbone, inference clearly marked as inference, packaged as an AI-legible dossier, and backed by a public record of whether we were right.** Built for people who get paid to be right — and structurally the one thing the general-purpose models won't build, because it requires *keeping fact separate from inference and keeping score*.
