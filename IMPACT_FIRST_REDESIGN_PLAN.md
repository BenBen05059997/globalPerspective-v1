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

**→ DECISION NEEDED: attention / impact / hybrid?** (Recommend hybrid.) Everything else follows.

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
- **P1 GDELT shadow ingester** — new isolated Lambda, zero production risk, tells us immediately
  how much we're missing.
Both are additive and reversible. The risky part (P3 migrate) is gated on P0+P1+P2 data.

**Honest stance:** "fix everything" = this sequence, root-first, measured. We do NOT rewrite the
live selection blind. The first concrete move is P0 (the reference set) + P1 (GDELT shadow) —
after the §3 product decision.
