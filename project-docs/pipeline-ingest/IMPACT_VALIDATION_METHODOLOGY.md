# Impact Validation Methodology

**How we prove the impact-first pipeline — and any change to it — is actually good**, given
that most news domains have **no ground truth** for "impact." This is the QA spine for the
redesign (`IMPACT_FIRST_REDESIGN_PLAN.md`). It generalizes the patterns we already used this
session (source-truth audit, multi-agent debates, the verify-agent) into one repeatable method.

---

## 1. Core principle — faithfulness ≠ truth

For **hard-impact** domains (disaster, war, economy) the feeds (GDACS/ACLED/our-econ) ARE the
ground truth. For **soft / free-form** domains (politics, tech, society) there is **no feed and
no ground truth** — the agent must judge impact itself. We cannot measure "is this truly the most
world-changing event"; we CAN measure three weaker-but-honest things:
1. **Faithfulness** — is the agent's impact judgment *justified by the sources it saw*?
2. **Recall vs a human reference set** — does it surface what a human says *genuinely mattered*?
3. **Coverage** — did the *feeds* contain a high-impact event the pipeline never surfaced?

No single one is "truth"; together they're the closest honest proxy. (This is the same
faithfulness≠truth lesson the drift investigation taught us — `AUDIT_FINDINGS_2026-06-24.md`.)

## 2. The validation loop

```
INPUT     the sources the agent was given (ALL fetched articles + feed events)
  │       ── captured & stored every run
  ▼
PRODUCER  the impact agent: selects events + assigns an impact score + reasons
  │       ── captured & stored every run
  ▼
AUDITOR   independent, DIFFERENT model family (Gemini vs the DeepSeek producer), given the
  │       SAME input, checks the producer's output (never grades its own work)
  ▼
VERDICT   per-event + per-run; metrics computed; ship only if it beats the baseline
```

**Capture is the prerequisite:** today we don't store the full input set or the agent's
reasoning. Step 1 of building this is a capture harness (log input + output per cycle).

## 3. The four failure modes + what catches each

| Failure | Caught by | Type |
|---|---|---|
| Agent **overstates** an event's impact (loud≠impactful) | Auditor check #1 (justified by sources?) | faithfulness |
| Agent **misses** a high-impact event it *saw* (false negative — invisible) | Auditor check #2 (what did it skip?) | faithfulness |
| High-impact event **never in our feeds** at all | The impact **feeds** (GDACS/ACLED/…) | coverage |
| Whole thing is just "plausible but wrong" | **Human reference set (P0)** | proxy-truth |

The dangerous one is #2 — a missed coup/famine is silent. The auditor's job is as much "what was
wrongly dropped" as "is what was kept justified."

## 4. The auditor's three checks (per run)
1. **Justification:** for each selected event, is its impact rating supported by its sources? (no
   invented figures/severity — the `newsSourceAudit` `DRIFT` discipline, applied to the score.)
2. **Omission:** scanning the SAME input, is there an event the producer ranked low/dropped that a
   reasonable analyst would call high-impact? List them.
3. **Ranking sanity:** are events ordered sensibly relative to each other across domains (a flood
   affecting millions above a symbolic vote)?

Output is structured (verdict + per-event justified/overstated + missed[] + notes) so it's
measurable, not prose.

## 5. Metrics — what "good enough" means
- **Faithfulness pass rate** — % of selected events the auditor rules justified (target: high).
- **Omission count** — # of high-impact events the auditor says were wrongly dropped (target: ~0).
- **Recall@K vs P0** — of the events a human labeled "genuinely mattered", how many did the
  pipeline surface in its top K (the anti-false-negative metric).
- **Coverage gap** — # of feed events (GDACS Red/Orange, ACLED high-fatality) the pipeline never
  surfaced.
- **Cross-domain rank correlation** vs P0 ordering.

A change ships only when it **beats the current baseline** on these — never on a single anecdote.

## 6. The human reference set (P0) — the anchor
50–100 recent days/cycles where a human (you, optionally LLM-assisted first pass + confirm) marks
**what genuinely mattered** and a rough impact rank. This is the closest thing to truth and the
yardstick for §5. Doubles as the scoring gold set. Build it FIRST — without it every metric above
is ungrounded. (Mirrors the prediction-calibration human-confirm pattern.)

## 7. How this becomes an automated PLAN → EXECUTE → TEST → AUDIT loop
The same orchestration we used for the Stage-1 scorer fix, generalized:
- **PLAN** — state the change + hypothesis (e.g. "add GDACS disaster impact → recall@10 vs P0 ↑").
- **EXECUTE** — implement in **shadow** (runs alongside prod, writes nowhere user-facing).
- **TEST** — run the new pipeline over the captured inputs + the P0 set; compute §5 metrics.
- **AUDIT** — the independent auditor (different model) + an adversarial pass; ship only if metrics
  beat baseline AND the auditor finds no new omissions.
Each iteration is logged with a **version tag** so we can compare impact-model versions over time
(regression guard).

## 8. Roles (who does what)
| Role | Who |
|---|---|
| Producer | the impact-ranking agent (DeepSeek) + the deterministic feeds |
| Auditor | a different model family (Gemini) — never grades its own output |
| Reference | human-labeled P0 set |
| Orchestrator | the plan→execute→test→audit workflow |

**Bottom line:** this is what makes "let the agent judge impact" *trustworthy* instead of a
vibe — the judgment becomes measured, the misses become visible, and every change must prove
itself against a human yardstick before it ships.
