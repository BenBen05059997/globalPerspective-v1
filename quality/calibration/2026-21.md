# Calibration Report — 2026-21

**Window:** last 30 days
**Total records in window:** 33 (live: 26, tombstone: 7)
**Distinct days with records:** 5

## Distribution health

| Metric | Value | Healthy band | Alarm if |
|---|---|---|---|
| severity: % severe | 7.7% | 5–25% | drifts ≥ 2σ in 7d |
| severity: % moderate | 84.6% | 50–80% | drifts ≥ 2σ in 7d |
| severity: % minor | 7.7% | 5–25% | drifts ≥ 2σ in 7d |
| tombstone rate | 21.2% | 20–40% | <10% or >60% |
| mean instruments/record | 3.88 | 2.5–4.0 | < 2 or > 5 |
| confidence: % high | 15.4% | 10–25% | > 40% |
| confidence: % medium | 84.6% | 50–70% |  |
| confidence: % low | 0.0% | 10–30% |  |
| mean Phase A flags/record | 1.38 | ≤ 1.5 | > 2.5 |
| inline-citation compliance (7d) | 100.0% | 100% | < 95% |
| judge coverage (>24h) | 0.0% | ≥ 80% | < 50% |
| judge low-quality rate | — | 5–25% | > 30% or < 2% |

## Horizon mix

- immediate: 0 (0.0%)
- days: 11 (42.3%)
- weeks: 14 (53.8%)
- months: 1 (3.8%)

## Daily coverage timeline

| Date | Live | Tombstones | Total |
|---|---:|---:|---:|
| 2026-05-19 | 14 | 3 | 17 |
| 2026-05-20 | 2 | 1 | 3 |
| 2026-05-21 | 6 | 0 | 6 |
| 2026-05-22 | 2 | 2 | 4 |
| 2026-05-23 | 2 | 1 | 3 |

## Phase D backtest readiness

- Distinct days of live records: **5** / 30 needed
- Estimated unblock date: ~TBD — keep running cron
