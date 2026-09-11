# System Management Proposal — Global Perspectives
**Status:** DRAFT for operator discussion — options + recommendations, not decisions.
**Date:** 2026-09-11
**Evidence base:** `project-docs/architecture/ARCHITECTURE.md` (Deploy model, lines 114-124),
`BACKEND_AUDIT_2026-09-10.md` (37-function fleet, 14 ranked findings),
`FRONTEND_STRUCTURE_AUDIT_2026-09-11.md`, `FRONTEND_QUALITY_AUDIT_2026-09-11.md`,
`redesign-ux/_active/EVENT_REGISTRY_PLAN.md`, `redesign-ux/_active/SITUATION_BACKEND_AUDIT.md`.

## 0. Framing

This is a one-person production system (~36 live Lambdas, one React SPA, no CI, no team) that has
just had its first full-fleet audit. The audit's own existence is the strongest evidence for what's
missing: the operator didn't know the shape of their own backend until ten Sonnet agents read every
line of it. That's not a personnel problem — it's a **management-surface** problem. Nothing here
proposes hiring, CI, a platform team, or a rewrite. Every move below is sized for "operator + an AI
agent, working from checked-in files," matching the repo's own stated preferences (boring/correct,
dedicated small pieces, docs-as-code, manual playbook scripts, plaintext env vars).

The audits found four *kinds* of problems, and the moves map onto them:
- **Knowledge problems** — nobody (human or doc) knows the deployed truth without re-auditing (repo≠deployed drift, dead env vars, naming traps).
- **Duplication problems** — the same logic hand-copied N times (JWT×4, scoring×3, transpose×3, byte-identical core modules×2).
- **Ordering problems** — a fixed-time cron chain with no completion signal between stages.
- **Attention problems** — test coverage and dev effort concentrated on dead/legacy surfaces (`/map-legacy`) while the live surface (`/map`) is untested; a 1.3MB bundle nobody chose on purpose; comment-drift in Lambda headers.

None of these need CI or a platform to fix. They need **data** (a manifest), **discipline artifacts**
(a lightweight contract check, a completion guard), and **a recurring practice** (the audit sweep,
formalized) — all still executed by hand/by an agent, on the existing local-verify + patch-zip
workflow.

---

## 1. The moves

Each move: problem → mechanism → cost → risk → explicitly NOT.

### Move 1 — Deploy Manifest (`project-docs/ops/DEPLOY_MANIFEST.md` or `.json`)
**Size: S** (one file, ~1-2 hrs to seed from the audit, then incremental upkeep)

**Problem:** Tribal, re-derived knowledge. `BACKEND_AUDIT_2026-09-10.md` finding #4 and #12: repo≠deployed
drift (`newsAnalyze`, `newsPostLinkedin`) and naming traps (`newsInvokeGemini-dev` is prod,
`newsSensitiveData-dev` is prod, `countryIntelliegence` typo'd scheduler name) are things a fresh
audit had to *rediscover live from AWS* because nothing in the repo recorded them. `ARCHITECTURE.md`
Deploy model rule #1 ("repo = intent; deployed zip × env = truth") is a standing warning precisely
because there's no artifact that pins down what's actually true — it's re-verified by full manual
audit each time.

**Mechanism:** One checked-in table, one row per Lambda: repo dir, live function name (if different),
deploy method (clean zip / patch-deployed-zip / has node_modules), last-verified-deployed date + who/how
verified it, known drift (free text), key env vars that gate behavior (not values — names only, per
the plaintext-env-is-fine model), trigger (rule/scheduler name, cadence). Seed it directly from
`BACKEND_AUDIT_2026-09-10.md`'s table (row 1 of §1 is already 90% of this). Update it as a required
step whenever a Lambda is touched (same discipline as CHANGES.md today) — one new line in the
existing "update docs in the same commit" habit, not a new process.

**Risk:** Goes stale like any doc if the update-on-touch discipline lapses — same failure mode as
every other doc in this repo. Mitigated by the same compensations already in place (periodic audit
sweep, Move 6) rather than a new mechanism.

**Explicitly NOT:** not a deploy tool, not a registry service, not enforced by anything automated
(no CI to enforce it with). It's a data file a human/agent reads before touching a Lambda, replacing
"grep old docs and hope" with "read one table."

---

### Move 2 — Env-var hygiene pass + convention (rides Move 1)
**Size: S** (half a day: one dead-var cleanup pass across ~8 functions, using existing standing AWS authorization)

**Problem:** `BACKEND_AUDIT_2026-09-10.md` finding #8: dead env vars fleet-wide (`BRAVE_SEARCH_API_KEY`/
`BRAVE_CONCURRENCY`, `XAI_API_KEY_BACKUP` on ≥5 functions referenced by zero, unused `OPENAI_API_KEY`,
`NEWS_CACHE_TABLE`, `IMPACT_AUDIT_TABLE`/`INGEST_CAPTURE_TABLE`, `DEVTO_API_KEY`, 4 orphaned social
secrets on `newsPostLinkedin`). Also finding #6: `SYSTEMS_TEST_COUNTRIES` is a "Phase 1 testing" var
still live in prod, silently constraining coverage — the dangerous *inverse* of a dead var (a live one
nobody remembers deciding to keep).

