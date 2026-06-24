# Fix Backlog — what we need to fix (2026-06-24)

The prioritized **action** list across everything touched this session. Evidence for each
item lives in `AUDIT_FINDINGS_2026-06-24.md` (source-truth A1–A5, scoring B1–B5); scoring
design in `SCORING_RUBRIC.md` + `BREAKING_ALERT_V2_BUILD_PLAN.md`. This file = the to-do, not
the evidence.

Legend: ⬜ open · 🟦 in progress · ✅ done · 🗣️ needs a decision before doing.

---

## Track A — make it trustworthy (source-truth) · HIGHER LEVERAGE
*(Why first: the Signal API's whole pitch is accuracy/provenance. Weak sources hollow that out.)*

| ID | Fix | Where | Status | Notes / decision |
|----|-----|-------|--------|------------------|
| A3 | **Ground title specifics** — every figure/date/death-toll/superlative in a topic title must come from a source article (the summary prompt already enforces this; the title prompt doesn't) | `newsInvokeGemini` title prompt | 🟦 doing | Cheap, unambiguous, no decision needed |
| A1 | **Prefer real articles over video/explainer pages** as sources — stop citing france24 `/video/` clips + "how-to-treat-heatstroke" explainers for hard claims | `newsInvokeGemini` fetch/cluster | 🗣️ | **Decide:** drop `/video/` URLs entirely, or just deprioritize them as the lead source? Explainers are harder to detect by URL — keyword filter or LLM-judged? |
| A2 | **Fix the audit basis** — auditor re-fetches the full live page while summaries are grounded in the stored RSS snippet, so it flags faithful summaries | `newsSourceAudit` | 🗣️ | **Decide the trade-off:** compare vs the stored snippet (lenient, fewer false alarms) vs store fuller article text at ingest so summary + audit share one basis (correct, bigger). |

## Track B — make it smart (scoring) · GATED ON A LABELED SET
| ID | Fix | Status | Notes / decision |
|----|-----|--------|------------------|
| B1 | Country-risk dominance — cap@50 + weight 2→1 | ✅ code (commit `f8a3de0`) | 🗣️ **Redeploy to live detector?** Low risk (operator inbox only). |
| Gold | **Labeled gold set** (50–100 stories alert/suppress) — gates ALL further tuning | ⬜ | 🗣️ **Invest now, or park Track B?** Nothing smart ships without it. |
| B2 | Verify-agent (news-values + Admiralty + CAP + ICD-203, shadow mode) | ⬜ deferred | Gated on the gold set |
| B3 | Multi-country contamination (GDELT actor→actor relationship) | ⬜ deferred (partly mitigated by B1 cap) | Stage 4 |

## Housekeeping
| Item | Status |
|------|--------|
| Merge `signal-api` branch to main (all session work lives here) | 🗣️ when we're happy with a batch |
| Redeploy decisions (Stage-1 scorer, the A-track prompt fixes) | 🗣️ batch a deploy |
| markSent IAM gap | ✅ fixed |

---

## What we need to DISCUSS (the real decisions)
1. **Track A vs Track B order.** Recommendation: Track A first (trust > smart; needs no gold set; protects the product pitch). Track B stays disciplined behind the gold set.
2. **A1 aggressiveness** — hard-drop `/video/`+explainers, or soft-deprioritize? Risk: dropping too much loses real coverage; keeping too much keeps weak citations.
3. **A2 leniency trade-off** — snippet-basis (fewer false alarms, less strict) vs full-text-at-ingest (correct, more work). This decides whether the daily drift email becomes trustworthy or stays noisy.
4. **Gold set: build it or park scoring?** The fork that decides if Track B happens at all soon.
5. **Deploy cadence** — batch the source-truth prompt fixes + Stage-1 scorer into one redeploy, or hold.

## Done this session (for reference)
Signal API deployed (`newsSignals`); breaking-alert auto-send live to operator; Stage-1 scorer
fix (code); markSent IAM fix; multi-agent debates (alerts + scoring rubric) recorded; external
standards research (CAP/GDELT/ICRG/Admiralty/news-values/ICD-203); source-truth audit re-run +
findings register.
