# Audit Findings — Problem Register (2026-06-24)

A fact-checked register of problems found while investigating the `newsSourceAudit`
summary-drift email alert + the breaking-alert scorer. Each item marks **evidence** and a
**confidence** level (Confirmed / Likely / Hypothesis) — no claim is asserted without a check.

> **Honesty note up front (a process lesson):** my first read of the drift alert called the
> heatwave headline's *"Hottest Day Since 1947, 40 Drown"* a fabrication. **That was wrong** —
> both are TRUE and corroborated by NPR/WaPo/Al Jazeera/CBS. A `DRIFT` verdict means "our
> summary's claim is **not supported by the attached source page**," **not** "the claim is
> false." Always fact-check a drift flag before acting.

---

## A. Source-truth / summary-drift findings (this investigation)

### A1. Weak source attribution — tangential pages used as sources for strong claims · **Confirmed**
**Evidence:** The "Europe Heatwave" topic's attached sources are mostly **video clips and
explainers**, not the news article: three france24 `/video/` clips ("Parisians flock to canal",
"forest-fire red alert", "Europe wilts"), an Al Jazeera **"how to stay cool and treat
heatstroke"** explainer, and a CNA **"what is a heat dome"** explainer. Our summary's strong
claims ("worst heatwave in history", "hottest day on record", "68,000 homes in Brittany") came
from the RSS *blurbs* of these pages. I fetched the Al Jazeera explainer directly: it contains
**none** of those claims (only a "Recommended Stories" *link* mentions the heatwave).
**Impact:** the summary cites pages that don't substantiate the claim → the auditor flags drift,
and a paying reader following the source link lands on a heatstroke how-to, not evidence.
**Root cause:** the clustering step attaches any article whose blurb matched, including
tangential video/explainer/service pieces. **Fix direction:** rank/prefer substantive news
articles over `/video/` + explainer URLs when attaching sources; or down-weight them.

### A2. Snippet-vs-full-text gap — the audit judges against re-fetched full pages · **Confirmed**
**Evidence (code):** `newsSourceAudit` `DRIFT_SYS` asks the auditor to flag any summary claim
"not supported by **the article**", and it **re-fetches the full article live**. But our summary
is grounded in the **RSS snippet captured at ingest** (`buildSummaryPrompt` uses
`topic.sources[].snippet`). When the snippet and the live page diverge — or the page is a
video/explainer (A1) — the summary can be **faithful to its snippet yet flagged as drift**.
**Impact:** an unknown share of the ~21% drift rate is this artifact, not fabrication. The two
flags I verified (heatwave, war-powers) were both factually accurate.
**Fix direction:** have the auditor compare against the **stored snippet** (what the summary was
actually grounded in) in addition to / instead of the re-fetched page; or store fuller article
text at ingest so summary and audit share the same basis.

### A3. Title prompt has no content-grounding rule · **Confirmed (latent risk, not demonstrated harmful)**
**Evidence (code):** `newsInvokeGemini` title/cluster prompt says *"BE SPECIFIC: Include key
details (names, **numbers**, locations, actions)"* and models it with figure-heavy examples
(*"…Temperatures Hit 48°C"*, *"25,000 Layoffs"*). Its anti-fabrication rules cover **URLs only**
("DO NOT INVENT URLs"). The **summary** prompt, by contrast, explicitly forbids invented numbers
("Do NOT state an outcome, verdict, vote result, casualty figure, or number the snippets do not
report"). So titles *may* carry an ungrounded figure.
**Impact:** the title is the **email subject line + public headline + the figure we'd sell in the
Signal API** — the highest-visibility text, with the weakest grounding rule.
**Caveat (no assumption):** in the case examined the title's numbers ("40 drown", "1947") were
**true**, so this is a *latent* risk — I found no confirmed case of a false title figure.
**Fix direction:** add the summary's anti-fabrication rule to the title prompt (figures/dates/
death-tolls/superlatives must appear in a source snippet).

### A4. War-powers summary — minor added framing · **Confirmed (minor)**
**Evidence:** I fetched the cited asiatimes article. Three of four summary claims are fully
supported (symbolic resolution, four named Republicans, "instructs Trump to withdraw US forces").
The fourth — *"the agreement is likely to have imperfections"* — is a **soft editorial addition**;
the article says negotiations are "rocky and uncertain", never "imperfections". This is the
likely drift the auditor caught. Low severity.

### A5. Real drift rate · **Confirmed (measurement)**
**Evidence:** 14-day CloudWatch history of `newsSourceAudit`: **~14 drift flags / 66 audited ≈
21%** (per-run: 2,1,0,1,1,0,2,2,0,3,2). But of the flags I fact-checked, the underlying facts
were accurate — so the **harmful-fabrication** rate is lower than 21%; much of it is A1/A2
(weak-source / snippet-gap) framing nuance. **Open:** the exact reason per flag lives only in the
SNS email (verified: CloudWatch logs the verdict, not the reason) — re-running the auditor or
reading the email is needed to classify each.

---

## B. Breaking-alert scoring findings (cross-referenced — full detail in the other docs)

### B1. Country-risk dominance · **Confirmed · Stage-1 fix shipped to code (commit f8a3de0), NOT redeployed**
Country *standing* risk was the heaviest weight (2.0) and event-independent → 62–88% of the alert
bar from geography alone. Fixed: cap at 50 + weight 2.0→1.0 (≤25% of bar). See `SCORING_RUBRIC.md`
§2a / `BREAKING_ALERT_V2_BUILD_PLAN.md` Stage 1.

### B2. Loudness-not-urgency · **Confirmed (design)**
Every scoring signal measures coverage volume or country attribute; none scores whether a real
**event** occurred (vs warning/filing/announcement/resolved), novelty, or credibility. ~14%
precision in a 22-agent debate. See `BREAKING_ALERT_DEBATE_2026-06-24.md` + `SCORING_RUBRIC.md`.

### B3. Multi-country contamination · **Confirmed (partly mitigated)**
`maxRegionRisk` takes the MAX risk across a story's countries, so a peripheral high-risk country
inflates the score (e.g. a US-China lawsuit inherits China's risk). The Stage-1 cap limits the
damage; the proper fix (GDELT-style actor→actor relationship) is Stage 4.

### B4. Within-cycle linking ≈ 0 → "breadth" signal rarely fires · **Confirmed (observation, not a bug)**
Live data: 13 topics → 13 distinct threads this cycle, 0 linked. Each event is its own topic, so
the "breadth" (concurrent angles) signal contributes ~0; threading is **cross-day** (verified
working — flagged stories correctly continue older threads). Implication: the score leans on
popularity/risk/economic/velocity, not breadth.

### B5. markSent IAM gap · **Found + Fixed (2026-06-24)**
The auto-send role lacked `dynamodb:UpdateItem`, so sent alerts weren't marked `sent` (email went
out, row stayed `proposed`, in-app feed didn't update). Added the permission; corrected the row.

---

## Priority read
- **A1 + A3** are the substantive source-truth items (weak source attribution; ungrounded title
  figures) — both real, both fixable, neither is the dangerous fabrication first feared.
- **A2** suggests the *auditor itself* may be over-sensitive (snippet-vs-fulltext); worth tuning
  the auditor, not just the summarizer.
- **B1** (country-risk) is the only scoring item already fixed in code; the rest are gated on a
  labeled gold set per the build plan.
- **Do not act on a drift flag without fact-checking it** (the A-section process lesson).
