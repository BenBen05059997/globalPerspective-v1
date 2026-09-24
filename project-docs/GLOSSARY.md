# Glossary — Operator Decision Board

*Dated 2026-09-14. Plain-language reference for every term currently on the operator's decision
board — what it is, where it comes from, and whether it's live, dormant, dead, planned, or
awaiting a decision. Not an essay — a reference card. Cross-checked against
`project-docs/architecture/ARCHITECTURE.md`, `WORLD_MODEL.md`, `WORLD_MODEL_FRAGMENTS.md`,
`SCORING_STANDARDS.md`, `IMPORTANCE_SCALE_MAPPING.md`, `DESIGN_UPGRADES_2026-09-14.md`,
`CHANGES.md`, and the Lambda source under `amplify/backend/function/*/src/`.*

---

## Scores & ratings

### Severity tier / `dimensions` / `riskScore`
**What it is:** The site's one canonical risk reading for a country or story — shown to readers as
one of four plain words: low, moderate, elevated, or high. Instead of blending everything into one
number (which can hide a spike in one area behind calm in another), the system scores four separate
angles — conflict, political, economic, humanitarian — and always headlines with the *worst* of the
four.
**Where it comes from:** `amplify/backend/function/newsCountryIntelligence/src/riskDimensions.js`
(byte-identical copy in `newsThreadAnalysis/src/riskDimensions.js`); `AXES =
['conflict','political','economic','humanitarian']`; band cutoffs ≥75 high, ≥50 elevated, ≥25
moderate, else low; frontend mirror `src/shared/lib/riskTiers.js`. Built as "Scoring Model v2" — Phase A
(frontend seam) then Phase B (per-axis LLM scoring + worst-axis derivation), deployed to prod
2026-07-07, to fix a country's real risk being masked by averaging.
**Status:** Live — this is the canonical, cross-site importance scale (see D2 below). Per the
2026-09-14 audit, it is also the most relied-on score; first benchmark baseline exists as of
2026-09-15 (40% exact / 85% within-one; systematic inflation diagnosed — fix in flight): a
one-sentence rubric, now checked against a human-labeled reference set (see **P0 reference
set** and **codebook** below).

### `urgency` and `significance` (topic enums)
**What it is:** Two separate tags the AI attaches to each daily news topic. `urgency` = how fast the
story is moving right now (high = broke/escalated in the last 24h). `significance` = how important
it is, independent of speed. They are deliberately different axes — tempo vs. standing importance —
not two names for the same thing.
**Where it comes from:** `amplify/backend/function/newsInvokeGemini/src/index.js:617-647` (prompt
definitions), `:741-776` (parsing). Part of the original topic-generation pipeline; re-examined in
the 2026-09-14 audit.
**Status:** Live but thinly used. `significance` has no frontend reader — only
`newsPostLinkedin/src/index.js:171-174` uses it, to order LinkedIn posts. `urgency` is shown to
readers but can't be folded into the canonical severity tier (D2) because the topic pipeline never
attaches a 0-100 score to it.

### Breaking-alert score
**What it is:** A deterministic formula (no AI judgment) that decides whether a story is big enough
to trigger a "breaking" alert. It weighs five signals — outlet count, how many angles it's breaking
across, the affected country's risk level (capped so it can't dominate), market impact, and how fast
it's accelerating — into one number. A story alerts only once the score passes 2.0; an
already-alerted story needs 1.8× that to re-alert, so it has to show real escalation, not just stay
loud.
**Where it comes from:** `amplify/backend/function/newsBreakingAlert/src/significance.js` —
`WEIGHTS`, `SIGNIFICANCE_THRESHOLD = 2.0`, `CONTINUATION_THRESHOLD_MULT = 1.8`, `RISK_CAP = 50`,
`scoreStory()`. Built 2026-06-10; reworked so a story's risk contribution comes from the axis
matching its own category rather than a country's blended score (fixed a dominance bug, ~14%
precision); the risk-weight cut and cap shipped to prod 2026-09-08.
**Status:** Live, runs on a schedule (`DRY_RUN=false`). It is an internal decision gate, never shown
to readers directly — see **breaking-alert email broadcast** below for what happens after a story
scores high enough.

