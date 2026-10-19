# Product Direction — Analyst Sense-Making Tool over a Causal Event-Web

**Date:** 2026-06-26
**Status:** Direction note (founder thinking) — supersedes the "monetize machines / pure signal API" emphasis in `project_signal_api_pivot` as the *primary* framing. The signal API can still exist as plumbing; the **product** is now an analyst-facing reasoning tool.
**Grounded in:** two adversarially-verified deep-research passes (2026-06-26), recorded in memory `reference_market_competitive_research_2026_06_26`.

---

## The vision (founder's words, sharpened)

A tool that helps a **human analyst understand the whole world** — not a feed, not a finished answer, but a reasoning surface. Three pillars:

1. **The causal web, not a series.** Events are not a timeline; they trigger each other in a spider-web of cause → effect with lags and counter-reactions. Surface *what each event is likely to trigger*, and what is triggering it.
2. **Genesis / provenance — how the story formed from the beginning.** Show the birth-to-now arc of a narrative: when it actually started, the first weak signal, how it evolved into today's headline.
3. **Bring-your-own hypothesis.** An analyst drops their own news report / article / thesis; the tool finds the related source data we already hold, places it in the causal web, and helps them build and stress-test *their own* thesis — including possible outcomes and **counter-events**.

The mission framing: *understand the whole world — possible outcomes and counter-events.*

---

## Why this is the right direction (what's strong)

- **It matches where the money actually is.** Every funded comparable sells to *human analysts / desks*, not machines (Signal AI $165M, AlphaSense ~$2.5B val, RANE, Recorded Future). Pass 2 explicitly flagged that the "events-purely-for-machines" buyer is *less proven at scale* than the grounding hype implies — the people cutting checks today are humans at risk desks. Steering at the analyst is better-validated than the self-serve API path.
- **The causal web is the real wedge.** Feeds/APIs give events in a *line* (timeline, sentiment score). Almost nobody packages the *causal graph* — event → triggers → counter-reactions with lag + confidence. This is how analysts think. We already have the bones: `newsSystemsAnalysis` (nodes/edges, lagDays, confidence, citations), narrative threading (story arcs across days), `trace_cause` (root-cause chains).
- **Genesis/provenance is underused and ownable.** "When did this narrative start and how did it grow" is a genuine analyst pain, and we have the threaded archive to answer it. Pairs naturally with the web (the web *plus* how the web grew).
- **Counter-events tie to calibration.** Most tools confirm a thesis; a tool that surfaces the *counter-scenario and what would falsify it* is differentiated and plugs directly into our prediction/track-record work.

---

## Honest pushback (the traps)

- **Doc-drop → thesis is a good FEATURE, a weak HEADLINE.** "Upload a document, get analysis" is commoditized — ChatGPT, Claude, AlphaSense all do it. If that's the pitch, we compete with frontier models on a feature they give away.
- **Coverage is the bottleneck.** "Find *our* related source data" is only as good as our corpus — and our corpus is the same Western RSS everyone has (the credibility gap noted repeatedly). The doc-drop feature *exposes our weakest asset*. (See `project_impact_first_redesign` — impact-driven ingest is the fix.)
- **"Output their thesis" can backfire.** An analyst's thesis is their value-add; a tool that hands them a finished thesis feels like it's replacing their judgment, and they'll distrust an LLM that may be confidently wrong. The adoptable version is **augmentation**, not replacement.
- **Calibration must be real.** If we claim "possible outcomes and counter-events," and the pipeline isn't actually calibrated, it's just an opinionated LLM — analysts catch that within a week. Pipeline-calibration is still UNPROVEN and is the make-or-break.

---

## The reframe

Lead with **"the causal web + how the story formed + counter-events."** Make the doc-drop an *entry point into* that web, not the headline.

Reframe BYO-hypothesis from *"we write your thesis"* to:

> **"Bring your hypothesis. We'll show you the web it sits in — what formed it, what it's triggering, and what would have to be true for the opposite to happen."**

Augment the analyst's judgment; surface provenance, the causal graph, base rates, and the falsifying counter-scenario. Let *them* form the thesis — faster, and more defensibly.

---

## RESOLVED: building for ENTERPRISE — thesis-PRODUCERS

Decided 2026-06-26: **enterprise**, specifically **funds + consultancies + gov** (founder explicitly excluded corporate geo-risk / supply-chain).

The unifying insight: those three are all professional **thesis-*producers*** — a fund analyst produces an investment thesis, a consultant a client assessment, a policy shop a judgment. Corporate supply-chain teams are thesis-*consumers* who just want operational alerts. **ICP = "people who must construct and defend an analytical thesis for a living."** The causal-web reasoning tool fits producers, not alert-consumers.

