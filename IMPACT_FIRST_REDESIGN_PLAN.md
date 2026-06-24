# Impact-First Pipeline Redesign — Master Plan

The root-cause plan that ties every issue we've found this session together. Supersedes the
piecemeal patches as the *organizing* doc (they become phases here). Evidence:
`AUDIT_FINDINGS_2026-06-24.md`, `SCORING_RUBRIC.md`, `FIX_BACKLOG.md`.

---

## 0. The fundamental problem (root cause)

**We never actually defined "what impacts the world." An LLM picks ~13 events on a vibe from
~26 mostly-Western feeds, nudged by diversity quotas.** Verified in `newsInvokeGemini`:
- Aperture: ~26 RSS feeds + 10 Brave queries — English/Western-heavy; the "world" we see =
  what those sources covered.
- Selection: one prompt line — *"SIGNIFICANCE = MATERIAL IMPACT… second-order effects on how
  people live/work/eat/move/breathe."* No measurable, consistent rubric; re-decided every 4h
  with no memory.
- Distortion: hard quotas (no category >25%, must include climate/science/society/energy/
  business) optimize for **variety, not impact**; hard cap of 13.

**Why this is the foundation:** every downstream thing — the breaking-alert score, the verify
agent, the country/economic analysis, the Signal API we'd sell — operates on *whatever 13 events
this step already chose.* **Garbage in, garbage scored.** Fixing ingestion is higher-leverage
than anything we've done so far.

## 1. The reframe — foundation vs downstream

```
[INGEST + IMPACT FILTER]  ← THE ROOT (vibe-based today)
        │  decides which events exist at all
        ▼
[per-event analysis: summary / prediction / cause / country / economic]
        │
        ▼
[breaking-alert score + verify agent]   ← we spent the session here (downstream)
        │
        ▼
[Signal API + emails + site]            ← sells/serves the output
```
Everything below the root is only as good as the root. So the order of fixing should be
**root-first**, not score-first.

## 2. The redesign — "impact-first"

Four changes, each tied to a standard we already researched (`SCORING_RUBRIC.md` §9):

1. **Widen + de-bias the aperture → add GDELT.** Free, 15-min, 100+ languages, 200+ countries;
   codes events as actor→action→actor with **mention counts** (global attention), **Goldstein**
   (event-type impact), and tone. Start from *"what the whole world is reacting to,"* then attach
   our editorial RSS/Brave articles for the text. (Keeps A1 honest too — real events, not whatever
   video clip was in a feed.)
2. **Define impact explicitly (a rubric, not a vibe).** Score each candidate on **reach**
   (countries/people affected), **severity** (lives/economy), **irreversibility**, **novelty** —
   the same axes as the verify agent. Deterministic where possible (GDELT mention-velocity +
   Goldstein + country-count), LLM only for the qualitative.
3. **Separate RANK from DISPLAY.** Rank purely by impact; apply diversity/variety as a
   *presentation* layer, never as a filter that distorts the impact ranking.
4. **Relax the hard cap/quota** — let impact decide how many surface; curate for display after.

## 3. The one product decision (yours)

Impact-first can mean two different things; they pull apart and shape the rubric:
- **Attention-driven** — "what the world is reacting to" (GDELT mentions, coverage volume). Fast,
  objective, but follows the herd (Western media included).
- **Impact-driven** — "what will materially change lives," even if underreported (a quiet famine,
  a sovereign default). Truer to the mission, harder to measure.
- **Recommended: hybrid** — use attention (GDELT) to *widen the net so nothing is missed*, then
  rank by the *impact rubric* so the herd doesn't dominate. Best of both; it's also the
  differentiated product position (not just another Bloomberg firehose).

**→ DECISION: IMPACT-DRIVEN (operator, 2026-06-24).** "What materially changes lives, even if
underreported." Feasibility checked — see §3.5.

## 3.5 Impact IS measurable — direct-impact feeds (verified 2026-06-24)

The hard part of impact-driven is "underreported = no media signal." **Solved by measuring impact
from authoritative bodies, not media volume.** Free feeds that quantify real-world impact directly:

| Feed | Measures (direct impact) | Domain | Access |
|------|--------------------------|--------|--------|
| **GDACS** (UN+EU) | alert level Red/Orange/Green + **affected population** | natural disasters (quake/cyclone/flood/volcano/wildfire/drought) | free API, keyless |
| **ACLED** | **fatalities** + actors + locations, real-time, 200+ countries | political violence + protests | free w/ registration — **we already hold creds** (`newsCountryFactsUpdater` ACLED_USERNAME/PASSWORD, was "approval pending" → verify) |
| **INFORM Severity Index** (ACAPS/EU JRC) | composite **crisis severity** — 31 indicators, weighted impact 20% / conditions-of-affected 50% / complexity 30%, 191 countries | humanitarian crises | open-source |
| **ReliefWeb** (UN OCHA) | curated humanitarian disasters + reports | humanitarian | free API, 1000/day |

**Two big wins:**
1. **A quiet flood/famine/massacre with little Western coverage still gets a high GDACS/ACLED/
   INFORM signal** — exactly the underreported-but-high-impact case our 26 RSS feeds miss. This is
   what makes impact-driven actually work.
2. **INFORM is a ready-made, published severity rubric** (like ICRG/CAP in §9) — adopt its
   dimensions instead of inventing our own.

**Design implication — impact is TYPED by domain** (no single number fits all news):
- disaster → GDACS (affected population + alert level)
- conflict → ACLED (fatalities)
- humanitarian → INFORM severity / ReliefWeb
- economy → our existing `newsEconomicImpact` severity
- politics / tech / science / other → editorial impact rubric (reach / severity / irreversibility / novelty)

So the impact filter = **direct-impact feeds where they exist, the rubric elsewhere** — and GDELT
(attention/breadth) stays only as the *wide net* so nothing is missed, never as the ranker.

Sources: [GDACS API](https://www.gdacs.org/) · [ACLED](https://acleddata.com/) ·
[INFORM Severity Index](https://www.acaps.org/en/thematics/all-topics/inform-severity-index) ·
[ReliefWeb API](https://reliefweb.int/help/api)

## 4. Safe sequencing — NOT a big-bang (this is mandatory)

The live pipeline feeds the whole site; we change it the way we changed scoring — measured.

- **P0 — Reference set.** Hand-label a "what genuinely mattered" set from recent days (extends the
  scoring gold set). This is the yardstick for *every* change below. Without it we're guessing.
- **P1 — GDELT shadow ingester.** New Lambda pulls GDELT in parallel, does NOT touch production.
  Compare: what would impact-first have surfaced vs the current 13? Measure coverage gaps
  (world-impacting events we currently miss) against P0.
- **P2 — Impact rubric in shadow.** Compute the explicit impact score on both the current topics
  and GDELT candidates; log alongside, no behavior change. Validate it ranks the P0 set well.
- **P3 — Migrate selection.** Only once P1+P2 beat the current pick on P0: switch
  `newsInvokeGemini` selection to impact-first; move diversity to display. Keep the old path as a
  fallback for a cycle or two.
- **P4 — Downstream falls into place.** With a sound input, the breaking scorer + verify agent
  (already designed) finally operate on the right events; source-quality (A1/A2/A3) and the Signal
  API inherit the improvement.

## 5. How the session's existing work folds in (nothing wasted)
| Already done / planned | Becomes |
|---|---|
| Stage-1 scorer fix (country-risk cap, `f8a3de0`) | Still valid; a downstream cleanup |
| Verify-agent design (news-values/Admiralty/CAP/ICD-203) | P4 — runs on better inputs |
| A3 title grounding (`fb47cdf`) | Independent quick win; keep |
| A1/A2 source quality | Partly subsumed — GDELT-anchored events reduce junk sources |
| Scoring gold set | Becomes the P0 reference set (extended to "what mattered") |
| Signal API | The eventual beneficiary; CAP output schema later |

## 6. What we can safely start NOW
- **P0 reference set** — needs no new infra; unblocks measuring *everything*. Highest-value first step.
- **P1 shadow ingesters (impact-driven)** — new isolated Lambda(s), zero production risk, that pull
  the **direct-impact feeds (§3.5)**: GDACS (disasters), ACLED (conflict fatalities — verify our
  existing creds first), ReliefWeb/INFORM (humanitarian), + GDELT only as the wide attention net.
  Compare what impact-first *would* surface vs the current 13, against P0 → measures exactly how
  many high-impact events we currently miss.
- **Quick check first:** confirm the ACLED credentials in `newsCountryFactsUpdater` actually work
  (was "approval pending") — that's free conflict-fatality data we may already be able to pull.
Both are additive and reversible. The risky part (P3 migrate) is gated on P0+P1+P2 data.

**Honest stance:** "fix everything" = this sequence, root-first, measured. We do NOT rewrite the
live selection blind. The first concrete move is P0 (the reference set) + P1 (GDELT shadow) —
after the §3 product decision.
