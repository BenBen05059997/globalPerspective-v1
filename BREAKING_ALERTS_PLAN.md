# Breaking-News Email Alerts — Plan

**Status:** IN PROGRESS — Phase 1 (detector + dry-run) building 2026-06-10
**Relationship:** Component 4 of [`RECOMMENDATIONS_AND_DIGEST_PLAN.md`](./RECOMMENDATIONS_AND_DIGEST_PLAN.md). Shares the `GlobalPerspectiveUserPrefs` table, the email-sending path, and the double-opt-in / one-click-unsubscribe compliance scaffolding with the digest. This doc covers only what is *different*: an event-driven trigger and a global significance selection rule.

**Email provider: Resend (decided 2026-06-10), not SES.** Chosen over Amazon SES for developer experience and *no sandbox production-access approval wait* — Resend sends to a verified address immediately and has good default deliverability; cost is a non-issue at this volume either way. The digest (recs plan Component 3) should switch to Resend too. The provider lives behind a single function (`sendEmail.js`) so it's a ~20-line swap if we ever reverse this. Real sends to arbitrary subscribers still require verifying `globalperspective.net` in Resend (DKIM/SPF/DMARC DNS records) — the same domain step any provider needs.

## Why

The site generates a headline **plus** its own analysis (summary / prediction / trace-cause / economic disruption) within ~hours of a story surfacing. Nobody else pairs the two. A breaking-news email is the strongest re-engagement hook the site can offer: *"a significant story just broke — here's our read, before you've seen it anywhere else."*

This is distinct from the planned digest (periodic, per-user ranked). Breaking alerts are **event-driven** and, for v1, **broadcast** (global significance, not personalized) — true breaking news matters to everyone, and broadcast sidesteps the cold-start problem.

## Decisions (locked 2026-06-10)

- **Scope:** Broadcast v1. Personalized ("breaking in countries you follow") is a v2 that reuses the digest's `scoreItem()` scorer.
- **Trigger:** Composite, deterministic significance score (no LLM). Send-nothing on slow days is the correct, honest outcome ([[feedback-no-misinformation-fallback]]).
- **Sequencing:** Build the detector + email rendering and run in **dry-run (log-only)** mode against production data to validate the trigger and tune the threshold *before* requesting SES production access.

## Cadence reality

The content pipeline runs every 4h (`newsInvokeGemini` → `NewsProjectInvokeAgentLambda` at :05). Analysis is written by the agent Lambda, so the alert detector must run **after** it — proposed `cron(15 */4 * * ? *)` (:15 each 4h cycle). This is *"newly-surfaced significant story within hours,"* not sub-minute push. We do not market it as instant.

## The unit of alerting is the thread (a story), not a topic

Topics under one `threadId` are angles on the same story. We aggregate by thread, score the story once, and alert on the story.

## Significance score (deterministic, transparent, tunable)

All inputs already exist in DynamoDB — no new pipeline:

| Signal | Source | Field |
|--------|--------|-------|
| **popularity** | `latest.topics[]` | `sources.length` summed across the thread's topics (log-squashed) |
| **breadth** | `latest.topics[]` | count of distinct topics under the thread this cycle (a story hitting many angles at once) |
| **risk** | `COUNTRY#{name}` / `COUNTRY_INTELLIGENCE` | max `riskScore` (0–100) across the thread's regions |
| **economic** | `ECON#THREAD#{threadId}` / `ECONOMIC_IMPACT` | max instrument `magnitude` (large/moderate/small) |

`score = Σ weight·normalizedSignal`. Weights are named module constants in `significance.js` (mirrors `newsRecommend/scoring.js`). A thread is "breaking" when `score ≥ SIGNIFICANCE_THRESHOLD`. The detector emits **`reasons[]`** per candidate so the dry-run log shows *why* — this is what we tune against.

## Anti-fatigue guards (mirrors the `newsErrorDigest` pattern)

1. **Dedupe** — a `GlobalPerspectiveBreakingAlerts` row per thread (`alertKey = threadId`); a story already alerted within `DEDUPE_DAYS` (default 5) never re-alerts. Dry-run writes the same rows so it faithfully simulates production dedupe.
2. **Frequency cap** — `MAX_ALERTS_PER_DAY` (default 1). Broadcast v1 sends at most the single highest-scoring fresh story per day.
3. **Significance floor** — most cycles produce no candidate above threshold, so most cycles send nothing. That is the intended behavior.

## Schema

### `GlobalPerspectiveBreakingAlerts` (`BREAKING_ALERTS_TABLE`, ap-northeast-1, PAY_PER_REQUEST)
**PK:** `alertKey` (= `threadId`)

