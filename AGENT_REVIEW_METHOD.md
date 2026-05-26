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

---

# Customized variants

Each variant reuses the same orchestrator + parallel-auditor loop. What changes is **(a) what counts as primary source** and **(b) what each auditor checks**. The cardinal rule always holds: verify against the live thing, never against a name, a doc, or a checkbox.

---

## Variant 1 — Pre-deploy frontend check

**Trigger:** before building + copying to `docs/` + pushing any change under `global-perspectives-starter/frontend/src/`.

**Primary sources:** `npm run lint` / `npm run build` output, `npx vitest run`, and a **real browser** (dev server or `vite preview` + Playwright) — not "the build passed."

**Auditor slices:**
1. **Build & static** — lint (0 *new* errors), `npm run build` succeeds, no new chunk/import warnings introduced by the change; grep for dangling imports/refs to anything deleted.
2. **Tests** — `vitest run`; confirm the *changed* components' tests pass and note any pre-existing failures (e.g. the `layers.test.jsx` d3-in-jsdom one) so they aren't mistaken for regressions.
3. **Golden-path browser** — drive the affected route(s) in a browser: the feature does what the change intended, on desktop **and** mobile width (`useIsMobile` 600px breakpoint).
4. **Regression sweep** — click through 2–3 *unrelated* high-traffic routes (`/`, `/weekly`, `/map`) to confirm nothing else broke.

**Gate:** do NOT copy to `docs/` until 1–4 pass. Auth-gated routes (`/account`) that can't be exercised without a signed-in user → say so explicitly; don't claim "verified."

**Why this shape:** "build-passes ≠ feature-works" — actually exercise controls in the browser before deploy. (Matches the standing project rule.)

---

## Variant 2 — Backend / Lambda health audit

**Trigger:** "is the pipeline healthy?", after a provider/schedule change, or periodically.

**Primary sources (in order):** `aws lambda get-function-configuration` (deployed env), `aws scheduler get-schedule` / `aws events describe-rule` (live crons), CloudWatch Logs (recent invocations/errors), then source. Region `ap-northeast-1`.

**Auditor slices (by Lambda group):**
1. **Pipeline** (newsInvokeGemini → AgentLambda → threadAnalysis → countryIntelligence) — schedule firing? last run succeeded? deployed `GROK_MODEL`/`GROK_API_URL` = the *intended* provider? recent 429s / timeouts?
2. **Derived analyses** (systems, pair, economicImpact, economicQuality) — same checks; confirm DDB writes have fresh `generatedAt`/`asOf`.
3. **Edge / data** (marketsData, countryFactsUpdater, savedItems, sensitiveData proxy) — feeds returning data, proxy actions 200, no auth regressions.
4. **Distribution** (postLinkedIn, linkedInAutoPost, postDevTo) — known-broken tokens (LinkedIn 401, Dev.to 401) confirmed or cleared.

**Cardinal rule front-and-center:** provider is whatever the **deployed env var holds**, never the source default or a migration-plan checkbox.

**Output:** per-Lambda green/red + the specific failing CLI evidence. Latent bugs → `BACKEND_TODO.md`, never silent-patched.

---

## Variant 3 — AI output quality review

**Trigger:** spot-checking generated content, or validating a prompt/model change.

**Primary sources:** the actual stored records in `SUMMARIZE_PREDICT_TABLE` (the real generated text), plus the source articles/`topicId`s they cite. Generalizes the `newsEconomicQuality` LLM-as-judge.

**Auditor slices (one judge per content type — use a *different* model family than the producer so errors decorrelate):**
1. **Summaries / predictions / trace_cause** (`TOPIC#`)
2. **Thread analyses** (`THREAD#`) — storyArc, trajectory, rootCauseChain
3. **Country / pair intelligence** (`COUNTRY#`/`PAIR#`)
4. **Systems graph** (`SYSTEMS#`) — every edge cites a real `topicId`

**Each judge scores fixed axes** (reuse: coherence / citation_fidelity / analog_match / severity_calibration / no_bs), flags any axis ≤ 2, and **must quote the offending text + the citation it fails**. No vibes — every "low quality" verdict cites evidence.

**Output:** flagged records + axis scores; systemic patterns (e.g. one prompt always over-claiming) → a prompt-fix note, not per-record edits.

---

## Variant 4 — Data integrity audit

**Trigger:** "is the data trustworthy?", before surfacing a new data-backed UI, or periodically. Extends the existing `verify_market.sh`-style checks.

**Primary sources:** the live DDB tables (`TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`, `MARKETS_DDB_TABLE`) and the upstream feeds they claim to mirror.

**Auditor slices:**
1. **Freshness** — every served record has an `asOf`/`archivedAt`/`generatedAt`; nothing stale is shown unlabeled (the honesty contract).
2. **Schema conformance** — records match the documented shape (required fields present, enums valid, no template placeholders that slipped past the parser).
3. **Markets sanity** — FX/rates/commodities/equities/crypto within plausible ranges vs. the source feed; `HISTORY#` series continuous (no gaps that break sparklines).
4. **Tombstones & TTL** — `{hasImpact:false}` tombstones present where expected; TTL'd records actually expiring; no orphaned `staging`.

**Output:** per-table pass/fail with the offending keys. Drift between a record and its upstream feed → flag the producer Lambda, don't hand-edit the record.

---

## Adding a new variant

Copy the shape above and answer four questions: **(1)** What's the trigger? **(2)** What is the *primary source* (the live thing, not a doc)? **(3)** What are the independent slices (one auditor each)? **(4)** What's the pass/fail gate and where do actionable findings go? Keep the cardinal rule intact.
