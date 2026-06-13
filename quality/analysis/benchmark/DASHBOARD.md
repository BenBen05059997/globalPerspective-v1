# Analysis Studio — Benchmark Dashboard

One row per run. PASS = no hard validator error AND faithfulness≥4 ∧ overreach≥4 ∧ calibration≥3.5 ∧ no dim <2. Scores are the mean of an N-pass auditor panel (`panel` column); `splits` = cases where the panel disagreed (queued for human review via `review.mjs`).

| date | analyst | auditor | panel | pass% | hard-fails | splits | faith | over | calib | diff | cite | insight | prob-spread |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-06-13 | deepseek-v4-flash | deepseek-v4-pro | ×1 | 60% | 0 | — | 3.8 | 4.2 | 4.2 | 4.0 | 4.2 | 4.0 | 27.5 |
| 2026-06-13 | deepseek-v4-flash | deepseek-v4-pro | ×3 | 80% | 1 | 4 | 3.8 | 4.3 | 3.9 | 3.9 | 4.3 | 3.7 | 45 |
| 2026-06-13-r2 | deepseek-v4-flash | deepseek-v4-pro | ×3 | 40% | 2 | 3 | 3.6 | 3.8 | 3.9 | 3.9 | 3.9 | 4 | 26.3 |
| 2026-06-13-r3 | deepseek-v4-flash | deepseek-v4-pro | ×3 | 80% | 0 | 3 | 3.9 | 4.4 | 4.4 | 4.3 | 4.3 | 4.2 | 26.3 |
| 2026-06-13-t03 | deepseek-v4-flash | deepseek-v4-pro | ×3 | 60% | 1 | 0 | 3.7 | 4.3 | 4.1 | 4 | 4.4 | 3.9 | 25 |

(`-r2/-r3` = repeat runs at temp 0.5; `-t03` = auditor temp 0.3.)

## Findings (5 runs, 2026-06-13)

- **Trust the means, not the small-sample pass-rate.** Pass-rate swung **40–80%** across identical configs, but the per-dimension means are stable: faithfulness ~3.6–3.9, overreach ~3.8–4.4, calibration ~3.9–4.4, differentiation ~3.9–4.3, citations ~3.9–4.4, insight ~3.9–4.2. The swing is small-sample noise (5 cases → each case = 20pp) plus the analyst regenerating a *different* analysis each run (analyst temp 0.3).
- **Grow the case set to ~12–20** to make pass-rate a stable headline number.
- **Auditor temp drives splits:** temp 0.5 → 3–4 panel-splits (surfaces uncertainty for human review); temp 0.3 → **0 splits** (panel agrees, but may be falsely confident on borderline cases). ~0.4 is a reasonable middle.
- **Recurring hard-fails on single-story cases** (`top-story-solo`, `markets-econ`): the analyst sometimes invents a phantom `[2]` citation or an unsourced figure on a one-story context. A real analyst weakness worth a prompt fix — separate from the benchmark.
