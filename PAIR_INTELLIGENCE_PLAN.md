# Pair Intelligence — Product & Implementation Plan

**Status:** Phase 0 COMPLETE — Phase 1 ready to start
**Last updated:** 2026-04-11

This document captures the plan for the Pair Intelligence feature — the next major product milestone for Global Perspectives. It is intentionally a living document; revise as decisions are made.

---

## Product Vision

Global Perspectives shows how the world is changing — one relationship at a time. The Pair Explorer lets anyone type two entities (countries or broad regions) and see a unified story of how that relationship is evolving, where it's heading, and what to watch.

- **Target user:** normal curious people, not analysts
- **Mental model:** "Type two things → see their shared story right now → understand where it's heading"
- **Time window:** 90 days rolling (no historical backfill, no pretense of deep history)
- **AI calls:** all pre-computed on a schedule — no on-demand synthesis ever
- **Prediction tracking:** private, for internal analyst use only, never exposed to users

### Product positioning

> **"See how the world is changing. In real time. With sources."**

Not a history encyclopedia. Not an aggregator. A real-time lens on how relationships between countries and regions are evolving right now, and where they're heading next. Fills the gap between daily headlines (too fragmented) and think-tank PDFs (too academic).

---

## Confirmed Decisions

1. ✅ Pre-computed, never on-demand — users only see cached output
2. ✅ Prediction ledger lives in same `SummarizeAndPredict` table (Option A, reuses PK/SK pattern)
3. ✅ Both country-level AND broad-region input allowed (EU, Middle East, ASEAN, G7, BRICS, etc.)
4. ✅ Prediction accuracy tracking is private — never exposed to users
5. ✅ Private AI quality test must pass before any frontend work
6. ✅ Daily Brief stays as-is, will eventually get pair links
7. ✅ 90-day rolling data window — no historical backfill
8. ✅ Feature approved for development after token economics review
9. ✅ **2026-04-11:** All content fully public during early access — no auth gates on any content route
10. ✅ **2026-04-11:** Firebase Auth stays functional — used for personalization only (save feature)
11. ✅ **2026-04-11:** Save feature with DynamoDB storage — users can bookmark threads, countries, daily briefs, and (future) pairs
12. ✅ **2026-04-11:** No paid tiers during early access — Pricing page removed entirely (route + nav link); `Pricing.jsx` component stays in the codebase but is not rendered

---

## Open Decisions — ALL RESOLVED 2026-04-11

| # | Decision | Confirmed |
|---|---|---|
| 1 | URL canonicalization — alphabetical slug, 301 redirect from reverse | ✅ `/explore/iran-and-israel` always |
| 2 | Pre-computed pair set: 30 stable + 20 rotating trending | ✅ Hybrid 30+20 |
| 3 | Thin-pair fallback: show each entity separately if empty intersection | ✅ Yes |
| 4 | Pair trajectory: single label, computed by Grok in same narrative call | ✅ Yes |
| 5 | Email alerts when tracked pair trajectory flips = first paid feature | ✅ Yes, free during early access |
| 6 | Start extracting people/org entities now for future Phase 2 use | ✅ Yes (cheap, accumulates data) |

---

## Architecture Insight: This is a Lens, Not a New Analyst

The most important architectural point: **`newsPairIntelligence` is a thin synthesis layer, not a new intelligence system.**

Your existing backend is already a layered intelligence system:

```
Layer 0: Raw articles (RSS + Brave Search)
Layer 1: Clustered topics (newsInvokeGemini)
Layer 2: Per-topic AI (SUMMARY/PREDICTION/TRACE_CAUSE via NewsProjectInvokeAgentLambda)
Layer 3: Per-thread AI (storyArc/rootCauseChain/trajectory via newsThreadAnalysis)
Layer 4: Per-country AI (situationSummary/crossThreadInsight via newsCountryIntelligence)
Layer 5: Per-day AI (daily brief via newsPostDevTo)
Layer 6: Per-pair AI (NEW — newsPairIntelligence)
```

Each layer consumes output from lower layers and produces higher-level synthesis. Pair analysis just adds one more layer on top. Most of the work is already done — we're stitching pre-computed pieces, not re-analyzing raw news.

---

## Reuse Inventory

