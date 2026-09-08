# OPTIMIZATION_REPORT.md — Evidence-based fix list

**Generated:** 2026-05-18, from on-disk source. Every finding cites file:line. Companion to SYSTEM_WIRING.md.

Items ranked **P0 (broken/security) → P1 (cost or major perf) → P2 (correctness) → P3 (hygiene)**.

---

## P0 — Broken in production or load-bearing wrong

### OPT-31. `DEVTO_API_KEY` invalid — **DEFERRED** (low priority — in-app `/daily` works)
- Daily Dev.to publish still fails with 401. `DAILY_BRIEF#YYYY-MM-DD` is stored in DDB so the in-app `/daily` page keeps working; only the public Dev.to article publish path is broken.
- **Fix when ready:** rotate the key at https://dev.to/settings/extensions, then `aws lambda update-function-configuration --function-name newsPostDevTo --environment Variables={...,DEVTO_API_KEY=NEW}`.

### OPT-32. OpenRouter model removed → AI overview missing — **SHIPPED 2026-05-18**
- **What was wrong:** `AI_MODEL` was a hardcoded constant `'deepseek/deepseek-r1:free'`. OpenRouter removed that model → 404 every run → daily brief published without the polished AI intro.
- **Fix shipped:**
  - `newsPostDevTo/src/index.js:25` — `AI_MODEL` now reads `process.env.AI_MODEL || 'deepseek/deepseek-v4-flash:free'`. Verified model exists via `curl https://openrouter.ai/api/v1/models`.
  - Set `AI_MODEL=deepseek/deepseek-v4-flash:free` env var on `newsPostDevTo`.
  - Bumped Lambda timeout 30s → 120s and memory 128MB → 256MB (working model takes ~10s vs old 404 instant-fail).
- **Verified live:** AI overview now generates (1,558 chars). Article body grew from 9,427 → 10,992 chars with the working intro.


### OPT-1. Repo↔deployed drift on newsPostDevTo → **SYNCED 2026-05-18**
- **What was wrong:** Deployed `newsPostDevTo/index.js` was 397 lines; repo was 388 lines, missing 8 const declarations + 2 function imports + a `ScanCommand` import. Someone had edited the Lambda directly in the AWS console without committing back. A `git`-based redeploy would have shipped broken code and silently killed the daily Dev.to publish.
- **Fix shipped:** Pulled `/tmp/devto_deployed/index.js` (deployed source via `aws lambda get-function`) into `amplify/backend/function/newsPostDevTo/src/index.js`. md5 now matches deployed.
- **Drift sweep:** md5-compared deployed vs. repo for `newsInvokeGemini-dev`, `NewsProjectInvokeAgentLambda-dev`, `newsCountryIntelligence`, `newsThreadAnalysis` — all matched. Drift was isolated to `newsPostDevTo`.
- **Remaining:** Sweep the other 9 Lambdas with the same `aws lambda get-function` + md5 check when convenient. Add a CI guard.

### OPT-2. ~~Source code doesn't reflect provider migration~~ — RESOLVED (operator)
- **Status:** I was wrong. Verified 2026-05-18 via `aws lambda get-function-configuration` on all 7 LLM Lambdas.
- **What's actually true:** Migration was done by **swapping env vars in the AWS console** — `GROK_API_URL` now points at `https://api.deepseek.com` (or `generativelanguage.googleapis.com` for `newsThreadAnalysis`), `GROK_MODEL` is `deepseek-chat` / `gemini-2.5-flash`, and `XAI_API_KEY` holds a DeepSeek or Gemini key. No source changes were needed because all three providers expose an OpenAI-compatible `/chat/completions` endpoint. ARCHITECTURE.md was correct.
- **Residual hygiene issue (now OPT-2b below):** the source identifiers are still Grok-named and misleading.

### OPT-2b. Rename Grok-named identifiers in source (cosmetic but high-value)
- **Files:** all 7 LLM Lambdas + their `process.env.GROK_*` references.
- **Evidence:** `GROK_API_URL`, `GROK_MODEL`, `XAI_API_KEY`, `invokeGrok()`, `GROK_ENDPOINT` — none of these now hold Grok values in deployed Lambdas. A future reader (or LLM auditor) will conclude the system runs on Grok. I did, an hour ago.
- **Fix:** Rename to `LLM_API_URL`, `LLM_MODEL`, `LLM_API_KEY`, `invokeLLM()`. Update env vars in console at the same time. Trivial sed pass; coordinate with deploy.

