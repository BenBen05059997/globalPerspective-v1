# Breaking-Alert Verify Debate — 2026-06-24

A multi-agent debate over the **7 real stories** our deterministic significance scorer
(`newsBreakingAlert/significance.js`) flagged so far. Goal: pressure-test whether the
scorer fires on the *right* things, and prototype the **urgency verify-agent** (the
`verifyStory()` seam) before we build it.

**Method.** For each story: an **ALERT advocate** and a **SUPPRESS skeptic** argued in
parallel, then an **independent Judge** scored urgency on six dimensions and ruled
`alert` / `hold` / `suppress`. A final **Editorial Director** synthesized across all 7.
22 agents. Each agent saw only the story's own content (no external facts) and a shared
rubric: *urgency ≠ importance ≠ loudness; default to silence; a push interrupts a paid
reader, so the bar is high.*

The six dimensions (0–5 each): **stakes, novelty (discontinuity), immediacy,
scope (contagion), irreversibility, credibility.**

---

## Verdict summary

| # | Story | Det. score | Sent? | Judge verdict | Urgency | Score read |
|---|-------|:---------:|:-----:|:-------------:|:-------:|:----------:|
| 1 | UN inquiry finds Israel committed genocide in Gaza | 3.791 | ❌ no | **🔴 ALERT** | **82** | justified |
| 2 | Iran & Oman *agree to discuss* Hormuz maritime fees | 3.009 | ❌ no | ⚪ suppress | 22 | **inflated** |
| 3 | Ethiopia's Abiy "turns to" Nile/Red Sea ambitions | 2.798 | ✅ **SENT** | ⚪ suppress | 22 | **inflated** |
| 4 | Airbus to inspect 16 A380s after wing cracks | 2.611 | ❌ no | ⚪ suppress | 22 | justified |
| 5 | Alibaba sues US DoD over military blacklist | 2.338 | ❌ no | ⚪ suppress | 28 | justified |
| 6 | Germany rail network halted ~2.5h (IT outage) | 2.278 | ✅ **SENT** | ⚪ suppress | 28 | justified |
| 7 | Five Eyes *warns* new AI models pose cyber risk | 2.169 | ❌ no | ⚪ suppress | 22 | justified |

**Headline result: the judge endorsed exactly 1 of 7 firings (~14% precision).** Both
stories that were actually **sent were false positives**; the one genuinely
alert-worthy story (Gaza, urgency 82) was **not** sent.

> **Honest caveat on the "sent" column.** Which stories got sent was *not* a clean
> score-ranking: the Abiy alert was sent by a manual `send.js --force` test, and the
> Germany one by the first auto-send invoke after the higher-scoring stories had already
> been written (and de-duped) in earlier dry-run cycles. So "we withheld Gaza" is partly
> a dedupe-timing artifact. The calibration finding (scorer fires on noise ~5/6) stands
> regardless; the specific send choices are a weaker signal.

---

## The core finding: the scorer detects *loudness*, not *urgency*

Every false positive shares one fingerprint — **nothing crossed a threshold.** The
deterministic scorer cannot distinguish a realized event from an announcement of intent:

| Story | What it actually is | Tell |
|-------|--------------------|------|
| Iran/Oman | *agreed to discuss* fees | verb = "discuss"; nothing signed |
| Alibaba | a lawsuit **filing**, not a ruling | process opened; outcome months away |
| Five Eyes | a **warning** communiqué | no breach, no victim, self-flagged "may overstate" |
| Airbus | an **inspection** order | EASA process working as designed; reversible |
| Germany rail | an **already-resolved** outage | "resumed step by step" *before* the alert fired |
| Abiy | restated policy + election result | summary says headline framing is "not supported" |

And the inflation mechanism is **country-risk dominance**: a standing risk prior
(62–88/100) is laundered into "urgency" regardless of whether the *event* matters.
Iran/Oman scored **3.009** — second-highest — purely by borrowing Hormuz's venue
importance for a procedural fee chat the brief itself rates "moderate, down."

---

## Per-story debate

