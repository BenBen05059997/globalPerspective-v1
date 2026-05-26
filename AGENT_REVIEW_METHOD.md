# Agent Review Method

**Established:** 2026-05-26 — during the `ARCHITECTURE.md` re-verification + subscription deprecation work.

A repeatable way to use multiple AI agents to verify documentation and code against ground truth, instead of trusting a single pass. Use it whenever a change depends on the *current* state of the system (docs that may have drifted, "is this still wired?", "what does the deployed Lambda actually use?").

---

## Roles

**Orchestrator (the main session).**
- Holds full context and is the only actor that edits files.
- Splits the target into independent slices, briefs one auditor per slice, runs them in parallel.
- Consolidates findings, re-checks the highest-risk ones itself, then applies fixes.
- Records genuinely actionable findings in the right plan/TODO — not just doc edits.

**Auditors (parallel sub-agents, one per slice).**
- Read-only. Do **not** trust the doc or any planning file — verify every claim from **primary sources**.
- Return a punch list: each claim → `CONFIRMED` / `WRONG (real value)` / `UNVERIFIABLE (why)`.
- Summarize the CONFIRMED items in one line; spell out every WRONG / UNVERIFIABLE in full.

---

## Primary sources (in priority order)

1. **Live infrastructure** — e.g. `aws lambda get-function-configuration`, `aws scheduler get-schedule`, `aws events describe-rule`. This is the source of truth for anything deployed.
2. **Source code** — the actual file, read whole, not grepped in isolation.
3. **Everything else (docs, plans, memory, TODO checkboxes) is a *claim to be verified*, never evidence.**

### The cardinal rule
**Never infer deployed behavior from source identifiers or a planning doc's checkbox.** Two real misses on this project both came from breaking this rule:
- Env vars named `XAI_API_KEY` / `GROK_MODEL` actually hold DeepSeek/Gemini values.
- A migration plan's unticked "Phase 2" box said pair-intelligence was "still on Grok" — the deployed function was already on DeepSeek.

If a fact is load-bearing, run the CLI/read the file. "The doc/plan says X" ≠ "X is true now."

---

## The loop

1. **Slice** the target into independent chunks (e.g. ARCHITECTURE.md → pipeline Lambdas / data+infra / frontend; or by subsystem).
2. **Fan out** one auditor per slice *in a single message* so they run concurrently. Give each a self-contained brief: what to check, where the primary sources are, the cardinal rule, and the punch-list output format.
3. **Consolidate** the punch lists. Group by CONFIRMED / WRONG / UNVERIFIABLE.
4. **Trust but verify:** before acting on any sweeping or surprising WRONG finding, the orchestrator re-checks it directly (especially deletions, or anything that contradicts memory).
5. **Fix** the doc/code from the verified findings.
6. **Route the actionables:** doc drift → fix the doc; latent bugs / removal candidates → write them into the relevant plan or TODO with enough context to act later.
7. **Re-sweep** with a final grep for residual stale strings you may have introduced.

---

## When to use / not use

**Use** for: auditing docs against code, pre-refactor "is this still true?" checks, verifying a migration actually landed, any claim that depends on live deployed state.

**Skip** for: a single known file edit, a quick lookup, work where there's no ground-truth-vs-claim gap to close. The orchestration overhead isn't worth it for trivial tasks.

---

## Worked example (2026-05-26)

Goal: bring `ARCHITECTURE.md` back in line with reality.
- 4 auditors ran in parallel (Lambdas #1–8, Lambdas #9–16, data+infra, frontend), each verifying against source + live AWS.
- They confirmed all schedules and DDB schemas, and caught real drift: stale TTLs, wrong Brave-query count, dead social platforms, an `ACLED_API_KEY` that doesn't exist, a `/daily` worker route, and a badly outdated frontend routes/components/hooks section (a "Cut: orphans" commit had deleted components the doc still listed).
- The orchestrator re-verified the frontend route deletions itself (they conflicted with memory), then fixed the doc.
- One genuine latent bug surfaced (`newsStripeWebhook` deployed with `STRIPE_*` vars while the code requires `PADDLE_WEBHOOK_SECRET`) and was routed to `BACKEND_TODO.md` rather than silently patched.