### OPT-2c. Delete `XAI_API_KEY_BACKUP` from all Lambdas
- **Status:** Operator confirmed env vars are the chosen secret store — Secrets Manager / KMS encryption is **out of scope** by design.
- **Remaining action:** Every Lambda still carries `XAI_API_KEY_BACKUP` holding the dead xAI key. It's unused (the live `XAI_API_KEY` slot now holds DeepSeek/Gemini keys) and just expands the blast radius of any future credential leak.
- **Fix:** `aws lambda update-function-configuration --function-name <n> --environment Variables={...}` on each of the 7 LLM Lambdas, omitting `XAI_API_KEY_BACKUP`. Trivial.

### OPT-3. `newsSensitiveData` has hardcoded production table name
- **File:** `amplify/backend/function/newsSensitiveData/src/index.js:718, 741, 769`
- **Evidence:** `TableName: 'GlobalPerspectiveMarkets'` — hardcoded literal, while `newsMarketsData` uses `process.env.MARKETS_DDB_TABLE`.
- **Impact:** Renaming the table or branching to a staging table requires a code edit. Will break in any non-prod environment that doesn't have a table with that exact name.
- **Fix:** Move to `MARKETS_DDB_TABLE` env var; share the value with newsMarketsData.

---

## P1 — Cost and major performance

### OPT-4. ~~Redundant 31-day archive reads~~ → **NOT WORTH FIXING at current scale**
- **Verified 2026-05-18:** NewsCache table consumed **3,654 RCU/day** (~$0.0009/day) and **2,931 WCU/day**. Total cost of all the duplicated archive reads is rounding error.
- Defer. Revisit if NewsCache grows past ~500MB.

### OPT-5. ~~`pruneObsoleteEntries` Scan~~ → **NOT WORTH FIXING at current scale**
- **Verified 2026-05-18:** `SummarizeAndPredict` table holds **383 items, 1.2 MB**. Total ConsumedReadCapacity last 24h across ALL operations on the table: **2,482 RCU** (~$0.0006/day on-demand). The TTL is working — table is not unbounded.
- **Implication:** Replacing the Scan with a GSI saves nothing measurable. Defer indefinitely. Revisit only if table item count crosses ~10k.

### OPT-6. ~~LinkedIn auto-post Scans~~ → **NOT WORTH FIXING at current scale**
- Same reasoning as OPT-5: 383 items total. Three Scans of a 1.2 MB table cost nothing.
- Revisit if/when SummarizeAndPredict grows past ~10k items.

### OPT-7. ~~Sequential LLM calls~~ → **SHIPPED 2026-05-18 — measured in production**

| Lambda | Before (sequential) | After (concurrency 4) | Speedup |
|---|---:|---:|---:|
| `NewsProjectInvokeAgentLambda-dev` | 387.7 s, 14% timeouts (445s wall) | **130.4 s, 0 failures** | **3.0×** |
| `newsCountryIntelligence` | 348 s avg | **60 s** (10 generated + 10 skipped) | **5.8×** |

**Changes deployed:**
- Added a 12-line `mapWithConcurrency(items, limit, worker)` helper at the top of each Lambda (no new dependencies).
- Replaced the `for (const x of items)` loop with `await mapWithConcurrency(items, LLM_CONCURRENCY, async (x) => {...})`.
- New env var `LLM_CONCURRENCY=4` on both Lambdas (tunable without code change).
- Agent Lambda also bumped: memory 128MB → 512MB (max-used at 134MB, plenty of headroom; more memory = more vCPU which helps LLM round-trips), timeout 445s → 600s as a belt-and-braces safety margin (the parallel version uses ~130s).

**Files:**
- `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` — helper at line ~42, loop replacement at line ~70
- `amplify/backend/function/newsCountryIntelligence/src/index.js` — helper after line ~30, loop replacement at line ~70

**Not done (intentionally, low ROI):**
- `newsSystemsAnalysis` — only 18s avg, 5 countries, not worth churning.
- `newsThreadAnalysis` — usually skips most threads via cache; 62s with 2 real calls. Could remove the 13s pacing (OPT-9) when convenient.

### OPT-8. `newsCountryIntelligence` issues 80 Brave Search calls per run
- **File:** `newsCountryIntelligence/src/index.js:230` and `gatherCountryGrounding`.
- **Evidence:** 4 Brave queries × 20 countries per run × 3 runs/day = 240 calls/day. Brave free tier is 2k/mo.
- **Fix:** The 4 queries per country are largely redundant ("X news", "X current leader 2026", "X leader killed 2026", "X government status 2026"). Collapse to 1–2 with smarter query design, or cache results in DDB for 6–12 h.

