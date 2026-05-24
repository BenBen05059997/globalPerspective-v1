# Economic Disruption — Health Dashboard

_Auto-generated at 2026-05-24T10:37:34.701Z. Regenerate with `node quality/dashboard.js`._

## Verifier — latest iteration

- **Last run:** 2026-05-24T10:36:48.828Z
- **Checks:** 28/30 green
- **Failing:** L1.16 (5), L1.27 (1)

**Diff vs prior iteration:**

- ✅ went green: L1.19 (1→0)
- ❌ went red:   L1.16 (0→5)
- 🟡 still failing: L1.27 (1→1)

## Phase status

| Phase | What | Status |
|---|---|---|
| A | Self-consistency checks (validator + qualityFlags) | ✅ shipped 2026-05-19 |
| B | LLM-as-judge (Gemini 2.5 Flash, 5-axis) | 🟡 deployed; awaiting next cron post-thinking-disable |
| C | Human spot-check (weekly rubric) | ✅ shipped 2026-05-20 |
| D | Direction-call backtest | ⏳ blocked — need 30+ days of ECON records (currently 26 live in window) |
| E | Judge calibration tracker | ⏳ blocked on Phase D + ~4 weeks of human reviews |

## Calibration — last 7 snapshots

| Date | Live | Tomb | %severe | %mod | %minor | conf_high | mean_inst | flags/rec |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-05-23 | 26 | 7 | 7.7 | 84.6 | 7.7 | 15.4 | 3.88 | 1.38 |

## Human spot-check reviews

- **2026-21** — 5 graded

## Lambda deploy history (last commit per file)

| File | Last touched |
|---|---|
| `newsEconomicImpact/src/index.js` | 2026-05-23 (69794de: Verification plan + iteration 1: schema verifier, REST proxy verifier, atom tests, 3 root-cause fixes) |
| `newsEconomicQuality/src/index.js` | 2026-05-24 (374f2b8: Iteration 2: Gemini thinking disabled, L1.16 archive cross-ref, page guards, calibration report, orchestrator) |
| `quality/verify_ddb.js` | 2026-05-24 (bbe3f45: Iteration 4: Playwright E2E, sigma drift, QualityFlag guard, report retention, daily remote routine) |
| `quality/calibration_report.js` | 2026-05-24 (bbe3f45: Iteration 4: Playwright E2E, sigma drift, QualityFlag guard, report retention, daily remote routine) |
| `quality/verify_pages.sh` | 2026-05-24 (bbe3f45: Iteration 4: Playwright E2E, sigma drift, QualityFlag guard, report retention, daily remote routine) |
| `quality/verify_lambdas.sh` | 2026-05-24 (617988c: Iteration 3: CI workflow, Lambda health verifier, pre-push hook, new producer tests) |
| `components/atoms/MechanismCard.jsx` | 2026-05-23 (d8719f9: Phase B+C + UI Wiring Batch A: LLM-as-judge, human spot-check, deeper integration) |
| `components/atoms/QualityFlag.jsx` | 2026-05-23 (d8719f9: Phase B+C + UI Wiring Batch A: LLM-as-judge, human spot-check, deeper integration) |

## How to use this stack

```bash
bash quality/verify_all.sh --fast      # pre-commit (~6s, no AWS)
bash quality/verify_all.sh             # pre-deploy (~30s, with AWS)
bash quality/verify_all.sh --with-e2e  # full + browser E2E
node quality/dashboard.js              # regenerate this file
node quality/calibration_report.js     # update calibration + drift
```

**Daily remote routine:** `trig_01MuDETdraFku7yxBLEs4ZZK` fires 09:00 UTC.
**CI:** `.github/workflows/verify.yml` runs on every push/PR.
**Pre-push hook:** install once with `bash scripts/install_hooks.sh`.