### From `newsThreadAnalysis` (copy as template, ~90% reuse)
- `readArchiveEntries(days)` — read 90 days of archive
- `callGrok(prompt)` — wrapper with retry + JSON parsing
- `braveSearch(query)` — external grounding
- DDB client setup + env var pattern
- "Skip if unchanged" logic (adapted)
- TTL + PK/SK write pattern

### From `newsCountryIntelligence` (consumption pattern)
- Pattern for loading thread analyses for cross-enrichment
- Same region/country resolution logic
- Same skip-if-unchanged optimization

### From `newsPostDevTo` (prompt engineering template)
- `buildBriefPrompt` structure — headlines + thread analyses + country intel → structured JSON
- Will be copied and modified for pair context

### From existing frontend components (Phase 3)

| Component | Used by | Reuse for /explore |
|---|---|---|
| `ThreadIntelligence` | ThreadPage | Show matching thread story arcs |
| `CompactTimeline` | ThreadPage | Pair timeline |
| `StoryEntryCard` | WeeklyPage, ThreadPage | Entry list inside pairs |
| `ShareButtons` | Everywhere | Share a pair page |
| `IntelligenceLoader` | Multiple | Loading state |
| `CATEGORY_BADGE_COLORS` | WeeklyPage exports | Category badges |
| `RISK_COLORS` | WeeklyPage exports | Risk badges |
| `TRAJECTORY_BADGES` (in DailyPage) | DailyPage | Trajectory arrows |
| `SideNav` | DailyPage, CountryPage | Sidebar navigation |

### What's actually new

| New asset | Approx size | Notes |
|---|---|---|
| Pair filtering logic | ~30 lines | Filter archive entries where regions contains both targets |
| Region resolution map | ~100 lines JSON | EU → member countries, Middle East → countries, etc. |
| Pair canonicalization | ~10 lines | Alphabetical slug |
| Pair scoring (top 30 + 20) | ~50 lines | Count intersections by article volume |
| Grok prompt | ~200 lines of prompt text | **The hard creative work** |
| Lambda wrapper | ~100 lines | Copy of newsThreadAnalysis with above substitutions |
| **Total new code (backend)** | **~430 lines** | Most of it is prompt engineering |

Phase 3 frontend: mostly assembling existing components into a new layout.

---

## Token Economics

### Per-pair input (what the AI reads)

| Input source | Approx tokens |
|---|---|
| Top 15-20 matching archive entries (with summaries) | ~4,000 |
| 5-10 intersecting thread analyses | ~3,000 |
| Country intelligence for both countries | ~1,000 |
| Prompt instructions | ~500 |
| **Total input** | **~8,500 tokens** |

All inputs are **pre-digested** — no raw article text. The AI reads summaries of summaries.

### Per-pair output

| Output field | Approx |
|---|---|
| `currentState` | 100 words |
| `recentShifts[]` (5-7 dated events) | 300 words |
| `trajectory` + `trajectoryChange` | 40 words |
| `rootDriver` | 120 words |
| `predictions[]` (3-5 items with timeframes) | 200 words |
| `watchFor[]` (3-4 items) | 150 words |
| Metadata (sources, article count, window) | 100 words |
| **Total output** | **~1,000 words / ~1,500 tokens** |

A normal person reads this in ~90 seconds. Target length.

### Cost

| Scope | Calculation | Cost |
|---|---|---|
| Per pair | (8,500 × $0.20/1M) + (1,500 × $0.50/1M) | **~$0.0025** |
| Daily (50 pairs) | 50 × $0.0025 | **~$0.13/day** |
| Monthly | — | **~$4/month** |

Effectively free.

### Current vs. new daily AI load

| Lambda | Calls/day | Daily tokens |
|---|---|---|
| `newsInvokeGemini` | ~24 | ~310k |
| `NewsProjectInvokeAgentLambda` | ~39 | ~100k |
| `newsThreadAnalysis` | ~10 | ~45k |
| `newsCountryIntelligence` | ~10 | ~45k |
| `newsPostDevTo` daily brief | 1 | ~7k |
| **Current total** | **~84 calls** | **~507k tokens/day** |
| **NEW: `newsPairIntelligence`** | **+50 calls** | **+575k tokens/day** |

Roughly doubles token consumption, but absolute cost remains trivial.

---

## Phase 0 — Remove Auth Gates + Ship Save Feature ✅ COMPLETE 2026-04-11

**Goal:** unlock SEO immediately by making all content public, and give login a meaningful purpose (personalization) instead of a gate (content access).