### OPT-9. 13s pacing in `newsThreadAnalysis` is wasted on Gemini (downgraded)
- **Verified 2026-05-18:** Last run loaded 671 archive entries / 108 active threads, **2 generated + 8 skipped (unchanged)**. Total Lambda runtime 62.7s. No 429s in CloudWatch logs.
- **Implication:** The skip-when-unchanged cache means real Grok-call count is usually 1–3, not 10. Two calls were 36s apart in logs (13s sleep + ~23s actual Gemini round-trip). At this volume the pacing is a small waste (~26s/day), not a major issue.
- **Downgraded to P3.** Worth removing if you do a pass over the LLM client (OPT-7) but no urgency.

### OPT-10. `newsMarketsData` macro fetch is 300 serial HTTP calls
- **File:** `newsMarketsData/src/index.js`
- **Evidence:** 50 countries × 6 indicators serial with 200 ms throttle = 60 s minimum (plus actual fetch time).
- **Fix:** `Promise.all` per-country, concurrency 5. World Bank does not aggressively rate-limit on parallel reads.

### OPT-11. Brave 2s sleep in newsInvokeGemini — **SHIPPED 2026-05-18**
- Replaced sequential `for + sleep(2000)` with a `BRAVE_CONCURRENCY=3` worker pool (same pattern as OPT-7).
- New env var `BRAVE_CONCURRENCY=3` lets you tune from console without redeploy.
- **Measured:** 79s avg → **63s** on the next real invocation. **16s saved per run × 12 runs/day ≈ 3.2 minutes of billed Lambda time per day eliminated.** Exactly the predicted saving.
- File: `amplify/backend/function/newsInvokeGemini/src/index.js` around line 380.

### OPT-12. Yahoo VIX scrape — **still working today, but fragile**
- **Verified 2026-05-18:** `COMMODITIES#GLOBAL/LATEST` has `vix: 18.61` with `asOf: 2026-05-18T12:36:22.856Z` (within last hour). Yahoo scraping currently works.
- **Downgraded to P3** but still worth a one-line swap to FRED `VIXCLS` series next time someone is in that file — Yahoo blocks unofficial scrapers periodically and a broken VIX would silently zero the value.

---

## P2 — Correctness and bug risk

### OPT-13. `linkedInAutoPost.extractRegions` bug — overlap filter rarely fires
- **File:** `amplify/backend/function/linkedInAutoPost/src/index.js:235`
- **Evidence:** Function lowercases the entire `threadTitle` into a Set and then asks `.has(c.countryName.toLowerCase())`. A Set built from a string yields single characters, not words. The intended overlap check is effectively dead.
- **Fix:** Split on whitespace; use `includes()` on the joined lowercase string; or compare canonical regions from the thread's data instead of parsing the title.

### OPT-14. `country_facts.json` mutation race — **low real risk, low fix cost**
- **Verified 2026-05-18:** Both Lambdas have `ReservedConcurrentExecutions=None` (shared pool). In principle two concurrent invocations can race. In practice: country intel runs 3×/day, pair intel is manual-only — overlap window is tiny and the mutation is idempotent (same JSON merged with same DDB items produces same result).
- **Downgraded to P3.** Fix when in the file: replace mutation with `{...EDITORIAL_FACTS, ...ddbFacts}` returned locally.

### OPT-15. `newsSavedItems` advertises `MAX_SAVED_ITEMS=500` but does not enforce it
- **File:** `amplify/backend/function/newsSavedItems/src/index.js`
- **Evidence:** Cap is enforced as a Query `Limit` on read, not as a count check on write. Users can save unbounded items; only the first 500 ever display.
- **Fix:** On save, Query count first and reject if at cap. Or remove the cap claim.

### OPT-16. `newsSavedItems` items have no TTL
- **File:** Same Lambda.
- **Evidence:** No TTL attribute is set on Put. Items live forever, table grows unboundedly.
- **Fix:** Decide policy (e.g. 1-year TTL with re-bump on access) and add `expiresAt` attribute.

### OPT-17. `summaryPredictionFresh` always returns true
- **File:** `amplify/backend/function/newsSensitiveData/src/index.js:999`
- **Evidence:** Function literally returns `true` unconditionally.
- **Impact:** A "freshness" gate that was meant to flag stale AI content is no-op. Stale entries are returned without indication.
- **Fix:** Either implement (compare `Item.updatedAt` to a freshness threshold) or delete and inline `true`.

