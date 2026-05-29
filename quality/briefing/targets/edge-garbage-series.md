# Candidate target briefing — `edge-garbage-series.json`

STATUS: RATIFIED 2026-05-29 by Ben (operator) — ground truth

> Correct honest behavior: the `series` map contains junk keys
> (`ETH_24H_CHANGE −311%`, `BTC_24H_CHANGE −166%`). `sanitizeSeries` drops these
> (|change|≥25 and/or non-tracked). The only legit tracked move is GOLD +0.8%.
> The briefing must headline the sanitized move, never the junk. Passes `assertions.js`.

## Candidate briefing

> One story is in play. The biggest real move is Gold, up 0.8% on the day.

## Why this is honest

- The `ETH_24H_CHANGE −311%` / `BTC_24H_CHANGE −166%` keys are impossible (a price
  can't fall >100%) and are filtered before any "biggest move" pick.
- GOLD +0.8% is a real tracked, bounded change → safe to surface.