**Rationale:** the product has effectively no users yet. Auth gates are pure friction — they cost traffic with zero revenue upside. Removing them now unlocks Google indexing for all thread/country/weekly pages. The save feature gives users a genuine reason to create an account (bookmark stories they care about) without feeling like extortion.

### 0.1 Remove backend auth gates (`newsSensitiveData`)

Remove JWT requirement from these actions:
- `archive_range` — return full 90 days for everyone, drop `MEMBER_MAX_DAYS` / `ENTERPRISE_MAX_DAYS` cap
- `thread_analysis`
- `country_intelligence`
- `narrative_thread`
- `daily_brief` — remove the past-date auth requirement

Remove the launch-mode tier override in `resolveUserTier` (it's unnecessary now that nothing is gated).

**Keep JWT-required:**
- `user_profile`
- `save_item` / `unsave_item` / `get_saved_items` (new — see 0.3)
- `portal_session` (leave in place, dormant)

### 0.2 Remove frontend auth gates

- Remove `<Gate>` wrapper from affected routes in `App.jsx`
- Remove preview-gate UI from `WeeklyPage`, `ThreadPage`, `CountryListPage`, `CountryPage`, `WeeklyMap`
- Remove past-date auth gate from `DailyPage`
- Update `Account.jsx` — remove tier/billing references, add placeholder for saved items
- **Remove `/pricing` route** from `App.jsx` and remove the nav link from `Layout.jsx`. Leave `Pricing.jsx` and `UpgradeSuccess.jsx` in the codebase — they'll be reactivated when paid tiers come back. Also remove any footer/CTA links pointing to `/pricing`.
- Update sign-in button copy (optional): "Sign in to save stories"

### 0.3 Build save feature backend ✅ COMPLETE

> **Note:** The save feature was built as a **dedicated Lambda** (`newsSavedItems`) with its own DynamoDB table — not as actions inside `newsSensitiveData`. The original plan below was updated during implementation.

**What was actually built:**
- Lambda: `amplify/backend/function/newsSavedItems/src/index.js` — Lambda Function URL (not API Gateway)
- DynamoDB table: `GlobalPerspectiveSavedItems` (PK=`uid`, SK=`savedKey` = `{itemType}#{itemId}`)
- Endpoint: `window.SAVED_ITEMS_ENDPOINT` in `docs/config.js`
- CORS: handled at AWS Function URL level, not in Lambda code

Actions (all require Firebase JWT):
```
save_item        { itemType, itemId, metadata }
unsave_item      { itemType, itemId }
get_saved_items  { itemType? }  → sorted by savedAt desc
```

### 0.4 Build save feature frontend

**New files:**
- `src/components/SaveButton.jsx` — small bookmark icon, toggles save state, shows "Sign in to save" popover for logged-out users
- `src/hooks/useSavedItems.js` — fetches saved list via `proxyActionWithAuth('get_saved_items')`, caches for session
- `src/components/SavedItemsList.jsx` — rendered on Account page, groups items by type

**Add `<SaveButton>` to:**
- `ThreadPage.jsx` (itemType="thread")
- `CountryPage.jsx` (itemType="country")
- `DailyPage.jsx` (itemType="daily_brief")
- (Future `PairPage.jsx` — itemType="pair")

**Update `Account.jsx`:**
- Remove tier badge, subscription status, Paddle portal link
- Add "Signed in as {email}" header
- Add `<SavedItemsList>` section
- Add small explainer: "Everything is free during early access. Accounts let you save stories — more features coming soon."

### 0.5 Pre-launch audit

Before removing the gates, verify each page is presentable to random visitors:
- `/weekly` — polished UI?
- `/weekly/thread/:threadId` — real content displays without auth?
- `/weekly/country/:countryName` — empty states handled?
- `/weekly-map` — mobile works?
- `/daily/:dateKey` (past dates) — loads fast?

Fix rough edges before deploying the gate removal.

### 0.6 Deploy order (critical)

**Backend BEFORE frontend.** If frontend stops sending auth before backend stops requiring it, pages will 401.

1. Deploy backend changes first — upload newsSensitiveData zip to Lambda
2. Verify public actions work via curl (no `Authorization` header)
3. Deploy frontend via `./deploy.sh --commit "Phase 0: remove auth gates, add save feature"`
4. Verify live site works for logged-out users

### 0.7 Decision gate for Phase 1

After Phase 0 ships and stabilizes (~few days of monitoring), we move to Phase 1 of the pair intelligence work. Phase 0 does NOT block Phase 1 planning, but it SHOULD ship first so the pair explorer inherits a clean "everything is public" story from day one.

### 0.8 Multi-Agent Dispatch Plan

**Execution shape:** 2 parallel workers + 1 sequential coordinator.

```
Agent A (Backend Rewriter)    ───────┐
  tasks #5 + #7, merged              │
  worktree isolation                 │
                                     ├──► Agent C (Deploy Coordinator)
Agent B (Frontend Rewriter)   ───────┤        task #9
  tasks #6 + #8, merged              │        runs in main repo
  worktree isolation                 │
```

**Why this shape:**
- Tasks #5 and #7 both touch `newsSensitiveData/src/index.js` → cannot parallelize → one agent owns the whole file
- Tasks #6 and #8 touch 4 overlapping frontend files (`Account`, `ThreadPage`, `CountryPage`, `DailyPage`) → cannot parallelize → one agent owns frontend
- Backend and frontend touch **entirely different directories** → zero file conflicts → safe to run in parallel
- Deploy coordinator runs sequentially to enforce "backend before frontend" constraint

**Universal constraints for all agents:**
1. Do NOT commit (A and B — Agent C handles commits)
2. Do NOT push (A and B)
3. Do NOT deploy (A and B)
4. Do NOT touch `CHANGES.md` (Agent C writes a unified entry)
5. Do NOT touch `docs/config.js` (holds runtime secrets — deploy.sh enforces this anyway)
6. Do NOT touch files outside your assigned scope
7. Report back with: summary of changes, list of files touched, any errors or ambiguities encountered
8. Follow existing code conventions in the file (don't reformat unrelated code)

---

#### Agent A — Backend Rewriter

**Isolation:** `worktree`
**Scope:** `amplify/backend/function/newsSensitiveData/src/index.js` ONLY
**Merged tasks:** #5 + #7
**Deliverable:** updated source file + ready-to-upload `deploy.zip`
**Do NOT deploy to AWS.**

**Context files to read first:**
- `PAIR_INTELLIGENCE_PLAN.md` — especially Phase 0.1 and 0.3
- `ARCHITECTURE.md` — the `newsSensitiveData` section for current action list
- `BACKEND_GUIDE.md` — the 12 actions table
- `amplify/backend/function/newsSensitiveData/src/index.js` — read the entire file before editing

**Changes to make:**

1. **Remove JWT requirement from these actions** (they should work without an `Authorization` header):
   - `archive_range`
   - `thread_analysis`
   - `country_intelligence`
   - `narrative_thread`
   - `daily_brief` — including past dates (currently only today is public)

2. **Remove day-count caps in `archive_range`:** return the full 90 days to everyone. The `MEMBER_MAX_DAYS = 7` cap is no longer needed.

3. **Remove the launch-mode tier override block** in `resolveUserTier`. It previously forced all signed-in users to `tier: 'member'`. It's no longer needed because there are no tier checks on the public actions.

4. **Add 3 new auth-required actions** (these still require Firebase JWT via `resolveUserTier`):

   ```
   save_item    { itemType, itemId }  → writes USER#{uid} / SAVED#{itemType}#{itemId} to SummarizeAndPredict
   unsave_item  { itemType, itemId }  → deletes that item
   get_saved_items                    → KeyConditionExpression: PK = USER#{uid} AND begins_with(SK, SAVED#)
   ```

   Storage schema:
   ```
   PK: USER#{uid}
   SK: SAVED#{itemType}#{itemId}
   itemType: "thread" | "country" | "pair" | "daily_brief"
   itemId: string
   savedAt: ISO timestamp
   ```

   - `itemType` must be one of the 4 allowed values — reject unknown types with 400
   - `get_saved_items` returns `{ items: [...] }` sorted by `savedAt` descending
   - Writes use `SummarizeAndPredict` table (same table, new PK pattern)

5. **Keep unchanged:** `user_profile`, `portal_session`, `topics`, `summary`, `prediction`, `trace_cause`, `geocode`, `today`, `country_preview`, `thread_preview`.

**Verification steps:**
- Run `node -c index.js` to check syntax
- Rebuild the Lambda zip: `cd amplify/backend/function/newsSensitiveData && zip -r deploy.zip src/`
- Report the zip path and any env vars needed

**Report format:**
- List of actions modified (auth removed)
- List of new actions added
- Path to updated zip file
- Any existing env vars the new actions depend on
- Any unexpected state found in the existing file

---

#### Agent B — Frontend Rewriter

**Isolation:** `worktree`
**Scope:** `global-perspectives-starter/frontend/src/` ONLY
**Merged tasks:** #6 + #8
**Deliverable:** updated frontend code + successful `npm run build`
**Do NOT deploy to GitHub Pages.**

**Context files to read first:**
- `PAIR_INTELLIGENCE_PLAN.md` — Phase 0.2 and 0.4
- `CLAUDE.md` — project guidelines
- `global-perspectives-starter/frontend/FRONTEND_ARCHITECTURE.md`
- `src/App.jsx` — current routing and Gate wrapper
- `src/components/Account.jsx`, `ThreadPage.jsx`, `CountryPage.jsx`, `DailyPage.jsx` — overlap zones

**Changes to make:**

**Part 1 — Remove auth gates:**

1. In `src/App.jsx`: remove the `<Gate>` wrapper from routes `/weekly`, `/weekly/thread/:threadId`, `/weekly/countries`, `/weekly/country/:countryName`, `/weekly-map`. The `Gate` and `ComingSoon` components can stay defined but unused (or delete them).

2. Remove preview-gate UI blocks from each of these components (search for code that checks `user` or `loading` and shows a "preview" / "sign in" placeholder — rip those out and always render the real content):
   - `WeeklyPage.jsx`
   - `ThreadPage.jsx`
   - `CountryListPage.jsx`
   - `CountryPage.jsx`
   - `WeeklyMap.jsx`

3. In `DailyPage.jsx`: remove the past-date auth gate (currently blocks non-authenticated users from viewing `/daily/:dateKey` for past dates). Make all past dates public.

4. **Remove `/pricing` route** from `App.jsx`.

5. **Remove pricing nav link** from `Layout.jsx`.

6. **IMPORTANT:** grep the entire `src/` folder for any remaining references to `/pricing` — `to="/pricing"`, `href="/pricing"`, `navigate("/pricing")`, etc. Remove all of them, including footer CTAs, sign-in success redirects, and any upgrade prompts. **Leave `Pricing.jsx` and `UpgradeSuccess.jsx` files in the codebase untouched** — they'll be reactivated later.

7. Update `Account.jsx`:
   - Remove the tier badge, subscription status, Paddle portal button
   - Add a simple "Signed in as {email}" header
   - Add small explainer: "Everything is free during early access. Accounts let you save stories — more features coming soon."

**Part 2 — Add save feature:**

8. Create `src/components/SaveButton.jsx` (new file):
   - Props: `itemType`, `itemId`
   - Bookmark icon that toggles between outline (unsaved) and filled (saved)
   - Uses `useAuth` — if not signed in, clicking shows a popover "Sign in to save stories" with a link to `/signin`
   - Calls `proxyActionWithAuth('save_item', { itemType, itemId })` or `'unsave_item'` on click
   - Loads initial saved state from `useSavedItems` hook

9. Create `src/hooks/useSavedItems.js` (new file):
   - Fetches from `proxyActionWithAuth('get_saved_items')` on mount when user is signed in
   - Caches for the session in memory (no localStorage needed yet)
   - Returns `{ items, loading, isSaved(itemType, itemId), refresh }`

10. Create `src/components/SavedItemsList.jsx` (new file):
    - Rendered on Account page
    - Uses `useSavedItems`
    - Groups items by `itemType` (threads, countries, daily briefs)
    - Each row links to the underlying page (`/weekly/thread/{id}`, `/weekly/country/{id}`, `/daily/{id}`)
    - Empty state: "You haven't saved anything yet. Click the bookmark icon on any story to save it."

11. Add `<SaveButton>` to:
    - `ThreadPage.jsx` — `itemType="thread"`, `itemId={threadId}`
    - `CountryPage.jsx` — `itemType="country"`, `itemId={countryName}`
    - `DailyPage.jsx` — `itemType="daily_brief"`, `itemId={dateKey}`

12. Add `<SavedItemsList>` to `Account.jsx`

13. Update `src/services/restProxy.js` if needed — add helper functions `saveItem`, `unsaveItem`, `fetchSavedItems` if the existing `proxyActionWithAuth` pattern requires explicit wrappers (check the existing code first).

**Verification steps:**
- `cd global-perspectives-starter/frontend && npm run build` must succeed with zero errors
- Check `dist/assets/` has the expected files
- Do NOT run `deploy.sh`

**Report format:**
- Files modified
- Files created
- Files deleted (should be none)
- `npm run build` output (or error)
- Any places where the existing code was unclear and you had to make a judgment call

---

#### Agent C — Deploy Coordinator

**Isolation:** none — operates directly on `main`
**Runs AFTER:** both Agent A and Agent B report success
**Task:** #9
**Deliverable:** backend live on AWS + frontend live on GitHub Pages

**Context files to read first:**
- Reports from Agents A and B
- `deploy.sh` to understand the frontend deploy flow
- `CLAUDE.md` for the deployment workflow section
- `PAIR_INTELLIGENCE_PLAN.md` Phase 0.6

**Steps:**

1. **Merge Agent A's worktree branch into main** — should have no conflicts since it only touches `amplify/backend/function/newsSensitiveData/src/index.js`

2. **Merge Agent B's worktree branch into main** — should have no conflicts since it only touches `global-perspectives-starter/frontend/src/`

3. **Handle any surprising conflicts** — if either agent accidentally modified a shared file, resolve carefully; do not lose changes

4. **Deploy backend FIRST** (critical order):
   ```bash
   aws lambda update-function-code \
     --function-name newsSensitiveData-dev \
     --zip-file fileb://amplify/backend/function/newsSensitiveData/deploy.zip \
     --region ap-northeast-1
   ```

5. **Verify backend is live** — test a formerly-gated action without an `Authorization` header. Should return 200, not 401:
   ```bash
   curl -X POST https://<api-gateway-url>/proxy \
     -H "Content-Type: application/json" \
     -d '{"action":"thread_analysis","payload":{"threadIds":["any"]}}'
   ```
   Get the endpoint from `docs/config.js` (don't modify it, just read it).

6. **Deploy frontend:**
   ```bash
   ./deploy.sh --commit "Phase 0: remove auth gates, add save feature, hide pricing"
   ```

7. **Update CHANGES.md** with a unified entry for the Phase 0 change (Agent C is the only one who touches this file)

8. **Push to GitHub:**
   ```bash
   git push
   ```

9. **Verify live site:**
   - Open `https://globalperspective.net/weekly` in an incognito window (logged out)
   - Open `https://globalperspective.net/weekly/country/Iran` in an incognito window
   - Open `https://globalperspective.net/daily/2026-04-09` in an incognito window (past date)
   - Sign in, click a save button, verify the item appears in `/account`

10. **Report:** deploy result, verification results, any issues encountered. If anything failed, roll back via `git revert` and report.

**Rollback plan if deploy fails:**
- Frontend rollback: `git revert HEAD && ./deploy.sh --commit "Revert Phase 0"`
- Backend rollback: re-upload the previous `deploy.zip` (if preserved) to `newsSensitiveData-dev`

---

## Phase 1 — Private Quality Test (NO Frontend)

**Goal:** prove the AI output is actually good before committing to build a frontend around it.

### 1.1 Check the data window
- Query the archive to find the oldest entry
- Determines honest "tracking since" date
- If too thin (<4 weeks), delay public launch or adjust expectations
- **First concrete action. 15 minutes of work.**

### 1.2 Hand-craft the target output
- Write an **ideal Iran × Israel** pair analysis **by hand** as if a human editor wrote the perfect output
- You review and edit it until it matches what you'd actually want users to see
- This becomes the **benchmark** — Grok output has to match or beat this
- Without a target, we'll ship whatever Grok gives us and hope it's good
- **Spec:** current state, recent shifts (dated), trajectory + change indicator, predictions with timeframes, "what to watch", sources

### 1.3 Build `newsPairIntelligence` Lambda (test-only mode)
- Copy `newsThreadAnalysis` as template
- Modify to accept `{pair: [a, b]}` payload
- Implement region resolution (broad region → member countries)
- Implement pair filtering (entries where regions includes both targets)
- Load matching thread analyses + country intelligence for both
- Call Grok with the carefully crafted prompt
- Write to `PAIR#{slug} / PAIR_ANALYSIS` in `SummarizeAndPredict` (90-day TTL)
- **Manual invocation only — no EventBridge schedule yet**
- **Not accessible via any public API yet**

### 1.4 Generate 10 test pair analyses

Proposed test set covers different relationship types + edge cases:

| Pair | Type | Why |
|---|---|---|
| Iran × Israel | Active conflict | Current hot story |
| US × China | Rivalry | Slow-burn, economic |
| India × Pakistan | Tense neighbors | Historical + current |
| Russia × Ukraine | War | Dense coverage |
| US × Mexico | Economic/migration | Non-conflict baseline |
| France × Germany | Allies | Cooperative baseline |
| Israel × EU | Country × region | Broad-region edge case |
| Iran × Middle East | Country ⊂ region | Self-overlap edge case |
| North Korea × Japan | Thin pair | Low data volume |
| Iceland × Zimbabwe | Empty pair | No intersection, fallback test |

### 1.5 Iterate prompt with review cycle
For each output, evaluate:
- Is the narrative sharp or generic?
- Are predictions specific with timeframes?
- Is the trajectory correct?
- Are sources cited appropriately?
- Does it read like the hand-crafted benchmark from 1.2?

**Iterate the prompt 3-5 times** until output is consistently good.

### 1.6 Decision gate
After 1.5, **you decide** whether Phase 3 (frontend) is worth building. If the output still feels generic or shallow, we stop and reconsider. No frontend time wasted on a weak backend.

**This is the most important gate in the entire plan.**

---

## Phase 2 — Prediction Ledger (parallel to Phase 1)

**Goal:** start accumulating prediction tracking data so we have backlog when we eventually audit.

### 2.1 Define trackable prediction schema
Force all future predictions to include:
- Specific claim
- Specific timeframe (deadline for evaluation)
- Confidence level (high/medium/low)

Vague predictions ("tensions will rise") are rejected at generation time — they're not useful to users either.

### 2.2 Add ledger writes to existing Lambdas
Modify these to also write `PREDICTION#{uuid} / PREDICTION_LEDGER` entries:
- `NewsProjectInvokeAgentLambda` — topic predictions
- `newsThreadAnalysis` — thread trajectories, watch questions
- `newsCountryIntelligence` — risk signals
- `newsPostDevTo` — daily brief top story predictions
- `newsPairIntelligence` — pair predictions (when built)

One extra `PutCommand` per prediction. Cheap. Non-breaking change.

### 2.3 Ledger schema

```
PK: PREDICTION#{uuid}
SK: PREDICTION_LEDGER
predictionText: "Iran will extend the blockade 3-5 days"
source: "daily_brief" | "topic" | "thread" | "country" | "pair"
sourceId: "DAILY_BRIEF#2026-04-09"
topicId: "xxx"
regions: ["Iran", "Israel"]
category: "conflict"
madeAt: "2026-04-09T07:00:00Z"
resolveBy: "2026-04-14T00:00:00Z"
resolved: false
outcome: null                // later: "correct" | "partial" | "incorrect" | "unclear"
evidence: null               // later: array of topicIds + rationale
confidence: "high" | "medium" | "low"
```

### 2.4 Do NOT build the audit Lambda yet
Just accumulate data. Audit comes in Phase 4 after backlog is ≥4 weeks deep.

---

## Phase 3 — Frontend /explore Page (Public)

**Only if Phase 1.6 decision gate passes.**

### 3.1 Scheduler for pair generation
- EventBridge cron → `newsPairIntelligence` daily around 7:30 UTC (after country intelligence at 7:00)
- Picks 30 stable + 20 trending pairs per run
- Overwrites `PAIR#` records with fresh analysis

### 3.2 Public API endpoints
New actions in `newsSensitiveData`:
- `pair_analysis` — `{a, b}` → returns `PAIR#` record (public, no auth)
- `popular_pairs` — returns currently-generated pair list for homepage grid
- `pair_autocomplete` — returns known entities for input suggestions

### 3.3 Frontend pages
- `/explore` — landing page: two inputs + autocomplete + "popular this week" grid
- `/explore/iran-and-israel` — pair result page, rendered from `PAIR#` record
- URL canonicalization: alphabetical slug, redirect reverse form
- Thin-pair fallback: show each entity separately if intersection is empty

### 3.4 Homepage integration
- Add a hero card on current Home: "See how the world is changing → type two countries"
- **Don't replace the current homepage** — add, don't replace. Measure engagement, then decide.

---

## Phase 4 — Prediction Audit & Paid Features

After Phase 3 is live and stable for a few weeks, and the ledger has ≥4 weeks of data.

### 4.1 `newsPredictionAudit` Lambda (private)
- Runs daily
- Finds unresolved predictions where `resolveBy < now`
- Fetches subsequent archive coverage
- Grok judges outcome (correct/partial/incorrect/unclear)
- Writes result back to ledger

### 4.2 CLI accuracy report (private, for Ben only)
- `scripts/prediction-report.sh` — queries ledger, prints accuracy by category/source/time window
- Never exposed via API or frontend

### 4.3 Email alerts — first candidate paid feature
- Signed-in users can track up to 5 pairs (free during early access; becomes paid later)
- Daily cron checks tracked pairs, sends email when trajectory changes
- Uses existing Firebase auth + Loops (already integrated)
- **This is the most likely first paid feature when pricing is reintroduced.** During early access it ships as free for logged-in users — a natural extension of the save feature.

---

## Risks & Mitigations

### 1. Archive might be too thin
**Risk:** If the oldest archive entry is only 2-3 weeks old, pair analyses will feel shallow.
**Mitigation:** Phase 1.1 checks this upfront. If thin, delay public launch until corpus is ~6 weeks old but continue building Phase 1/2 privately.

### 2. Grok may be inconsistent across pair types
**Risk:** Hot pairs (Iran × Israel) might produce great output; cooperative pairs (France × Germany) might produce boring output.
**Mitigation:** The 10-pair test set in Phase 1.4 is designed to surface this. Iterate prompts per relationship type if needed.

### 3. Causation claims being wrong or dangerous
**Risk:** Grok may assert "X led to Y" when reality is more nuanced, spreading false causal narratives.
**Mitigation:** Prompt explicitly requires sourced claims and softened language ("appears linked", "followed by") rather than strong causal assertions. Timeline dates extracted deterministically from archive entries, not generated by Grok.

### 4. Prompt drift over time
**Risk:** As edge cases pile up, the prompt gets messy and regresses.
**Mitigation:** Version-control the prompt in the repo, document each iteration's reason for change in CHANGES.md.

### 5. Quality is 80% prompt, 20% infrastructure
**Risk:** We build the whole infrastructure and the AI output is mediocre.
**Mitigation:** Phase 1.2 hand-crafts the target output BEFORE building anything. Without a benchmark, we'd ship whatever Grok produces.

### 6. Prediction ledger catches bad predictions but too late
**Risk:** By the time we audit, many bad predictions have already been shown to users.
**Mitigation:** Phase 2.1 forces schema discipline at generation time — vague predictions can't even exist. Audit becomes quality assurance, not damage control.

---

## Execution Order (Updated 2026-04-11)

1. ✅ **Phase 0 — COMPLETE.** Auth gates removed, save feature shipped, Account page redesigned, `/pricing` route removed.
2. **Phase 1 — Private pair quality test. NEXT.** Starts with checking the data window (Phase 1.1, 15 min) and hand-crafting the Iran × Israel benchmark (Phase 1.2).
3. **Phase 2 — Ledger writes.** Runs in parallel with Phase 1. Non-breaking Adds prediction ledger entries to existing Lambdas.
4. **Phase 3 — Frontend `/explore`.** Only after Phase 1.6 decision gate passes.
5. **Phase 4 — Audit + email alerts.** Several weeks after Phase 3 ships.

## What's Still Needed Before Phase 1 Starts

1. ✅ Open decisions resolved (see above)
2. **Confirm or modify the test pair list** (10 pairs in Phase 1.4) — proposed list is there, needs your OK
3. **Ready to start Phase 1.1** — check archive data window (oldest entry date)

---

## Guiding Principles (Not to Be Violated)

1. **No on-demand AI calls.** Ever. All synthesis runs on a schedule; user pages are pure DB reads.
2. **Real-time change tracking, not history.** Never pretend to cover events before the data window.
3. **Pre-digested input only.** The AI reads summaries, not raw articles.
4. **Prompt quality is the product.** Infrastructure is cheap; good output is hard. Always budget more time on prompts than on code.
5. **Ship to `/explore` first, not homepage.** Protect the existing SEO surface until the new feature is proven.
6. **Prediction tracking stays private** until the accuracy is worth publicizing.
7. **Reuse before building new.** 90% of this feature is recombining existing infrastructure.
8. **Every feature must answer one clear user question.** For pair explorer: "How is the relationship between X and Y changing?"
