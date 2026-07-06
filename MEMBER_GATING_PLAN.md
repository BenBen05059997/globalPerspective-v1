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

- [x] **P0** Rewrite this plan (redirect to depth-gating).
- [ ] **P1** Backend: `resolveTier` + `capForTier` (+ `node --test`) → cap `country_history` driftNotes & `corrections_feed` for non-members; `USERS_DDB_TABLE` env documented for deploy.
- [ ] **P2** Frontend: lock affordance on CountryPage history chain + /track-record ledger (honest count + Join link).
- [ ] **P3** *(next)* Foundation: `newsDriftCorrector` also writes a permanent `DRIFTLOG#{date}` row (no TTL) so history accrues past 60d; a member-only per-country drift timeline serve reads it.
- [ ] **P4** *(next)* Membership-promise copy update across `/membership` + the 4 legal/marketing pages — **operator sign-off.**
- [ ] **P5** *(later)* Drift-alert email — "notify me when a country's read changes" — via `newsEmailSender` (send infra exists) + a subscribe opt-in + a trigger. The perk analysts actually pay for.

## 7. Risks / honesty flags

- **Enforcement is soft by design.** The gated content is *depth of public analysis history*, not secrets — a determined API bypass sees old drift notes, which is low-stakes. That's acceptable for a convenience/depth tier (unlike the old draft, where bypass = free access to the whole paid product). The frontend affordance + backend cap together are proportionate.
- **SEO/discovery:** fully protected — every analysis page and all preview actions stay public and uncapped; only the drift *depth* caps. No redirect, no page behind a wall.
- **Don't gate before highlighting** (§5) — inverts the funnel.
- **Copy reversal** (§4) is a deliberate positioning change, operator-owned.
