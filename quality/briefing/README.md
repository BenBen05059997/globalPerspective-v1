# Economy Briefing — eval set

A fixed standard for the "Today in the economy" briefing on `/economy`
(see `ECONOMY_BRIEFING_PLAN.md`, workstream **W1**). Build the standard before
tuning any prompt: you can't optimize against a target that comes from the optimizer.

Three parts:

1. **Frozen fixtures** (`fixtures/`) — snapshots of the three data sources the page
   loads (`economic_top_movers`, `economic_impact_list`, `markets_global`), shape
   `{capturedAt, topMovers, disruptions, markets}`. `real-<date>.json` is a live
   capture; `edge-*.json` are hand-built to test specific honesty failures.
2. **Assertion harness** (`assertions.js`) — objective, programmatic honesty-contract
   checks (no LLM, no judgment). This is the floor every briefing must clear.
3. **Candidate target briefings** (`targets/*.md`) — one per fixture, the *intended*
   honest output. **UNRATIFIED until a human (Ben) signs off** — only then do they
   count as ground truth for the subjective ceiling (lead choice, prose).

## Capture a new fixture

```bash
node quality/briefing/fixtures/capture.js
# → writes fixtures/real-<today>.json and prints counts
```

Uses built-in `fetch` (Node 18+); all three actions are public, read-only. No deploy.

## Run the assertions

```bash
node quality/briefing/assertions.js
# self-tests checkBriefing() against every fixture with good + bad sample briefings
```

Exit 0 = all expected pass/fail outcomes held.

`checkBriefing(briefingText, fixture)` → `{passed, failures}` enforces:

- **(a)** no numeric token absent from the fixture (whitelist: severity counts,
  citations, consensusStrength, directions, sanitized series changes, instrument
  levels; 1-dp rounding tolerance).
- **(b)** every named story (bold/quoted, 4+ words) resolves to a real fixture headline.
- **(c)** stated severity counts and total story count match the fixture tallies
  (a per-instrument citation count like "Brent, 27 stories" is allowed).
- **(d)** no directional claim contradicts the sign of that instrument's realized
  `series[id].change` — UNLESS explicitly framed as a consensus-vs-realized divergence.
- **(e)** `sanitizeSeries(series)` whitelists to tracked tickers (mirrors EconomyPage
  `TRACKED_UNIVERSE`) and drops `|change|>=25` (the `ETH_24H_CHANGE -311` junk-key bug),
  used before any "biggest move" pick.

## Honesty contract (what the fixtures defend)

- Never fabricate a number.
- Every named story traces to a real `scopeId`/headline.
- Distinguish **CONSENSUS DIRECTION** (what stories expect) from **REALIZED MOVE**
  (actual day-over-day %); flag divergence, never smooth it.
- Omit absent fields rather than guess.

## Ratification

The `assertions.js` floor is objective and always-on. The `targets/*.md` are
**candidates** — they describe the correct honest behavior but must be human-ratified
before being treated as ground truth for prose/lead-selection quality. Until then each
target carries `STATUS: UNRATIFIED — awaiting operator sign-off`.
