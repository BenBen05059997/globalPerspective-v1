# Polar Billing — Plan & Open Decisions

**Status:** DISCUSSION / not started. Created 2026-06-10.
**Goal:** Reintroduce paid subscriptions using **Polar.sh** (Merchant of Record), reversing the 2026-05-26 billing deprecation.

> ⚠️ This reverses a deliberate teardown. Subscriptions/tier-gating were removed on 2026-05-26 (site went fully public). The old `newsStripeWebhook` (Paddle) source still exists in-repo for reference, but the proxy tier-gates and `resolveUserTier()` were deleted. This is a **rebuild**, not a reconnect. See [[project-billing-deprecated]] in memory.

---

## Why Polar (decided)

- Plain Stripe / Paddle didn't work for us (payment availability in our country).
- Polar is a **Merchant of Record**: *Polar* charges the customer, so Stripe Payments availability in our country is irrelevant. We only need to be in a **Stripe Connect Express payout country** (~120 countries) to get paid out.
- Polar also assumes **international sales-tax / VAT liability** — it collects & remits consumption tax from customers, not us.
- Clean REST API + webhooks (`subscription.created/updated/canceled`, `order.created`) + hosted checkout + hosted customer portal → maps onto the old Paddle-webhook architecture.
- **Fees (verified 2026-06-10):** Starter (free) 5% + 50¢; Pro $20/mo → 3.8% + 40¢; Growth $100/mo → 3.6%; Scale $400/mo → 3.4%. +1.5% international cards, $15/chargeback. (Orgs created before 2026-05-27 keep a 4%+40¢ "Early Member" rate unless they upgrade.)

---

## Polar account — resources & IDs (live; update as we go)

**Account (set during onboarding 2026-06-12):** type **Individual** (sole proprietor); payout country **Japan** (payout currency JPY); default **charge** currency **USD**. Org slug: `global-perspective-net` *(confirm final)*.