### 1. UN inquiry finds Israel committed genocide in Gaza — **ALERT (82)** · score justified
**🟢 Alert advocate:** stakes 5 — a UN body crossing the legal threshold to *genocide*
(not "investigating"), naming a state's military for deliberately killing children,
including after the Oct 2025 ceasefire — a genuine legal-record discontinuity at maximum
stakes, rated True Signal/High confidence.
**🔴 Suppress skeptic:** It's a *report*, not an event — nothing changed on the ground
Tuesday; the conflict is the slow-burn since 1967. The headline concedes its own
contestation (Israel: "libellous sham"); no action required of the reader tonight.
**⚖️ Judge — alert, urgency 82** (stakes 5, novelty 4, immediacy 3, scope 4, irrev 4,
cred 4): *"A UN COI formally crossing the genocide threshold… is a genuine legal-record
discontinuity at maximum stakes. The weak link is immediacy — consequences unfold over
months — which I dock to 3. On balance it clears the high bar."*

### 2. Iran & Oman agree to discuss Hormuz fees — **suppress (22)** · score **inflated**
**🟢 Alert advocate:** Hormuz carries ~20% of global oil; any shift toward Iranian
control of transit fees touches the global energy order; markets front-run such signals.
**🔴 Suppress skeptic:** "Agreed to *discuss*" — nothing signed; decades of Hormuz
competition is the *root cause*, so this is continuity, not discontinuity; contagion is
what shippers "may see" — the brief undercuts its own headline.
**⚖️ Judge — suppress, urgency 22** (stakes 2, novelty 1, immediacy 1): *"The advocate
borrows the chokepoint's latent importance to inflate a procedural fee discussion the
brief itself rates 'moderate, down.' The 3.009 reflects topic country-risk, not anything
time-critical."*

### 3. Ethiopia's Abiy "turns to" Nile/Red Sea ambitions — **suppress (22)** · score **inflated** · ⚠️ was SENT
**🟢 Alert advocate:** Three Nile-basin states; a head of state with a ~90% landslide
mandate turning expansionist; water security is the one resource states go to war over.
**🔴 Suppress skeptic:** The summary itself states *"the source does not report any
specific outcomes… the title's framing is not supported by the snippets."* The headline
is a framing, not an event; single-source and self-undercutting.
**⚖️ Judge — suppress, urgency 22** (novelty 1, credibility 1): *"The alert-worthy angle
is a headline inference the summary itself disowns… the 2.798 is inflated because it
rides country-risk 88 (loudness) rather than any real discontinuity."*

### 4. Airbus to inspect 16 A380s after wing cracks — **suppress (22)** · score justified
**🟢 Alert advocate:** EASA *ordered* inspections, 5 immediately; cracks in a primary
wing component across two flag carriers = a fleet-wide structural pattern.
**🔴 Suppress skeptic:** Verb is "inspect" — nothing failed or grounded; routine
airworthiness-directive process = the safety system working as designed; reversible.
**⚖️ Judge — suppress, urgency 22** (credibility 4 but stakes 2, novelty 1): *"Credible
but routine aviation-safety housekeeping… the only interesting angles are hedged as
speculative ('may'). Below the interrupt bar."*

### 5. Alibaba sues US DoD over blacklist — **suppress (28)** · score justified
**🟢 Alert advocate:** A top-5 tech company litigating the Pentagon is rare; a hard,
dated legal event at the live US-China fault line.
**🔴 Suppress skeptic:** A *filing*, not an adjudication — the legal equivalent of
"agreed to discuss"; the blacklist predates this; the "underreported angle" is an
interested party's denial.
**⚖️ Judge — suppress, urgency 28** (immediacy 1, irrev 1): *"A lawsuit filing over a
pre-existing designation is a slow-burn legal process… worth tracking but not worth
interrupting a reader. Low score (2.338, driven only by generic country risk) is correct."*

