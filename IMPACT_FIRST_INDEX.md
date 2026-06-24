# Impact-First Project — Index & Progress Record

Entry point for the work on branch `signal-api` (2026-06-23 → 24). Read top-to-bottom for the
story; the table is the doc map.

## The arc (what we did, in order)
1. **Signal API pivot** — decided to sell structured *signals* (machine-readable), free newsletter
   as the funnel. Built + deployed `newsSignals` (build+serve, key-gated). → `SIGNAL_API_PLAN.md`,
   memory `project-signal-api-deployed`.
2. **Breaking-alert email** — went live (auto-send to operator, no human gate). → memory
   `project-breaking-alerts`.
3. **Scoring debate** — 22-agent debate found the scorer was ~14% precision: **loudness, not
   urgency**, dominated by *standing country-risk*. → `BREAKING_ALERT_DEBATE_2026-06-24.md`.
4. **Scoring rubric + fix** — documented the weights, diagnosed country-risk dominance, researched
   how pros weight risk (CAP/GDELT/ICRG/Admiralty/news-values/ICD-203), shipped **Stage 1**
   (cap country-risk, weight 2→1) via plan→execute→audit agents. → `SCORING_RUBRIC.md`,
   `BREAKING_ALERT_V2_BUILD_PLAN.md`.
5. **Source-truth audit** — re-ran the drift alert against real articles. Found it was NOT
   fabrication (the scary specifics were true) but **weak source attribution** + an over-sensitive
   auditor. Shipped A3 (title grounding). → `AUDIT_FINDINGS_2026-06-24.md`, `FIX_BACKLOG.md`.
6. **THE ROOT CAUSE** — realized the real problem is upstream: we never defined *"what impacts the
   world"* — an LLM picks 13 events on a vibe from 26 Western feeds with distorting quotas.
   Everything downstream rides on that. → `IMPACT_FIRST_REDESIGN_PLAN.md`.
7. **Decision: impact-driven**, typed by domain. Verified **GDACS works keyless** (live disaster
   impact); **ACLED creds valid but data-access pending** (operator TODO). → redesign plan §3.5.
8. **Validation methodology** — defined how we prove any of this is good without ground truth
   (input→producer→auditor loop, 4 failure modes, human reference set). → `IMPACT_VALIDATION_METHODOLOGY.md`.

## Doc map
| Doc | What it is |
|---|---|
| `IMPACT_FIRST_REDESIGN_PLAN.md` | **The master plan** — root-cause + impact-first redesign + safe sequencing + verified feeds |
| `IMPACT_VALIDATION_METHODOLOGY.md` | **How we prove it's good** — the audit/validation method |
| `SCORING_RUBRIC.md` | Canonical scoring spec + diagnosis + panel verdict + pro frameworks (§8/§9) |
| `BREAKING_ALERT_V2_BUILD_PLAN.md` | Staged scoring rebuild (Stage 1 shipped) |
| `BREAKING_ALERT_DEBATE_2026-06-24.md` | The 7-story multi-agent debate |
| `AUDIT_FINDINGS_2026-06-24.md` | Fact-checked problem register (A1–A5 source-truth, B1–B5 scoring) |
| `FIX_BACKLOG.md` | Prioritized action list + open decisions |
| `SIGNAL_API_PLAN.md` | The Signal API product spec |

## Current state
- **Shipped to code (branch `signal-api`, NOT merged, NOT redeployed):** Stage-1 scorer fix
  (`f8a3de0`), A3 title grounding (`fb47cdf`). Source-only — live Lambdas unchanged until redeploy.
- **Deployed live earlier:** `newsSignals` Signal API; `newsBreakingAlert` auto-send (old scorer).
- **Verified feeds:** GDACS ✅ keyless; ACLED ⚠️ access pending.

## Open decisions (waiting on operator)
- Get **ACLED API access approved** (acleddata.com, `benlai310@gmail.com`).
- **Redeploy** Stage-1 scorer + A3? (batch a deploy)
- Build the **P0 reference set** + **P1 GDACS shadow ingester** (recommended next).
- Merge `signal-api` to main (when a batch is ready).

## Decisions made
- Horizontal signal API (not vertical supply-chain). Free for humans, paid for machines.
- **Impact-driven** (not attention), typed by domain.
- Discipline: never tune/migrate blind — shadow → measure vs reference set → migrate.