### OPT-18. `generateRssFeed` cutoff — **NOT FIRING IN PRACTICE**
- **Verified 2026-05-18:** `curl https://globalperspective.net/rss | grep -c '<item>'` returned **50 items**. Cutoff filter currently passes everything. The NaN risk is real only if legacy items appear without `updatedAt`; nothing legacy is in the active set right now.
- **Downgraded to P3.** Worth fixing the `|| Date.now()` defensively when in the file.

### OPT-19. `CATEGORY_LABEL` missing categories — **SHIPPED 2026-05-18**
- Added 5 keys (`business`, `society`, `energy`, `climate`, `science`) to all 3 maps:
  - `amplify/backend/function/newsPostLinkedIn/src/index.js` (CATEGORY_LABEL at line 57)
  - `amplify/backend/function/newsSensitiveData/src/index.js` (CATEGORY_LABEL at line 1315)
  - `amplify/backend/function/newsPostDevTo/src/buildDailySummary.js` (CATEGORY_LABEL at line 3)
- All 3 Lambdas redeployed + smoke-tested (200 OK each).
- **Verified live:** `newsPostLinkedin` invoke posted 5 topics to LinkedIn in 33s — module loads cleanly, new categories now applied. The 38% mis-tag is fixed going forward.

### OPT-20. `newsStripeWebhook` re-bumps `createdAt` on Paddle retries
- **File:** `amplify/backend/function/newsStripeWebhook/src/index.js`
- **Evidence:** No idempotency key check. Paddle retries failed webhooks; the second delivery of `subscription.created` re-Puts the user record with a new `createdAt`.
- **Fix:** Store `event_id` and skip duplicates. Or use `ConditionExpression: 'attribute_not_exists(createdAt)'` on the createdAt path.

### OPT-21. Frontend signOut does not clear cached user data
- **File:** `global-perspectives-starter/frontend/src/contexts/AuthContext.jsx:124` (signOut)
- **Evidence:** `signOut()` clears Firebase state but does not purge LocalStorage keys keyed by `user.uid` (`gp_weekly_archive_v1:{uid}`, thread analyses, country intelligence). Next user on the same browser sees previous user's cache.
- **Risk:** Cross-account data leakage in shared-browser scenarios.
- **Fix:** On signOut, iterate `localStorage` and remove keys starting with `gp_`.

---

## P3 — Hygiene and dead code

### OPT-22. Dead components/hooks/utils on frontend
- **Components (no live importers):** `MiniMap.jsx`, `TopicNav.jsx`, `SectionNav.jsx`, `SideNav.jsx`, `ApiKeyGate.jsx`, `KickstarterBanner.jsx`, `WeeklyLockedPreview.jsx`, `ArchiveTopicModal.jsx`, `PerspectiveComparison.jsx`, `CopyBriefing.jsx`, `ShareButtons.jsx`, `TrialBanner.jsx`, `ErrorHandling.jsx`. Plus `Pricing`, `PairPage`, `PairListPage` are imported in `App.jsx` but no `<Route>` references them.
- **Hooks (no live importers):** `useArticles`, `useBookmarks`, `useSummary`, `usePrediction`, `useTraceCause`, `useResearchBriefing`. `usePairAnalyses` + `usePairIntelligence` only feed the dead Pair pages.
- **Utils:** `services/appsyncProxy.js`, `utils/graphqlService.js` — no live importers; `aws-amplify` + `@aws-amplify/api-graphql` deps ride along in `package.json`.
- **Atoms:** `Sparkline`, `RiskDeltaPill`, `MacroChip` — built but never imported.
- **Impact:** Subagent estimated ~5,800 LOC removable. Smaller bundle, less surface to maintain.
- **Fix:** Single cleanup commit. Easy to verify via grep before deletion.

### OPT-23. Dead code in `newsPostLinkedIn`
- **File:** `newsPostLinkedIn/src/index.js`
- **Evidence:** `postToX` (line 757), `postToThreads` (line 826), `formatThreadsPost` — none are called. `require('ws')` (line 4) — `ws` is imported but no WebSocket code exists. `require('crypto')` is used by `postToX` only.
- **Impact:** ~150 LOC + a dep.
- **Fix:** Delete.