### 6. Germany rail halted ~2.5h — **suppress (28)** · score justified · ⚠️ was SENT
**🟢 Alert advocate:** A *total* nationwide halt of a G7 rail backbone is a genuine
systemic discontinuity; the single-point-of-failure root cause means recurrence is
imminent.
**🔴 Suppress skeptic:** **Already resolved** at report time ("resumed step by step") —
immediacy 0; fully reversible within 2.5h; the underinvestment angle is a slow structural
thesis, not breaking news.
**⚖️ Judge — suppress, urgency 28** (immediacy 0, irrev 0): *"On the story's own facts it
was already resolved and fully reversed within 2.5 hours — no irreversible threshold, no
near-term action for the reader. Sending it was an error."*

### 7. Five Eyes warns AI = urgent cyber risk — **suppress (22)** · score justified
**🟢 Alert advocate (conceded):** *"Push: NO."* A warning with no breach, no victim;
"AI helps attackers" is the multi-year consensus; single-source; self-flagged as possibly
overstated — textbook low credibility.
**🔴 Suppress skeptic:** Agreed — a warning, not an event; "urgent" is the speaker's
rhetoric, not a near-term consequence.
**⚖️ Judge — suppress, urgency 22** (novelty 1, irrev 0, cred 1): *"A self-flagged
warning with no discrete event… route it to the brief. Low score (2.169) correctly
matches the content."*

---

## Editorial Director synthesis

**1) Calibration.** ~14% precision at the current threshold — firing on noise 5 of 6
times. Both SENT stories were false positives; the one urgency-82 story was withheld.

**2) Systematic bias — country-risk dominance.** "The scorer is a country-risk loudness
amplifier wearing an event-detector costume." Five of seven red-flag sets name a standing
risk prior (62–88) as the driver, not the event.

**3) The single missing signal — event-vs-warning / threshold-crossing.** Every false
positive is a non-event: agreed-to-discuss, a filing, a warning, an inspection, a resolved
outage. The deterministic scorer can't tell a realized discontinuity from an
announcement-of-intent or a finished, reversible incident.

**4) Recommendations (ranked by impact):**

1. **Add an event-state gate (highest impact).** The verify-agent classifies each item as
   `REALIZED_EVENT` vs `WARNING | INTENT | FILING | RESOLVED`; auto-suppress the latter
   classes unless stakes ≥ 5. *Kills Iran/Oman, Alibaba, Five Eyes, Germany, Abiy in one rule.*
2. **Cap/decouple country-risk's contribution.** It should weight, not drive — clamp the
   standing prior to a small additive bonus so geography alone can't clear threshold.
3. **Gate sends on LLM urgency, not the deterministic score.** Gaza (urgency 82, score
   3.79) proves they diverge; use the deterministic score as a recall *pre-filter*, then
   require urgency ≥ ~70 to send.
4. **Penalize self-undercutting summaries + single-source items.** When the summary
   contradicts its own headline (Abiy, Five Eyes, Iran/Oman) or lacks corroboration, dock
   credibility hard — this is the SENT-mistake fingerprint.
5. **Add an immediacy floor.** Suppress anything with immediacy 0 (already resolved, e.g.
   Germany rail) regardless of score — a closed incident is never push-worthy.

---

## Implication for the verify-agent build

The debate is, in effect, a working prototype of the verify-agent. Build order it implies:

1. **`verifyStory()` → real Gemini call** returning the JUDGE schema (verdict + 6
   dimensions + event_state + red_flags). Different model family from the DeepSeek
   producer, mirroring `newsEconomicQuality`.
2. **Gate:** send only if `verdict === 'alert'` (≈ urgency ≥ 70). Start in **shadow mode**
   — log the verdict next to every detection without blocking — until we've seen it agree
   with us on a week of live alerts, *then* let it veto.
3. **Cheap structural pre-checks even before the LLM:** an immediacy-0/RESOLVED filter and
   a country-risk cap are deterministic and would have killed 2 of the 2 bad sends.

> Source data: `GlobalPerspectiveBreakingAlerts` scan, 2026-06-24. Debate run:
> workflow `breaking-alert-debate` (22 agents). This file is the labeled seed set — extend
> it with operator thumbs-up/down on live alerts to turn it into a precision benchmark.
