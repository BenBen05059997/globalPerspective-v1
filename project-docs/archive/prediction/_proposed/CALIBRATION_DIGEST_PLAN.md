# Calibration Digest Plan — compact the track record into a constant-cost feedback loop

**Status: DESIGNED 2026-07-08 — DO NOT BUILD YET (data-gated, see Activation Gates).**
**Prereq reading:** `PREDICTION_METHODOLOGY_V1_PLAN.md` (capture gates, era cut, resolution loop). This plan is its Phase 5.

---

## 1. Why this exists

The resolution loop is producing a growing trace of resolved triggers (35 as of 2026-07-08; **~1,539 pending** triggers already committed in the log and scheduled to resolve as deadlines pass). Two findings from the first two resolution runs motivate this plan:

1. **Stated probabilities carry signal but run hot.** Calibration is monotonic (0–20% stated → 9% fired · 20–40% → 9% · 60–80% → 54%), but the ~65% "Most Likely" template over-states by ~10 points.
2. **Misses cluster by class.** The model over-predicts *institutional response speed* (agency completes X in 72h, court sustains full penalty, grid restored to threshold). Real bureaucracies move slower than the 65% scenarios assume.

We cannot train the model. What we CAN do is anchor its probabilities to **our own measured base rates** — reference-class forecasting computed from the immutable log. The design problem: the trace grows unboundedly, but generation must never pay for reading it. Solution: **expensive aggregation on a schedule, cheap reads at serve time** — the same pattern as `newsDriftCorrector`, `newsWeeklyBrief`, and the signals cron.

```
GlobalPerspectivePredictionLog (raw trace, grows forever)
        │  weekly cron Scan
        ▼
newsCalibrationDigest (new Lambda: classify → aggregate → distill)
        │  writes ONE small row (+ dated history row)
        ▼
CALIBRATION#DIGEST row (~200-token JSON, constant size)
        │  one GetItem per forecast generation
        ▼
NewsProjectInvokeAgentLambda → calibrationBlock in buildPredictionPrompt()
        → records stamped methodologyVersion:2
```

Cost per forecast: one GetItem + a few hundred prompt tokens, **flat whether the trace holds 35 verdicts or 35,000**.

## 2. Principles (non-negotiable)

- **Never remap displayed probabilities.** The number the model states is the number the log stores and the page shows. Calibration feedback changes what the model *says next time*, never what it *already said*. A serve-time recalibration wrapper forks the number between log and page — forbidden (honesty principle, [[feedback_no_misinformation_fallback]]).
- **Era-stamp every behavior change.** The first generation run with the digest injected stamps `methodologyVersion:2`. v1 (flat 65/20/15 template) is the control group; the v2-vs-v1 calibration curve is the public before/after artifact — and the calibration-moat pitch for the signal API.
- **Thresholds gate every stat.** A digest row appears only when its `n` clears the floor (see §5). The injection block auto-shrinks to whatever is statistically real — at worst it's empty and generation behaves exactly like v1.
- **Digest never blocks generation.** GetItem fails / row absent / row stale → skip the block, log a warning, proceed. Same never-throws posture as `logPredictionSnapshot`.
- **Two compaction layers, never blurred.** The *statistical digest* (this plan) calibrates numbers globally. *Retrieved analogues* (top-k similar resolved cases, few-shot) inform per-situation reasoning — explicitly **out of scope** here (§8); a summary of 1,000 cases can't reason about one case, and 10 analogues can't calibrate globally.

## 3. Activation gates — when to build what

| Checkpoint | Trigger condition | Action | Infra |
|---|---|---|---|
| **CP-1 "measure"** | **~50 resolved triggers** (at ~35 now; likely 1–3 more weekly sweeps) | Manually compute the 65%-bucket empirical fire rate (the standing 2026-07-06 decision — see [[project_prediction_methodology_v1]]). Materially off 65% → hand-write a 2–3 line static calibration note into `buildPredictionPrompt` and stamp `methodologyVersion:2`. Near 65% → ship nothing. | **None.** Prompt edit only. |
| **CP-2 "automate"** | **~150 resolved triggers** AND ≥2 trigger classes with n≥30 | Build Phases A–C below: the digest pipeline replaces the CP-1 static note with live numbers. | New Lambda + cron + 1 row. |
| **CP-3 "skill map"** | ~500 resolved | Extend digest with per-domain skill slices; scope paid signal tiers to buckets with proven calibration. | Digest field additions only. |