**Mechanism:** One cleanup pass (agent-run, `update-function-configuration` merge-don't-clobber per
the existing rule) removing the confirmed-dead vars; a decision from the operator on
`SYSTEMS_TEST_COUNTRIES` (remove or document why it stays). Going forward: the convention is "every
env var that's read by more than a fallback path gets a one-line note in the Deploy Manifest (Move 1)
env-knobs column" — not a schema, not a linter, just a habit tied to the manifest that already exists.

**Risk:** Low — dead-var removal is inert by definition (grep-confirmed zero references first).
`SYSTEMS_TEST_COUNTRIES` removal is a real behavior change, gated on an explicit operator call, not
auto-applied.

**Explicitly NOT:** not Secrets Manager, not Parameter Store, not a validation schema for env vars —
plaintext env stays the secret store per standing preference.

---

### Move 3 — Vendored `common/` directory for the worst duplications, applied selectively
**Size: M** (per-instance; recommend doing 1 of the 3 candidates first, not all three at once)

**Problem:** `BACKEND_AUDIT_2026-09-10.md` finding #10: Firebase JWT verification copied near-verbatim
across 4 Lambdas; track-record scoring logic in 3 places (`newsPredictionsSnapshot`,
`newsSensitiveData` fallback, `newsSignals`); markets HISTORY-transpose in 3 places. "A security fix
or scoring change must be applied N times by hand." `situations-core.js`/`riskDimensions.js` are
already hand-synced byte-identical pairs (`ARCHITECTURE.md` Deploy model #4) — proof this pattern
already causes real audit overhead (both had to be diffed to confirm they *hadn't* drifted).

**Mechanism, respecting no-build-step:** since Lambdas here deploy as zips (some clean, some
patch-the-deployed-zip with vendored node_modules already inside), a real shared npm package with a
build/publish step is the wrong fit — it would introduce exactly the CI/tooling surface the operator
doesn't want. Instead: a single `shared/` directory at repo root (parallel to `amplify/backend/function/`)
holding the canonical source for each duplicated module (`shared/firebaseAuth.js`,
`shared/scoring.js`, `shared/marketsTranspose.js`). Each Lambda's zip-build step (already manual/
patch-zip) **copies** the relevant file(s) into its own `src/` at zip time — a `cp`, not a bundler.
This keeps the "one canonical source, N deployed copies" model the repo already runs for
`situations-core.js`, but makes the canonical copy a real file instead of tribal knowledge of which
of two copies is authoritative. A short comment header (`// SOURCE OF TRUTH: shared/firebaseAuth.js — copy verbatim, do not hand-edit`) in each deployed copy, matching the existing pattern already used for `situations-core.js`.

Do the **JWT verification** consolidation first (security-relevant, 4 copies, most audit-cited) as
the pilot; only extend to scoring/transpose if the pilot proves low-friction.

**Cost:** M because it touches 4 live Lambdas' deploy process even for the JWT pilot, each needing a
verify+patch-zip+redeploy cycle under the existing per-deploy-yes gate.

**Risk:** Medium — touching JWT verification in 4 places that are currently working is exactly the
kind of change that can introduce an auth regression; needs careful diff-first (repo≠deployed check
per Move 1) and a per-function smoke test after each deploy, not a batch deploy.

**Explicitly NOT:** not a monorepo/workspaces migration, not an npm-published private package, not a
build pipeline. No new tooling — just a `cp` convention and a comment discipline, matching the
existing byte-identical-pair pattern this repo already trusts.

---

### Move 4 — Lightweight contract check in the existing manual verify script
**Size: S-M** (extends `scripts/contract-check.mjs`, which already exists per agent-kit notes)

**Problem:** `FRONTEND_STRUCTURE_AUDIT_2026-09-11.md` §6/finding #5: "No shared response-shape
validation between restProxy and its ~25 consumer hooks... a backend response-shape change would
surface as scattered per-page `undefined` reads rather than one clear contract-break signal." This is
the exact class of bug the fleet has no defense against short of manual live-curl spot checks (which
the structure audit itself had to do by hand, §6 items 1-3).

**Mechanism:** Not TypeScript, not a schema-validation library on the runtime path (that would be a
frontend behavior change, out of scope and risky). Instead: a **JSON-schema (or even just a plain JS
shape-check function) per known restProxy action**, checked only in the existing manual
`scripts/contract-check.mjs` playbook — the script curls each documented live endpoint (already what
the structure audit did by hand for `topics`, `world/latest.json`, `weekly_brief`) and asserts the
top-level keys the consuming hook actually reads exist. Run on-demand (pre-deploy of a backend Lambda,
or as part of the periodic sweep, Move 6) — never in CI, never blocking a commit automatically, exactly
like `smoke-test.mjs`/`link-crawl.mjs` today.

Start with the 3 contracts the structure audit already spot-checked live (`topics`, `world/latest.json`,
`weekly_brief`) since the expected shapes are already documented in that audit — near-zero new
research cost.

**Risk:** Low — read-only, additive, no runtime behavior change; the only risk is scope creep into "let's
just add TypeScript," which is explicitly rejected below.

**Explicitly NOT:** not a TypeScript migration, not compile-time type checking, not a runtime response
validator that could reject/alter real traffic. It's a manual, on-demand drift detector, same tier as
the smoke test.

---

### Move 5 — Cron-chain completion guards (input-freshness checks)
**Size: M** (5-6 Lambdas touched, each a small added check at the top of the handler)

**Problem:** `BACKEND_AUDIT_2026-09-10.md` finding #11: "Fixed-time cron chain with no completion
ordering" — 06:30 threads → 07:00 country → 07:15 systems → 07:20 drift → 07:30 econ → 08:00 quality
all assume the prior stage finished on time; a slow run silently feeds the next stage stale data.
Flagged explicitly in the audit as "structural fragility, not an observed failure" — i.e. a latent bug,
not yet a fire, which is exactly when it's cheapest to fix.

**Mechanism:** Each downstream stage reads a small freshness marker its upstream already writes as a
side effect (a `lastRunAt`/`lastRunStatus` field on its own DDB/S3 output, or — cheaper — a shared
tiny marker object, e.g. `ops/last-run/<lambda>.json` in the existing S3 bucket used elsewhere in this
project for cheap coordination). On entry, a stage checks "did my upstream complete within the last
N minutes?" — if not, it logs a warning (CloudWatch, already the fleet's error-visibility layer) and
either proceeds with a flag or (safer default, matching fail-empty doctrine) skips this run rather than
computing on stale input, letting the *next* scheduled run catch up naturally. No new infrastructure —
same S3 bucket, same env-var-driven config style the fleet already uses (e.g. `CLOSED_KEEP_HOURS`).

**Cost:** M — 5-6 Lambdas need the same ~10-line guard added, each independently deployable
(patch-zip, one at a time, verified individually) — mechanical but touches live cron functions.

**Risk:** Low-medium. The "skip rather than compute on stale data" default is conservative and
consistent with the "fail empty, don't fake" doctrine already governing this codebase — but any
change to when a cron stage runs vs. skips needs a watch period after each deploy to confirm it
doesn't over-trigger skips on ordinary jitter.

**Explicitly NOT:** not a real orchestrator (Step Functions, Airflow, a DAG engine) — that's the
"become a platform team" failure mode this proposal is designed to avoid. It's a marker file and an
`if` statement, in keeping with "boring/correct."

---

### Move 6 — Formalize the audit sweep as a monthly playbook
**Size: S** (write the playbook once; ongoing cost = the sweep itself, which the operator already
demonstrated works — this just gives it a repeatable shape)

**Problem:** The single best tool that surfaced everything in this proposal — a parallel-agent,
live-verified, full-fleet re-read — was a one-off ("the operator asked for proof of full backend
understanding"). Without a rhythm, drift (naming traps, dead env vars, doc/schedule mismatches,
repo≠deployed splits) will simply reaccumulate silently until the next ad hoc prompt to do it again.
This is the compensating control `ARCHITECTURE.md` Deploy model rule #6 already names as one of the
reasons "no CI" is survivable — but it's currently informal.

**Mechanism:** A short playbook doc, `project-docs/playbooks/AUDIT_SWEEP.md` (sibling to the existing
`AGENT_REVIEW_METHOD.md`), codifying: cadence (recommend monthly, or triggered after any batch of
backend deploys), scope rotation (whole-fleet inventory vs. one subsystem deep-dive, alternating —
doing the whole fleet every time is expensive; a rotating subsystem focus, as was already done for
the situation pipeline specifically, is cheaper and matches how these two audits actually happened),
output contract (update Move 1's manifest + `ARCHITECTURE.md` + memory in the same pass — this is
already the docs-as-code habit, just pointed at a recurring trigger instead of an ad hoc one).

**Risk:** Low — it's a documentation/process artifact, not a code change. The only real risk is the
operator's own time/attention cost of running it — sized deliberately small (a playbook invocation,
not a multi-day project) to keep that cost low.