**Product — "Global Perspectives Membership"** ($15/mo + $150/yr, USD, recurring). Created as a **DRAFT — do NOT enable live selling until the Phase-1 access-gating is built** (today all content is public, so a subscriber would be paying for what's free).
| Plan | Product ID |
|------|-----------|
| Monthly ($15) | `e53eeb9a-4e2e-4b33-9c18-f0e779c07677` |
| Yearly ($150) | `cd375325-0fd2-4223-8b10-8e02d50798fd` |

> ✅ **Environment: PRODUCTION** (confirmed 2026-06-12 — no Sandbox toggle/badge in the dashboard). The IDs above are **live Production** product IDs. For the build we'll still spin up matching **Sandbox** products to test against (Polar test cards), then point the live config at these Production IDs at launch.

**Still needed for the build — you generate, secrets go straight into the Lambda env vars (NOT this file):** Organization Access Token + Webhook signing secret. (Product IDs above are public checkout identifiers — safe in-repo; tokens/secrets are not.)

---

## Build status — Phase 1 (updated 2026-06-12)

**Code BUILT (not deployed/live yet):**
- ✅ **`newsPolarBilling` Lambda** (`amplify/backend/function/newsPolarBilling/`) — one Function URL, three jobs: Polar **webhook** (Standard-Webhooks signature verify → grant/revoke `tier=member` in `USERS_TABLE`), **`create_checkout`** (Firebase-JWT → Polar Checkout Session with `customer_external_id=uid` → `{url}`), **`get_membership`** (Firebase-JWT read). Deploy + Polar-config steps in its `README.md`.
- ✅ **Frontend** — `restProxy.js` (`createCheckout`/`fetchMembership`/`billingConfigured`), `hooks/useMembership.js`, `components/MembershipPage.jsx` (+css) at route **`/membership`** ($15/mo + $150/yr cards, current-status, honest "not available yet" state until `window.POLAR_BILLING_ENDPOINT` is set). No nav link yet (route is hidden until go-live).

**✅ DEPLOYED to AWS 2026-06-16** — `newsPolarBilling` is live:
- Role `newsPolarBilling-role` (CloudWatch logs + GetItem/UpdateItem on `GlobalPerspectiveUserTable` only). Runtime nodejs20.x, 256MB/15s.
- Env set: `POLAR_ACCESS_TOKEN` (verified against Polar; **rotate — it was pasted in chat**), `POLAR_PRODUCT_MONTHLY`/`_YEARLY`, `POLAR_API_BASE=https://api.polar.sh`, `USERS_DDB_TABLE=GlobalPerspectiveUserTable`, `FIREBASE_PROJECT_ID=globalperpectives`, `SITE_URL`.
- **Function URL:** `https://zlf6j2yfk6jxtnctlyfgyl26uy0shwyx.lambda-url.ap-northeast-1.on.aws/` (auth NONE + CORS). Smoke-tested: no-auth→401, unknown-action→400. Products confirmed live ($15/mo `e53eeb9a…`, $150/yr `cd375325…`).

**✅ DECISION #3 RESOLVED + member side DEPLOYED 2026-06-16** — reading stays **100% free** (no `newsSensitiveData` gating). The **membership = the Analysis Studio on our compute** (no BYOK). New **`newsAnalyze` Lambda** is live:
- Role `newsAnalyze-role` (logs + GetItem/UpdateItem on `GlobalPerspectiveUserTable`). nodejs20.x, 256MB/30s.
- Member-gated (Firebase JWT → require `tier=member`), server-pinned honesty prompt, daily fair-use cap (`ANALYZE_DAILY_CAP=50`), runs on **our DeepSeek** (key copied from `newsCountryIntelligence`, never exposed). Smoke-tested no-auth→401.
- **Function URL:** `https://cahpz2r7c2fins4vsi5udzsdxm0rjxir.lambda-url.ap-northeast-1.on.aws/`
- Frontend: `AnalysisStudio.jsx` now routes members → server path ("Member · included", no key); free registered users keep BYOK + a "Run it on us with a membership →" nudge. Deep-research stays BYOK (needs web search).

**Remaining (the go-live checklist):**
1. ✅ **DONE 2026-06-22** — Polar webhook created via API (id `d158b5a9-09cc-4245-b364-453b879c41e7`, → billing Function URL, Raw, 6 events `subscription.*`+`order.paid`); its signing secret captured + set as `POLAR_WEBHOOK_SECRET` on `newsPolarBilling` (config update Successful). Token now also carries `webhooks:write` — **still the same value that leaked in chat; rotate it.** Backend now fully wired (checkout + webhook→`tier=member` + membership read).
2. ✅ **DONE 2026-06-22** — `docs/config.js` now sets `POLAR_BILLING_ENDPOINT` + `NEWS_ANALYZE_ENDPOINT`.
3. ✅ **DONE 2026-06-22** — frontend built + deployed (commit `8f15055`): `/membership` page + member Studio run-path live (members → "Member · included" no-key; free users → BYOK + upgrade nudge).
4. ✅ **MACHINE-TESTED 2026-06-22** (commit history a69aa8b…0d61f13). Verified against LIVE Polar + AWS by simulating signed events + a real checkout-create:
   - webhook `subscription.created`→`tier=member`, `subscription.canceled`→`tier=free`, forged-signature→`401` (rejected). Test record cleaned up.
   - `POST /v1/checkouts/` → real $15 USD checkout URL with `customer_external_id` linked. (Fixed Lambda to canonical trailing-slash URL.)
   - **NOT yet verified (needs a human / real Firebase JWT):** the browser click-through (sign-in → `/membership` → Polar hosted checkout → return) and a real member running `newsAnalyze`.

**Operator must do, to fully launch:**
- **A) One real 100%-off run** — create a 100%-off discount in Polar → `globalperspective.net/membership` → subscribe → open `/analyze` → confirm "Member · included" + a no-key run works.
- **B) KYC review** must clear before real (non-$0) payouts.
- **C) Add a `/membership` nav link** (page is live but unlinked).
- **D) Rotate the access token** (still the chat-exposed value; now also has `webhooks:write`). Regenerate → I swap it onto the Lambda.
- E) (Later) "Manage subscription" → Polar customer portal link.

**Live endpoints (recorded):** billing `https://zlf6j2yfk6jxtnctlyfgyl26uy0shwyx.lambda-url.ap-northeast-1.on.aws/` · analyze `https://cahpz2r7c2fins4vsi5udzsdxm0rjxir.lambda-url.ap-northeast-1.on.aws/` · webhook id `d158b5a9-09cc-4245-b364-453b879c41e7`.

---

## OPEN DECISIONS (we work through these one by one)

### 1. Payout country & tax registration  ← **CURRENT**
- **Decision:** Japan (user files in both JP and CA; primary work is in Japan).
- Both CA and JP are Connect Express countries, so either works technically.
- **Open sub-items:** which JP government filings/registrations are required (see "Tax & Compliance" below); confirm with a 税理士.