Do not build CP-2 infrastructure before CP-1 has data. A digest of 35 points is noise dressed as signal.

## 4. Phase A — trigger classifier (pure, deterministic, tested)

New pure module `classifyTrigger(text)` in `amplify/backend/function/newsCalibrationDigest/src/lib.js` — keyword/regex classifier in the same spirit as the G6 gate (deterministic, `node --test`, corpus-validated before use). **It runs inside the digest job at aggregation time, classifying all triggers on the fly each run** — no capture-time schema change, no backfill writes, taxonomy freely revisable (a v2 taxonomy simply reclassifies the whole trace on the next cron).

Taxonomy v0 (informed by the first 35 verdicts; expect revision):

| class | signature (sketch) | early signal |
|---|---|---|
| `institutional_response` | agency/military/utility *completes·deploys·restores·announces* within a window | fires LOW (the known bias) |
| `court_ruling` | court/tribunal *rules·upholds·overturns·imposes* | splits on literal penalty wording |
| `diplomatic_statement` | govt/bloc *issues statement·condemns·announces deal·signs* | mixed |
| `quantified_threshold` | numeric threshold (≥N aircraft, 90% restored, >€3B) | near-misses common → fires LOW |
| `violence_escalation` | attack/casualties/strike occurs | low-p tails, rarely fire (correct) |
| `election_political` | wins election·advances·coalition forms | — |
| `other` | fallback | — |

A trigger may match multiple classes → assign the FIRST match in a fixed priority order (deterministic). Corpus-validate exactly like G6: run over all live v1 triggers, eyeball the class assignment sample, 0-surprise rule before shipping.

## 5. Phase B — `newsCalibrationDigest` Lambda + weekly cron

Dedicated Lambda (clean-architecture preference, [[feedback_clean_architecture]]), nodejs22, runtime `@aws-sdk` only — **no bundled node_modules** (~small zip, same deploy shape as `NewsProjectInvokeAgentLambda`).

**Job (weekly, e.g. `cron(0 8 ? * MON *)` — after the weekend resolution sweep):**
1. Scan `GlobalPerspectivePredictionLog` with `FilterExpression: attribute_exists(methodologyVersion)` (v1+ only, mirrors `resolve-v1-extract.js`).
2. Collect resolved triggers (`finalVerdict` ∈ {fired, not_fired}; unclear excluded — same rule as the scoreboard).
3. Classify each via `lib.classifyTrigger`; aggregate per probability-bucket and per class.
4. Distill `topBiases`: deterministic rules (e.g. "bucket stated-vs-actual gap > 8pts AND n ≥ 30 → emit bias line"), NOT an LLM.
5. Write two rows:
   - `PK: CALIBRATION#DIGEST, SK: LATEST` — overwritten each run; what generation reads.
   - `PK: CALIBRATION#DIGEST, SK: <YYYY-MM-DD>` — dated history, never overwritten (the before/after artifact trail).

**Digest row shape (~200 tokens serialized):**
```json
{
  "asOf": "2026-09-01",
  "resolvedN": 480,
  "methodologyNote": "v1 era-cut 2026-07-04",
  "buckets": [
    { "range": "60-80", "meanStated": 0.65, "actualFired": 0.51, "n": 160 }
  ],
  "classes": [
    { "class": "institutional_response", "fireRate": 0.31, "n": 85 },
    { "class": "quantified_threshold",   "fireRate": 0.28, "n": 41 }
  ],
  "topBiases": [
    "Scenarios stated ~65% have fired ~51% — shade 'Most Likely' probabilities down",
    "Triggers expecting an institution to complete an action within days fire ~31% — bureaucracies are slower than expected"
  ]
}
```
Rows below the n-floor (buckets n<30, classes n<30) are **omitted**, not zero-filled.

