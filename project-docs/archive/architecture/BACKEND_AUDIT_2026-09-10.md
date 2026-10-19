# Whole-Backend Audit — every Lambda read + live-verified (2026-09-10)

**Method:** the operator asked for proof of full backend understanding. Ten Sonnet auditors ran in
two waves (4 on the situation pipeline — see `../redesign-ux/_active/SITUATION_BACKEND_AUDIT.md` —
then 6 covering every remaining Lambda). Every auditor read every source line of its assigned
functions and verified live AWS state read-only: real schedules (both classic EventBridge rules
AND EventBridge Scheduler — the account uses both), enabled/disabled state, Function URL + CORS
config, memory/timeout/runtime/LastModified, env var NAMES (never values). Conflicting claims were
re-verified directly by the orchestrator. This doc records the verified inventory and the ranked
cross-backend findings. Situation-pipeline findings live in their own doc and are not repeated.

## 1. Verified inventory (37 function dirs; 36 live functions, 1 undeployed)

| Repo dir | Live name (if different) | Trigger (verified) | Notes |
|---|---|---|---|
| newsInvokeGemini | `newsInvokeGemini-dev` | Scheduler `InvokeGoogleGemini` cron 0 */4 (4-hourly) | editorial ingest; Brave fully removed from code; stale `BRAVE_*` env vars remain |
| NewsProjectInvokeAgentLambda | `NewsProjectInvokeAgentLambda-dev` | invoked by pipeline (no direct rule/URL) | summarizer + prediction capture gates G1-G6; Brave grounding silently OFF (no key in env) |
| newsModelGuard | — | rule cron daily 12:00 | fleet model-retirement guard; OpenRouter-namespaced ids invisible by design |
| newsSourceAudit | — | rule daily 08:30 | summary-vs-source drift judge via public proxy |
| newsFreshnessMonitor | — | rule every 2h | staleness probe; STALE_HOURS=5 vs 4h cadence = ~1h slack |
| newsThreadAnalysis | — | rule `TriggerDailyAnalysis` 06:30 | sequential LLM calls + 13s sleeps (by design) |
| newsCountryIntelligence | — | Scheduler `countryIntelliegence` (typo) 07:00 | MAX_COUNTRIES=20 cap, no rotation |
| newsSystemsAnalysis | — | rule 07:15 | ⚠️ `SYSTEMS_TEST_COUNTRIES` env var LIVE in prod — "Phase 1 testing" allow-list may still constrain coverage |
| newsDriftCorrector | — | rule 07:20 | additive-only (DRIFT#/DRIFTLOG# SKs) — never-overwrite invariant enforced by construction |
| newsWeeklyBrief | — | rule Sun 06:00 | header comment claims "no EventBridge schedule" — stale; auto-publishes (`weekly/review.js` at repo root has nothing to gate) |
| newsEconomicImpact | — | rule daily 07:30 | closed instrument allowlist; downgrade-only consistency pass |
| newsEconomicQuality | — | rule daily 08:00 | dead env var `NEWS_CACHE_TABLE`; full-table Scan pattern |
| newsMarketsData | — | 3 rules: hourly all / weekday-06:00 yields / Sun-02:00 macros | no LLM; Yahoo endpoint fragile; `seed_history` won't heal null rows (confirmed in code); double yields fetch at weekday hour 6 |
| newsWeeklyMarkets | — | rule Sun 08:30 (ENABLED — header comment "no schedule" is stale) | ⚠️ Perplexity web-context tier DEAD in prod (no `PERPLEXITY_API_KEY`); drafts gated by `weekly-markets/review.js` (correct) |
| newsSensitiveData | `newsSensitiveData-dev` | request/response (~30 actions), no cron | hardcodes `GlobalPerspectiveMarkets` instead of env var; duplicates track-record + markets-transpose logic |
| newsPredictionResolver | — | rule daily 09:00 | ⚠️ 40-proposal/day cap BINDING every run vs 37,021 pending triggers |
| newsPredictionsSnapshot | — | rule every 30 min | S3 read-cache for /track-record; KEEP-IN-SYNC duplicate of scoring logic |
| newsSignals | — | rule daily 10:00 build + Function URL (key-gated in code) | deployed bytes CURRENT (memory's "5-week drift" is resolved — redeployed 2026-09-09 with S8) |
| newsPairIntelligence | — | rule Mon 08:00 | DEFAULT_PAIRS list stale since 2026-04-18; `countries` field mismatch is compensated by frontend slug parsing (not a live bug) |
| newsGdeltConflict | — | rule every 6h | HEALTHY — running cleanly, no IP throttling observed (memory note outdated) |
| newsImpactAudit | — | rule daily 09:00 | fully S3; dead env vars `IMPACT_AUDIT_TABLE`, `INGEST_CAPTURE_TABLE`; working as designed (SNS'd a "weak" verdict yesterday) |
| newsGdacsIngest | — | rule every 20 min | see situation audit |
| newsSituationIngest | — | rule hourly | see situation audit |
| newsSituationTracker | — | rule every 30 min | see situation audit |
| newsAnalyze | — | Function URL (Firebase JWT in code) | ⚠️ CONFIRMED repo≠deployed: live env has `ANALYZE_DAILY_CAP`, no allowance/credit vars — repo's credits code is NOT live |
| newsPolarBilling | — | Function URL (webhook HMAC + JWT actions) | `POLAR_CREDIT_PACKS` absent live ⇒ credit-pack purchases disabled (matches PROD_CREDITS_NEXT_STEPS pending state); mis-grant guard in place |
| newsStripeWebhook | **NOT DEPLOYED** | none | actually a Paddle handler (misnamed dir); pure dead source |
| newsSavedItems | — | Function URL (JWT; URL-config CORS) | clean |
| newsRecommend | — | Function URL (mixed auth) | ⚠️ public `list_alerts` = unauthenticated full-table Scan, no rate limit — weakest abuse surface found |
| newsClientErrors | — | Function URL (public, bounded) | best-hardened public endpoint of the fleet |
| newsErrorDigest | — | rule every 6h | full-table Scan each run (fine at current volume) |
| newsBreakingAlert | — | rule every 4h (:15) | proposes alerts; auto-send-to-operator branch; `verifyStory()` is a stub |
| newsEmailSender | — | 3 rules: breaking 15-min ENABLED / weekly Sun 14:00 ENABLED / drift 07:40 **DISABLED** | ⚠️ breaking broadcast is a live no-op: 0 `confirmed` rows in the table (operator never runs `breaking/review.js`), yet the 15-min poll keeps firing |
| newsPostLinkedIn (dir) | `newsPostLinkedin` (lowercase "in") | Scheduler `InvokeLinkedIn` every 3h | ⚠️ env carries Mastodon/Telegram/Farcaster/Nostr secrets with zero code referencing them (repo code = LinkedIn+Bluesky only) — dead secrets or deployed-zip drift; needs a zip diff to settle |
| linkedInAutoPost | — | Scheduler every 12h | second LinkedIn poster, same account, DIFFERENT dedup namespace ⇒ no cross-dedup with newsPostLinkedin — duplicate-post risk; legacy candidate for retirement |
| newsPostDevTo | — | Scheduler `InvokeDev` daily 23:00 | dev.to publishing is DEAD code (removed 2026-05-18); function is now purely the /daily brief generator; `DEVTO_API_KEY` orphaned |
| newsCountryFactsUpdater | — | Scheduler `Fact` daily 05:00 | Wikidata+ACLED facts; ACLED failure falls back to stale data silently; cleanest Lambda of its group |

Human-in-the-loop scripts verified at repo root: `breaking/review.js` (sets `status:'confirmed'` —
the code path is intact; it just isn't being run), `weekly/review.js` (vestigial — weekly brief
auto-publishes), `predictions/review.js` (promotes resolver proposals to `finalVerdict`),
`weekly-markets/review.js` (the live draft→published gate).

## 2. Cross-backend findings, ranked

1. **Prediction backlog is stalled at scale** — 37,021 of 37,158 dated triggers pending; resolver
   capped at 40 proposals/day (cap binding every run) and each proposal still needs manual
   `predictions/review.js` confirmation. Only 30 fired / 122 scored ever. The /track-record
   calibration moat cannot grow at this throughput. (Memory's "585 due" figure was off by ~60×.)
2. **Breaking-alert subscriber broadcast has never actually flowed** — the every-15-min sender
   polls for `status:'confirmed'`; live count of confirmed rows: 0. The code chain is intact;
   the operator confirm step (`breaking/review.js`) is simply never run. Either run it, automate a
   confidence-gated auto-confirm, or disable the 15-min cron.
3. **Two LinkedIn posters, one account, no shared dedup** — `newsPostLinkedin` (3-hourly,
   topics+images+Bluesky) and `linkedInAutoPost` (12-hourly, thread/country) use disjoint dedup
   namespaces (`POSTED#LINKEDIN#` vs `POSTED#LINKEDIN_AUTO#`); overlapping posts about the same
   story are structurally possible. Decide primary; retire or cross-dedup the other.
4. **Repo≠deployed drift, confirmed instances** — `newsAnalyze` (credits code parked in repo;
   daily-cap live), `newsPostLinkedin` (env secrets for 4 platforms the repo code never touches —
   unresolved without a zip diff). Corrected the other way: `newsSignals` is NO LONGER drifted
   (redeployed 2026-09-09). Standing rule stays: diff deployed zip before editing any Lambda.
5. **Silently-dead capability tier** — `newsWeeklyMarkets`' Perplexity web-context tier
   (documented as one of its three trust tiers) has no API key live; uncovered movers always get
   "No clear driver found". Also `NewsProjectInvokeAgentLambda`'s Brave grounding is off (no key).
6. **`SYSTEMS_TEST_COUNTRIES` live on prod `newsSystemsAnalysis`** — a "Phase 1 testing"
   allow-list env var that replaces top-5-by-volume selection. Operator should confirm intent or
   remove it.
7. **Public unauthenticated Scan endpoint** — `newsRecommend` `list_alerts`: full table Scan per
   call, no rate limit, no cache. Cheap today, an abuse/cost surface as the table grows.
8. **Env-var hygiene (dead config), fleet-wide pattern** — stale `BRAVE_SEARCH_API_KEY`/
   `BRAVE_CONCURRENCY` (newsInvokeGemini), `XAI_API_KEY_BACKUP` (set on ≥5 functions, referenced
   by zero), `OPENAI_API_KEY` (unused where set), `NEWS_CACHE_TABLE` (newsEconomicQuality),
   `IMPACT_AUDIT_TABLE`/`INGEST_CAPTURE_TABLE` (newsImpactAudit), `DEVTO_API_KEY` (newsPostDevTo),
   4 social-platform secrets (newsPostLinkedin). Orphaned secrets should be removed (merge-don't-
   clobber env discipline applies).
9. **Stale "no schedule yet" header comments** — `newsWeeklyBrief` and `newsWeeklyMarkets` both
   claim manual-invoke-only; both have ENABLED crons. Tracker header claims 10-min sweeps (real:
   30). Doc-drift in Lambda source, fix at next touch of each file.
10. **Duplicated load-bearing logic (no shared modules)** — Firebase JWT verification copied
    near-verbatim across 4 Lambdas; track-record scoring in 3 places (snapshot, newsSensitiveData
    fallback, newsSignals); markets HISTORY-transpose in 3 places; `riskDimensions.js` and
    `situations-core.js` hand-synced pairs (both currently identical — verified). A security fix
    or scoring change must be applied N times by hand.
11. **Fixed-time cron chain with no completion ordering** — 06:30 threads → 07:00 country → 07:15
    systems → 07:20 drift → 07:30 econ → 08:00 quality all assume the prior stage finished; a slow
    run silently feeds the next stage stale data. Structural fragility, not an observed failure.
12. **Naming traps (live-verified)** — deploy names: `newsInvokeGemini-dev`,
    `newsSensitiveData-dev`, `NewsProjectInvokeAgentLambda-dev`, `newsPostLinkedin` (case).
    Scheduler name typo `countryIntelliegence`. `newsStripeWebhook` dir contains a Paddle handler.
    `newsPostDevTo` no longer posts to dev.to. `provider:'openai'` stamped on records generated by
    DeepSeek.
13. **Silent-degradation paths (accepted per fail-empty doctrine, but unmetered)** —
    newsCountryFactsUpdater keeps stale ACLED data on auth failure; newsSourceAudit degrades to
    snippets when article fetches fail with no distinct marker; systems-analysis discards invalid
    LLM graph output with only console.warn; ingest batch failures drop ~35 articles unlogged.
14. **CORS: fleet is CLEAN** — every URL-bearing function matches the code-owns-CORS ⇔ empty-URL-
    config rule (newsAnalyze/newsPolarBilling code-owned; newsSavedItems/newsRecommend/
    newsClientErrors URL-config-owned). No duplicate-ACAO violations anywhere.

## 3. Memory/doc corrections established by this audit

- `newsSignals` deployed-drift note → RESOLVED (current as of 2026-09-09).
- `newsGdeltConflict` "GDELT IP-throttled from Lambda" → not currently manifesting; 6-hourly runs
  clean across the checked window (the *ingest*-side GDELT disable in newsSituationIngest is a
  separate, still-valid decision).
- Prediction "585 open triggers" → actual pending backlog 37,021.
- `breaking/review.js` etc. exist at repo root (auditors looking in Lambda src alone will miss
  them).