**Explicitly NOT:** not a monitoring dashboard, not continuous drift detection, not automated (no
cron-triggered agent sweep proposed here — that crosses into "autonomous system managing itself,"
a bigger trust step the operator hasn't asked for and audits like this one benefit from being
operator-initiated).

---

### Move 7 — Frontend: route-level `lazy()` + dead-file deletion (bundled as one deploy)
**Size: S** (mechanical, audit already scoped the exact fix)

**Problem:** `FRONTEND_QUALITY_AUDIT_2026-09-11.md` #1: zero route-level code splitting, 1.3MB main
chunk, "highest-value, lowest-risk fix" per the audit's own ranking. Plus the free dead-code
deletions it already verified zero-ref (`WorldMap.jsx`, `WorldMap.css`, `MapSidePanel.jsx`,
`MiniMap.jsx`, one dead CSS rule) and the `WeeklyMap` dual-import fix.

**Mechanism:** Exactly what the quality audit's "Top 3 fixes" section already specifies:
`React.lazy()` + `<Suspense>` around ~20 non-critical routes in `App.jsx`, fix the `WeeklyMap`
dual-import in `CountryPage.jsx`, delete the four dead files. No design decisions needed — this is
pure execution of already-completed analysis. Ship through the existing `deploy.sh` pipeline
unchanged.

