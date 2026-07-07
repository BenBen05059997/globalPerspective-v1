# Member Gating Plan — gate the self-correction DEPTH, not the pages

**Status:** ACTIVE — building on branch `feat/autofix-gating` (2026-07-06). **NOT deployed** (deploy is a separate, gated step — see Sequencing).
**Supersedes** the 2026-07-01 draft (which gated whole thread/country *pages* behind a member wall — SEO-risky, reverses "all content public" hard). This version gates only the **auto-fix depth** (correction history + drift alerts), leaving every analysis page fully public.

> **Why the redirect (2026-07-06 strategy session):** the differentiator is the *self-correcting analysis* (living-analysis loop → "What changed" bands, corrections ledger, /track-record). Today it is 100% free AND invisible (0 mentions on Home/nav; /track-record reachable only from one footer link). The credit/Studio path monetizes the *commodity* feature (ask-an-LLM) with ~0 usage. So: keep the analysis + the trust receipts free (they are the marketing), and make **membership buy the depth + the alerts** on the auto-fix layer.

---

## 1. The model — free hint, member "see more"

The free layer IS the hint (and the public proof). The member layer is depth + notification.

| Surface | Free (the hint — public, SEO-safe, the receipts) | Member (see more) |
|---|---|---|
| CountryPage "What changed" band | Latest correction (as today) | Full correction-history chain |
| /track-record corrections ledger | Recent window (last ~7d / N=5) + honest total | Full history |
| ThreadPage drift note | Latest (as today, via shared `thread_analysis`) | (history not yet served — future) |
| /track-record scorecard + methodology | **Fully free — never gate the receipts** | — |
| Living forecast board (ThreadPage) | Current forecast (as today) | — |
| Drift **alerts** email ("tell me when a country's read changes") | — | **member perk** (Phase 5; reuses `newsEmailSender`) |
| Signal API corrections feed | — | paid by design (API sub, machines) |