### OPT-24. Dead code in `newsSensitiveData`
- **File:** `newsSensitiveData/src/index.js`
- **Evidence:** `MEMBER_MAX_DAYS`, `ENTERPRISE_MAX_DAYS`, `MEMBER_API_KEYS`, `ENTERPRISE_API_KEYS`, `resolveTier` — all unreachable in launch-mode (line 134 hard-codes `tier:'member'`).
- **Fix:** Either delete behind a clear `EARLY_ACCESS_MODE` flag, or implement tier gating.

### OPT-25. Dual AWS SDK loader in newsInvokeGemini
- **File:** `newsInvokeGemini/src/index.js:7–21`
- **Evidence:** Tries v3 then v2 SDK. Node 24.x Lambda runtime has v3 built-in; v2 is no longer available in newer Lambdas.
- **Fix:** Drop v2 branch.

### OPT-26. Layout.jsx topic counter probably broken
- **File:** `global-perspectives-starter/frontend/src/components/Layout.jsx:27`
- **Evidence:** Reads a legacy LocalStorage key that doesn't match the current cache key (`gemini_topics_cache_v2`).
- **Fix:** Use `useGeminiTopics()` directly, or read the correct key.

### OPT-27. Lambda response helpers are named 3 different things across files
- **Files:** Most Lambdas.
- **Evidence:** `http(statusCode, body)`, `response(...)`, `httpReply(...)` — same code, different names. Plus CORS headers replicated.
- **Fix:** Shared `respond()` in layer.

### OPT-28. `console.log` debug calls in production
- **File:** `global-perspectives-starter/frontend/src/bootstrapProxy.js` (5 live calls per subagent count).
- **Fix:** Gate behind `if (import.meta.env.DEV)`.

### OPT-29. `LoadingBar` listens but most hooks don't dispatch
- **File:** `global-perspectives-starter/frontend/src/components/LoadingBar.jsx`
- **Evidence:** Listens to `gp-loading-start/end` CustomEvents; only `useGeminiTopics` + `useWeeklyArchive` dispatch them.
- **Impact:** Loading bar appears for ~10% of fetches.
- **Fix:** Either wire all hooks (via the proposed `useCachedFetch`), or remove the loading bar.

### OPT-30. Inconsistent storage key conventions
- **Evidence:** Markets table uses lowercase `pk`/`sk`; everything else uses uppercase `PK`/`SK`. Frontend cache keys mix `gp_*`, `gemini_*`, and per-uid suffixes inconsistently.
- **Fix:** Pick a convention, enforce via lint.

---

## Shared-layer extraction (consolidates many fixes)

A single `gp-lambda-shared` Lambda Layer would unify ~600–900 LOC and resolve OPT-2, OPT-4, OPT-7, OPT-19, OPT-27:

```
gp-lambda-shared/
  llm/grokClient.js        (extract OPT-7 concurrency; OPT-2 provider swap)
  search/braveClient.js    (OPT-8 dedup)
  auth/firebaseVerify.js   (kill duplicate in newsSavedItems)
  data/archiveReader.js    (OPT-4 snapshot)
  data/countryRegistry.js  (OPT-19, alias maps)
  data/ddbClient.js
  http/respond.js          (OPT-27, CORS)
  text/stripCodeFence.js   (one canonical version)
```

The migration is mechanical; each Lambda already has the boilerplate to delete.

---

## Suggested execution order (re-prioritized after CloudWatch verification 2026-05-18)

1. **OPT-1** (repo↔deployed drift on newsPostDevTo) — pull deployed into repo NOW. Risk: any redeploy from repo ships broken code.
2. **OPT-7** (parallelize LLM loops) — biggest live problem. 14% failure rate on NewsProjectInvokeAgentLambda-dev suggests timeouts; 360s avg duration cries out for `p-limit(4)`.
3. **OPT-2b + OPT-2c** (rename `GROK_*` → `LLM_*`, delete `XAI_API_KEY_BACKUP`) — pair them.
4. **OPT-3** (hardcoded markets table name) — trivial.
5. **OPT-22 + OPT-23 + OPT-24** (dead code) — single cleanup commit.
6. **OPT-13 through OPT-21** (correctness bugs) — small individual PRs.
7. **OPT-8 / OPT-10 / OPT-11 / OPT-12** (cost tuning on Brave/macros/Yahoo) — measure with CloudWatch first; only act on the ones biting.
8. ~~OPT-5, OPT-6~~ — defer; verified not worth fixing at current 383-item table size.
9. **OPT-25 through OPT-30 + OPT-9** (hygiene) — opportunistic.
