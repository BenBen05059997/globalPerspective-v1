# Country Intelligence vs. Analysis Studio — merge assessment (2026-09-24)

**Question posed by operator:** now that pair-intelligence was migrated conceptually into the
Studio (cron disabled, dead display surface, recorded as a future "Bilateral relationship" lens,
not built) — does `newsCountryIntelligence` deserve the same treatment?

**Read-only assessment. No code changed.** All citations are file:line as read 2026-09-24, plus
live AWS reads (`aws scheduler get-schedule`, `aws events list-rules/list-targets-by-rule`,
`aws lambda get-function`).

**Bottom line up front: no — not the same treatment.** Pairs had a dead display surface and no
other consumers, so migrating was free. Country intelligence has a live public page, is the risk
backbone for four other Lambdas, and is one of the two live targets of the pending severity-prompt
fix (ONE_TRUTH_EXECUTION_PLAN.md Phase 4). A full merge into the Studio would delete public
surface area, break four downstream consumers, and paywall content that's currently anonymous-
accessible. The real overlap is narrower and fits the SERIAL pattern from
`WORLD_MODEL_FRAGMENTS.md`, not TRUE-MERGE. See Verdict section.

---

## 1. What `newsCountryIntelligence` produces

Source: `amplify/backend/function/newsCountryIntelligence/src/index.js`.

- **Trigger:** EventBridge **Scheduler** schedule `countryIntelliegence` (sic — typo in the live
  resource name), `cron(0 7 * * ? *)`, **ENABLED**, target
  `arn:...:function:newsCountryIntelligence` (verified via `aws scheduler get-schedule`). This is
  *not* a classic `events` rule (a `list-rules` scan misses it entirely — worth noting for anyone
  auditing schedules by that command alone). `TriggerDriftCorrector`
  (`cron(20 7 * * ? *)`, `aws events list-rules`) is described inline as running "after
  newsCountryIntelligence (07:00 UTC)" — confirms the daily chain: country intel 07:00 → drift
  corrector 07:20 UTC.
- **Model:** `deepseek-v4-pro` via the xAI-shaped endpoint (env `GROK_MODEL`, `GROK_ENDPOINT`,
  `XAI_API_KEY` — misleading names per `feedback_misleading_grok_naming`, verified live: this repo
  points at DeepSeek) — `index.js:15-17`, thinking disabled (`index.js:615-617`, DeepSeek V4
  defaults to thinking mode which burns `max_tokens` on invisible reasoning).
- **Scale per run:** up to `MAX_COUNTRIES = 20` countries (`index.js:46`), `LLM_CONCURRENCY = 4`
  (`index.js:33`), reads a 30-day archive window across all `TOPICS_DDB_TABLE` daily buckets
  (`index.js:47,112-145`). Per country that needs regeneration: 1 DeepSeek call
  (`invokeGrok`, `index.js:601`) + up to 4 Brave News calls (1 `searchCountryNews` +
  3-query `gatherCountryGrounding`, `index.js:270-289,349-397`) + a skip-if-unchanged check
  (`readExisting`, `index.js:230-240`, keyed on `totalArticles` not changing). Worst case ≈20
  LLM calls + 80 Brave calls/day; typically fewer because of the skip guard.
- **Records written** (`writeAnalysis`, `index.js:525-597`), all in `SUMMARIZE_PREDICT_TABLE`:
  - `PK: COUNTRY#{name}`, `SK: COUNTRY_INTELLIGENCE` — the live record: `headline`, `bluf`,
    `keyDevelopments[]`, `whyItMatters`, `backgroundTimeline[]`, `crossThreadInsight`,
    `trajectory`/`trajectoryDetail`, `riskSignals[]`, `dimensions` (4-axis: conflict/political/
    economic/humanitarian, each `{score, why}` or null — `index.js:487-494`), `riskScore`/
    `riskLevel`/`lead` **derived** from `dimensions` via `deriveRisk()` in
    `riskDimensions.js` (worst-axis rule, per `project_scoring_model_v2` memory), `keyActors[]`,
    `groundingSources[]`, `model`, `latencyMs`, TTL 90 days (`index.js:45`).
  - `PK: COUNTRY#{name}`, `SK: HISTORY#{dateKey}` — daily snapshot for sparkline/riskDelta
    (`index.js:578-594`).