### Economic `severity` / `severityScore`
**What it is:** How disruptive a news event is to markets or the economy — minor, moderate, or
severe — paired with a 0-100 confidence number that must fall inside that label's numeric band.
**Where it comes from:** `amplify/backend/function/newsEconomicImpact/src/index.js` —
`VALID_SEVERITIES`, `SEVERITY_BAND` (severe 70-100, moderate 40-69, minor 0-39), auto-downgrade logic
(drops severity a notch if evidence is thin). Built as the "Economic Disruption" feature, live since
2026-05-19, daily cron 07:30 UTC.
**Status:** Live. Deliberately kept as its own separate measure — the 2026-09-14 audit classified it
DISTINCT (a magnitude score, not mergeable into the canonical severity tier).

### `is_low_quality` / quality scores
**What it is:** A second AI, from a different model family than the one that wrote the analysis
(so it doesn't share the same blind spots), grades each economic write-up on five axes — coherence,
citation fidelity, analog match, severity calibration, "no BS" — each 1-5. Any single axis at 2 or
below flags the whole record `is_low_quality`.
**Where it comes from:** `amplify/backend/function/newsEconomicQuality/src/index.js` —
`QUALITY_AXES`, `LOW_QUALITY_THRESHOLD = 2`. Live since 2026-05-20 (Phase B LLM-as-judge), daily
cron 08:00 UTC, right after `newsEconomicImpact`.
**Status:** Live but inconsistently enforced — confirmed by the 2026-09-14 whole-backend read: it
filters the economy lede (`composeEconomyBriefing.js:111`) but **not** the Active-disruptions list.
Known gap, not yet fixed.

### Prediction probability, Brier score, calibration buckets, era-cut
**What it is:** Every forecast the site makes states a probability (e.g. "60% chance"). Once the
real-world deadline passes, a resolver marks it fired or not. Brier score is the standard
"how well-calibrated were you" number (0 = perfect, higher = worse). Calibration buckets group
forecasts by their stated probability and show what fraction actually came true in each bucket.
Era-cut means only forecasts made after 2026-07-04 are scored — everything older is excluded (not
deleted) because ~28% of the pre-rebuild forecasts had broken deadlines already in the past.
**Where it comes from:** `amplify/backend/function/newsPredictionsSnapshot/src/trackRecord.js` —
`ERA_CUT_FROM = '2026-07-04'`, `computeTrackRecord()`. Era-cut shipped 2026-07-04 after a 50-trigger
pilot found the 28% breakage; `trackRecord.js` itself is a later (2026-09-09) optimization that
moved the aggregation from a live per-pageview DynamoDB Scan to a cached 30-minute snapshot.
**Status:** Live. Per `SCORING_STANDARDS.md`, this is "the only score with real ground truth" on the
site — the benchmarking gold standard the other scores are measured against (and found lacking).

### `impactScores` (Trace-the-Cause 1-10 triple)
**What it is:** Part of the "Trace the Cause" AI write-up for a topic — three 1-10 ratings (human
impact, economic reach, geopolitical reach) meant to convey how big a deal the root cause of an
event is.
**Where it comes from:** `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js:405`
(prompt schema), generated by `buildTraceCausePrompt()` alongside `proximate` / `contributing` /
`structural` / `biasNote`. Added when Trace-the-Cause prompts were converted to strict JSON output.
**Status:** Live but "ungoverned" per the 2026-09-14 audit — flagged as a keep-as-exception, not
mergeable into the canonical severity tier, and no page uses it as a filterable or comparable score;
it just renders as text.

---

## Identity & event terms

### topicId / threadId / storyId
**What it is:** The two separate "what thing is this" ID systems the site runs today. `topicId`
belongs to the editorial pipeline (the daily AI-written topics/articles). `storyId`/`threadId`
belong to the map/situation side (event clusters detected from raw news). They don't share one root
yet — see **the convergence build** below for the plan to unify them.
**Where it comes from:** Editorial side: `amplify/backend/function/newsInvokeGemini` and
`NewsProjectInvokeAgentLambda`. Map side: `newsSituationIngest` / `newsSituationTracker`. The bridge
that links the two is the **Tier 1 matcher** (below).
**Status:** Live, but split — the core problem the World Model / Event Registry work exists to solve.

### staging / latest / archive
**What it is:** The three-stage life of each day's editorial picks. Freshly written = "staging"
(not yet public). Once ready, it's swapped to "latest" (what visitors actually see). It's also saved
permanently to "archive" as a daily record used later for story-threading.
**Where it comes from:** `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`
(write/swap logic; DDB table constant `TOPICS_CACHE_ITEM_ID`, default `staging`). The
`threadId`-stamped-before-swap fix (so `latest` always carries a `threadId`) shipped 2026-06-10.
**Status:** Live — core daily pipeline, runs every day.

### GDACS
**What it is:** The Global Disaster Alert and Coordination System — a public, UN-affiliated feed of
real-world disaster alerts (floods, quakes, storms). The site polls it every 20 minutes to open map
"situations" for serious (Orange/Red) events.
**Where it comes from:** `amplify/backend/function/newsGdacsIngest` (writes to
`situations/inbox/gdacs-latest.json` and `corpus/gdacs/latest.json`); EventBridge rule
`TriggerGdacsIngest`, rate(20 min). Built 2026-09-08 as part of the map-as-home + situation-tracker
programme; its DynamoDB mirror was dropped 2026-09-09 in favor of pure S3.
**Status:** Live, deterministic, no LLM involved.

### `situation` (the map's event object)
**What it is:** One tracked real-world happening shown as a pin/entry on the map — either a GDACS
disaster or a breaking-news alert — with a lifecycle (emerging → escalating → peak → cooling →
closed) rather than being a static one-off article.
**Where it comes from:** Assembled by `amplify/backend/function/newsSituationTracker`
(`situations-core.js`'s `buildSituation` / `coolSituation`) into `situations/state/<id>.json`,
`situations/index.json`, and `world/latest.json`. Built 2026-09-08 for the map-as-home programme;
its DDB schema was retired to S3 the same window.
**Status:** Live, but with known open issues (`SITUATION_BACKEND_AUDIT.md` F2-F8: no corroboration
signal feeding the tier, GDACS-specific vocabulary leaking into cooling-story text, escalation
flip-flopping, wrong suppression, stale resurrection, missing `coverage_ratio`) — all pending
operator threshold decisions as of 2026-09-10.

### `world/latest.json`
**What it is:** The single file the public map page (`/map`) actually reads — a snapshot of every
currently open situation plus freshness info, refreshed roughly every 30 minutes.
**Where it comes from:** Sole writer is `newsSituationTracker/src/index.js:32` (key
`world: 'world/latest.json'`); read by the frontend via the Cloudflare Worker's `/data/*` route.
Live since 2026-09-08, same build as `situation`.
**Status:** Live.

### Phase-1b tags: `iso3[]` / `actors[]` / `event_type`
**What it is:** Extra labels the AI attaches to each topic and article — which countries are
involved (`iso3`), which specific named people/organizations/groups are involved (`actors`), and
what kind of event it is (`event_type`) — so the system can later recognize when two different
pipelines are describing the same real-world event.
**Where it comes from:** `newsSituationIngest/src/classifier-core.js:10-27` (map-side classifier) and
`newsInvokeGemini/src/index.js:638-650` (topic pipeline). Added because an earlier fingerprint
experiment found the topic side had no genuine actor signal — every "shared actor" was really just a
country name — so structured tags at generation time became a precondition for any future
fuzzy-matching. Deployed and verified 2026-09-11.
**Status:** Live — tags are being emitted and stored, but their intended downstream consumer (the R3
fuzzy matcher, below) is still switched off.

### Tier 1 matcher / `threads/story-map.json` / R3 / `ENABLE_R3_TIER`
**What it is:** The system needs to know when a "topic" (editorial pick) and a "story" (map event
cluster) are the same real-world thing, so the map can link out to the fuller write-up. Tier 1 is a
simple, safe rule: if they cite the exact same article URL, they're linked (zero false positives so
far). "R3" is a more powerful but riskier second-tier rule that would also link stories sharing a
country + a named actor + event type — built, but switched off pending one more accuracy check on
real (not simulated) tagged data.
**Where it comes from:** `amplify/backend/function/NewsProjectInvokeAgentLambda/src/matcher.js:4-53`
writes `threads/story-map.json` (S3); read each sweep by `newsSituationTracker`, which stamps
`threadId` onto `world/latest.json`. `ENABLE_R3_TIER` env flag gates Tier 2, confirmed absent from
the deployed function's env as of the 2026-09-11 verify pass. Tier 1 spec drafted 2026-09-11,
verified live the same window (25 Tier-1 pairs matched, 0 ambiguous). R3's earlier simulated test
passed with 0 false positives, but the plan requires re-confirming against ~1 week of real Phase-1b
production tags (target ~2026-09-13/14) before flipping it on.
**Status:** Tier 1 (URL-exact) is **live** in production. R3 (fuzzy/fingerprint tier) is
**dormant / decision-pending** — built, flagged off, awaiting the real-tag re-measurement and an
operator go/no-go.

---

## Dormant / decision-pending features

### Breaking-alert email broadcast + the human confirm step
**What it is:** When the breaking-alert score (above) crosses threshold, the system drafts a
proposed alert email. A human — the operator — is supposed to review and click "confirm" before it
goes out to subscribers; it never auto-sends to the public.
**Where it comes from:** Detector `amplify/backend/function/newsBreakingAlert/src/index.js` (writes
`status:'proposed'` rows); confirm/reject tool `breaking/review.js`; actual send is
`newsEmailSender` (`mode:'breaking'`, cron `TriggerBreakingEmailSend`). Built 2026-07-03/07-04;
detector scheduled live since ~07-25.
**Status:** Dormant/decision-pending, and now deliberately paused further. A 2026-09-10 audit found
**zero `confirmed` rows have ever existed** — the operator confirm step has never been run. On
2026-09-11, given 33 proposed alerts / only 3 ever sent (via an earlier manual path) and exactly 1
subscriber, the operator **disabled** the `TriggerBreakingEmailSend` cron entirely. Alert
*generation* stays on and still feeds the in-app bell / `/breaking` page — only the subscriber-email
broadcast is off. Why zero emails have ever gone out: the confirm workflow was built but never
operated.

### Recommendation ranking (`newsRecommend/src/scoring.js`)
**What it is:** Code that would personalize each reader's story list by comparing what they've saved
to guess their interests, producing a ranked recommendation list.
**Where it comes from:** `amplify/backend/function/newsRecommend/src/scoring.js`
(`buildInterestProfile`, `isColdStart`, `rankRecommendations`), wired into the Lambda's default
`action:'recommend'`. Built alongside the Lambda's other actions (`list_alerts`, `follow_country`,
unsubscribe). Origin story beyond that: not recorded in `CHANGES.md`.
**Status:** Dormant/unwired. The Lambda logic is complete and callable, but a repo-wide frontend
search found zero references to "recommend" — no page or component ever calls this action. Built,
live infrastructure, no consumer.