**Non-negotiables (why this is safe where the last draft wasn't):**
- **Data-cap, never hard-block.** Non-members always get a **200 with capped data** — never a `403`/redirect. This sidesteps the 2026-04-22 anon-regression entirely (`feedback_auth_guard_hooks`): no `!user` guard, no action ever returns "member_required".
- **Only gate actions EXCLUSIVE to the deep surfaces.** `country_history` (CountryPage-only) ✅ and `corrections_feed` (my new /track-record action) ✅. **Never** `thread_analysis` / `country_intelligence` / `economic_impact` / `systems_analysis` — they feed public pages (the crux table in the old draft still holds).
- **No fake wall.** Real latest content + an honest count ("+7 earlier corrections") + a Join link. Never a blurred/fabricated teaser (`feedback_no_misinformation_fallback`).
- **The receipts stay public.** Scorecard, methodology, latest "what changed", live forecast board — all free. A paywalled proof-of-honesty can't do its marketing job.

---

## 2. Backend enforcement (real, but soft — it's depth, not secrets)

`newsSensitiveData` already has `verifyFirebaseToken()` (dead since 06-01, ready to reuse) and `AmazonDynamoDBFullAccess` (can read `GlobalPerspectiveUserTable` — the tier authority written by `newsPolarBilling` on payment). So enforcement needs **no IAM change** — only one env var + a small helper.

1. **`USERS_DDB_TABLE=GlobalPerspectiveUserTable`** env on `newsSensitiveData` (deploy step — gated).
2. **`resolveTier(authHeader)`** helper: `verifyFirebaseToken` → uid → `GetItem` on the users table → `tier` (`'member'` | else). Best-effort: any failure → treat as free (never throws, never blocks).
3. **`country_history`**: non-member → return `driftNotes` capped to the newest 1, plus `driftNotesTotal` + `driftNotesGated:true`. Member → full array. (Snapshots/history array unchanged — only the drift depth is capped.)
4. **`corrections_feed`**: non-member → newest N (=5) + `total` + `gated:true`. Member → full.
5. Pure cap logic lives in a testable helper (`capForTier`) with `node --test`.

## 3. Frontend (the lock affordance)

Uses the membership state the app already has (the header pill / account tab fetch `get_membership`). No secret content on the client — the backend cap is the real enforcement; the frontend just renders the honest affordance.

1. **CountryPage** `CountryWhatChanged` history chain: members see the full chain; non-members see the latest note + a row *"🔒 {driftNotesTotal − 1} earlier corrections — [Join to see the full history →](/membership)"* (only when `driftNotesTotal > 1`).
2. **/track-record** corrections ledger: non-members see the capped list + a footer *"Showing the last {n} of {total}. [Members see the full corrections history →](/membership)"*.
3. Honest-empty rules unchanged; the affordance renders only when there is genuinely more (`total > shown`).

## 4. Membership promise — copy change (needs operator sign-off)

This **partially reverses** the 2026-06-01 "all content 100% public" line. Current copy everywhere: *"Reading is free forever; membership buys compute."* New: *"The news and our public track record are free; membership adds the full correction history, per-country drift timeline, and change-alerts — and runs the Studio on our compute."* The four legal/marketing pages were reconciled 2026-06-22 → **operator reviews before this ships.** (Queued, not auto-applied.)

---

## 5. Sequencing & ship discipline (playbook-gated)

Built in worktree `feat/autofix-gating`, `npm run verify` green + commit-per-item, **never deploys** (agent-kit `AUTOMATION_LOOP.md` guardrail + repo deploy gate).

**Deploy order matters — do NOT ship the gate onto an empty, invisible room:**
1. **Highlight first** (coordinate with the `site-orientation` worktree: Home value-prop + trust strip + /track-record cross-links). Nobody pays for a feature they've never seen.
2. **Start the archive accruing** (Phase P3 below) so "full history" is worth unlocking (today: 26 notes, 60d TTL → without the archive the "more" caps at 60 days).
3. **Then** flip the gate on (env var + code deploy + frontend). Membership-copy change lands with it (operator sign-off).

## 6. WORKING_QUEUE

> **STATUS 2026-07-07: P0–P5 ALL DEPLOYED TO PROD** (merged to main `f3e0f4d` + docs `d5314b3`). Prod-verified: anon `country_history` 1/6 `gated:true` (51 snapshots uncapped), `corrections_feed` 5/26 `gated:true`, `follow_country`→`sign_in_required`, single ACAO. IAM `ReadTier` (GetItem on `GlobalPerspectiveUserTable`) added to `newsRecommend-ddb` — required, `getTier` is fail-closed. **Drift email cron `TriggerDriftEmailSend` created DISABLED** (sender is `DRY_RUN=false` = live; send-to-self smoke test before enabling; 0 drift subscribers today). Archive accrues from the corrector's next 07:20 UTC run. Remaining: member-side browser test (1 member account) + P6 below.

- [x] **P0** Rewrite this plan (redirect to depth-gating).
- [x] **P1** Backend: `resolveTier` + `capForTier` (+ `node --test`) → cap `country_history` driftNotes & `corrections_feed` for non-members; `USERS_DDB_TABLE` env set on `newsSensitiveData-dev`. **DEPLOYED + prod-verified 2026-07-07.**
- [x] **P2** Frontend: lock affordance on CountryPage history chain + /track-record ledger (honest count + Join link). **DEPLOYED 2026-07-07** (bundle `index-DRIay5Lv.js`).
- [x] **P3** Foundation: `newsDriftCorrector` now writes a permanent `DRIFTLOG#{date}` row (no TTL) alongside the 60d `DRIFT#{date}` (idempotent, both country + thread). `country_history` unions archive+live (`dedupeByAsOf`) so members get the full accruing history; empty archive ⇒ no-op (band unaffected). `node --test` 9/9. **⚠️ DEPLOY:** redeploy `newsDriftCorrector` (+ `newsSensitiveData` from P1) — the archive starts accruing on its next cron (~07:20 UTC). Optional one-time backfill: copy existing `DRIFT#`→`DRIFTLOG#` so the current 26 notes survive past their TTL (else pre-deploy history caps at 60d). `begins_with('DRIFT#')` does NOT match `DRIFTLOG#` (verified) — no double-count in the ledger.
- [x] **P4** Membership-promise copy repositioned across **6 user-facing spots** — `MembershipPage` (hero sub + `BENEFITS` list), `Disclosures`, `PrivacyTerms`, `TrackRecordPage` (support blurb — same page as the gated ledger), `WhitepaperPage`, `Account` membership panel. Old *"membership buys compute, **not access**"* → new *"reading stays free (every analysis + the latest correction); membership adds the **depth** — full correction history, change-alerts, Studio compute."* It's a **soft** reversal (reading genuinely stays free; only history-depth + alerts gate), phrased precisely on the legal pages. Grep-confirmed 0 survivors of the old line; verify green (0 errors, 192 tests, build ✓). ⚠️ **Operator: review the new wording before it deploys** — it's a public positioning change (you can still edit any of the 6 strings).
- [x] **P5** Drift-alert email — "notify me when a country's read changes" — the perk analysts actually pay for. **FULLY BUILT (backend + frontend), verify-green, NOT deployed:**
  - **P5a storage/actions (`newsRecommend`):** `followedCountries` (DynamoDB String Set, atomic ADD/DELETE) + `driftOptIn` on the existing `GlobalPerspectiveUserPrefs` row. New actions `follow_country`/`unfollow_country` — signed-in **AND member-tier** (fail-closed `getTier` read of `GlobalPerspectiveUserTable`; `403 members_only` otherwise). `get_prefs`/`set_prefs` extended (drift + follows); `handleUnsubscribe` gains `kind='drift'`. Following auto-opts-in + stamps consent/token/email → a complete sendable subscription.
  - **P5b sender (`newsEmailSender`):** new `mode:'drift_alert'` → `runDrift` scans fresh not-yet-emailed `DRIFT#` **country** notes (mirrors `runBreaking`: `attribute_not_exists(emailedAt)` + freshness window), groups by country, emails each country's followers (`driftOptIn` + `followedCountries.has(country)`), stamps `emailedAt` once. New `renderDriftEmail.js` (self-tested). `kind='drift'` unsub. Safe: `DRY_RUN` default on; `TEST_RECIPIENT` send-to-self.
  - **⚠️ DEPLOY (gated):** (1) redeploy `newsRecommend` with `USERS_DDB_TABLE=GlobalPerspectiveUserTable` env + **verify its role can `dynamodb:GetItem` that table** (fail-closed gate needs it); (2) redeploy `newsEmailSender` — **`renderDriftEmail.js` MUST be in the zip**; (3) new EventBridge cron `TriggerDriftEmailSend` invoking `{mode:'drift_alert'}` shortly after the corrector's 07:20 UTC run (create DISABLED; enable at go-live like the breaking rule). Optional `DRIFT_FRESH_HOURS` (default 36).
  - **P5d frontend (BUILT):** `restProxy` `followCountry`/`unfollowCountry` (authed) + `usePreferences` exposes `followedCountries`/`driftOptIn`/`follow`/`isFollowing` (optimistic, revert-on-error). New `FollowButton` (member-only 🔔 toggle; non-members/anon → subtle locked `/membership` CTA; renders nothing if prefs/billing unconfigured) placed in the CountryPage header actions next to Save. `/account?tab=notifications` gains a "Country change-alerts" list — followed countries with Unfollow + a "Pause all" master toggle (keeps the list, mutes email). Verify green (0 errors, 192 tests, build ✓).
  - ~~NOT deployed~~ **DEPLOYED 2026-07-07** (all four Lambdas + frontend + IAM; cron DISABLED). Member-side 🔔 browser test still pending (needs the one member account).
- [ ] **P6** *(next)* Perk surfacing — mention the member perks on more pages, **contextually** (see §8).

## 7. P6 — perk surfacing plan (brainstormed 2026-07-07, not built)

**Problem:** discovery, not conversion. The perk is mentioned only where someone already *encounters* the gated thing (CountryPage, /track-record) + the purchase page. Traffic is low; if nobody reaches a gated moment, the funnel never starts.

**Principle (resolves the marketing-vs-trust tension):** mention the perk **only where its value is being demonstrated on screen** — "this thing you're looking at — members get its full version." Never a generic site-wide banner; the free receipts ARE the marketing, and over-nagging cheapens the accountability positioning.

**Ranked placements — DO (all one-liners):**
- **P6a — Home trust-strip corrections card** *(+ bugfix, partially edited uncommitted)*. **BUG:** the card computes "revised conclusions logged" as `notes.length`, which the new anon cap shrinks to 5 — Home now undersells the trust number (was 26). Fix = use the server's honest `total` from `useCorrectionsFeed` (count stays public; only note *contents* gate). Then add a one-line sub-hint on that card: *"members see every one + get change-alerts."* Highest-traffic page, perk's own number, contextual.
- **P6b — weekly-brief + breaking-alert email footers** *(highest leverage)*. The most engaged audience (already opted into email) hears nothing about change-alerts. Add one footer line to `renderWeeklyEmail.js` + the breaking `appendUnsub` footer: *"Members can follow countries and get alerted the moment our read changes."* Link `/membership`. Zero UI clutter; invisible to casual visitors. ⚠️ Touches the LIVE sender (`DRY_RUN=false`) — verify with a send-to-self before the next Sunday send.
- **P6c — /analyze (Analysis Studio) pitch**. It's already a membership funnel but pitches ONLY compute (the ~0-usage feature). Update its member-pitch copy to lead with history + alerts, aligning both funnels.

**Deferred / skipped:**
- **P6d (defer) — bell dropdown footer**: *"Want these in your inbox? Members get country change-alerts."* Good fit (people opening the bell want notifications), moderate effort — do after A–C prove out.
- **P6e (defer) — ThreadPage**: threads aren't followable + thread history isn't served — nothing to unlock; mentioning it would be noise. Revisit when thread follows exist.
- **SKIP — /weekly, /daily, /economy, Map**: no demonstrated value on screen there → pure nagging.

**Ship discipline:** same as the rest of the plan — worktree branch, verify-green, one commit per placement, deploy gated on explicit yes. P6b additionally needs the email smoke test.

## 8. Risks / honesty flags

- **Enforcement is soft by design.** The gated content is *depth of public analysis history*, not secrets — a determined API bypass sees old drift notes, which is low-stakes. That's acceptable for a convenience/depth tier (unlike the old draft, where bypass = free access to the whole paid product). The frontend affordance + backend cap together are proportionate.
- **SEO/discovery:** fully protected — every analysis page and all preview actions stay public and uncapped; only the drift *depth* caps. No redirect, no page behind a wall.
- **Don't gate before highlighting** (§5) — inverts the funnel.
- **Copy reversal** (§4) is a deliberate positioning change, operator-owned.
