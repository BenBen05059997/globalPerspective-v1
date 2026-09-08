# DeepSeek V4 Output Quality Audit
**Date:** 2026-05-16  
**Model:** deepseek-chat (DeepSeek-V4-Flash, non-thinking mode)  
**Audited:** 3 summaries, 3 predictions, 2 trace causes, 2 thread analyses

---

## Overall Verdict: PASS with 1 fix needed

Quality is analyst-level and comparable to Grok. One bug causes a visible preamble in summaries that needs patching.

---

## Field-by-Field Assessment

### Summaries — ⚠️ FAIL (fixable)

**Bug:** DeepSeek prefixes every summary with:
> "Here is a summary of the news from May 16, 2026, based on the provided title:"

This is AI preamble that Grok never produced. It will render verbatim on the frontend and looks unprofessional.

**Content quality underneath the preamble:** Good. Accurate bullet points, correct named actors, correct regions.

**Fix:** Strip the preamble in post-processing, OR add "Do not preface your response with any introduction" to the prompt.

---

### Predictions — ✅ PASS (excellent)

Best output of the three field types. Examples:

- **Putin-China:** Names "May 19-20, 2026: Putin-Xi summit" with specific deal type (Power of Siberia 2 gas agreement). 60-70% probability range with named triggers.
- **Lebanon:** References the "May 20 deadline for ceasefire negotiations", names UNIFIL's enforcement gap, Netanyahu coalition pressure as actor.
- **Gaza:** Historical analogy to Ahmed Yassin killing, names Mohammed Deif as likely successor target, names mediators Egypt and Qatar with specific date (May 30).

This is the highest-value field and DeepSeek is performing at or above Grok level.

---

### Trace Cause — ✅ PASS (good)

Structured JSON with proximate/contributing layers. Cites specific sources (BBC, Middle East Eye) as evidence per contributing factor. Three-layer causal analysis is present and coherent.

Minor note: the "structural/historical" third layer sometimes gets cut short, suggesting the prompt could push harder on requiring 3 full layers.

---

### Thread Analysis (storyArc, trajectory) — ✅ PASS

**Note:** The two thread analyses pulled are from the Grok era (March 2026) — `riskScore` and `sentiment` are blank on these older records, which is expected (those fields were added later). The Gemini-generated thread analyses from May 5 do have riskScore populated.

**Content quality:** Good analytical journalism style. Specific dates ("March 22, 2026"), named institutions (Italian Senate, THAAD deployments, UN Security Council), plausible timeframes.

---

## Issues to Fix

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **High** | Summary preamble — AI meta-text renders on frontend | Patch `NewsProjectInvokeAgentLambda`: strip "Here is a summary..." prefix from summary content before writing to DDB |
| 2 | Low | Trace cause 3rd structural layer sometimes truncated | Strengthen prompt instruction |

---

## What's Good Enough to Ship

- Predictions: excellent, no changes needed
- Trace cause: good, ship as-is
- Thread analysis storyArc/trajectory: good, ship as-is
- Summary: needs preamble strip before it looks right on frontend

---

## Recommended Next Step

Fix the summary preamble in `NewsProjectInvokeAgentLambda-dev`. Two options:

**Option A (safer):** Post-process strip in the Lambda — regex remove "Here is a summary of the news.*?:\n?" before writing to DDB.

**Option B (better long-term):** Add to the summary prompt: "Write directly. Do not preface with any introduction or meta-commentary."

Option B is cleaner — fixes root cause and avoids brittle regex.