| Attr | Type | Purpose |
|------|------|---------|
| `alertKey` | S (PK) | threadId |
| `score` | N | composite score at alert time |
| `reasons` | L | why it qualified (for tuning) |
| `title` | S | story title |
| `alertedAt` | S | ISO — set when it qualifies (dedupe anchor) |
| `sent` | BOOL | true only when an email actually went out (false in dry-run) |
| `cycle` | S | ISO cycle bucket |
| `ttl` | N | epoch; DEDUPE window + a margin (~14d) |

### `GlobalPerspectiveUserPrefs` (existing — additive)
Add a **separate** opt-in from the digest, so a user can take a calm weekly digest without real-time pings (or vice versa):
- `breakingOptIn` BOOL · `breakingVerified` BOOL (double opt-in) — reuses the same `unsubToken` / `List-Unsubscribe` plumbing.

## The pipeline (full shape)

```
detect (deterministic, significance.js)
  → propose            (status:'proposed' row; NEVER auto-sends)
  → LLM verify          ("is it true?" — Phase 3, see below)
  → human confirm + words (breaking/review.js — operator reviews, can add an editor note)
  → send                (SES — Phase 4)
```

## Review / verify agent ("is it true?")

Two independent gates, because a deterministic significance score answers *"is this loud?"* not *"is this real and accurately characterized?"*:

1. **LLM verify (Phase 3, automated).** Mirrors `newsEconomicQuality`: a **different model family from the producer** (the analysis is DeepSeek-written, so **Gemini** judges) checks the flagged story against its cited sources — is the event real, is our summary/prediction faithful, is the significance warranted? Returns `{ verdict, confidence, note }`. A failed verdict blocks the proposal from reaching the human queue (or flags it loudly). Until built, every proposal carries `verify:{ status:'pending' }` and the human is the sole gate — `verifyStory()` in `index.js` is the stub seam.
2. **Human confirm (Phase 1.5, already built — `breaking/review.js`).** The operator sees the draft + the verify verdict, can **add their own words** (an editor note that leads the email), and confirms (`status:'confirmed'`) or rejects. Nothing sends without this. Mirrors `predictions/review.js` + the economic-quality human spot-check.

## Benchmark (deferred — agreed "later")

To trust the detector + verify agent we need a labeled set: take N past pipeline cycles, hand-label which stories *should* have been breaking-worthy, and measure precision/recall of (a) the significance threshold and (b) the LLM verdict against that gold set. Build once there's enough dry-run history to label. Tracked here so it isn't lost; not blocking earlier phases.

## Components (build order)

1. **`newsBreakingAlert` Lambda — detector + dry-run.** ✅ BUILT. `significance.js` (pure, 17 unit tests pass), `render.js` (subject + body, honesty-checked), `index.js` (loaders, thread aggregation, dedupe, frequency cap, `DRY_RUN` gate, `verifyStory()` stub). Default `DRY_RUN=true`: logs candidate + full would-be email, writes the `proposed` row, sends nothing.
   1.5. **Human review CLI.** ✅ BUILT — `breaking/review.js` (list / confirm + your words / reject).
2. **Deploy + threshold tuning.** Deploy the Lambda (schedule `cron(15 */4 * * ? *)`), create `GlobalPerspectiveBreakingAlerts` table, run dry-run against production over several cycles, read CloudWatch + the `proposed` rows, tune `SIGNIFICANCE_THRESHOLD` + weights to what *should* have alerted.
3. **LLM verify agent.** Wire `verifyStory()` to Gemini (different family from the DeepSeek producer); benchmark when history allows.
4. **Email send (Resend) + opt-in UI.** ✅ send seam BUILT — `sendEmail.js` (Resend via `fetch`, no npm dep, key from `RESEND_API_KEY`) + `breaking/send-test.js` (renders a sample and sends it). Remaining: add `breakingOptIn`/`breakingVerified` to `GlobalPerspectiveUserPrefs` + confirmation flow, build the sender that picks up `status:'confirmed'` rows, flip `DRY_RUN=false`. Shares the digest's send infra.
   - **First real test → `benlai310@gmail.com`.** Create a Resend account (sign up with `benlai310@gmail.com`), grab an API key, then: `RESEND_API_KEY=re_xxx node breaking/send-test.js`. Using Resend's built-in `onboarding@resend.dev` test sender this delivers to the account's own email with **zero domain setup**. Once that looks right, verify `globalperspective.net` in Resend and switch `from` to `alerts@globalperspective.net` to send to anyone.

## Honesty contract

- Never manufacture a "breaking" story to fill a quota — silence is a valid, correct output.
- The email carries only real, already-generated analysis with real source links. No fabricated urgency, no placeholder copy.
- Breaking unsubscribe must never disable transactional/account email, and is independent of the digest opt-in.
