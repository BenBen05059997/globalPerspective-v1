## Drafter eval: can the verdict-drafting AI be trusted? — 2026-10-01 — plan (not built)

**Goal:** measure, before the first real settlements (the first draw is 2026-10-12), how often the scoring drafter (the AI in `newsPredictionResolver` that drafts yes / no / void for each sampled forecast question) agrees with the operator, and how often it wrongly says "happened". Its drafts become the public accuracy score once the operator confirms them, so a sloppy drafter either wastes the operator's Mondays or lets mistakes into the score.

**Why this eval, and only this one first (operator 2026-10-01: "1 only first and see what we can get here"):** it is the highest-stakes AI output on the site, and the operator's Monday confirmations produce ground-truth labels for free, so the eval grows by itself. The other candidates (forecast-question quality, drift-direction regression set, story analysis flash vs v4-pro, story-link plausibility, the prompt-caching audit) are recorded in `BACKEND_PLAN_2026-09-27.md` for later.

**Method** (from Anthropic's "Demystifying evals for AI agents" and "Automating eval design and hillclimbing"):
- start with ~25 real cases (the articles: 20–50 from real failures; ≥ 24 with repeated runs);
- code-based graders on checkable claims, not a 1–5 score;
- a human (the operator) is the gold standard;
- read the transcripts of every disagreement;
- regression use before any drafter change;
- train / test hill-climbing only once there are ≥ 50 cases.

The claude-api skill's `build-eval` / `hillclimb` tools target Claude apps and skip other providers, so we follow the method, not the tool. The drafter runs on DeepSeek `deepseek-v4-pro`.

**Reads / references:**
- `amplify/backend/function/newsPredictionResolver/src/{draft,search,index,store}.js` (the `replay` action runs the drafter with no writes and never sees `p`);
- `predictions/settle-review.js` (the operator's confirm CLI);
- `TASK_2026-09-30_batch4_scoring_web_share.md` (phase B; the drafter rules: YES needs a verbatim quote + a second agreeing pass, NO only after deadline + 3 days, VOID with a reason code);
- `GlobalPerspectivePredictionLog` (`PRED#` rows with past deadlines; `Q#` rows once questions exist).

### What gets built
1. **Starter set (the operator labels ~25 cases once, ~30–45 min).**
   - The picker draws past-deadline triggers from the prediction log: balanced likely-yes / likely-no / ambiguous, one per story, never a July-pilot verdict as gold (those were agent-made).
   - `quality/drafter-eval/label.mjs` shows one case at a time (question text, deadline, named source, issue date; **never the probability**), and the operator answers yes / no / void (+ reason) and pastes the evidence link.
   - Saved to `quality/drafter-eval/cases.jsonl` (`labeller`, `labelledAt`, `origin: starter`).
2. **Auto-growth.** `predictions/settle-review.js` appends every operator-confirmed verdict to `cases.jsonl` (`origin: monday`), with no extra operator step. The question text and the operator's verdict only (never `p`).
3. **Runner.** `quality/drafter-eval/run.mjs` invokes `newsPredictionResolver {"action":"replay", …}` (no writes) for each case, **3 trials** each; one bare invoke per call, no loops against production.
4. **Graders (code).**
   - Agreement with the operator's label, overall and per class.
   - **False-yes rate** (drafted "happened" when the operator said no or void), the costliest error.
   - The evidence quote actually present in the returned source text.
   - Consistency across the 3 trials (pass^3: all three agree).
   - Abstain ("needs human") rate, counted as safe, not wrong.
5. **Report.** `quality/drafter-eval/report.md`: agreement with a confidence interval (stated plainly: with 25 cases it is wide, e.g. "about 85%, plausibly 65–95%"), a confusion table, and every disagreement with the drafter's search results and reasoning, for the operator to read.

### What the operator can expect
- One-time labelling, ~30–45 min.
- A short report: e.g. "agreed on 21 / 25; wrongly said 'happened' 1×; 3 cases inconsistent across runs", plus the disagreement list.
- **High agreement:** Monday reviews become quick confirmations, and later the track record page can say "drafted verdicts agreed with human review in X of Y cases".
- **Low agreement:** the drafter is fixed before real scoring starts (mid-October).
- **Afterwards:** re-run before any drafter prompt / model / search change, and keep a change only if the score does not drop.
- **At ≥ 50 cases:** train / test hill-climbing is possible.

### Cost and limits
- About $0.25 per full run (25 cases × 3 trials on v4-pro) + ~225 Brave searches.
- **Open item B2:** the Brave Search plan / limits are not checked yet. Check them before running often.
- No AWS change (local scripts + the existing `replay` action). No CI, run by hand, per the operator's no-CI rule.

### Changes (code), when built
- `quality/drafter-eval/{label.mjs, run.mjs, graders.mjs, pick-starter.mjs, README.md}` (new).
- `quality/drafter-eval/cases.jsonl` (new; labels only, no probabilities).
- `predictions/settle-review.js` (append confirmed verdicts).
- Tests for the graders and the append.

### Docs to update on completion
- `BACKEND_PLAN_2026-09-27.md` (the evals section);
- `ARCHITECTURE.md` (the prediction calibration section: the eval exists and how to run it);
- `predictions/V1_RESOLUTION_RUNBOOK.md` (Mondays also feed the eval);
- `CHANGES.md`; `INDEX.md` row.

### ▶ LIVE TRACKER
| Step | What | Status |
|---|---|---|
| 0 | Plan written | ✅ 2026-10-01 |
| 1 | Build picker + labelling script + runner + graders + report + settle-review append | Waiting for the operator's "build" |
| 2 | The operator labels the ~25 starter cases | After step 1 |
| 3 | First run + report to the operator | After step 2 |

**Completion checklist:**
- [ ] scripts + tests
- [ ] starter set labelled
- [ ] first report delivered
- [ ] docs updated
- [ ] status → done
