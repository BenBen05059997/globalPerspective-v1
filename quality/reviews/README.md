# Human spot-check reviews

Ground-truth layer for the [Economic Disruption quality plan](../../ECONOMIC_DISRUPTION_QUALITY_PLAN.md) (Layer 4 / Phase C). Without this, the LLM-as-judge (Layer 2) drifts toward its own biases — we'd be grading a system against another instance of the same kind of system.

## Weekly cadence

5 records per week, stratified by severity:
- 2 × `severe`
- 2 × `moderate`
- 1 × `minor`

Smaller buckets shouldn't block a review — the picker tops up from larger buckets when one is short.

## Workflow

```bash
# 1. Generate this week's review file from live DDB
node quality/pick_weekly_review.js
# → writes quality/reviews/YYYY-WW.md

# 2. Open the file and fill in the 7-question rubric per record.
#    Take 5–15 minutes per record. Write notes even on "right" answers —
#    they're what calibrates the judge later.

# 3. Rebuild the dashboard once you've reviewed at least one record
node quality/build_dashboard.js
# → writes quality/dashboard.md

# 4. Commit the review file. Don't edit reviews after committing — that
#    would corrupt the ground-truth signal.
```

## The 7 questions

Verbatim from the [quality plan](../../ECONOMIC_DISRUPTION_QUALITY_PLAN.md#layer-4--human-spot-check-rubric-slow-weekly):

1. **Headline accurate?** — `[Y / N / partial]`
2. **Direction calls correct (subjective)?** — `[all correct / some wrong / all wrong]`
3. **Mechanism makes sense given the news?** — `[yes / mostly / partly / no]`
4. **Historical analog appropriate?** — `[good fit / weak / wrong / not in catalog and shouldn't be cited]`
5. **Severity calibrated?** — `[right / too high / too low]`
6. **Any hallucinations or BS?** — `[none / minor / moderate / severe]`
7. **Would you publish this on a paid newsletter?** — `[yes / yes-with-edits / no]`

**Overall grade:** `[A / B / C / D / F]` — your gestalt judgment, not a formula.

## When this becomes valuable

- **Week 1–4:** baseline. Not enough data to draw conclusions; just keep logging.
- **Week 5+:** start cross-checking judge scores against human grades. If a record graded `D` got auto-judged `4.5 mean`, the judge prompt needs tuning (Phase E).
- **Month 3+:** publish aggregate hit-rate / would-publish % on `/disclosures` as the credibility moat.

## Don't

- Don't edit a committed review. Append a follow-up section if your view changes — the original grade is the data point.
- Don't grade records you authored the prompt for. Bias risk.
- Don't skip weeks silently — log a short note explaining why if you do (vacation, etc.). Gaps matter for the trend line.