### 2. Charging model  ✅ DECIDED 2026-06-10
- **Subscription → full read access.** All pre-generated intelligence (archive, thread + country intelligence, economic disruption, daily brief, systems graphs) unlimited, no meter on reading. (Credits-to-read rejected: served analysis is pre-generated & cached in DDB ≈ zero marginal cost, and metering reading kills daily-habit engagement.)
- **Credits → "analyze it yourself."** The user points our engine at **our data** and runs their **own** custom analysis (e.g. "compare JP vs KR semiconductor exposure over 30 days", "scenario tree if X happens", "turn this thread into a one-page brief"). Each run = a real LLM call over our corpus → a credit maps to actual compute cost (honest metering).
- **Deposit fits here:** subscription includes a monthly credit allowance; users can top up (buy more credit packs) to go deeper. Satisfies the "deposit + subscription" instinct.
- Turns a passive reader into an active analyst — a real differentiator.

### 3. Free-vs-paid line (gating boundary)
- What stays public (SEO + early-access habit) vs. what goes behind the wall.
- Candidate paid surfaces: archive depth, thread intelligence, country intelligence, economic disruption, daily brief, systems analysis, track record.
- Candidate always-free: today's topics, map, SEO previews (`country_preview`/`thread_preview`), RSS.
- **Status:** to decide. Note honesty constraint — keep enough public for SEO/bots.

### 4. Pricing & tiers
- How many tiers, monthly price points, currency display (JPY/USD), trial?
- **Status:** to decide.

### 5. Credit mechanics — the "Custom Analysis" feature  ✅ DECIDED + BUILT 2026-06-30 (not deployed)

**Decisions locked with the operator 2026-06-30:**
- **Relationship to subscription:** *subscription + credit top-ups beyond cap.* A member gets a **monthly allowance** (`MEMBER_MONTHLY_ALLOWANCE`, env on `newsAnalyze`) of free runs; once exhausted they spend purchased credits.
- **Who can buy/use credits:** *anyone signed in.* A non-member can buy credit packs and run pay-as-you-go — `newsAnalyze` no longer hard-gates on `tier=member`; it gates on allowance-or-credit-or-`402`.
- **Granularity:** *flat — 1 credit = 1 run* (guided / free-form / deep all cost the same; deep still requires BYOK because it needs web search).

**Built (code only — `npm run verify` green; NOT deployed):**
- `newsAnalyze` — new `consume()`: member allowance (monthly `analyzeMonth`/`analyzeCount`) → atomic conditional credit decrement (`ADD creditBalance -1` if `>= 1`) → `402 out_of_credits`. Refunds the credit if the LLM call fails after charging.
- `newsPolarBilling` — `create_checkout` `kind:'credits'`+`pack` → one-time Polar product; webhook `order.paid` routes credit-pack orders to an **idempotent** `grantCredits` (`processedOrders` string-set dedupe) vs subscription orders to `tier=member`; `get_membership` returns `creditBalance`. Credit amounts are server-authoritative via env `POLAR_CREDIT_PACKS` = JSON `{ "<packKey>": { "productId": "...", "credits": N } }`.
- Frontend — `MembershipPage` "Analysis credits" section (balance + buy cards, honest "coming soon" until `window.POLAR_CREDIT_PACKS` set); `AnalysisStudio` opens the our-compute path to members AND credit-holders; `restProxy.createCreditCheckout`/`creditPacks`; `useMembership.creditBalance`. **Balance + plan surfaced 2026-06-30:** a header credits pill + an Account → Membership tab.
- Local logic tests — pure helpers extracted to `src/lib.js` in both functions; `node --test` suites (`npm test`): 13 tests covering the webhook signature, order→credits routing, pack parsing, and the allowance-vs-credit decision.