### `newsGdeltConflict`
**What it is:** A robot that checks a global conflict-news database (GDELT) every 6 hours and saves
a daily per-country conflict-intensity summary, used only to check whether the news pipeline is
missing important stories (a coverage audit, not a reader-facing feature).
**Where it comes from:** `amplify/backend/function/newsGdeltConflict/src/index.js`; output
`corpus/gdelt/<day>.json`, consumed by `newsImpactAudit`. Deployed to prod in June via an unmerged
`signal-api` branch; source only reconciled to `main` on 2026-08-01. Its DynamoDB mirror table was
dropped 2026-09-09 (S3-only since).
**Status:** Live, and no longer actually orphaned — confirmed healthy 2026-09-10 (running every 6h,
no throttling), with a real single consumer (`newsImpactAudit`'s coverage dead-man's-switch). The
"orphan ingest" label reflects its June–August state, when it was deployed but sourceless on `main`.
It feeds no map or user-facing surface.

### `newsAnalyze` credits (`POLAR_CREDIT_PACKS`, `MEMBER_MONTHLY_ALLOWANCE`, `ANALYZE_DAILY_CAP`)
**What it is:** A planned pay-per-use option for the AI "Analysis Studio" — members get some free
runs per month, then buy credit packs; non-members could also buy credits without subscribing.
**Where it comes from:** `newsAnalyze` / `newsPolarBilling` source (credit metering, webhook grant
logic); checklist `project-docs/billing/_proposed/PROD_CREDITS_NEXT_STEPS.md` (PARKED 2026-07-06); design
`POLAR_BILLING_PLAN.md` §5. Built and sandbox-verified 2026-06-30. Steps 1-3 of the go-live checklist
are done (CORS fixed 07-01, code pushed, live Polar credit-pack products created 07-01 — $40/10,
$70/20, $150/50). Steps 4-8 (set prod env vars, deploy the credit code, wire the frontend, verify,
cleanup) were never run.
**Status:** PARKED / decision-pending. As of the 2026-07-29 deploy, prod `newsAnalyze` still runs the
pre-credits code (hard `tier=member` gate, `ANALYZE_DAILY_CAP=100`); `POLAR_CREDIT_PACKS` is still
unset in prod, so the feature is present in the repo but inert live. Deliberately parked because it
would monetize a near-zero-usage feature.