- **Editorial/grounding inputs layered in** (authority hierarchy, `index.js:438-443`): operator-
  verified `country_facts.json` (highest) → live Brave grounding search (leadership/regime
  status) → 30-day archive/thread analyses → Brave News references → own prior `DRIFT#` notes
  from `newsDriftCorrector` (continuity only). This grounding stack (editorial facts + live
  search + drift continuity) has no equivalent in the Studio path today.

## 2. Full consumer map

| Consumer | What it reads | Live? |
|---|---|---|
| `CountryPage.jsx:359` via `useCountryIntelligence` hook (`hooks/useCountryIntelligence.js:7`) → `services/restProxy.js:158 fetchCountryIntelligence` | Full `COUNTRY_INTELLIGENCE` record for one country | **Live, public page** `/weekly/country/:countryName` (`App.jsx:119`), **no auth guard** — memory rule `feedback_auth_guard_hooks.md` explicitly lists this pattern as backend-public; confirmed no `useAuth`/`user` gate in `CountryPage.jsx` around the hook call |
| `CountryListPage.jsx:275` via same hook | Intelligence for all listed countries (headline/risk chips on the list) | **Live, public** `/weekly/countries` (`App.jsx:118`) |
| `newsWeeklyBrief/src/index.js:62` | `getRecord(COUNTRY#{name}, COUNTRY_INTELLIGENCE)` — feeds the Sunday DeepSeek synthesis alongside `ECONOMIC_IMPACT` and prediction log (`index.js:5-7`) | **Live** — `TriggerWeeklyBrief cron(0 6 ? * SUN *) ENABLED`, feeds `/weekly-brief` page + email |
| `newsBreakingAlert/src/index.js:111` | `getRecord(COUNTRY#{r}, COUNTRY_INTELLIGENCE)` per region touched by a candidate story — "max risk across the story's regions" (`index.js:105`) feeds into breaking-alert significance scoring | **Live** — `TriggerBreakingAlert cron(15 */4 * * ? *) ENABLED` |
| `newsSignals/src/index.js:168`, `signalAdapter.js:36,253` | Scans `COUNTRY#` prefix / `COUNTRY_INTELLIGENCE` SK to build the `geopolitical_risk` signal type, reusing the *same calibration* as `riskScore` (`signalAdapter.js:36`) | **Live** — `TriggerSignalsBuild cron(0 10 * * ? *) ENABLED`, feeds the paid Signal API |
| `newsDriftCorrector/src/index.js:33` | `COUNTRY_PK = COUNTRY#{n}` — reads the current record, writes `DRIFT#` notes back under the same PK, which the *next day's* `newsCountryIntelligence` run reads back via `buildDriftBlock` (`index.js:245-266`) | **Live** — `TriggerDriftCorrector cron(20 7 * * ? *) ENABLED`; feeds "What changed" band per `project_living_analysis` |
| `newsEmailSender/src/index.js:213-252` | Queries `DRIFT#` items under `COUNTRY#` PKs to compose the drift digest email | **Live pathway, but `TriggerDriftEmailSend` cron is DISABLED** (0 subscribers, per `project_member_gating` memory) — code live, cron off |
| `newsSensitiveData/src/index.js` (multiple lines: 524, 553, 561, 570, 620-623, 778, 783, 1217) | Owner/admin tooling: reads `COUNTRY_INTELLIGENCE`, its `HISTORY#`/`DRIFT#`/`DRIFTLOG#` items, and a `pk.startsWith('COUNTRY#')` scope split vs `THREAD#` | **Live** — this is the admin/ops surface (dashboards, spot-checks), heaviest single consumer by line count |
| `newsPostDevTo/src/index.js:59` | `COUNTRY_INTELLIGENCE` record, presumably to source syndication copy | **Live** (cron not independently verified this pass, but code path is current) |
| `quality/severity_gold_set.json`, `quality/severity_agreement.js`, `quality/severity_prompt_eval.js`, `quality/pick_severity_sample.js` | Samples `COUNTRY#<name>/COUNTRY_INTELLIGENCE` records (25-30, alongside `THREAD_ANALYSIS`) to measure model-vs-operator agreement on `dimensions` | **Live workstream** — `ONE_TRUTH_EXECUTION_PLAN.md` Phase 4 names `newsCountryIntelligence` (deepseek-v4-pro) as one of **the two** target generators for a measured severity-prompt fix (the other is `newsThreadAnalysis`, gemini-2.5-flash), status "ADDED 2026-09-15, post-baseline" — this is an **open, in-flight workstream against this exact lambda** |
| LinkedIn weekly poster (`newsPostLinkedIn/src/index.js`) | Checked directly: only builds `weekly/thread/{threadId}` deep links (`index.js:460`), no `COUNTRY#`/`weekly/country` reference found | **Not a consumer** — correcting the task brief's assumption; the LinkedIn poster links threads, not countries |
| `newsRecommend` | Grepped for `COUNTRY#`/`COUNTRY_INTELLIGENCE` | **Not a consumer** — no hits |

