# v1 Prediction Resolution — runbook (Phase 2)

The agent-run loop that turns due `methodologyVersion:1` triggers into scored `finalVerdict`s.
Phase 2 of `PREDICTION_METHODOLOGY_V1_PLAN.md`. Validated by the 2026-07-04 pilot; only the
capture side (Phase 1) is automated — **resolution is deliberately agent-run**, because reliable
verdicts require independent web-grounded verification, not a headless heuristic (the legacy
`newsPredictionResolver` proposes but punts `unclear` ~86% of the time).

## When to run

When `resolve-v1-extract.js` reports `due & open > 0`. Roughly weekly. The first v1 deadlines
fall ~2026-07-11 (the pipeline went live 2026-07-04). Nothing to do until then — the extractor
is honest-empty (`Nothing due yet`).

## The loop

**1. Extract the worklist (read-only).**
```
node predictions/resolve-v1-extract.js --out /path/to/scratch/worklist.json
```
Scans only v1 records, emits due (`deadline <= today`, no `finalVerdict`) triggers oldest-first.
It also reports **gate escapes** (any v1 trigger with `deadline <= generatedAt`) — that should
always be 0; a non-zero count means a capture gate regressed, fix that before resolving.

**2. Verify — independent, web-grounded, blind (the agent does this).**
Fan out verification over the worklist (as in the pilot — parallel sub-agents, ~10 triggers each).
Rules, non-negotiable:
- Form the verdict from real web search **before** looking at any prior proposal. Never from memory.
- `fired` — concrete evidence the event occurred on/before the deadline (cite url + title + date).
- `not_fired` — evidence of absence in a context where the event would have been reported (cite what you found).
- `unclear` — ambiguous / unverifiable / malformed. **Under any real doubt, choose `unclear`** (it is Brier-excluded).
- **Every `fired` gets a SECOND independent blind pass.** If the two passes disagree on scoreability, downgrade to `unclear`.
- Batch-complete, oldest-first. No cherry-picking which triggers get resolved (resolving only the ones that fired inflates the score).

Emit a verdicts file: JSON array of
`{ pk, sk, triggerId, verdict, confidence?, evidence?:[{url,title,note}], note? }`.

**3. Operator blind spot-check (~10%).**
Before committing, the operator blind-judges a random ~10% sample (no peeking at the agent verdict),
and the agreement rate is recorded — it becomes part of the published methodology (`/track-record`).

**4. Write back — dry-run, then commit.**
```
node predictions/resolve-v1-write.js verdicts.json            # dry-run: shows every change, writes nothing
node predictions/resolve-v1-write.js verdicts.json --commit   # writes finalVerdict + confirmedBy:'agent-verified'
```
Safeguards: v1-only (refuses legacy records), idempotent (skips already-resolved unless `--force`),
and a snapshot flips to `status:'resolved'` only once **every** dated trigger has a verdict.

## Invariants (why this is trustworthy)

- **Never score the legacy backlog.** Both scripts filter on `methodologyVersion`. Pre-v1 records
  stay immutable + unscored (the era cut, `PREDICTION_METHODOLOGY_V1_PLAN.md` §2).
- **`confirmedBy:'agent-verified'`**, not `'human'` — the record says exactly who confirmed it, and
  the agent's `evidence[]` is attached to every trigger, so any verdict is auditable against its cites.
- **Unclear is the safe default** and is excluded from the Brier score — a thin/ambiguous verdict
  never corrupts the public number.

## Files
- `resolve-v1-extract.js` — due-trigger worklist (read-only)
- `resolve-v1-write.js` — agent-verdict write-back (dry-run default)
- `review.js` — the original interactive/human write path (still valid; `confirmedBy:'human'`)
