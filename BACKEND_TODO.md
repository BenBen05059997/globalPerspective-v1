# Backend TODO

Tracked issues from code review of all 11 Lambda functions (2026-04-17).

---

## 2026-05-26 audit findings (full ARCHITECTURE.md re-verification vs. live AWS)

### A. Subscriptions / billing — DEPRECATED 2026-05-26 (do not fix, plan for removal)
Billing is **not in use and not planned to return.** The earlier "fix the Paddle/Stripe env mismatch before re-enabling billing" item is **withdrawn** — there is nothing to re-enable. The deployed `newsStripeWebhook` is broken (reads `PADDLE_WEBHOOK_SECRET`, only has stale `STRIPE_*` vars) but that no longer matters.

**Frontend cleanup — DONE 2026-05-26 (built + deployed to `docs/`):**
- Deleted `TrialBanner.jsx`, `UpgradeSuccess.jsx`, `WeeklyLockedPreview.jsx`, `useUserProfile.js`.
- Removed the `/upgrade/success` route + TrialBanner usage from CountryPage/ThreadPage/WeeklyPage.
- Stripped tier/perks/billing + `fetchPortalSession`/`fetchUserProfile` from `Account.jsx` (kept the Saved-items feature + basic profile).
- Removed `fetchUserProfile` / `fetchPortalSession` from `restProxy.js` and the dead mocks from `redesign.test.jsx`.
- Lint 0 errors, build OK, 171 tests pass.

**Backend teardown — DEFERRED by user 2026-05-26 ("leave it later"), do when convenient (destructive AWS infra):**
- Delete the deployed `newsStripeWebhook` Lambda + its API Gateway endpoint.
- Remove `resolveUserTier` / `user_profile` / `portal_session` from `newsSensitiveData` source, then redeploy the Lambda (verify with a `topics` test invoke after).
- Optionally drop `tier`/`paddleCustomerId`/`paddleSubscriptionId` from `USERS_TABLE` records.
- Left intact for now to avoid source↔deploy drift and risky production-proxy redeploys without confirmation. The actions are inert (JWT-gated, nothing calls them).

### B. Resolved since the 2026-04-17 list — verified done
- **#4 / architectural note:** `newsPairIntelligence` is documented in ARCHITECTURE.md and confirmed manual-only (no schedule), deployed on DeepSeek. No longer "uncertain."
- **#6:** `newsPostDevTo` is deployed and live (DeepSeek for the brief, OpenRouter `deepseek/deepseek-v4-flash:free` for the Dev.to overview). The undeclared-reference worry was a WIP that shipped.
- **"Add `newsSavedItems`":** done — plus `newsMarketsData`, `newsEconomicImpact`, `newsEconomicQuality` are now all documented (16 Lambdas total).

### C. Lower-priority follow-ups surfaced by the audit
- Env-var **rename** `XAI_API_KEY`/`GROK_MODEL`/`GROK_API_URL` → `LLM_*`: every Lambda's name now lies about its provider. Tracked in `OPTIMIZATION_REPORT.md` OPT-2b; raising visibility here.
- Known-broken integrations (from `AI_PROVIDER_MIGRATION_PLAN.md`): `linkedInAutoPost` LinkedIn token expired (401); `newsPostDevTo` Dev.to publish key 401. Brief generation still works.

---

## Verified issues (found in code)

### 1. Dead code in `newsSensitiveData`
**File:** `amplify/backend/function/newsSensitiveData/src/index.js`

- `MEMBER_API_KEYS` and `ENTERPRISE_API_KEYS` env var parsing (lines ~18-23)
- `resolveTier(apiKey)` function (line ~863)
- Never called in the handler — all auth flows through `resolveUserTier` (JWT)

**Action:** Delete the dead code.

---

### 2. `summaryPredictionFresh()` is a stub
**File:** `amplify/backend/function/newsSensitiveData/src/index.js` (~line 828)

```js
function summaryPredictionFresh(item) {
  return true;
}
```

Called as `stale: summaryPredictionFresh(Item) ? false : true`, so the `stale` field returned to the frontend is always `false`. Either implement the freshness check (compare `item.generatedAt` against `SUMMARY_PREDICT_MAX_AGE_SECONDS`) or remove the function and the `stale` field.

---

### 3. `archive_range` does sequential DynamoDB reads
**File:** `amplify/backend/function/newsSensitiveData/src/index.js` (~line 919)

```js
for (let i = 1; i < days; i++) {
  const { Item } = await client.send(new GetCommand({...}));
}
```

For a 90-day enterprise call, this is 90 serial round-trips. Fine at current tier limits (usually 7 days), but will be slow if anyone requests the full 90.

**Action:** Batch with `BatchGetCommand` (max 100 keys per batch → one round-trip for 90 days).

---

## Uncertain — needs verification before acting

### 4. Is `newsPairIntelligence` scheduled?
- Folder is untracked in git (`?? amplify/backend/function/newsPairIntelligence/`)
- Not mentioned in `ARCHITECTURE.md` or `MEMORY.md`
- Grok prompt + DDB write paths look production-ready

**Action:** Check `amplify/backend/backend-config.json` and AWS Console for an EventBridge rule. If missing, decide on a cadence (weekly? daily? manual?) and wire one up.

---

### 5. Daily brief timing vs. country intelligence
- `newsCountryIntelligence` runs at 7:00 UTC
- `newsPostDevTo` generates the Daily Brief by reading thread analyses + country intel
- If DevTo runs before 7:00 UTC, the brief will miss fresh country data
- `newsPostDevTo` dedups per-day, so a thin brief won't auto-regenerate

**Action:** Check the EventBridge rule for `newsPostDevTo`. If it fires before ~7:15 UTC, move it later or remove the per-day dedup and let it regenerate on each run.

---

### 6. `newsPostDevTo` has undeclared references
**File:** `amplify/backend/function/newsPostDevTo/src/index.js`

Variables used but not declared in the portion I read: `POSTS_TABLE`, `DEVTO_API_KEY`, `PLATFORM`, `AI_ENDPOINT`, `AI_MODEL`, `OPENROUTER_API_KEY`, `SITE_URL`, `POST_TTL_DAYS`, `buildDailySummary`, `buildAiOverviewPrompt`.

Memory notes say "BUILT 2026-04-08, pending deploy" — likely a WIP. File shows as `M` in git status.

**Action:** Before deploying, either finish the declarations or stash the changes. `node --check` should catch this.

---

## Architectural notes (not urgent)

### `newsPairIntelligence` not in `ARCHITECTURE.md`
Once scheduled and deployed, add a section alongside the other Lambdas documenting: trigger, inputs, outputs, DDB keys (`PAIR#{slug}` / `PAIR_ANALYSIS`), TTL (90 days), hardcoded pair list.

### Add `newsSavedItems` to `ARCHITECTURE.md`
Memory has details but `ARCHITECTURE.md` only lists 8 Lambdas. Both `newsSavedItems` and `newsPairIntelligence` are missing.

---

## What I explicitly chose NOT to put on this list

Things that looked like issues at first glance but aren't worth acting on:

- **Scan operations in `pruneObsoleteEntries` and `linkedInAutoPost`.** Table TTLs keep the steady-state size ~3,000 items. Scans are cheap at that scale.
- **`newsSensitiveData` being ~1,284 lines.** Splitting would add more deploy surface and cold-start overhead than it saves. Single proxy Lambda is fine.
- **Lack of unit tests.** Yes, there are none. For a solo-operated Lambda pipeline with AI outputs that change every run, test ROI is genuinely low. Not adding it to the list.