### `DRY_RUN` on `newsSituationTracker`
**What it is:** A safety switch. When on, the tracker practices on a private "shadow" copy of the
data instead of touching what readers actually see, so its behavior can be watched without risk
before trusting it live.
**Where it comes from:** `amplify/backend/function/newsSituationTracker/src/index.js:13` —
`const DRY_RUN = process.env.DRY_RUN !== 'false'; // default true (shadow) until explicitly flipped`.
Designed as a ~1-week shadow trial ahead of the map-as-home situation-tracker launch.
**Status:** Live, not shadow, in prod — the deployed override is `DRY_RUN=false` (confirmed by the
2026-09-10 audit; `ARCHITECTURE.md`). The **source code default is still `true`/shadow** — only the
deployed environment variable flips it live, a repo-vs-prod trap this project has been bitten by
before. Several known bugs (F2-F8, same list as under `situation` above) remain unfixed pending
operator decisions.

---

## Plan / decision terms

### World Model
**What it is:** The single rulebook meant to define what counts as an "event," how it's identified,
typed, scored, and timed across the whole site, so the map, the editorial pipeline, and predictions
all agree on meaning instead of each inventing its own.
**Where it comes from:** `project-docs/architecture/WORLD_MODEL.md`, drafted grounded in
`worldmodel-verify/VERIFY.md`, `IMPACT_FIRST_REDESIGN_PLAN.md`, `EVENT_REGISTRY_PLAN.md`,
`DATA_STRATEGY.md`; debated in `WORLD_MODEL_DEBATE_2026-09-11.md` by three adversarial positions
(Unifier / Pluralist / Visitor-First).
**Status:** Decision-pending overall, partially decided — D1 and D2 (below) were recorded 2026-09-12.
Nothing in the doc is built yet; it is a binding meaning-layer, not shipped code.