**Risk:** Low (audit already verified zero importers on the deletions; lazy-loading is a mechanical,
widely-used React pattern with a `<Suspense>` fallback as the only new surface).

**Explicitly NOT:** not a bundler migration, not a rewrite of routing, not the `useCachedFetch`
hook-consolidation (audit's finding #5) — that one is real but touches 20 hooks' worth of live data
fetching; recommend it as a *separate*, slower-paced follow-up (do a couple of hooks, watch, continue)
rather than folding into this quick win.

---

### Move 8 — Test-coverage rebalance toward the live surface
**Size: M** (ongoing, incremental — not a one-shot)

**Problem:** `FRONTEND_QUALITY_AUDIT_2026-09-11.md` #6: test investment is inverted — heavy coverage
on `/map-legacy` (`WorldMapV2`, 5+ test files) which the structure audit confirms is now an orphan
route (no nav link), while the *actual live* `/map` (`SituationHome`/`SituationMap`/`SituationMap3D`)
has zero dedicated tests. 29 of 32 hooks (91%) untested.

**Mechanism:** No new test framework or infra — same Vitest setup already in `npm run verify`. Two
concrete moves: (1) when `/map-legacy` is eventually retired (a product call, not this proposal's to
make — see structure audit finding), retire its 5 test files with it rather than dragging them
forward as false confidence; (2) add tests for the live `/map` stack opportunistically, prioritized by
what's about to change — e.g. this rides naturally with EVENT_REGISTRY_PLAN Phase 1 (Move-adjacent:
when `threadId` stamping ships, that's exactly when `SituationHome.jsx`'s "Full analysis →" link logic
most needs a test, since it's new behavior on the live surface, not retrofitted coverage on old code).

**Risk:** Low — additive test-writing, no production code touched, but requires ongoing attention
rather than a single PR; the failure mode is this move quietly not happening because nothing forces it
(same as any doc). Tie it to actually-changing code (per §2 Sequencing) rather than treating it as a
standalone backlog item, to make it more likely to actually get done.

**Explicitly NOT:** not a coverage-percentage target/gate (no CI to enforce one anyway), not a
mandate to test everything — test what's live and changing, delete tests for what's dead.

---

## 2. Accept/reject on the candidate areas (a)-(h)

| # | Area | Call | Reasoning |
|---|---|---|---|
| (a) | Versioned contract layer (typed/validated shapes, no TS mandate) | **Accept, narrowed → Move 4** | Real gap (structure audit finding #5), but scope it to a manual on-demand shape-check extending the existing `contract-check.mjs`, not a validation layer on the live request path and definitely not a TypeScript migration mandate — that's a multi-week rewrite this repo's own conventions (boring/correct, small dedicated pieces) argue against right now. |
| (b) | Shared-module strategy for hand-synced/duplicated logic | **Accept, narrowed → Move 3** | The audit explicitly flags this as "must be applied N times by hand" risk. But full `common/` package + build step is over-engineering for a zip-deploy fleet; a vendored-source-of-truth-plus-`cp` convention (extending the pattern the repo already runs for `situations-core.js`) fits the no-build-step reality. Pilot on JWT only first — don't do all 3 duplication classes at once. |
| (c) | Deploy manifest | **Accept as-is → Move 1** | Directly and cheaply converts tribal patch-zip knowledge into a checked-in artifact; lowest cost, highest immediate leverage move in this whole list — it's essentially "write down what the audit already found." |
| (d) | Cron-chain completion guards | **Accept → Move 5** | Directly cited (ledger S9·T5 / finding #11) as structural fragility; cheap per-stage guard, no orchestrator needed. |
| (e) | Frontend: lazy(), cache hook, dead-code, restProxy split | **Partial accept** — lazy()+dead-code deletion → Move 7 now; cache-hook consolidation flagged as a slower follow-up, not bundled; **restProxy split rejected for now** | restProxy serving 5 backends from one file is untidy (structure audit finding #3) but each backend's block is independent/working — splitting it is a refactor with no user-facing payoff and real regression risk on live auth code, for a codebase that explicitly prefers not touching working things without cause. Revisit only if restProxy needs a 6th consumer or a bug forces a look inside it. |
| (f) | Test strategy rebalance | **Accept → Move 8** | Audit-documented inversion (legacy over-tested, live surface untested) is a real risk profile mismatch; low cost to correct incrementally, tied to already-planned work rather than a standalone sprint. |
| (g) | Periodic audit-sweep playbook | **Accept → Move 6** | This is the single mechanism that produced every other finding in this proposal; formalizing its cadence is nearly free and is the actual answer to "how do we avoid needing another one-off deep audit in 6 months." |
| (h) | Env-var hygiene process | **Accept → Move 2** | Cheap, already-scoped cleanup (finding #8) with one live operator decision needed (`SYSTEMS_TEST_COUNTRIES`); tie the "every env var appears in the manifest" convention to Move 1 rather than inventing a separate document. |

---

## 3. Sequencing recommendation

**Do now, standalone (no dependency on other planned work):**
1. Move 1 (Deploy Manifest) — seed it directly from `BACKEND_AUDIT_2026-09-10.md`'s existing table;
   this is nearly a copy-paste, not new research.
2. Move 2 (env cleanup) — rides the manifest seeding pass; do them together.
3. Move 7 (frontend lazy+dead-code) — fully scoped by the quality audit already, zero new analysis
   needed, ships through the existing `deploy.sh` unchanged.
4. Move 6 (formalize the audit-sweep playbook) — pure documentation, capture the method that just
   worked while it's fresh, before its shape is forgotten.

**Ride along with already-planned work:**
5. Move 8 (test rebalance) rides `EVENT_REGISTRY_PLAN` Phase 1 (the `threadId` stamping bridge) —
   that's new live-surface behavior on `/map`, the exact moment to add `SituationHome.jsx` coverage
   instead of retrofitting it cold later. Also rides any eventual `/map-legacy` retirement decision
   (delete route + its 5 test files together, per the quality audit's own note).
6. Move 5 (cron completion guards) rides the situation-pipeline slice-4/5 work already queued in
   `SITUATION_BACKEND_AUDIT.md` §3 (items 1-6 there already touch `newsSituationIngest` +
   `newsSituationTracker`) for that pair specifically; extend the same guard pattern to the
   06:30→08:00 editorial chain as a separate, later pass once the pattern is proven on one pipeline.
7. Move 3 (JWT shared-module pilot) — do this *after* Move 1 exists (need the manifest to know
   confidently which 4 Lambdas currently carry the JWT copy and their exact deploy methods before
   touching security-relevant code in 4 places).

**Standalone but lower priority (do when there's slack, not urgent):**
8. Move 4 (contract check extension) — valuable but not urgent; the 3 contracts the structure audit
   already hand-verified are the cheap starting set whenever there's a slow week.

**Explicit non-sequencing note:** none of these should be bundled into `EVENT_REGISTRY_PLAN` Phase 2
(shared ingest) — that's already flagged in its own doc as "the spine change... shadow-gated,"
independently large and risky; don't let management-hygiene work ride a change that big, it'll just
make Phase 2's blast radius harder to reason about.

---

## 4. Do-not-do list

Tempting-sounding improvements the evidence argues against, at least for now:

- **Don't add CI/GitHub Actions.** Explicit standing preference (a failing workflow gets removed, not
  fixed — `feedback_no_ci_solo_dev`). All checks proposed here stay manual/on-demand, matching
  `smoke-test.mjs`/`link-crawl.mjs`.
- **Don't migrate to TypeScript.** Real payoff for the contract-drift problem, but it's a multi-week
  investment for a solo dev with no team to amortize the ongoing type-maintenance cost across; Move 4
  gets most of the safety at a fraction of the cost.
- **Don't build a real orchestrator (Step Functions/Airflow) for the cron chain.** Move 5's marker-file
  guard solves the actual observed problem (silent stale-input propagation) without taking on
  orchestration infrastructure this team has no reason to operate.
- **Don't consolidate all three duplication classes (JWT/scoring/transpose) in one pass.** Pilot on
  JWT alone; scoring and transpose duplication is real but lower-risk-if-left-alone (not
  security-relevant) — batching all three multiplies the blast radius of a single refactor effort for
  marginal added benefit.
- **Don't split `restProxy.js` into 5 files right now.** Untidy but working; no bug has ever
  originated there per the audits. A refactor with no concrete trigger, on live auth-adjacent code, is
  exactly the kind of "clever" this repo's stated preference (boring/correct) argues against.
- **Don't chase 100% test coverage or set a coverage gate.** No CI to enforce one, and it would
  incentivize testing dead code (the opposite of Move 8's point) just to hit a number.
- **Don't move plaintext env vars to Secrets Manager/KMS/Parameter Store.** Explicitly rejected
  standing preference; Move 2 only cleans up *dead* vars, doesn't change the storage model.
- **Don't automate the audit sweep itself (no cron-triggered self-auditing agent).** Keep Move 6
  operator-initiated. A system that periodically re-audits and silently "fixes" itself is a bigger
  trust/autonomy step than anything else in this proposal, and the two audits that produced all this
  evidence worked well specifically *because* a human asked for them on purpose.
- **Don't retire `/map-legacy` or `/spider-demo` as part of this proposal.** Both are flagged as
  orphan routes by the audits, but deleting a route + its tests is a product call (traffic/rollback
  considerations), not a management-hygiene one — defer to the operator, reference it under Move 8 as
  a trigger only.
- **Don't fold Move 5/7/8 into `EVENT_REGISTRY_PLAN` Phase 2.** See §3 — keep the big shadow-gated
  spine change isolated from hygiene work so its blast radius stays legible.
