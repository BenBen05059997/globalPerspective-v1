# Candidate target briefing — `edge-missing-fields.json`

STATUS: RATIFIED 2026-05-29 by Ben (operator) — ground truth

> Correct honest behavior: the single story has no `historicalAnalog`, no
> `winners`/`losers`, no `marketContext`, and its `series` entries have no numeric
> `change`. The briefing must OMIT these clauses — no analog, no realized move,
> no affected countries — rather than guess. Passes `assertions.js`.

## Candidate briefing

> One story is repricing markets today. The sharpest is **Quiet supply note with no
> analog.** No tracked instrument shows a clean day-over-day move.

## Why this is honest

- No analog field → no analog clause.
- `series.COPPER` / `series.BRENT` have no numeric `change` → `sanitizeSeries`
  yields nothing → the briefing states there is no clean move rather than inventing one.
- No winners/losers → no affected-country clause.