**Net:** at least **7 live production consumers** (CountryPage, CountryListPage, WeeklyBrief,
BreakingAlert, Signals/paid API, DriftCorrector↔itself, SensitiveData admin) plus one in-flight
quality workstream measuring this lambda's own prompt. This is the opposite of the pair case.

## 3. The pair-case contrast (why that migration was clean)

Per the operator's own framing and `LEGACY_MAP_IDEA_HARVEST_2026-09-24.md`/session history: pair
intelligence (`newsPairIntelligence`, `PAIR#{slug}` PK) had **one dead display surface** (pair
pages were deleted; `pair_analyses_list` is kept only because it powers `/map` arcs — a narrow,
already-decoupled read) and **no other Lambda consumers**. `TriggerPairIntelligenceWeekly` is
confirmed **DISABLED** live (`aws events list-targets-by-rule` shows the rule still wired to
`newsPairIntelligence` but the schedule itself was disabled). Cancelling the cron and recording it
as a future Studio lens cost nothing: nothing else read `PAIR#` records, and the one page that
displayed them was already gone.

Country intelligence is structurally the opposite:
- **Live public page**, not a dead one — `/weekly/country/:name` and `/weekly/countries`, no auth
  guard.
- **Downstream consumers span breaking alerts, the weekly brief, the paid Signal API, drift
  correction, and admin tooling** — pulling the cron would silently degrade all five.
- **Active quality workstream** targets its prompt specifically (Phase 4 of
  ONE_TRUTH_EXECUTION_PLAN.md) — killing the generator mid-workstream would strand that work.

`WORLD_MODEL_FRAGMENTS.md:84-87` already classifies `PAIR#{name}`, `COUNTRY#{name}`, and
`SYSTEMS#{name}` together as **DISTINCT identity grains** (coarser than per-event identities,
keyed by country or country-pair) — so at the *identity* level the two are peers. The divergence
is entirely about **consumer load-bearing-ness**, not data-model kinship.

## 4. Contrast with the Studio's model

Source: `AnalysisStudio.jsx`, `utils/analysis.js`, `utils/analysisPrompt.js`,
`amplify/backend/function/newsAnalyze/src/index.js`.

- **Gating:** `AnalysisStudio.jsx:24-32` — "registered-only feature (anonymous guests count as
  not-registered)... scoped to THIS feature only, does not touch the public data hooks." Paid
  path: `isMember` monthly allowance first, then a purchased credit
  (`newsAnalyze/src/index.js:113-129,203-222`); free path is BYOK (user's own provider key,
  browser→provider directly, `newsAnalyze/src/index.js:5`).
- **On-demand, not cron:** the Studio runs when a signed-in user clicks Analyze, not on a
  schedule.
- **Grounding:** `buildAnalysisContext()` (`utils/analysis.js:27-44`) fetches per-*topic* cached
  `SUMMARY`/`PREDICTION`/`TRACE_CAUSE` (via `restProxy.fetchSummaryCache` etc.) for up to
  `MAX_STORIES = 4` user-selected topics (`AnalysisStudio.jsx:20`) — **it does not read `COUNTRY#`
  records today.** The system prompt (`SYSTEM_PROMPT`/`DEEP_SYSTEM_PROMPT` in
  `utils/analysisPrompt.js`) is server-pinned, not user-editable.