**✅ SANDBOX-VERIFIED 2026-06-30 (Polar sandbox + real DynamoDB):**
- Isolated twins `newsPolarBilling-sandbox` / `newsAnalyze-sandbox` deployed via `amplify/backend/function/_sandbox/deploy-sandbox.sh` (reuse prod roles, `POLAR_API_BASE=https://sandbox-api.polar.sh`, `MEMBER_MONTHLY_ALLOWANCE=2`). 5 sandbox products created (monthly/yearly + 50/200/500-credit packs).
- Signed-`order.paid` webhook test: grant → **50**; replay same order → **stays 50** (idempotent); 2nd pack → **250**; `subscription.created` → `tier=member`, credits **unchanged** (routing correct). Test row cleaned up.
- Frontend exercised against sandbox via the gitignored `frontend/public/config.js` (sandbox endpoints + `window.POLAR_CREDIT_PACKS`).
- **BUG FOUND + FIXED — dual CORS → "Failed to fetch":** the Lambda code sets CORS *and* the Function URL had its own CORS config → duplicate `Access-Control-Allow-Origin` header → browser checkout failed (server-side curl didn't catch it). Fixed by clearing the Function-URL CORS (code owns CORS) on **both sandbox and the two prod functions**; the deploy script no longer sets `--cors`. Recorded in `ARCHITECTURE.md` Common Mistakes #7.
- **Not yet browser-confirmed:** the live credit *spend* + `402` (needs a signed-in checkout with a Polar test card — operator step).

**Operator go-live steps for credits (still open — you do these):**
0. **Deploy the new code to PROD** — prod `newsAnalyze`/`newsPolarBilling` still run the **pre-credits** code; the credit logic only exists in the sandbox twins + the repo. Zip `src/` (must include the new `lib.js`) and `aws lambda update-function-code` both.
1. Create **one-time** credit-pack products in Polar (pick sizes + prices). Record each product ID.
2. Set `POLAR_CREDIT_PACKS` env on `newsPolarBilling` (the `{packKey:{productId,credits}}` map) and `MEMBER_MONTHLY_ALLOWANCE` on `newsAnalyze` (the X free runs/month — pick the number).
3. Add `window.POLAR_CREDIT_PACKS = [{ key, credits, price }]` to `docs/config.js` (operator-owned) so the buy-UI renders. The `key`s must match the env map.
4. Deploy both Lambdas. Verify a credit-pack checkout → webhook → balance increment, and a non-member run spending a credit.

> **Original open sub-items (now resolved by the decisions above):**

- **Granularity (open):** flat 1 credit = 1 analysis (Claude's lean — simple/predictable) vs. scaled by depth (quick summary 1 / full report 3).
- **Allowance vs. deposit (open):** subscription includes *N* analyses/month; extras via top-up credit packs. (How many/month?)
- **Free taste (open):** give logged-in free users ~1–2 free analyses as a conversion hook? (Claude's lean: yes.) — **still open** (currently a non-member starts at 0 credits; the conversion hook would be a small starting grant).

For reference, the original spec lived in [`ANALYSIS_STUDIO_PLAN.md`](./ANALYSIS_STUDIO_PLAN.md).
> **Resequenced 2026-06-10:** we are building the analysis feature (`/analyze`, "Analysis Studio") **FIRST, free-but-capped**, before billing — you can't sell per-run credits for a feature that isn't built/proven. Full design (both input modes + guardrails + lenses) lives in **[`ANALYSIS_STUDIO_PLAN.md`](./ANALYSIS_STUDIO_PLAN.md)**. Credits attach later: the free daily cap simply becomes a credit balance. Granularity/allowance/pricing stay parked until the feature has usage data.

The single credit-consuming action: a **user-initiated custom analysis over our data**. New backend path (working name `newsAnalyze` / "Analysis Studio").
- **Granularity (open):** flat 1 credit = 1 analysis (Claude's lean — simple/predictable) vs. scaled by depth (quick summary 1 / full report 3).
- **Allowance vs. deposit (open):** subscription includes *N* analyses/month; extras via top-up credit packs. (How many/month?)
- **Free taste (open):** give logged-in free users ~1–2 free analyses as a conversion hook? (Claude's lean: yes.)
- **Cost guardrails (non-negotiable):** cap tokens per run so one analysis can't blow the budget; price a credit **above** the LLM cost so it's never a loss; per-user rate/abuse caps; atomic credit decrement (conditional `UpdateItem` on `USERS_TABLE`).
- **Honesty (non-negotiable):** user-generated reports must cite real records from our corpus and return "insufficient data" rather than hallucinate — otherwise self-serve becomes a misinformation vector ([[feedback-no-misinformation-fallback]]).
- **Tech sketch:** `newsAnalyze` Lambda (Function URL, JWT-gated) → checks credit balance → pulls relevant DDB records (archive / thread / country / economic) for the user's query → LLM call (capped) → returns cited report → decrements credit. Mirrors existing generation Lambdas; reuses the DeepSeek/Gemini plumbing.

---

## Integration Plan (technical sketch)

1. **Polar setup** — create org; define products (subscription tier(s); optional credit packs as one-time products).
2. **`newsPolarWebhook` Lambda** (new, Function URL — the slot the deleted `newsStripeWebhook` occupied). Verifies Polar webhook signature; handles `subscription.created/updated/canceled` + `order.created`; writes `tier` (+ `creditBalance` if credits) to `USERS_TABLE` keyed by Firebase `uid`.
3. **uid ↔ Polar customer link (critical glue)** — pass Firebase `uid` as Polar `customer_external_id`/metadata at checkout so the webhook knows whose record to update.
4. **Checkout** — frontend opens Polar overlay/hosted checkout with uid attached.
5. **Re-gate `newsSensitiveData`** — reintroduce `resolveUserTier()` + per-action tier checks on the gated actions (per decision #3).
6. **Credit ledger** (only if #2 includes credits) — `creditBalance` + transactions on the user record; decrement on credit-consuming generation; webhook tops up on renewal/pack purchase.
7. **Frontend** — rebuild Account billing tab, subscribe button, credit balance (if any), upgrade prompts on gated content. Link to Polar's **hosted customer portal** (replaces old Paddle portal — less to build).

---

## Tax & Compliance notes (research 2026-06-10 — NOT tax advice; confirm with a 税理士 / CPA)

**Key MoR simplification:** Because Polar is the Merchant of Record, **Polar collects & remits consumption tax/VAT from end customers**. We do *not* register to collect sales tax from buyers. What we receive is a **payout (business income)** from Polar, which we report as income.

### Japan (chosen)
- **開業届 (kaigyō todoke)** — "Notification of Opening of a Sole Proprietorship" (個人事業の開業・廃業等届出書). File at the local tax office **within ~1 month** of starting the business. Usually filed together with the **青色申告承認申請書 (blue-return application)** to unlock the up-to-¥650,000 income deduction.
- **確定申告 (kakutei shinkoku)** — annual income tax return, **Feb 16 – Mar 15**, reporting worldwide income. Sole-proprietor filing generally required once business income exceeds the ¥480,000 basic deduction; the ¥200,000 "side income" rule applies if otherwise employed.
- **Consumption Tax (JCT)** — only mandatory once **taxable sales exceed ¥10,000,000** in the base period (≈2 fiscal years prior). Below that you're a **免税事業者** (tax-exempt) and don't deal with JCT. With Polar as MoR, customer-side consumption tax is Polar's responsibility anyway. (2026 reform mainly affects *nonresident* sellers/platforms — relevant to Polar, not to us directly.)
- **Large cross-border receipts** — banks file a 国外送金等調書 for big transfers; a separate self-report applies to very large (¥30M+) direct dealings with non-residents. Polar payouts via bank are normally below the self-report trigger, but confirm with an accountant if volume grows.

### Canada (fallback, if ever switched)
- **Business Number (BN)** via CRA Business Registration Online; register the sole proprietorship (province-dependent).
- **GST/HST small-supplier rule** — under **CAD $30,000** taxable supplies over 4 rolling quarters → *not* required to register/collect. Above → register within 29 days. With Polar as MoR, buyer-side sales tax is Polar's job regardless.
- **Income** — report self-employment income on the **T1 / T2125**.

**Sources:**
- Japan freelancer/sole-proprietor taxes: https://resources.realestate.co.jp/living/guide-to-taxes-in-japan-for-freelancers-and-sole-proprietors/ , https://mailmate.jp/blog/how-to-freelance-in-japan-as-a-foreigner
- Japan JCT threshold + 2026 reform: https://mailmate.jp/blog/japan-consumption-tax-guide , https://www.bdo.global/en-gb/insights/tax/indirect-tax/japan-2026-tax-reform-includes-jct-changes-that-affect-nonresident-sellers
- Polar supported countries: https://polar.sh/docs/merchant-of-record/supported-countries
- Polar pricing: https://polar.sh/resources/pricing
- Canada GST/HST small supplier: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html

---

## Risks / honesty flags
- Reviving a deliberately-deleted enforcement path — don't half-gate (a leaky gate is worse than none).
- Keep enough content public for SEO/bot pre-rendering (Cloudflare Worker previews) or organic discovery suffers.
- No fabricated "all clear" / fallback billing UI — honesty contract still applies ([[feedback-no-misinformation-fallback]]).
- Tax specifics above are researched, **not** professional advice — verify with a 税理士 before filing.
