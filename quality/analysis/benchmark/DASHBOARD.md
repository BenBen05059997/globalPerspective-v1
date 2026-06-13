# Analysis Studio — Benchmark Dashboard

One row per run. PASS = no hard validator error AND faithfulness≥4 ∧ overreach≥4 ∧ calibration≥3.5 ∧ no dim <2. Scores are the mean of an N-pass auditor panel (`panel` column); `splits` = cases where the panel disagreed (queued for human review via `review.mjs`).

| date | analyst | auditor | panel | pass% | hard-fails | splits | faith | over | calib | diff | cite | insight | prob-spread |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-06-13 | deepseek-v4-flash | deepseek-v4-pro | ×1 | 60% | 0 | — | 3.8 | 4.2 | 4.2 | 4.0 | 4.2 | 4.0 | 27.5 |
| 2026-06-13 | deepseek-v4-flash | deepseek-v4-pro | ×3 | 80% | 1 | 4 | 3.8 | 4.3 | 3.9 | 3.9 | 4.3 | 3.7 | 45 |