- **Deploy caveat** (per memory `project_analysis_studio`): prod `newsAnalyze` is a **patched
  deploy zip** — the repo file carries parked-credits code that differs from what's live. Any
  change routed through here needs the same live-vs-repo bytes check called out for
  `project_signal_api_deployed` and `project_breaking_alert_scoring_rework`.

**Public/anon note:** `CountryPage`/`CountryListPage` content is anonymous-accessible (backend
public, per `feedback_auth_guard_hooks` memory and confirmed by absence of an auth gate in
`CountryPage.jsx`). The Studio is registered-only, and its server-compute path is member/BYOK
gated on top of that. **A full merge would paywall currently-public country pages** — a real
product regression, not a wash.

## 5. Verdict options

### A. Full merge (retire `newsCountryIntelligence`, fold into Studio) — NOT RECOMMENDED
What it would break:
- `/weekly/country/*` and `/weekly/countries` go from public/anon to registered+paid/BYOK, or need
  a separate free-serving path rebuilt from scratch (defeats the point of merging).
- `newsBreakingAlert`, `newsWeeklyBrief`, `newsSignals` (paid API), `newsDriftCorrector` all lose
  their upstream `COUNTRY_INTELLIGENCE`/`riskScore` read unless each is rewired to trigger an
  on-demand Studio run per country — turning a cheap batched cron into N ad-hoc paid/BYOK calls
  triggered by backend jobs, which doesn't fit the Studio's user-initiated design at all.
  `newsSensitiveData` admin tooling and the Phase 4 severity-quality workstream lose their target.
- Cost/complexity: replacing one scheduled batch job (≤20 LLM calls/day, shared across all
  consumers) with per-consumer on-demand calls multiplies spend and latency for no visible gain.

### B. Keep cron, add a Studio "Country deep-dive" lens (SERIAL) — RECOMMENDED
Matches the TRUE-MERGE/SERIAL/DISTINCT framework in `WORLD_MODEL_FRAGMENTS.md`: this is a SERIAL
opportunity, not a TRUE-MERGE. `newsCountryIntelligence` stays the upstream source of truth
(cron unchanged, all 7 consumers unaffected); the Studio gains an optional lens that **reads** the
latest `COUNTRY#{name}/COUNTRY_INTELLIGENCE` record plus the user's currently-selected topics as
additional grounding context, the same way `buildAnalysisContext` already folds in
SUMMARY/PREDICTION/TRACE_CAUSE. This is additive: one new `fetchCountryIntelligence`-style read in
`utils/analysis.js`, no write path, no cron change, no gating change to the public country pages.
Cost: a small frontend/prompt-assembly change; no backend risk.

### C. Do nothing — plausible interim, not final
Country intelligence is mid an active quality workstream (Phase 4). It may be reasonable to let
that land first (it changes the prompt/rubric this lambda uses) before layering a Studio lens on
top of a record shape that's about to change (`dimensionsPromptVersion: 2` stamp per
`ONE_TRUTH_EXECUTION_PLAN.md:28`). Cost of waiting: none structurally; just sequencing.

**Recommendation: B, sequenced after C.** Do not touch the cron or the public pages. Let Phase 4's
severity-prompt fix land and stabilize the `dimensions`/`riskScore` shape first (it's already
approved and in flight), then add the Studio's "Country deep-dive" lens as a pure consumer of the
existing record — never as a replacement generator.

## 6. Open questions for the operator

1. Does "merged into the Studio" mean *retire the cron* (Option A) or *let the Studio use the
   data* (Option B)? The operator's phrasing echoes the pair case, but the evidence above says
   they're not analogous — worth confirming intent before scoping either way.
2. If Option B: should the "Country deep-dive" lens require the country to already have topics
   selected, or should it work standalone (select a country instead of stories)? The current
   Studio's unit of selection is topics, not countries — this is a UX decision, not just a data
   one.
3. Should the Studio lens wait for Phase 4 (severity-prompt v2) to ship, given
   `ONE_TRUTH_EXECUTION_PLAN.md`'s hard rule against touching the generator's rubric until its own
   offline eval passes? Recommendation above says yes; confirm.
4. `newsPostDevTo` reads `COUNTRY_INTELLIGENCE` — its cron/purpose wasn't independently re-verified
   this pass (only the code path). If DevTo syndication is dead too, it's a separate small cleanup
   item, not part of this decision.