**Sequencing:** start with **boutique consultancies + macro/discretionary funds** (reachable by a solo founder, faster value). **Defer gov to phase 2** — slowest procurement, heaviest compliance (on-prem/clearance/FedRAMP); wrong first beachhead for a solo dev, great later expansion. Consultancies = faster first design partner (lower data-rigor bar, value provenance + branded exports) but watch white-label/commoditization risk; funds = pay more + more defensible but demand proven calibration + raw point-in-time data up front.

| Segment | Watchlist unit | Top demand | Calibration bar | Hardest gate |
|---|---|---|---|---|
| Funds | tickers / sectors / exposures | calibration + raw point-in-time data | mandatory, market-relevant | "we'll build it ourselves" |
| Consultancies | client engagements / regions | branded exports + provenance | medium | budget / white-label risk |
| Gov (phase 2) | actors / regions / threats | compliance + on-prem | high but slow | procurement + security |

## Enterprise tuning — ranked by what gates the SALE

1. **Coverage credibility** — now the #1 deal-killer. An evaluator types in *their* region/sector; the Western-RSS corpus fails. Fix via impact-driven, multilingual, structured ingest (`project_impact_first_redesign`) — for the *vertical's* world, not the whole world.
2. **Defensibility / provenance** — already a strength (honesty contract, `newsSourceAudit`, `SourceRobustness`). Make it the headline: every conclusion auditable to source, one-click branded export.
3. **Per-domain calibration** — sliceable by domain/region, exportable. Table stakes now; still UNPROVEN (make-or-break).
4. **Workflow integration** — briefs to email/Slack, API/MCP endpoint, branded PDF exports. Insight is the causal web; integration is what gets it used.
5. **Watchlist customization** — causal web + alerts + counter-events tuned to *their* exposures (their 40 things, not the world).
6. **Trust / compliance infra** — SSO + multi-seat + DPA + basic SLA get you into pilots; SOC 2 mandatory above mid-market. Don't build speculatively — let the first design partner name the hard gates.

**Pricing:** annual, seat- or platform-based, ~$1k–50k/yr, land-and-expand. Start with a time-boxed / free 60–90d POC to win a reference logo, then convert.

**GTM reality (solo dev):** can't run generic enterprise self-serve. Land 1–3 design partners in ONE starter segment → their logo + requirements = the roadmap. Expect 6–18mo cycles, security reviews, reference-customer demands. Don't lead the demo with doc-drop (commoditized) — lead with the causal web around their watchlist + auditable provenance. Build the **shared core first** (watchlist + export layer — common to all three).

---

## Maps to assets we already have

| Pillar | Existing asset |
|---|---|
| Causal web | `newsSystemsAnalysis` (nodes/edges/lag/confidence/citations) — currently gated to Argentina/Iran; `SystemsGraph.jsx` |
| Genesis / provenance | Narrative threading (`threadId`, story arcs), `newsThreadAnalysis` (storyArc, rootCauseChain), threaded daily archive |
| BYO-hypothesis | Analysis Studio (`/analyze`, `AnalysisStudio.jsx`) — already lets users pick stories → cited deep-dive; extend to accept a dropped doc + RAG over our corpus |
| Outcomes + counter-events | `PREDICTION` / `newsPredictionResolver` / `/track-record` calibration |
| Honesty / provenance trust | source-truth audit (`newsSourceAudit`), `SourceRobustness` pill, anti-fabrication contract |

Much of this exists. The work is *composition + positioning*, plus the two hard constraints: **corpus coverage** and **proven calibration**.

---

## On calibration — corrected role (it is NOT a precondition)

Earlier framing over-weighted calibration as a "prove-it-first / make-or-break" gate. That was a chicken-and-egg trap: a credible Brier track record **cannot exist on day one** — it needs months of resolved predictions. Separate three things:

1. **Honesty philosophy** (day one, cheap, already done) — no fabrication; show confidence, counter-events, uncertainty. This is what makes the *early* product credible to a design partner.
2. **Immutable prediction logging** (day one, already built — `GlobalPerspectivePredictionLog`) — the ONE calibration thing that must run early, because a track record **can't be retrofitted** (needs point-in-time integrity). Background instrumentation, not a deliverable.
3. **Published Brier / calibration asset** (LATER) — the sales artifact. Matters mainly for **funds** (segment 2); barely relevant to first consultancy design partners, who judge coverage + causal web + provenance.

## Priority order to START the product

1. **Coverage credibility** — the real day-one make-or-break (impact-driven, multilingual, structured ingest — `project_impact_first_redesign`; for the vertical's world, not the whole world).
2. **Causal-web + provenance reasoning surface** — the core value. Widen the systems-graph gate beyond Argentina/Iran so it's real coverage, not a demo.
3. **Workflow / watchlist / branded export** — what gets it used; the shared core across all three segments.
4. **Honesty philosophy + keep logging predictions** — on by default, compounds silently.
5. **Calibration as a published asset** — LATER, when resolved data exists and you're courting funds. Turn logging on and forget it; let the record accrue so it's *ready* when a fund asks.