**⚠️ Table-cohabitation gotchas (both verified against current code 2026-07-08):**
- The digest rows must **NOT carry a `methodologyVersion` attribute** — `resolve-v1-extract.js` scans on `attribute_exists(methodologyVersion)` and `prediction_track_record` (newsSensitiveData `index.js` ~:892) filters `methodologyVersion >= 1` in code. Omitting the attribute keeps digest rows invisible to both.
- `prediction_track_record` Scans the WHOLE table with a projection; digest rows will enter the scan but drop at the v1 filter. Acceptable; if the projection ever changes, re-verify.
- IAM: the digest Lambda needs Scan+PutItem on `GlobalPerspectivePredictionLog`; `NewsProjectInvokeAgentLambda` needs one additional GetItem (it already has PutItem on this table for snapshots — verify its role covers GetItem before assuming).

## 6. Phase C — inject into generation (`methodologyVersion:2`)

`NewsProjectInvokeAgentLambda/src/index.js`:
1. Load digest once per invocation (GetItem `CALIBRATION#DIGEST / LATEST`) alongside the existing once-per-invocation FACTS# load (~:89). Staleness guard: `asOf` older than 21 days → treat as absent.
2. Build `calibrationBlock` (pure function in `lib.js`, `node --test`):
```
=== YOUR MEASURED TRACK RECORD (use to calibrate probabilities) ===
Across 480 publicly scored triggers:
- Scenarios you rate ~65% have actually fired ~51% — shade "Most Likely" down unless evidence is strong.
- Triggers expecting an institution (agency/court/utility) to complete an action within days fire ~31%.
- Quantified thresholds (≥N units, X% restored) fire ~28% — near-misses are the norm; widen margins or lower probability.
State probabilities you would bet on at these measured rates.
=== END TRACK RECORD ===
```
3. Pass into `buildPredictionPrompt(...)` (index.js:390) next to `premiseBlock` (call site :475); also into the research prompt if trials show it helps.
4. `lib.buildGatedScenarios` stamps `methodologyVersion: 2` **only when a non-empty calibrationBlock was injected** (else stays 1) — the era boundary is behavioral, not calendar.
5. Tests: block renders from a digest fixture; empty/stale digest → empty block + version stays 1; snapshot carries `capture.calibrationDigestAsOf` for auditability.

## 7. Phase D — surface it (after v2 has resolved data)

- `/track-record` methodology section gains one disclosure line: "From <date>, generation is fed its own measured track record (methodology v2); v1 vs v2 calibration shown separately once v2 triggers resolve."
- Scoreboard: `prediction_track_record` splits calibration by methodologyVersion when v2 resolved-n ≥ 30 — the public before/after curve.
- Signal API: digest JSON becomes a sellable `calibration` endpoint field (the moat artifact, [[project_signal_api_pivot]]).

## 8. Explicitly OUT of scope

- **Retrieved analogues / few-shot from resolved cases** — different mechanism (top-k retrieval, likely embeddings), own plan when the trace justifies it.
- **Any serve-time probability remapping** (§2).
- **LLM-written bias summaries** — `topBiases` stays deterministic rules over aggregates.
- **Per-topic/per-country skill slices before CP-3 n.**
- **Backfill-writing class labels onto stored triggers** — classification stays a digest-time computation.

## 9. Verification ladder (when building CP-2)

1. `node --test` on classifier + digest aggregation + calibrationBlock (pure, hermetic).
2. Corpus dry-run: digest job against live table with `--dry-run` printing the digest instead of writing; eyeball class assignments on ~30 sampled triggers.
3. One manual invoke → verify both rows in DDB; verify `resolve-v1-extract.js` worklist count UNCHANGED and `/track-record` payload UNCHANGED (cohabitation gotcha).
4. Generation canary: one manual `NewsProjectInvokeAgentLambda` invoke → snapshot carries `methodologyVersion:2` + `calibrationDigestAsOf`; triggers still pass G1–G6.
5. Weekly resolution sweeps then measure v2 as v1 was measured. No frontend build needed until Phase D.

## 10. Standing decisions this plan encodes

- 2026-07-06 (adversarial debate): defer prompt calibration until ground truth exists; gate at ~50 resolved. **CP-1 is that decision's execution.**
- 2026-07-08: feedback loop = guards for structural defects (new gate per new failure category), measured-feedback prompt for probability drift; digest = the compaction that keeps agent cost flat as the trace grows.
- Flat-65% v1 era is preserved untouched as the control group.