### D1 — "keep developments, demoted"
**What it is:** The site covers two kinds of stories: EVENTS (things with a place and an actor —
wars, elections, disasters — that get map pins) and DEVELOPMENTS (placeless but important things,
like a science/climate/tech shift, with no country to pin). The operator decided to keep
DEVELOPMENTS but demote them: no map pin ever, no guaranteed quota slot, always ranked below EVENTS,
shown as a quiet secondary band, not a nav page or front-page peer. It adds no new ID system — just a
display tag off fields that already exist (`iso3[]`/`actors[]` present = EVENT, absent =
DEVELOPMENT).
**Where it comes from:** `WORLD_MODEL.md` "OPERATOR DECISIONS — 2026-09-12" block; resolves the
Unifier-vs-Pluralist debate as the "Pluralist-compromise" option.
**Status:** Decision recorded (commit `85ef6cb`, 2026-09-12), not yet built — the display band/badge
does not exist in the frontend yet.

### D2 — "one importance scale"
**What it is:** Everywhere the site tells a reader "how big a deal is this," it should show the same
four-level scale (low/moderate/elevated/high — the canonical severity tier, above), instead of the
eight-plus different scoring systems that exist today. Three scores are explicitly kept separate
because they answer different questions: prediction probability (likelihood, not importance), the
breaking-alert score (an internal gate never shown to readers), and economic-impact severity (market
magnitude, may feed the display tier but stays its own measure).
**Where it comes from:** `WORLD_MODEL.md`, same 2026-09-12 decision block. The underlying scale
(`riskTiers.js`, 25/50/75 bands) predates this decision and was separately confirmed canonical
2026-09-11 with zero frontend stragglers.
**Status:** Decision recorded. Classifier severity and GDACS level already fold into the tier
(done); the one-time editorial `significance`/`urgency` consumer check is executed as of
2026-09-15 — `urgency` is kept as the 4th exception (tempo, `WORLD_MODEL.md` D2), `significance` is
left as-is (legacy), and the Phase-2 replacement was dropped.

