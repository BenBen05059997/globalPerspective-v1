# Analysis Studio — Test & Benchmark Plan

**Status:** PLANNED 2026-06-13. Builds on `ANALYSIS_STUDIO_TESTING_PLAN.md` (the
validator + eval Layers A/A2/B/C already shipped). This plan adds a **reproducible
benchmark** so prompt/model/provider changes are *measured*, not vibe-checked.

## 1. Why a benchmark (vs the eval we already have)

The eval (`quality/analysis/run.mjs`) proves the validator works and that a live run
doesn't hard-fail. It does NOT answer: *is the analysis getting better or worse over
time? is V4-Pro worth the cost over V4-Flash? did a prompt edit regress calibration?*
A benchmark answers those with **numbers on a fixed set**, run on demand.

Motivating finding (real run, 2026-06-13): on 3 live stories the model gave all three
scenarios ~60–70% probability — plausible but under-differentiated. The regex
validator passed it (no phantom cites/figures/dates); only a **scored judge over a
fixed set** surfaces "calibration is flat" as a trend. That gap is what this closes.

## 2. The frozen benchmark set (the hard part)

Live stories change daily, so a benchmark must run on **snapshots**, not live data.

- `quality/analysis/benchmark/cases/*.json` — each case = a captured story-set:
  the real `topic` objects + their cached `summary`/`prediction`/`trace` at capture
  time (exactly what `buildAnalysisContext` would assemble), + the `lens`/`mode`.
- Capture tool `quality/analysis/benchmark/capture.mjs`: given topic indices, pulls
  live topics + caches from the proxy and writes a dated case file. Run occasionally
  to refresh/grow the set; **commit the snapshots** so runs are reproducible.
- Target ~12–20 cases spanning: single-thin-story (refusal), single-rich-story,
  multi-story-related (synthesis), multi-story-unrelated (don't-force-a-thesis),
  each across a couple of lenses + one free-form + one deep (web) case.

## 3. Dimensions measured

For each case, run the matrix (bounded — log what's skipped):
- **Models:** `deepseek-v4-flash` (default), `deepseek-v4-pro` (is "strongest" worth
  it?). Optionally one non-DeepSeek when a key is supplied.
- **Lenses/modes:** the case's declared lens + free-form; deep cases separately.

## 4. Scoring (two layers, both already built)

1. **Deterministic** (`analysisValidator.js`): phantom_citation (hard fail),
   invented_figure, invented_date, no_citations, thin_input. Counts per run.
2. **LLM-as-judge** (`judge.mjs` rubric): faithfulness / overreach / calibration /
   citations / insight, 1–5. **Add a `differentiation` sub-check** (are probabilities
   meaningfully spread, or all clustered?) — the gap the real run exposed.
   - Judge with a *different* model than the one under test where possible, to reduce
     self-grading bias. Average 2–3 judge samples (temp 0) per output.

## 5. Metrics & pass bar

Per (model × lens) cell and overall:
- **Hard-fail rate** (any error-severity validator finding) — must be 0.
- **Mean judge scores** per dimension; **PASS** = faithfulness ≥4 ∧ overreach ≥4 ∧
  calibration ≥3.5 ∧ no dimension <2.
- **Cost & latency** per run (tokens × price; wall-clock) — to judge V4-Pro's premium.
- **Regression gate:** compare to the last committed scorecard; flag any dimension
  that drops >0.5 or any new hard-fail.

## 6. Output (mirror the economic-quality dashboard pattern)

- `quality/analysis/benchmark/run.mjs` → writes `scorecard-<date>.json` + appends a
  human-readable `quality/analysis/benchmark/DASHBOARD.md` (one row per run: date,
  model, pass rate, mean scores, cost). Commit the scorecard so trends are in git.
- Console summary: a per-cell table + the regression diff vs last run.

## 7. Cadence (no CI — solo dev)

On-demand, before/after: a prompt edit, a model swap, a provider add. `node
quality/analysis/benchmark/run.mjs` (needs a key). Not wired to GitHub Actions
([[feedback-no-ci-solo-dev]]); it's a manual gate like the rest of `quality/`.

## 8. Build order

1. `capture.mjs` + capture ~12 seed cases from today's live stories (incl. the Iran /
   EU / Venezuela set used in the 2026-06-13 demo).
2. `run.mjs` (matrix → validator + judge → scorecard + DASHBOARD.md).
3. Add `differentiation` to the judge rubric.
4. First baseline scorecard (v4-flash); then v4-flash vs v4-pro comparison.
5. (Later) capture real production outputs as new cases as usage grows
   (`ANALYSIS_STUDIO_TESTING_PLAN.md` Phase 5 logging feeds this).

## 9. Out of scope / open

- Deep (web) mode benchmarking needs a Perplexity/Anthropic key and can't re-verify
  live web sources deterministically — judge it on structure/faithfulness-to-retrieved
  only, flagged as lower-confidence.
- Browser/UI e2e (gate → modal → run → render) stays a separate Playwright check;
  this benchmark is engine/quality only.
