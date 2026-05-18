# FUNCTION_DEBATE.md — Multi-Agent Critique of System Functions

**Created:** 2026-05-18
**Purpose:** Use multiple agents with explicit *opposing* mandates to surface real disagreements about every function in the system — what to keep, what to cut, what to consolidate, what to rebuild. The goal is *useful conflict*, not consensus.

## Why this approach

A single-agent review converges to a polite middle. Multi-agent with adversarial mandates exposes the actual trade-offs. Operator (Ben) reviews the debate and decides.

This is **opinion work, not measurement work**. Where measurement matters, point to `OPTIMIZATION_REPORT.md` (already evidence-grounded). Where strategy matters, debate.

---

## Scope: features to debate (not Lambdas — features)

Grouping by user-facing or operator-facing feature so the debate is about *purpose*, not implementation. Each feature is one debate row.

### Content pipeline features
1. **Topic clustering** (newsInvokeGemini + NewsProjectInvokeAgentLambda) — does the system need this at all, or could a hosted news API replace it?
2. **Two-pass prediction** (research → prediction inside NewsProjectInvokeAgentLambda) — worth the cost?
3. **Thread analysis** (newsThreadAnalysis) — multi-day storyArc/trajectory/rootCauseChain on top 10 threads.
4. **Country intelligence** (newsCountryIntelligence) — top 20 country briefings 3×/day.
5. **Pair intelligence** (newsPairIntelligence) — bilateral relationships. Currently hidden from nav.
6. **Systems analysis** (newsSystemsAnalysis) — causal graph, Phase 1 restricted to Argentina+Iran.
7. **Country facts updater** (newsCountryFactsUpdater) — Wikidata + ACLED daily sync.
8. **Markets data** (newsMarketsData) — FX, yields, commodities, macros from 5 sources.
9. **Daily intelligence brief** (newsPostDevTo's brief, served at `/daily`) — editorial daily summary.

### Distribution features
10. **Dev.to publishing** (newsPostDevTo's publish path) — currently 401-broken.
11. **Multi-platform social posting** (newsPostLinkedIn + linkedInAutoPost) — LinkedIn, Bluesky, Mastodon, Telegram, Farcaster.
12. **RSS feed** (`/rss` via Cloudflare Worker + newsSensitiveData) — 50 items.
13. **Cloudflare bot pre-rendering** — `/weekly/country/*` and `/weekly/thread/*` for crawlers.

### User-facing surfaces
14. **Save / bookmark feature** (newsSavedItems + Account page) — saved threads/countries/dailies.
15. **Firebase auth + magic-link** — sign-in entry to enable saved items.
16. **Paddle billing scaffolding** (newsStripeWebhook + Pricing component, dormant) — billing infra not in active use.
17. **`/map` — WorldMapV2 D3 choropleth** with 3 layers (Today / Connections / Editorial).
18. **`/weekly-map` — Google Maps story playback** — alternative map experience.
19. **`/intelligence-map` — animation showcase** — orphan, no inbound links.
20. **CLI marketing page** (`/cli`) — orphan, no inbound links.

### Infrastructure / operator features
21. **Repo↔deployed sync workflow** — found drift; no CI check exists.
22. **30-day archive read pattern** — 4 Lambdas independently read 31 days of NewsCache.
23. **Editorial overrides** (`country_facts.json` + DDB FACTS records) — operator-verified facts merged into LLM context.
24. **Soft deduplication** (`seen-today` item in NewsCache, 24h fingerprint) — avoids re-covering same story.

---

## Three debaters (clearly different mandates)

I will spawn three subagents in parallel. Each receives the same feature list and the same context (SYSTEM_WIRING.md, PAGES_GUIDE.md). They must take **strong** positions — not "it depends." If they agree on a row, that's signal; if they disagree, even bigger signal.

### Agent A — The Minimalist
**Mandate:** Argue that fewer features is better. Defaults to *cut*, *consolidate*, *delete*. Skeptical of anything not directly tied to "user opens a page → gets value." If a feature serves <5% of users or isn't visible, propose removing it. Argues from cognitive overhead, maintenance burden, and bundle/cost weight.

**Tone:** "Why does this exist? Who would notice if it were gone tomorrow?"

### Agent B — The Strategist
**Mandate:** Argue from product differentiation and moat. What makes Global Perspectives different from a generic news aggregator? Features that create defensibility (proprietary thread analysis, causal graphs, editorial facts) get strong defense. Features that anyone could replicate cheaply with a hosted API get challenged. Argues from "would a competitor copy this?" and "does this earn a price premium?"

**Tone:** "What's the unfair advantage here? What's just table stakes?"

### Agent C — The Reliability Engineer
**Mandate:** Argue from operational pain. Features that fail silently, have unclear ownership, or impose ongoing maintenance (LLM provider rotations, scraper breakage, key rotations) get challenged. Features that are battle-tested and self-healing get defended. Argues from incident cost, page-pinging at 3am, and recoverability.

**Tone:** "When this breaks, what happens? Who fixes it? How long?"

---

## Per-feature debate format

Each agent produces, for each of the 24 features:

```
## Feature N — <name>

**Verdict (one word):** keep | cut | consolidate | rebuild | defer

**Argument (2-3 sentences):** the case for that verdict, grounded in code/cost/UX
where possible. No "it depends." No fence-sitting.

**Counter-question:** the strongest objection the agent expects from the other two.
```

That's 24 × 3 = 72 short verdicts, plus per-agent counter-questions. Then I synthesize.

## Synthesis (mine, after the agents)

For each feature, the synthesis section will be:

```
### Feature N — <name>
| Agent | Verdict |
|---|---|
| Minimalist | ... |
| Strategist | ... |
| Reliability | ... |

**Disagreement signal:** none / mild / sharp

**Synthesized recommendation:** the actual call I'd make, and why.

**Operator decision point:** one specific question for Ben to answer if he wants to redirect.
```

Disagreement signal is the most valuable output — sharp disagreements are where the operator's judgment is required.

---

## Output

Single file: `FUNCTION_DEBATE_OUTPUT.md` at repo root. Sections:

1. **Executive summary** — features by disagreement signal (sharp/mild/none), so Ben can read just the contentious ones.
2. **Per-feature debate** — 24 rows × 3 verdicts + synthesis.
3. **Cross-cutting themes** — patterns that recurred across multiple features (e.g. "all three agents flagged X").
4. **Decision points for operator** — explicit list of "you must decide" questions.

Target length: ~6,000–8,000 words. Long for me to read fully, but the executive summary makes it scannable.

---

## What this debate is NOT

- Not measurement work (CloudWatch / DDB scans / cost analysis) — that's `OPTIMIZATION_REPORT.md`.
- Not architecture work — that's `SYSTEM_WIRING.md`.
- Not page-level QA — that's `PAGES_GUIDE.md`.
- Not a roadmap — it's a backlog feed for one.

## Risks of this approach

- Agents may agree more than expected (politeness drift) — mitigated by explicit "no fence-sitting" rule.
- Output could be too long to act on — mitigated by executive summary section.
- Cost ~30k tokens per agent × 3 = ~90k tokens of LLM compute. Acceptable for a one-time strategic review.

---

## Execution plan

1. Spawn three subagents in parallel, each receiving the scope list + their mandate + the existing foundation docs as context.
2. Wait for all three to return their 24-row verdicts.
3. Synthesize into `FUNCTION_DEBATE_OUTPUT.md`.
4. Present to operator for review.