### The convergence build / "Phase 2" (editorial selects from the registry)
**What it is:** Right now the map side and the editorial side each independently decide what's a big
story, using two separate ID systems (see **topicId/threadId/storyId** above) that don't talk to
each other. "Phase 2" is the eventual fix: have the editorial pipeline pick its topics *from* the
map's event registry instead of running its own separate news fetch, so there's one true list of
"what happened" and everything else derives from it.
**Where it comes from:** `WORLD_MODEL.md` §2 and §8 (step 5: "Editorial-selects-from-registry ≡
IMPACT_FIRST P3"); roadmap named in `EVENT_REGISTRY_PLAN.md`. Phase 1b (the fingerprint tag fields)
already shipped 2026-09-11.
**Status:** Planned, not started — explicitly gated behind a full shadow-week validation and
requires the **P0 reference set** (below) to exist first, since without it there's no yardstick to
gate the flip against.

### Home swap (S6)
**What it is:** Replacing the current homepage's written-lede/topic-list layout with a 2.5D
map-as-hero design, showing live situations ranked by severity instead of prose.
**Where it comes from:** `WORLD_MODEL.md` §8 step 7, design detail in
`MAP_HOME_SITUATION_PLAN.md`. Approved by the operator 2026-09-08.
**Status:** Approved design, not built — explicitly sequenced to happen *after* the World Model
convergence work, not blocking it.

### The P0 reference set
**What it is:** A small set of stories a human (the operator) has hand-picked and labeled "yes this
matters" / "no this doesn't," used as an answer key to judge whether any automated importance-ranking
system is actually choosing well, before it's trusted.
**Where it comes from:** `WORLD_MODEL.md` §8 step 5, referenced back to
`IMPACT_FIRST_REDESIGN_PLAN.md`.
**Status:** Planned, not built — a hard prerequisite blocking the Phase 2 shadow-gate flip.

### Codebook / gold set / agreement metric
**What it is:** Borrowed from how professional conflict-data organizations (like ACLED) grade their
own analysts: write down exact rules for scoring an event's severity (the "codebook"), have a human
score ~25 real past events by hand as the correct answers (the "gold set"), then measure how often
the automated system agrees with the human (the "agreement metric"). Today the site's entire
severity-scoring instruction is one sentence applied to different kinds of judgments, with no
ground-truth check at all.
**Where it comes from:** `project-docs/architecture/DESIGN_UPGRADES_2026-09-14.md` §2 row 6, §3, §5
item 6, alongside `SCORING_STANDARDS.md`. Proposed in the 2026-09-14 pressure-test of six industry
scoring patterns against this codebase; designed to reuse existing `quality/` conventions
(`golden_evals.json` shape, `pick_weekly_review.js` labeling workflow). Estimated cost: about half a
day of engineering plus 1.5-2.5 operator-hours to label 25 events.
**Status:** Built 2026-09-15 — codebook, 28-record gold set, agreement script, and first baseline all
exist; the current rubric has been baseline-scored against the gold set, and a prompt fix is pending
(Phase 4).

---

## The six adopted tools (`DESIGN_UPGRADES_2026-09-14.md` — planned, none built)

All six are read-only scripts or monitors — deliberately "verification machinery, not architecture
surgery." Two heavier options (event-chain rewiring, a code bundler) were pressure-tested and
rejected.

### 1. check-shared-sync
**What it is:** A script that checks whether files meant to be identical copies of each other (like
two Lambdas' shared risk-scoring logic) have actually drifted apart, and flags it if so.
**Where it comes from:** Planned as `scripts/check-shared-sync.mjs`. Replaces a rejected "bundler"
option — the pressure-test found only 2 truly-identical file pairs exist, not enough to justify a
build system.
**Status:** Planned — smallest/first item on the build list.

### 2. Model-default scan
**What it is:** A script that greps the whole codebase for hardcoded AI-model names buried in code
(separate from the environment-variable settings the existing `newsModelGuard` monitor already
checks), so a stale or wrong model choice can't hide in a code fallback nobody's watching.
**Where it comes from:** Planned as `scripts/audit-model-defaults.mjs`. Found 19 Lambdas carry both
an env-var model setting *and* an independent hardcoded fallback invisible to `newsModelGuard`.
Replaces a rejected "central models.json config" option, since that would require manually
redeploying ~20-30 Lambdas in this shop's zip-patch deploy process.
**Status:** Planned, zero-redeploy detection-only script.

### 3. Fleet reconciler
**What it is:** A script that compares what's actually running live on AWS against what the repo's
code and docs claim is running, to catch drift — like a Lambda that's deployed but the docs still
call it retired.
**Where it comes from:** Planned as `scripts/reconcile-fleet.mjs`, modeled on an existing working
pattern in `newsModelGuard/src/index.js:50-59`. Its need was proven live during the 2026-09-14
pressure-test itself: `ARCHITECTURE.md` §10 was found still describing the retired
`linkedInAutoPost` feature as live, three days after it was actually shut down (fixed same day).
**Status:** Planned, read-only script; manifest to be auto-generated rather than hand-maintained.

### 4. Generic freshness checker
**What it is:** A general "is this data stale?" watchdog, extended to cover roughly 8-12 shared data
files the site depends on that currently have no staleness check at all — built by generalizing the
one freshness monitor that already works (`newsFreshnessMonitor`).
**Where it comes from:** Planned. The pressure-test found zero schema/shape-drift incidents have ever
occurred in this repo's history, so the stricter "data contract" half of the industry pattern
(dbt/Dagster-style schema validation) was deliberately deferred as premature; only the freshness half
was adopted.
**Status:** Planned, touches zero existing Lambdas; must avoid duplicating the situation tracker's
existing separate CloudWatch alarms.

### 5. Completion-marker guard
**What it is:** A lightweight check where a downstream process reads the timestamp on the upstream
data it depends on and loudly warns if it's about to use stale data, instead of silently proceeding.
**Where it comes from:** Planned. Replaces a rejected "event-chain" pattern (Airflow/Dagster/Step-
Functions-style trigger-on-completion) — the pressure-test found only 4 of ~8 cron-job pairs are true
dependencies, and switching to event triggers would introduce a new silent-skip failure mode,
arguably worse than the current silent-stale one, with no existing precedent in this fleet.
**Status:** Planned, lightweight guard on the 4 true daily-chain dependencies (thread→country,
thread→systems, thread→econ, econ→econQuality).

### 6. Codebook + gold set + agreement metric
Same item as under **Plan/decision terms** above — listed here as tool #6 of the adopted six.

