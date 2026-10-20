# v1 Prediction Resolution — runbook (July pilot)

Last verified: 2026-10-19 (scripts read from the repo; `verify-draw.mjs` run against live weeks 2026-W41 and 2026-W42).

> **Superseded 2026-09-30 for new questions.** Resolution is now the weekly sampled flow: the
> `newsPredictionResolver` Lambda commits a seed, draws ~22 questions a week, drafts verdicts and
> (since 2026-10-20, decision 0034) writes them itself. Nothing waits for a human. If a verdict is wrong,
> correct it with a reason: `node predictions/settle-correct.js --correct <qid> <yes|no|void> "<reason>"`
> (appends `Q#<qid>/VERDICT#<n>`, `confirmedBy:'operator'`; the highest n is the verdict the board shows),
> then fix the algorithm. `node predictions/settle-correct.js --list` shows what is due, drafted and settled
> this week. An unclear draft is re-drafted after 5 days; the third unclear draft becomes void. Check a week's draw with
> `node predictions/verify-draw.mjs --week <YYYY-Www>`: exit 0 = verified, 1 = NOT VERIFIED,
> 3 = not revealed yet (only the commitment exists until the week ends). Runbook:
> `project-docs/runbooks/prediction-resolver.md`.
>
> The rest of this page is the July pilot's manual loop for `methodologyVersion:1` `PRED#` rows
> (`resolve-v1-*.js` touch nothing else). Its plan was deleted 2026-10-19:
> `git show 120de90:project-docs/archive/prediction/_shipped/PREDICTION_METHODOLOGY_V1_PLAN.md`.

The agent-run loop that turns due `methodologyVersion:1` triggers into scored `finalVerdict`s.
Resolution is deliberately agent-run, because reliable verdicts need independent web-grounded
verification, not a headless heuristic.

## When to run

When `resolve-v1-extract.js` reports `due & open > 0`; otherwise it prints `Nothing due yet`.

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
  stay immutable + unscored (the era cut, §2 of the deleted plan above).
- **`confirmedBy:'agent-verified'`**, not `'human'` — the record says exactly who confirmed it, and
  the agent's `evidence[]` is attached to every trigger, so any verdict is auditable against its cites.
- **Unclear is the safe default** and is excluded from the Brier score — a thin/ambiguous verdict
  never corrupts the public number.

## Files
- `resolve-v1-extract.js` — due-trigger worklist (read-only)
- `resolve-v1-write.js` — agent-verdict write-back (dry-run default)
- `review.js` — the original interactive/human write path for the July pilot records (`confirmedBy:'human'`)
- `settle-correct.js` — list and correct sampled-question verdicts (current flow)
